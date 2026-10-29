import { Schema, model, Model } from 'mongoose';
import { z } from 'zod';
import { IdentityClient } from '../../clients/identityClient';
import { ObjectStorage } from '../files/storage';
import { EventProducer } from './events.service';
import { DomainEvent } from './events.schema';
import { withUserTransaction } from '../../utils/userTransaction';
import { DeletedUser } from './events.model';
import { JournalEntry, MoodLog } from '../journal/journal.model';
import { Conversation, CompanionMessage } from '../companion/companion.model';
import { FileMetadata } from '../files/files.model';
import { CrisisEvent } from '../safety/safety.model';
import {
  Post,
  Comment,
  ChatMessage,
  Reaction,
  UserRestriction,
  PendingReport,
} from '../community/community.model';
import { ChatRate } from '../chat/chat.socket';
export const ExportRecord = model(
  'ExportRecord',
  new Schema(
    { _id: String, userId: String, objectKey: String },
    { collection: 'export_records' },
  ),
);
export const DeletionJob = model(
  'DeletionJob',
  new Schema(
    {
      _id: String,
      userId: String,
      eventId: String,
      occurredAt: String,
      prefixes: [String],
      readyAt: Date,
    },
    { collection: 'deletion_jobs' },
  ),
);
const privateModels: Model<any>[] = [
  JournalEntry,
  MoodLog,
  Conversation,
  CompanionMessage,
  CrisisEvent,
  FileMetadata,
  Reaction,
  UserRestriction,
  PendingReport,
  ChatRate,
];
export interface CommunityRealtime {
  evict(userId: string, circleId?: string): void;
  removed(circleId: string, id: string): void;
  aliasChanged(userId: string, alias: string): void;
}
export class Phase5Handler {
  constructor(
    private identity: IdentityClient,
    private storage: ObjectStorage,
    private producer: EventProducer,
    private chat: CommunityRealtime,
    private deleted: (user: string) => void = () => {},
    private now: () => Date = () => new Date(),
  ) {}
  async handle(event: DomainEvent): Promise<boolean> {
    const type = event.type[0].toUpperCase() + event.type.slice(1),
      p = event.payload;
    if (
      ![
        'RestrictionChanged',
        'AliasChanged',
        'ContentRemovalRequested',
        'ModerationActionCreated',
        'UserDeletionRequested',
        'DataExportRequested',
        'ConsentChanged',
      ].includes(type)
    )
      return false;
    if (
      type === 'ContentRemovalRequested' ||
      (type === 'ModerationActionCreated' && p.action === 'REMOVE_CONTENT')
    ) {
      const id = z
        .string()
        .regex(/^[a-f0-9]{24}$/i)
        .parse(p.contentId);
      const circleId = z.string().uuid().parse(p.circleId);
      for (const m of [Post, Comment, ChatMessage] as Model<any>[]) {
        const doc = await m.findOneAndUpdate(
          { _id: id, circleId },
          { $set: { status: 'REMOVED', text: '[removed]' } },
        );
        if (doc && m === Post)
          await Comment.updateMany(
            { postId: id },
            { $set: { status: 'REMOVED', text: '[removed]' } },
          );
        if (doc && m === ChatMessage) this.chat.removed(circleId, id);
      }
      await Reaction.deleteMany({ targetId: id });
      return true;
    }
    const userId = z.string().min(1).parse(p.userId);
    this.identity.invalidate(userId);
    if (type === 'ConsentChanged') {
      // Consent disables generation and visibility; account deletion removes history.
      return false; // Existing Phase 4 handler clears companion summaries.
    }
    if (type === 'UserDeletionRequested') {
      await this.deleteUser(userId, event);
      return true;
    }
    if (type === 'DataExportRequested') {
      await this.exportUser(userId, event);
      return true;
    }
    if (await DeletedUser.exists({ _id: userId })) return true;
    if (type === 'AliasChanged') {
      const alias = z.string().min(1).max(40).parse(p.alias);
      await withUserTransaction(userId, async (session) => {
        for (const m of [Post, Comment, ChatMessage] as Model<any>[])
          await m.updateMany(
            { userId },
            { $set: { authorAlias: alias } },
            { session },
          );
      });
      this.chat.aliasChanged(userId, alias);
      return true;
    }
    const circleId = z.string().uuid().parse(p.circleId);
    const occurredAt = new Date(event.occurredAt);
    await withUserTransaction(userId, async (session) => {
      const current = await UserRestriction.findOne({
        userId,
        circleId,
      }).session(session);
      if (current?.occurredAt && current.occurredAt > occurredAt) return;
      let values: Record<string, unknown> = { occurredAt };
      if (type === 'RestrictionChanged') {
        values = {
          ...values,
          mutedUntil: null,
          bannedUntil: null,
          ...z
            .object({
              muted: z.boolean(),
              banned: z.boolean(),
              mutedUntil: z.string().datetime().nullable().optional(),
              bannedUntil: z.string().datetime().nullable().optional(),
            })
            .parse(p),
        };
      } else if (p.action === 'MUTE')
        values = {
          ...values,
          muted: true,
          mutedUntil: z.string().datetime().parse(p.until),
        };
      else if (p.action === 'BAN')
        values = {
          ...values,
          banned: true,
          bannedUntil: z.string().datetime().parse(p.until),
        };
      else if (p.action === 'UNBAN')
        values = { ...values, banned: false, bannedUntil: null };
      await UserRestriction.updateOne(
        { userId, circleId },
        { $set: values },
        { session, upsert: true },
      );
    });
    this.chat.evict(userId, circleId);
    return true;
  }
  private async exportUser(userId: string, event: DomainEvent) {
    const requestId = z.string().uuid().parse(event.payload.requestId);
    if (await DeletedUser.exists({ _id: userId })) return;
    const key = `exports/${requestId}/data.json`;
    if (!this.identity.exportData)
      throw new Error('Identity export client unavailable');
    await withUserTransaction(userId, async (session) => {
      await ExportRecord.updateOne(
        { _id: requestId },
        { $setOnInsert: { userId, objectKey: key } },
        { upsert: true, session },
      );
    });
    const identity = await this.identity.exportData(userId);
    await withUserTransaction(userId, async (session) => {
      const data: Record<string, unknown> = { identity };
      for (const m of [
        ...privateModels,
        Post,
        Comment,
        ChatMessage,
      ] as Model<any>[]) {
        if ([UserRestriction, PendingReport, ChatRate].includes(m as any))
          continue;
        data[m.collection.collectionName] = await m
          .find({ userId })
          .select('-__v -lease -leaseUntil -jobId -jobPublished -dedupeKey')
          .session(session)
          .lean();
      }
      // Deterministic key makes transaction retries safe. User lock serializes deletion against upload.
      await this.storage.putJson(key, data);
      await ExportRecord.updateOne(
        { _id: requestId },
        { $set: { userId, objectKey: key } },
        { upsert: true, session },
      );
    });
    if (!(await DeletedUser.exists({ _id: userId })))
      await this.producer.publish('content-events', userId, {
        ...event,
        type: 'DataExportCompleted',
        payload: { userId, requestId, objectKey: key },
      });
  }
  private async deleteUser(userId: string, event: DomainEvent) {
    const requestId = z.string().uuid().parse(event.payload.requestId);
    await withUserTransaction(
      userId,
      async (session) => {
        if (!(await DeletionJob.exists({ _id: requestId }).session(session))) {
          const exportRecords = await ExportRecord.find({ userId }).session(
            session,
          );
          const lastUpload = await FileMetadata.findOne({ userId })
            .sort({ uploadExpiresAt: -1 })
            .session(session);
          // Allow all already-issued five-minute upload URLs (including identity avatars) to expire before final purge.
          const readyAt = new Date(
            Math.max(
              this.now().getTime() + 300000,
              lastUpload?.uploadExpiresAt?.getTime() ?? 0,
            ),
          );
          await DeletionJob.create(
            [
              {
                _id: requestId,
                userId,
                eventId: event.id,
                occurredAt: event.occurredAt,
                readyAt,
                prefixes: [
                  `users/${encodeURIComponent(userId)}/`,
                  `avatars/${userId}/`,
                  ...exportRecords.map((e) => `exports/${e._id}/`),
                ],
              },
            ],
            { session },
          );
        }
        await DeletedUser.updateOne(
          { _id: userId },
          { $setOnInsert: { _id: userId } },
          { upsert: true, session },
        );
        for (const m of privateModels)
          await m.deleteMany({ userId }, { session });
        await ExportRecord.deleteMany({ userId }, { session });
        for (const m of [Post, Comment, ChatMessage] as Model<any>[])
          await m.updateMany(
            { userId },
            {
              $set: {
                userId: null,
                authorAlias: 'Deleted member',
                text: '[deleted]',
              },
            },
            { session },
          );
      },
      true,
    );
    this.chat.evict(userId);
    this.deleted(userId);
    // Wipe existing objects immediately; a second purge after upload expiry prevents recreation via old URLs.
    const job = await DeletionJob.findById(requestId);
    for (const prefix of job!.prefixes) await this.storage.deletePrefix(prefix);
  }
  async cleanupDue() {
    for (const job of await DeletionJob.find({
      readyAt: { $lte: this.now() },
    })) {
      for (const prefix of job.prefixes)
        await this.storage.deletePrefix(prefix);
      await this.producer.publish('content-events', job.userId!, {
        id: job.eventId!,
        type: 'UserDeletionCompleted',
        version: 1,
        occurredAt: job.occurredAt!,
        payload: { userId: job.userId, requestId: job._id },
      });
      await DeletionJob.deleteOne({ _id: job._id });
    }
  }
}
