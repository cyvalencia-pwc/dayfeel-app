import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AiClient } from '../src/clients/aiClient';
import { IdentityClient } from '../src/clients/identityClient';
import { DomainEvent } from '../src/modules/events/events.schema';
import {
  EventProducer,
  EventConsumer,
  Delivery,
} from '../src/modules/events/events.service';
import { JournalService } from '../src/modules/journal/journal.service';
import { CrisisService } from '../src/modules/safety/crisis.service';
import { createApp } from '../src/app';
import { createLogger } from '../src/config/logger';
import { CompanionService } from '../src/modules/companion/companion.service';
import { CommunityService } from '../src/modules/community/community.service';
import { FilesService } from '../src/modules/files/files.service';
import { ObjectStorage } from '../src/modules/files/storage';
export class MemoryStorage implements ObjectStorage {
  objects = new Map<string, unknown>();
  upload = jest.fn(async (key: string, contentType: string, size: number) => ({
    url: 'https://storage.test/upload',
    fields: { key, 'Content-Type': contentType, size: String(size) },
  }));
  download = jest.fn(async (key: string) => 'https://storage.test/' + key);
  putJson = jest.fn(async (key: string, value: unknown) => {
    this.objects.set(key, value);
  });
  deletePrefix = jest.fn(async (prefix: string) => {
    for (const key of this.objects.keys())
      if (key.startsWith(prefix)) this.objects.delete(key);
  });
  head = jest.fn(async (_key: string) => ({
    contentType: 'image/png',
    size: 1024,
  }));
}
export class MemoryProducer implements EventProducer {
  messages: { topic: string; key: string; event: DomainEvent }[] = [];
  publish = jest.fn(async (topic: string, key: string, event: DomainEvent) => {
    this.messages.push({ topic, key, event });
  });
}
export class MemoryConsumer implements EventConsumer {
  private handler?: (delivery: Delivery) => Promise<void>;
  async start(handler: (delivery: Delivery) => Promise<void>) {
    this.handler = handler;
  }
  async stop() {
    this.handler = undefined;
  }
  async deliver(delivery: Delivery) {
    if (!this.handler) throw new Error('Not started');
    await this.handler(delivery);
  }
}
export const aiMock = (): jest.Mocked<AiClient> => ({
  crisisCheck: jest.fn().mockResolvedValue({ riskLevel: 'LOW' }),
  companionChat: jest
    .fn()
    .mockResolvedValue({ reply: 'What would feel helpful right now?' }),
  moderate: jest.fn().mockResolvedValue({ verdict: 'OK' }),
});
export const identityMock = (): jest.Mocked<IdentityClient> => ({
  consent: jest.fn().mockResolvedValue({ }),
  restrictions: jest
    .fn()
    .mockResolvedValue({ member: true, muted: false, banned: false }),
  membership: jest.fn().mockResolvedValue({ active: true, role: 'MEMBER' }),
  aliases: jest.fn(async (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, 'QuietOtter'])),
  ),
  report: jest.fn().mockResolvedValue(undefined),
  exportData: jest.fn(async (userId: string) => ({
    id: userId,
    alias: 'QuietOtter',
  })),
  resources: jest.fn().mockResolvedValue([
    {
      name: 'Test directory',
      url: 'https://example.org/support',
      region: 'GLOBAL',
    },
  ]),
  invalidate: jest.fn(),
});
export function fixture(now = new Date('2026-10-21T17:30:00Z')) {
  const ai = aiMock(),
    identity = identityMock(),
    producer = new MemoryProducer();
  const service = new JournalService(
    identity,
    new CrisisService(ai, identity),
    producer,
    () => now,
  );
  const companion = new CompanionService(
    identity,
    new CrisisService(ai, identity),
    ai,
    () => now,
  );
  const emit = jest.fn();
  const community = new CommunityService(identity, ai);
  const storage = new MemoryStorage();
  const files = new FilesService(storage, community, () => now);
  const app = createApp({
    community,
    files,
    companion,
    journal: service,
    logger: createLogger('silent'),
    auth: (req, _res, next) => {
      req.auth = {
        userId: req.header('X-Test-User') ?? 'user-1',
        roles: [],
        token: 'test-token',
      };
      next();
    },
  });
  return {
    ai,
    identity,
    producer,
    service,
    app,
    companion,
    emit,
    community,
    storage,
    files,
  };
}
export function database() {
  let mongo: MongoMemoryReplSet;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: '7.0.14' },
    });
    await mongoose.connect(mongo.getUri());
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  }, 600000);
  beforeEach(async () => {
    await Promise.all(
      Object.values(mongoose.connection.collections).map((c) =>
        c.deleteMany({}),
      ),
    );
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });
}
