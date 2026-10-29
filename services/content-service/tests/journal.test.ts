import request from 'supertest';
import { database, fixture } from './helpers';
import { JournalEntry, MoodLog } from '../src/modules/journal/journal.model';
import { CrisisEvent } from '../src/modules/safety/safety.model';
import { eventHandler } from '../src/modules/events/events.controller';
import { event } from '../src/modules/events/events.service';
database();
const input = {
  text: 'A peaceful day',
  moodScore: 4,
  tags: ['walk'],
  timezone: 'Asia/Singapore',
};
test('journal saves mood without creating analysis jobs or derived fields', async () => {
  const f = fixture();
  const r = await request(f.app).post('/journal').send(input).expect(201);
  expect(r.body.streak).toBe(1);
  expect(r.body.entry).not.toHaveProperty('analysis');
  expect(f.producer.publish).not.toHaveBeenCalled();
  expect((await MoodLog.findOne())?.date).toBe('2026-10-22');
  expect(await CrisisEvent.countDocuments()).toBe(1);
});

test('validation rejects unsafe input without safety or persistence', async () => {
  const f = fixture();
  for (const body of [
    { ...input, moodScore: 6 },
    { ...input, userId: 'other' },
    { ...input, timezone: 'Invalid/Zone' },
    { ...input, text: '' },
  ])
    await request(f.app).post('/journal').send(body).expect(400);
  expect(f.ai.crisisCheck).not.toHaveBeenCalled();
  expect(await JournalEntry.countDocuments()).toBe(0);
});
test('owner-scoped CRUD supports collection and item update/delete', async () => {
  const f = fixture();
  const r = await request(f.app).post('/journal').send(input).expect(201);
  const id = r.body.entry._id;
  await request(f.app)
    .get('/journal/' + id)
    .set('X-Test-User', 'other')
    .expect(404);
  await request(f.app)
    .put('/journal/' + id)
    .set('X-Test-User', 'other')
    .send(input)
    .expect(404);
  await request(f.app)
    .delete('/journal/' + id)
    .set('X-Test-User', 'other')
    .expect(404);
  const list = await request(f.app).get('/journal').expect(200);
  expect(list.body.entries).toHaveLength(1);
  await request(f.app)
    .put('/journal')
    .send({ ...input, id, text: 'Updated' })
    .expect(200);
  await request(f.app)
    .get('/journal/' + id)
    .expect(200)
    .expect((r) => expect(r.body.text).toBe('Updated'));
  await request(f.app).delete('/journal').send({ id }).expect(204);
  await request(f.app)
    .get('/journal/' + id)
    .expect(404);
  await request(f.app).get('/journal/invalid').expect(400);
});
test('mood upsert is unique and summary/calendar respect dates and range', async () => {
  const f = fixture();
  await Promise.all(
    [2, 3, 4].map((moodScore) =>
      request(f.app)
        .put('/mood/today')
        .send({ moodScore, timezone: 'Asia/Singapore' })
        .expect(200),
    ),
  );
  expect(await MoodLog.countDocuments()).toBe(1);
  await MoodLog.create({ userId: 'user-1', date: '2026-10-21', moodScore: 3 });
  await MoodLog.create({ userId: 'other', date: '2026-10-21', moodScore: 1 });
  const summary = await request(f.app)
    .get('/mood/summary?range=7d&timezone=Asia%2FSingapore')
    .expect(200);
  expect(summary.body).toMatchObject({
    count: 2,
    streak: 2,
    from: '2026-10-16',
    to: '2026-10-22',
  });
  const calendar = await request(f.app)
    .get('/mood/calendar?month=2026-10')
    .expect(200);
  expect(calendar.body.days).toHaveLength(2);
  await request(f.app).get('/mood/calendar?month=2026-13').expect(400);
  await request(f.app).get('/mood/summary?range=1d').expect(400);
});
test('deletion during crisis screening fences the in-flight create', async () => {
  const f = fixture();
  f.ai.crisisCheck.mockImplementation(async () => {
    await eventHandler(f.identity, f.producer)(
      'identity-events',
      event('UserDeletionRequested', {
        userId: 'user-1',
        requestId: '00000000-0000-4000-8000-000000000002',
      }),
    );
    return { riskLevel: 'LOW' };
  });
  await request(f.app).post('/journal').send(input).expect(403);
  expect(await JournalEntry.countDocuments()).toBe(0);
  expect(await CrisisEvent.countDocuments()).toBe(0);
  expect(await MoodLog.countDocuments()).toBe(0);
  expect(f.producer.messages).toHaveLength(1);
  expect(f.producer.messages[0].event.type).toBe('UserDeletionCompleted');
});
test('public DTOs exclude job internals and Mongoose version fields', async () => {
  const f = fixture();
  const response = await request(f.app)
    .post('/journal')
    .send(input)
    .expect(201);
  expect(response.body.entry).not.toHaveProperty('jobId');
  expect(response.body.entry).not.toHaveProperty('jobPublished');
  expect(response.body.entry).not.toHaveProperty('__v');
  const summary = await request(f.app)
    .get('/mood/summary?timezone=Asia%2FSingapore')
    .expect(200);
  expect(summary.body.days[0]).not.toHaveProperty('__v');
});
