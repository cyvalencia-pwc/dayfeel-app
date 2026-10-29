import { Model, Types } from 'mongoose';
import { z } from 'zod';
import { IdentityClient } from '../../clients/identityClient';
import { AiClient } from '../../clients/aiClient';
import { AppError } from '../../utils/errors';
import { withUserTransaction } from '../../utils/userTransaction';
import {
  Post,
  Comment,
  ChatMessage,
  Reaction,
  UserRestriction,
  PendingReport,
} from './community.model';
import { buildCrisisResponse } from '../safety/safety.controller';
import { DeletedUser } from '../events/events.model';
export const moderationSchema = z.object({
  verdict: z.enum(['OK', 'TOXIC', 'SPAM', 'SELF_HARM_RISK']),
});
export class CommunityService {
  constructor(
    private identity: IdentityClient,
    private ai: AiClient,
  ) {}
  async access(userId: string, circleId: string, write = true) {
    if (await DeletedUser.exists({ _id: userId }))
      throw new AppError(403, 'ACCOUNT_DELETED', 'Access denied');
    const cached = await UserRestriction.findOne({ userId, circleId }).lean();
    const banned =
      cached?.banned &&
      (!cached.bannedUntil || cached.bannedUntil > new Date());
    const muted =
      cached?.muted && (!cached.mutedUntil || cached.mutedUntil > new Date());
    const r = await this.identity.restrictions(circleId, userId);
    const membership = z
      .object({ active: z.boolean(), bannedUntil: z.string().nullable().optional(), mutedUntil: z.string().nullable().optional() })
      .parse(await this.identity.membership(circleId, userId));
    if (banned || r.banned || (write && (muted || r.muted))) {
      const dates = [
        ...(banned || r.banned ? [membership.bannedUntil, cached?.bannedUntil?.toISOString()] : []),
        ...(write && (muted || r.muted) ? [membership.mutedUntil, cached?.mutedUntil?.toISOString()] : []),
      ].filter((d): d is string => !!d && Number.isFinite(Date.parse(d)) && Date.parse(d) > Date.now());
      const until = dates.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
      throw new AppError(403, 'RESTRICTED', 'Your account is restricted in this circle.', until);
    }
    if (!r.member || !membership.active)
      throw new AppError(
        403,
        'NOT_MEMBER',
        'Active circle membership required',
      );
  }
  async alias(userId: string) {
    if (!this.identity.aliases)
      throw new AppError(
        503,
        'IDENTITY_UNAVAILABLE',
        'Alias service unavailable',
      );
    const alias = (await this.identity.aliases([userId]))[userId];
    if (!alias) throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'Access denied');
    return alias;
  }
  dto(doc: {
    _id: unknown;
    circleId: string;
    authorAlias: string;
    text: string;
    status: string;
    createdAt?: Date;
    postId?: unknown;
    userId?: string | null;
  }, viewerId?: string) {
    return {
      id: String(doc._id),
      circleId: doc.circleId,
      authorAlias: doc.authorAlias,
      text: doc.text,
      status: doc.status,
      own: !!viewerId && doc.userId === viewerId,
      createdAt: doc.createdAt,
      ...(doc.postId ? { postId: String(doc.postId) } : {}),
    };
  }
  async create(
    userId: string,
    circleId: string,
    text: string,
    token: string,
    kind: 'post' | 'comment' | 'chat' = 'post',
    postId?: string,
  ) {
    await this.access(userId, circleId);
    let verdict: z.infer<typeof moderationSchema>['verdict'];
    try {
      verdict = moderationSchema.parse(
        await this.ai.moderate({ text }, token),
      ).verdict;
    } catch {
      throw new AppError(
        503,
        'MODERATION_UNAVAILABLE',
        'Please try again later',
      );
    }
    const authorAlias = await this.alias(userId);
    await this.access(userId, circleId); // Recheck restrictions after the external moderation call.
    const doc = await withUserTransaction(userId, async (session) => {
      if (postId) {
        // Touch the parent to serialize comments against post removal.
        const parent = await Post.findOneAndUpdate(
          { _id: postId, circleId, status: 'VISIBLE' },
          { $set: { updatedAt: new Date() } },
          { session },
        );
        if (!parent) throw new AppError(404, 'NOT_FOUND', 'Post not found');
      }
      const model: Model<any> =
        kind === 'post' ? Post : kind === 'comment' ? Comment : ChatMessage;
      const [created] = await model.create(
        [
          {
            userId,
            authorAlias,
            circleId,
            text,
            postId,
            status:
              verdict === 'TOXIC' || verdict === 'SPAM' ? 'HELD' : 'VISIBLE',
          },
        ],
        { session },
      );
      if (verdict !== 'OK')
        await PendingReport.create(
          [
            {
              userId,
              circleId,
              contentId: String(created._id),
              reason:
                verdict === 'TOXIC'
                  ? 'HARASSMENT'
                  : verdict === 'SPAM'
                    ? 'SPAM'
                    : 'UNSAFE',
            },
          ],
          { session },
        );
      return created;
    });
    await this.flushReports().catch(() => {}); // Durable outbox retries on the server timer.
    const support =
      verdict === 'SELF_HARM_RISK'
        ? buildCrisisResponse(
            await this.identity.resources('GLOBAL').catch(() => []),
          )
        : null;
    return { content: this.dto(doc, userId), support };
  }
  async flushReports() {
    for (const report of await PendingReport.find()
      .sort({ _id: 1 })
      .limit(100)) {
      if (!this.identity.report) throw new Error('Report client unavailable');
      await this.identity.report({
        targetId: report.userId!,
        circleId: report.circleId!,
        contentId: report.contentId,
        reason: report.reason as 'HARASSMENT' | 'SPAM' | 'UNSAFE',
        source: 'AI',
      });
      await PendingReport.deleteOne({ _id: report._id });
    }
  }
  async getPost(userId: string, id: string) {
    const post = await Post.findById(id);
    if (
      !post ||
      post.status === 'REMOVED' ||
      (post.status === 'HELD' && post.userId !== userId)
    )
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    await this.access(userId, post.circleId, false);
    return post;
  }
  async posts(userId: string, circleId: string, cursor?: string, limit = 20) {
    await this.access(userId, circleId, false);
    const anchor = cursor ? await Post.findOne({ _id: cursor, circleId }).select('createdAt').lean() : null;
    if (cursor && !anchor) throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor');
    const docs = await Post.find({
      circleId,
      status: 'VISIBLE',
      ...(anchor ? { $or: [{ createdAt: { $lt: anchor.createdAt } }, { createdAt: anchor.createdAt, _id: { $lt: cursor } }] } : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);
    return {
      posts: docs.slice(0, limit).map((d) => this.dto(d, userId)),
      nextCursor: docs.length > limit ? docs[limit - 1].id : null,
    };
  }
  async comments(userId: string, postId: string, cursor?: string, limit = 20) {
    await this.getPost(userId, postId);
    const anchor = cursor ? await Comment.findOne({ _id: cursor, postId }).select('createdAt').lean() : null;
    if (cursor && !anchor) throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor');
    const docs = await Comment.find({
      postId,
      status: 'VISIBLE',
      ...(anchor ? { $or: [{ createdAt: { $lt: anchor.createdAt } }, { createdAt: anchor.createdAt, _id: { $lt: cursor } }] } : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);
    return {
      comments: docs.slice(0, limit).map((d) => this.dto(d, userId)),
      nextCursor: docs.length > limit ? docs[limit - 1].id : null,
    };
  }
  async chatHistory(userId: string, circleId: string, cursor?: string) {
    await this.access(userId, circleId, false);
    const docs = await ChatMessage.find({ circleId, status: 'VISIBLE',
      ...(cursor ? { _id: { $lt: cursor } } : {}) }).sort({ _id: -1 }).limit(51);
    return { messages: docs.slice(0, 50).map(d => ({ ...this.dto(d), own: d.userId === userId })),
      nextCursor: docs.length > 50 ? docs[49].id : null };
  }
  async reportedContent(token: string, reportId: string) {
    if (!this.identity.reportDetail) throw new AppError(503, 'REPORT_UNAVAILABLE', 'Reporting unavailable');
    const report = await this.identity.reportDetail(token, reportId);
    if (!report.contentId || !Types.ObjectId.isValid(report.contentId)) return null;
    for (const [kind, model] of [['post', Post], ['comment', Comment], ['chat', ChatMessage]] as const) {
      const doc = await (model as Model<any>).findOne({ _id: report.contentId, circleId: report.circleId });
      if (doc) return { ...this.dto(doc), kind };
    }
    return null;
  }
  async reportComment(userId: string, id: string, reason: string, token: string) {
    const comment = await Comment.findOne({ _id: id, status: 'VISIBLE' });
    if (!comment) throw new AppError(404, 'NOT_FOUND', 'Comment not found');
    await this.getPost(userId, String(comment.postId));
    if (!comment.userId || comment.userId === userId) throw new AppError(400, 'INVALID_REPORT', 'Cannot report this comment');
    if (!this.identity.memberReport) throw new AppError(503, 'REPORT_UNAVAILABLE', 'Reporting unavailable');
    return this.identity.memberReport(token, { targetId: comment.userId, circleId: comment.circleId, contentId: id, reason });
  }
  async reportPost(userId: string, postId: string, reason: string, token: string) {
    const post = await this.getPost(userId, postId);
    if (!post.userId || post.userId === userId) throw new AppError(400, 'INVALID_REPORT', 'Cannot report this post');
    if (!this.identity.memberReport) throw new AppError(503, 'REPORT_UNAVAILABLE', 'Reporting unavailable');
    return this.identity.memberReport(token, { targetId: post.userId, circleId: post.circleId, contentId: postId, reason });
  }
  async reactions(userId: string, postId: string) {
    await this.getPost(userId, postId);
    const own = await Reaction.findOne({ userId, targetType: 'POST', targetId: postId }).lean();
    const counts = await Reaction.aggregate<{ _id: string; count: number }>([
      { $match: { targetType: 'POST', targetId: new Types.ObjectId(postId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    return { reaction: own?.type ?? null, counts: Object.fromEntries(counts.map(c => [c._id, c.count])) };
  }
  async react(
    userId: string,
    postId: string,
    type: 'support' | 'hug' | 'relate' | 'helpful' | null,
  ) {
    const post = await this.getPost(userId, postId);
    await this.access(userId, post.circleId);
    await withUserTransaction(userId, async (session) => {
      if (
        !(await Post.findOneAndUpdate(
          { _id: postId, status: 'VISIBLE' },
          { $set: { updatedAt: new Date() } },
          { session },
        ))
      )
        throw new AppError(404, 'NOT_FOUND', 'Post not found');
      if (type === null) {
        await Reaction.deleteOne({ userId, targetType: 'POST', targetId: postId }, { session });
      } else await Reaction.updateOne(
        { userId, targetType: 'POST', targetId: postId },
        { $set: { type } },
        { upsert: true, session },
      );
    });
    const counts = await Reaction.aggregate<{ _id: string; count: number }>([
      { $match: { targetType: 'POST', targetId: new Types.ObjectId(postId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    return {
      reaction: type,
      counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    };
  }
  async remove(userId: string, id: string, kind: 'post' | 'comment') {
    const model: Model<any> = kind === 'post' ? Post : Comment;
    await withUserTransaction(userId, async (session) => {
      const doc = await model.findOneAndUpdate(
        { _id: id, userId, status: { $ne: 'REMOVED' } },
        { $set: { status: 'REMOVED', text: '[removed]' } },
        { session },
      );
      if (!doc) throw new AppError(404, 'NOT_FOUND', 'Content not found');
      if (kind === 'post')
        await Comment.updateMany(
          { postId: id },
          { $set: { status: 'REMOVED', text: '[removed]' } },
          { session },
        );
      await Reaction.deleteMany({ targetId: id }, { session });
    });
  }
}
