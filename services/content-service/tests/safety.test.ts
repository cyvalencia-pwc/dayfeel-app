import request from 'supertest';
import { database, fixture } from './helpers';
import { CrisisEvent } from '../src/modules/safety/safety.model';
import { JournalEntry } from '../src/modules/journal/journal.model';
database();
test.each(['MEDIUM', 'HIGH'] as const)(
  'AI %s prevents all generative work and returns fixed directory support',
  async (riskLevel) => {
    const f = fixture();
    f.ai.crisisCheck.mockResolvedValue({ riskLevel });
    const text = 'private crisis words';
    const r = await request(f.app)
      .post('/journal')
      .send({ text, moodScore: 1 })
      .expect(201);
    expect(r.body.entry.crisisFlag).toBe(true);
    expect(r.body.support.resources).toHaveLength(1);
    expect(f.ai.companionChat).not.toHaveBeenCalled();
    expect(f.producer.publish).not.toHaveBeenCalled();
    const audits = await CrisisEvent.find().lean();
    expect(JSON.stringify(audits)).not.toContain(text);
    expect(audits[0]).not.toHaveProperty('riskLevel');
  },
);
test.each([
  'I want to die',
  'I will kill myself',
  'I am considering self-harm',
  'I may overdose',
])('timeout fallback screens %s', async (text) => {
  const f = fixture();
  f.ai.crisisCheck.mockRejectedValue(
    new DOMException('Timed out', 'TimeoutError'),
  );
  const r = await request(f.app)
    .post('/journal')
    .send({ text, moodScore: 1 })
    .expect(201);
  expect(r.body.support.crisisDetected).toBe(true);
  expect(f.ai.companionChat).not.toHaveBeenCalled();
  expect(f.producer.publish).not.toHaveBeenCalled();
});
test('edits are screened without creating analysis jobs; directory outage retains support', async () => {
  const f = fixture();
  const initial = await request(f.app)
    .post('/journal')
    .send({ text: 'Fine today', moodScore: 3 })
    .expect(201);
  f.producer.publish.mockClear();
  f.ai.crisisCheck.mockRejectedValue(new Error('unavailable'));
  f.identity.resources.mockRejectedValue(new Error('unavailable'));
  const r = await request(f.app)
    .put('/journal/' + initial.body.entry._id)
    .send({ text: 'I want to die', moodScore: 1 })
    .expect(200);
  expect(r.body.support).toMatchObject({ crisisDetected: true, resources: [] });
  expect(f.producer.publish).not.toHaveBeenCalled();
  expect(f.ai.companionChat).not.toHaveBeenCalled();
  expect((await JournalEntry.findOne())?.toObject()).not.toHaveProperty('analysis');
});
test('invalid AI result invokes fallback', async () => {
  const f = fixture();
  f.ai.crisisCheck.mockResolvedValue({ riskLevel: 'INVALID' } as never);
  await request(f.app)
    .post('/journal')
    .send({ text: 'I want to die', moodScore: 1 })
    .expect(201)
    .expect((r) => expect(r.body.entry.crisisFlag).toBe(true));
  expect(f.producer.publish).not.toHaveBeenCalled();
});
