import request from 'supertest';
import { database, fixture } from './helpers';
import {
  Conversation,
  CompanionMessage,
} from '../src/modules/companion/companion.model';
import { JournalEntry, MoodLog } from '../src/modules/journal/journal.model';
import { CrisisEvent } from '../src/modules/safety/safety.model';
import { withUserTransaction } from '../src/utils/userTransaction';
database();

test('first message names conversation once; manual names survive later messages', async () => {
  const f = fixture();
  const c = await f.companion.create('user-1', 'New conversation');
  await f.companion.send(
    'user-1',
    c.id,
    { ...input, text: 'Feeling stressed\n  about exams' },
    'token',
  );
  expect((await Conversation.findById(c.id))!.title).toBe(
    'Feeling stressed about exams',
  );
  await f.companion.send(
    'user-1',
    c.id,
    { ...input, text: 'Another thought' },
    'token',
  );
  expect((await Conversation.findById(c.id))!.title).toBe(
    'Feeling stressed about exams',
  );
  await request(f.app)
    .patch(`/companion/conversations/${c.id}`)
    .send({ title: '  Exam reflections  ' })
    .expect(200);
  expect((await Conversation.findById(c.id))!.title).toBe('Exam reflections');
});

test('rename validates input, enforces ownership, and preserves a name chosen before first message', async () => {
  const f = fixture();
  const c = await f.companion.create('user-1', 'New conversation');
  const url = `/companion/conversations/${c.id}`;
  await request(f.app)
    .patch(url)
    .set('X-Test-User', 'other')
    .send({ title: 'Not mine' })
    .expect(404);
  for (const title of ['', '   ', 'x'.repeat(121)]) {
    await request(f.app).patch(url).send({ title }).expect(400);
  }
  await request(f.app)
    .patch(url)
    .send({ title: 'New conversation' })
    .expect(200);
  await f.companion.send('user-1', c.id, input, 'token');
  expect((await Conversation.findById(c.id))!.title).toBe('New conversation');
});

test('automatic title is bounded even when the first reply fails', async () => {
  const f = fixture();
  const c = await f.companion.create('user-1', 'New conversation');
  f.ai.companionChat.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(
    f.companion.send(
      'user-1',
      c.id,
      { ...input, text: 'x'.repeat(200) },
      'token',
    ),
  ).rejects.toThrow();
  expect((await Conversation.findById(c.id))!.title).toBe('x'.repeat(79) + '…');
});
test('seeded nonchronological IDs cannot move an old reply after the current user turn', async () => {
  const f = fixture();
  const c = await f.companion.create('user-1', 'Seeded history');
  await CompanionMessage.create({
    _id: 'ffffffffffffffffffffffff',
    userId: 'user-1',
    conversationId: c.id,
    role: 'ASSISTANT',
    text: 'An earlier reply',
    screened: true,
    safe: true,
    createdAt: new Date('2020-01-01T00:00:00Z'),
  });
  await f.companion.send(
    'user-1',
    c.id,
    {
      text: 'What exercise can I try?',
      timezone: 'Asia/Singapore',
      region: 'GLOBAL',
    },
    'token',
  );
  const body = f.ai.companionChat.mock.calls[0][0] as {
    messages: { role: string; content: string }[];
  };
  expect(body.messages.at(-1)).toEqual({
    role: 'user',
    content: 'What exercise can I try?',
  });
});
const input = {
  text: 'I had a good walk',
  timezone: 'Asia/Singapore',
  region: 'GLOBAL',
};

test('persists before screening; crisis stores fixed reply and never calls chat or context', async () => {
  const f = fixture();
  const c = await f.companion.create('user-1', 'Check-in');
  f.ai.crisisCheck.mockImplementation(async () => {
    expect(await CompanionMessage.countDocuments({ role: 'USER' })).toBe(1);
    return { riskLevel: 'HIGH' };
  });
  const result = await f.companion.send('user-1', c.id, input, 'token');
  expect(result.message.role).toBe('CRISIS');
  expect(result.support).toMatchObject({ crisisDetected: true });
  expect(f.ai.companionChat).not.toHaveBeenCalled();
  expect(f.identity.consent).not.toHaveBeenCalled();
  expect(await CompanionMessage.countDocuments()).toBe(2);
  expect(await CrisisEvent.findOne()).toMatchObject({
    source: 'companion',
    crisisDetected: true,
  });
});

test('fallback crisis short-circuits and never leaks flagged history on later turns', async () => {
  const f = fixture(),
    c = await f.companion.create('user-1', 'Check-in');
  f.ai.crisisCheck.mockRejectedValueOnce(new Error('offline'));
  await f.companion.send(
    'user-1',
    c.id,
    { ...input, text: 'self-harm' },
    'token',
  );
  await f.companion.send('user-1', c.id, input, 'token');
  const body = f.ai.companionChat.mock.calls[0][0] as { messages: unknown[] };
  expect(body.messages).toHaveLength(1);
  expect(JSON.stringify(body)).not.toContain('self-harm');
  expect(body).not.toHaveProperty('context');
  expect(body).not.toHaveProperty('summary');
});

