import request from 'supertest';
import { randomUUID } from 'crypto';
import { database, fixture } from './helpers';
import {
  Post,
  ChatMessage,
  Comment,
  Reaction,
  PendingReport,
} from '../src/modules/community/community.model';
database();
const circle = randomUUID();
test('posts and comments paginate newest creation date first rather than insertion order', async () => {
  const f = fixture();
  const fields = { circleId: circle, userId: 'user-1', authorAlias: 'QuietOtter', status: 'VISIBLE' };
  const newest = await Post.create({ ...fields, text: 'Newest', createdAt: new Date('2026-10-27') });
  await Post.create({ ...fields, text: 'Oldest', createdAt: new Date('2026-10-01') });
  const first = await request(f.app).get(`/circles/${circle}/posts`).query({ limit: 1 }).expect(200);
  expect(first.body.posts[0].text).toBe('Newest');
  const next = await request(f.app).get(`/circles/${circle}/posts`).query({ limit: 1, cursor: first.body.nextCursor }).expect(200);
  expect(next.body.posts[0].text).toBe('Oldest');
  await Comment.create({ ...fields, postId: newest.id, text: 'Newest comment', createdAt: new Date('2026-10-27') });
  await Comment.create({ ...fields, postId: newest.id, text: 'Oldest comment', createdAt: new Date('2026-10-01') });
  const comments = await request(f.app).get(`/posts/${newest.id}/comments`).query({ limit: 1 }).expect(200);
  expect(comments.body.comments[0].text).toBe('Newest comment');
  const older = await request(f.app).get(`/posts/${newest.id}/comments`).query({ limit: 1, cursor: comments.body.nextCursor }).expect(200);
  expect(older.body.comments[0].text).toBe('Oldest comment');
});
test('comment reporting rejects the author and preview requires report authorization', async () => {
  const f = fixture();
  f.identity.memberReport = jest.fn().mockResolvedValue({ id: randomUUID() });
  const post = await request(f.app).post(`/circles/${circle}/posts`).send({ text: 'Post' }).expect(201);
  const comment = await request(f.app).post(`/posts/${post.body.content.id}/comments`).send({ text: 'Comment' }).expect(201);
  const id = comment.body.content.id;
  await request(f.app).post(`/comments/${id}/report`).send({ reason: 'OTHER' }).expect(400);
  await request(f.app).post(`/comments/${id}/report`).set('X-Test-User', 'user-2').send({ reason: 'OTHER' }).expect(201);
  expect(f.identity.memberReport).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ contentId: id, targetId: 'user-1' }));
  f.identity.reportDetail = jest.fn().mockResolvedValue({ circleId: circle, contentId: id });
  const preview = await request(f.app).get(`/moderation/reports/${randomUUID()}/content`).expect(200);
  expect(preview.body).toMatchObject({ kind: 'comment', text: 'Comment' });
  expect(preview.body.userId).toBeUndefined();
  f.identity.reportDetail = jest.fn().mockRejectedValue(new (require('../src/utils/errors').AppError)(403, 'FORBIDDEN', 'Denied'));
  await request(f.app).get(`/moderation/reports/${randomUUID()}/content`).expect(403);
});
test('member reports resolve the author on the server and enforce circle access', async () => {
  const f = fixture();
  const reportId = randomUUID();
  f.identity.memberReport = jest.fn().mockResolvedValue({ id: reportId });
  const post = await request(f.app).post(`/circles/${circle}/posts`).send({ text: 'Hello' }).expect(201);
  const id = post.body.content.id;
  await request(f.app).post(`/posts/${id}/report`).send({ reason: 'SPAM' }).expect(400);
  const result = await request(f.app).post(`/posts/${id}/report`).set('X-Test-User', 'user-2').send({ reason: 'SPAM' }).expect(201);
  expect(result.body.id).toBe(reportId);
  expect(f.identity.memberReport).toHaveBeenCalledWith(expect.any(String), { targetId: 'user-1', circleId: circle, contentId: id, reason: 'SPAM' });
  f.identity.membership.mockResolvedValue({ active: false });
  await request(f.app).post(`/posts/${id}/report`).set('X-Test-User', 'user-2').send({ reason: 'SPAM' }).expect(403);
  expect(f.identity.memberReport).toHaveBeenCalledTimes(1);
});
test('only comment authors see ownership and can delete their comment', async () => {
  const f = fixture();
  const post = await request(f.app).post(`/circles/${circle}/posts`).send({ text: 'Hello' }).expect(201);
  const postId = post.body.content.id;
  const comment = await request(f.app).post(`/posts/${postId}/comments`).send({ text: 'Welcome' }).expect(201);
  const commentId = comment.body.content.id;
  const own = await request(f.app).get(`/posts/${postId}/comments`).expect(200);
  expect(own.body.comments[0].own).toBe(true);
  const other = await request(f.app).get(`/posts/${postId}/comments`).set('X-Test-User', 'user-2').expect(200);
  expect(other.body.comments[0].own).toBe(false);
  await request(f.app).delete(`/comments/${commentId}`).set('X-Test-User', 'user-2').expect(404);
  expect((await Comment.findById(commentId))?.status).toBe('VISIBLE');
  await request(f.app).delete(`/comments/${commentId}`).expect(204);
  expect((await Comment.findById(commentId))?.status).toBe('REMOVED');
});
test('chat history pages visible messages and requires active membership', async () => {
  const f = fixture();
  await ChatMessage.insertMany(Array.from({ length: 53 }, (_, i) => ({
    userId: 'user-1', circleId: circle, authorAlias: 'QuietOtter', text: `Message ${i}`,
    status: i === 51 ? 'REMOVED' : i === 52 ? 'HELD' : 'VISIBLE',
  })));
  const first = await request(f.app).get(`/circles/${circle}/chat/messages`).expect(200);
  expect(first.body.messages).toHaveLength(50);
  expect(first.body.messages.every((m: any) => m.status === 'VISIBLE' && m.createdAt && !m.userId)).toBe(true);
  const older = await request(f.app).get(`/circles/${circle}/chat/messages`).query({ cursor: first.body.nextCursor }).expect(200);
  expect(older.body.messages).toHaveLength(1);
  expect(older.body.nextCursor).toBeNull();
  expect(first.body.messages.map((m: any) => m.id)).not.toContain(older.body.messages[0].id);
  f.identity.membership.mockResolvedValue({ active: false });
  await request(f.app).get(`/circles/${circle}/chat/messages`).expect(403);
});
test('banned and muted users cannot post; membership check follows restrictions, before AI', async () => {
  const f = fixture();
  for (const status of [
    { member: true, muted: false, banned: true },
    { member: true, muted: true, banned: false },
  ]) {
    f.identity.restrictions.mockResolvedValue(status);
    await request(f.app)
      .post(`/circles/${circle}/posts`)
      .send({ text: 'Hello' })
      .expect(403);
  }
  expect(f.identity.membership).toHaveBeenCalled();
  expect(f.ai.moderate).not.toHaveBeenCalled();
  f.identity.restrictions.mockResolvedValue({
    member: true,
    muted: false,
    banned: false,
  });
  f.identity.membership.mockResolvedValue({ active: false });
  await request(f.app)
    .post(`/circles/${circle}/posts`)
    .send({ text: 'Hello' })
    .expect(403);
  expect(f.ai.moderate).not.toHaveBeenCalled();
});
test('visible posts/comments expose aliases only; owner delete and unique reaction replacement', async () => {
  const f = fixture();
  const created = await request(f.app)
    .post(`/circles/${circle}/posts`)
    .send({ text: 'Hello' })
    .expect(201);
  const id = created.body.content.id;
  const read = await request(f.app).get(`/posts/${id}`).expect(200);
  expect(read.body.authorAlias).toBe('QuietOtter');
  for (const response of [created, read])
    expect(JSON.stringify(response.body)).not.toMatch(/userId|authorId|user-1/);
  const comment = await request(f.app)
    .post(`/posts/${id}/comments`)
    .send({ text: 'Welcome' })
    .expect(201);
  const list = await request(f.app).get(`/posts/${id}/comments`).expect(200);
  expect(list.body.comments).toHaveLength(1);
  expect(JSON.stringify(list.body)).not.toContain('userId');
  await request(f.app)
    .put(`/posts/${id}/reactions`)
    .send({ type: 'support' })
    .expect(200);
  await request(f.app)
    .put(`/posts/${id}/reactions`)
    .send({ type: 'hug' })
    .expect(200);
  expect(await Reaction.countDocuments()).toBe(1);
  expect((await Reaction.findOne())?.type).toBe('hug');
  await request(f.app)
    .put(`/posts/${id}/reactions`)
    .send({ type: 'downvote' })
    .expect(400);
  await request(f.app)
    .delete(`/comments/${comment.body.content.id}`)
    .set('X-Test-User', 'other')
    .expect(404);
  await request(f.app)
    .delete(`/comments/${comment.body.content.id}`)
    .expect(204);
  await request(f.app)
    .delete(`/posts/${id}`)
    .set('X-Test-User', 'other')
    .expect(404);
  await request(f.app).delete(`/posts/${id}`).expect(204);
  await request(f.app).get(`/posts/${id}`).expect(404);
});
test.each(['TOXIC', 'SPAM'])(
  '%s is HELD, reported and hidden from others',
  async (verdict) => {
    const f = fixture();
    f.ai.moderate.mockResolvedValue({ verdict });
    const response = await f.community.create(
      'user-1',
      circle,
      'Moderate me',
      'token',
    );
    expect(response.content.status).toBe('HELD');
    expect(f.identity.report).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'AI', contentId: response.content.id }),
    );
    expect((await f.community.posts('other', circle)).posts).toHaveLength(0);
    await expect(
      f.community.getPost('other', response.content.id),
    ).rejects.toMatchObject({ status: 404 });
  },
);
test('self-harm stays visible but support is private; report delivery survives failure', async () => {
  const f = fixture();
  f.ai.moderate.mockResolvedValue({ verdict: 'SELF_HARM_RISK' });
  (f.identity.report as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const response = await f.community.create(
    'user-1',
    circle,
    'Synthetic fixture',
    'token',
  );
  expect(response.content.status).toBe('VISIBLE');
  expect(response.support?.crisisDetected).toBe(true);
  expect(await PendingReport.countDocuments()).toBe(1);
  expect(
    JSON.stringify(await f.community.posts('other', circle)),
  ).not.toContain('support');
  await f.community.flushReports();
  expect(await PendingReport.countDocuments()).toBe(0);
});
test('invalid moderation fails closed and feed cursor is stable', async () => {
  const f = fixture();
  f.ai.moderate.mockResolvedValueOnce({ verdict: 'UNKNOWN' });
  await expect(
    f.community.create('user-1', circle, 'Hi', 'token'),
  ).rejects.toMatchObject({ status: 503 });
  expect(await Post.countDocuments()).toBe(0);
  await f.community.create('user-1', circle, 'One', 'token');
  await f.community.create('user-1', circle, 'Two', 'token');
  const a = await f.community.posts('user-1', circle, undefined, 1),
    b = await f.community.posts('user-1', circle, a.nextCursor!, 1);
  expect(a.posts[0].text).toBe('Two');
  expect(b.posts[0].text).toBe('One');
  const indexes = await Reaction.collection.indexes();
  expect(
    indexes.some(
      (i) => i.unique && i.key.userId && i.key.targetId && i.key.targetType,
    ),
  ).toBe(true);
});

