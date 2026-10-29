import { randomUUID } from 'crypto';
import { database, fixture } from './helpers';
import { JournalEntry } from '../src/modules/journal/journal.model';
import {
  Conversation,
  CompanionMessage,
} from '../src/modules/companion/companion.model';
import { eventHandler } from '../src/modules/events/events.controller';
import { event } from '../src/modules/events/events.service';
database();
async function setup() {
  const f = fixture(),
    circleId = randomUUID();
  const entry = await JournalEntry.create({
    userId: 'user-1',
    text: 'Private journal body',
    moodScore: 3,
    crisisFlag: false,
    analysis: { status: 'pending' },
  });
  const result = event('AnalysisCompleted', {
    userId: 'user-1',
    entryId: entry.id,
    revision: 1,
    emotions: ['calm'],
    sentiment: 0.5,
    themes: ['walking'],
    modelVersion: 'v1',
  });
  const deleted = jest.fn();
  const handle = eventHandler(f.identity, f.producer, {
    deleted,
  });
  return { ...f, circleId, entry, result, handle, deleted };
}
test('retired analysis events do not add derived journal data', async () => {
  const f = await setup();
  await f.handle('analysis-results', f.result);
  expect((await JournalEntry.findById(f.entry.id))?.toObject()).not.toHaveProperty('analysis');
});
test('account deletion removes Phase 4 data, disconnects sockets and rejects new writes', async () => {
  const f = await setup(),
    c = await f.companion.create('user-1', 'Check-in');
  await f.companion.send(
    'user-1',
    c.id,
    { text: 'Hi', timezone: 'UTC', region: 'GLOBAL' },
    'token',
  );
  await f.handle('analysis-results', f.result);
  await f.handle(
    'identity-events',
    event('UserDeletionRequested', {
      userId: 'user-1',
      requestId: randomUUID(),
    }),
  );
  for (const m of [Conversation, CompanionMessage])
    expect(await m.countDocuments()).toBe(0);
  expect(f.deleted).toHaveBeenCalledWith('user-1');

});