test('context is consent-gated and includes only own mood check-ins from 7 local dates', async () => {
  const f = fixture(),
    c = await f.companion.create('user-1', 'Check-in');
  f.identity.consent.mockResolvedValue({
    companionMemoryOptIn: true,
  });
  await MoodLog.create([
    { userId: 'user-1', date: '2026-10-22', moodScore: 4 },
    { userId: 'user-1', date: '2026-10-16', moodScore: 2 },
    { userId: 'user-1', date: '2026-10-15', moodScore: 1 },
    { userId: 'other', date: '2026-10-22', moodScore: 1 },
  ]);
  await JournalEntry.create({
    userId: 'user-1',
    text: 'private journal',
    moodScore: 4,
    crisisFlag: false,
    createdAt: new Date('2026-10-21T10:00:00Z'),
    analysis: { status: 'complete', themes: ['walking'] },
  });
  await f.companion.send('user-1', c.id, input, 'token');
  expect(f.ai.companionChat.mock.calls[0][0]).toMatchObject({
    context: { averageMood: 3 },
  });
  expect(JSON.stringify(f.ai.companionChat.mock.calls[0][0])).not.toContain(
    'private journal',
  );
  f.identity.consent.mockResolvedValue({
    companionMemoryOptIn: false,
  });
  await f.companion.send('user-1', c.id, input, 'token');
  expect(f.ai.companionChat.mock.calls[1][0]).not.toHaveProperty('context');
});

test('fresh opt-out during context building removes context before chat', async () => {
  const f = fixture(),
    c = await f.companion.create('user-1', 'Check-in');
  f.identity.consent
    .mockResolvedValueOnce({
      companionMemoryOptIn: true,
    })
    .mockResolvedValueOnce({
      companionMemoryOptIn: false,
    });
  await f.companion.send('user-1', c.id, input, 'token');
  expect(f.ai.companionChat.mock.calls[0][0]).not.toHaveProperty('context');
});

test('owner isolation, validated cursor, pagination and conversation deletion', async () => {
  const f = fixture();
  const c = (
    await request(f.app)
      .post('/companion/conversations')
      .send({ title: 'Test' })
      .expect(201)
  ).body;
  await request(f.app)
    .post(`/companion/conversations/${c.id}/messages`)
    .send(input)
    .expect(201);
  await request(f.app)
    .get(`/companion/conversations/${c.id}/messages`)
    .set('X-Test-User', 'other')
    .expect(404);
  await request(f.app)
    .post(`/companion/conversations/${c.id}/messages`)
    .set('X-Test-User', 'other')
    .send(input)
    .expect(404);
  await request(f.app)
    .get(`/companion/conversations/${c.id}/messages?cursor=bad`)
    .expect(400);
  const first = await request(f.app)
    .get(`/companion/conversations/${c.id}/messages?limit=1`)
    .expect(200);
  const next = await request(f.app)
    .get(
      `/companion/conversations/${c.id}/messages?limit=1&cursor=${first.body.nextCursor}`,
    )
    .expect(200);
  expect(first.body.messages[0]._id).not.toBe(next.body.messages[0]._id);
  await request(f.app)
    .delete(`/companion/conversations/${c.id}`)
    .set('X-Test-User', 'other')
    .expect(404);
  await request(f.app).delete(`/companion/conversations/${c.id}`).expect(204);
  expect(await CompanionMessage.countDocuments()).toBe(0);
});

test('periodic bounded summaries and LLM failure preserve user message and release lease', async () => {
  const f = fixture(),
    c = await f.companion.create('user-1', 'Check-in');
  f.identity.consent.mockResolvedValue({
    companionMemoryOptIn: true,
  });
  for (let n = 0; n < 5; n++)
    await f.companion.send('user-1', c.id, input, 'token');
  expect((await Conversation.findById(c.id))?.summary.length).toBeGreaterThan(
    0,
  );
  f.ai.companionChat.mockRejectedValueOnce(new Error('offline'));
  await expect(
    f.companion.send('user-1', c.id, input, 'token'),
  ).rejects.toMatchObject({ status: 503 });
  expect(await CompanionMessage.countDocuments({ role: 'USER' })).toBe(6);
  expect((await Conversation.findById(c.id))?.lease).toBeNull();
});

test('deleting conversation while AI responds cannot recreate messages', async () => {
  const f = fixture(),
    c = await f.companion.create('user-1', 'Check-in');
  f.ai.companionChat.mockImplementation(async () => {
    await f.companion.remove('user-1', c.id);
    return { reply: 'hello' };
  });
  await expect(
    f.companion.send('user-1', c.id, input, 'token'),
  ).rejects.toMatchObject({ status: 409 });
  expect(await CompanionMessage.countDocuments()).toBe(0);
  await withUserTransaction('user-1', async () => {}, true);
  await expect(f.companion.create('user-1', 'No')).rejects.toMatchObject({
    code: 'ACCOUNT_DELETED',
  });
});
