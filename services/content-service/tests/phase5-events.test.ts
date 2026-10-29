import { randomUUID } from 'crypto';
import { database, fixture } from './helpers';
import {
  Phase5Handler,
  ExportRecord,
  DeletionJob,
} from '../src/modules/events/phase5.handler';
import { event } from '../src/modules/events/events.service';
import { eventHandler } from '../src/modules/events/events.controller';
import {
  Post,
  Comment,
  ChatMessage,
  UserRestriction,
  Reaction,
  PendingReport,
} from '../src/modules/community/community.model';
import { JournalEntry, MoodLog } from '../src/modules/journal/journal.model';
import {
  Conversation,
  CompanionMessage,
} from '../src/modules/companion/companion.model';
import { CrisisEvent } from '../src/modules/safety/safety.model';
import { FileMetadata } from '../src/modules/files/files.model';
import { ChatRate } from '../src/modules/chat/chat.socket';
import { DeletedUser } from '../src/modules/events/events.model';
import { Model } from 'mongoose';
database();
const circleId = randomUUID();
const realtime = () => ({
  evict: jest.fn(),
  removed: jest.fn(),
  aliasChanged: jest.fn(),
});
test('restrictionChanged caches latest restriction, evicts chat, and blocks posts', async () => {
  const f = fixture(),
    chat = realtime(),
    h = new Phase5Handler(f.identity, f.storage, f.producer, chat);
  const ban = event('restrictionChanged', {
    userId: 'user-1',
    circleId,
    muted: false,
    banned: true,
  });
  await h.handle(ban);
  expect((await UserRestriction.findOne())?.banned).toBe(true);
  expect(chat.evict).toHaveBeenCalledWith('user-1', circleId);
  await expect(
    f.community.create('user-1', circleId, 'No', 'token'),
  ).rejects.toMatchObject({ status: 403 });
  await h.handle({
    ...ban,
    occurredAt: '2000-01-01T00:00:00Z',
    payload: { ...ban.payload, banned: false },
  });
  expect((await UserRestriction.findOne())?.banned).toBe(true);
});
test('aliasChanged updates all public content and contentRemovalRequested removes and broadcasts', async () => {
  const f = fixture(),
    chat = realtime(),
    h = new Phase5Handler(f.identity, f.storage, f.producer, chat);
  const post = await f.community.create('user-1', circleId, 'Hello', 'token');
  await f.community.create(
    'user-1',
    circleId,
    'Comment',
    'token',
    'comment',
    post.content.id,
  );
  const msg = await f.community.create(
    'user-1',
    circleId,
    'Chat',
    'token',
    'chat',
  );
  await h.handle(event('aliasChanged', { userId: 'user-1', alias: 'CalmFox' }));
  for (const model of [Post, Comment, ChatMessage] as Model<any>[])
    expect((await model.findOne()).authorAlias).toBe('CalmFox');
  await h.handle(
    event('contentRemovalRequested', { circleId, contentId: msg.content.id }),
  );
  expect(chat.removed).toHaveBeenCalledWith(circleId, msg.content.id);
  await h.handle(
    event('ModerationActionCreated', {
      userId: 'user-1',
      circleId,
      action: 'REMOVE_CONTENT',
      contentId: post.content.id,
    }),
  );
  expect((await Post.findOne())?.status).toBe('REMOVED');
  expect((await Comment.findOne())?.status).toBe('REMOVED');
});
test('consent changes clear companion memory', async () => {
  const f = fixture(),
    h = new Phase5Handler(f.identity, f.storage, f.producer, realtime());
  const c = await f.companion.create('user-1', 'Hello');
  await Conversation.updateOne({ _id: c.id }, { $set: { summary: 'Memory' } });
  await eventHandler(
    f.identity,
    f.producer,
    undefined,
    h,
  )(
    'identity-events',
    event('consentChanged', {
      userId: 'user-1',
      aiAnalysis: false,
      companionMemory: false,
    }),
  );
  expect(f.identity.invalidate).toHaveBeenCalledWith('user-1');
  f.identity.consent.mockResolvedValue({ });
  f.identity.consent.mockResolvedValue({ });
  expect((await Conversation.findById(c.id))?.summary).toBe('');
});
test('export assembles one owner-only JSON, then deletion wipes every private collection and anonymizes public records before final S3 acknowledgement', async () => {
  let now = new Date('2026-10-22T00:00:00Z');
  const f = fixture(now),
    chat = realtime(),
    deleted = jest.fn();
  const h = new Phase5Handler(
    f.identity,
    f.storage,
    f.producer,
    chat,
    deleted,
    () => now,
  );
  const c = await f.companion.create('user-1', 'Hello');
  await f.companion.send(
    'user-1',
    c.id,
    { text: 'Hi', region: 'GLOBAL', timezone: 'UTC' },
    'token',
  );
  await JournalEntry.create([
    { userId: 'user-1', text: 'Own journal', moodScore: 3, crisisFlag: false },
    {
      userId: 'other',
      text: 'Other private journal',
      moodScore: 3,
      crisisFlag: false,
    },
  ]);
  await MoodLog.create({ userId: 'user-1', date: '2026-10-21', moodScore: 3 });
  const post = await f.community.create('user-1', circleId, 'Post', 'token');
  await f.community.create(
    'user-1',
    circleId,
    'Comment',
    'token',
    'comment',
    post.content.id,
  );
  await f.community.create('user-1', circleId, 'Chat', 'token', 'chat');
  await f.community.react('user-1', post.content.id, 'hug');
  await ChatRate.create({
    _id: 'bucket',
    userId: 'user-1',
    count: 1,
    expiresAt: new Date('2099-01-01'),
  });
  await UserRestriction.create({ userId: 'user-1', circleId, banned: false });
  await PendingReport.create({
    userId: 'user-1',
    circleId,
    contentId: 'pending',
    reason: 'UNSAFE',
  });
  const upload = await FileMetadata.create({
    userId: 'user-1', objectKey: 'users/user-1/journal/legacy.png',
    uploadExpiresAt: new Date('2026-10-21T17:35:00Z'),
    purpose: 'journal',
    contentType: 'image/png',
    size: 1024,
  });
  f.storage.objects.set(upload.objectKey, 'image');
  const requestId = randomUUID();
  await h.handle(event('dataExportRequested', { userId: 'user-1', requestId }));
  const key = `exports/${requestId}/data.json`,
    exported = JSON.stringify(f.storage.objects.get(key));
  expect(exported).toContain('Own journal');
  expect(exported).not.toContain('Other private journal');
  expect(exported).not.toContain('test-token');
  expect(f.producer.messages.at(-1)?.event).toMatchObject({
    type: 'DataExportCompleted',
    payload: { objectKey: key },
  });
  const deletion = event('userDeletionRequested', {
    userId: 'user-1',
    requestId: randomUUID(),
  });
  await h.handle(deletion);
  for (const m of [
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
    ExportRecord,
  ] as Model<any>[])
    expect(await m.countDocuments({ userId: 'user-1' })).toBe(0);
  expect(await DeletedUser.exists({ _id: 'user-1' })).toBeTruthy();
  expect(await JournalEntry.countDocuments({ userId: 'other' })).toBe(1);
  expect(chat.evict).toHaveBeenCalledWith('user-1');
  expect(deleted).toHaveBeenCalledWith('user-1');
  expect(f.storage.objects.size).toBe(0);
  await h.cleanupDue();
  expect(
    f.producer.messages.filter((m) => m.event.type === 'UserDeletionCompleted'),
  ).toHaveLength(0);
  f.storage.objects.set(upload.objectKey, 'late upload');
  now = new Date(now.getTime() + 300001);
  await h.cleanupDue();
  expect(f.storage.objects.size).toBe(0);
  expect(await DeletionJob.countDocuments()).toBe(0);
  expect(f.producer.messages.at(-1)?.event.type).toBe('UserDeletionCompleted');
  await expect(
    f.community.create('user-1', circleId, 'No', 'token'),
  ).rejects.toMatchObject({ status: 403 });
});
test('failed S3 cleanup never publishes deletion completion and durable job retries', async () => {
  let now = new Date();
  const f = fixture(),
    h = new Phase5Handler(
      f.identity,
      f.storage,
      f.producer,
      realtime(),
      () => {},
      () => now,
    );
  const e = event('UserDeletionRequested', {
    userId: 'user-1',
    requestId: randomUUID(),
  });
  f.storage.deletePrefix.mockRejectedValueOnce(new Error('S3 unavailable'));
  await expect(h.handle(e)).rejects.toThrow('S3 unavailable');
  expect(await DeletionJob.countDocuments()).toBe(1);
  expect(f.producer.messages).toHaveLength(0);
  now = new Date(now.getTime() + 300001);
  await h.cleanupDue();
  expect(f.producer.messages[0].event.type).toBe('UserDeletionCompleted');
});
