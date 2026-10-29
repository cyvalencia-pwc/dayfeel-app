import mongoose from 'mongoose';
import { readConfig } from './config/env';
import { connectDatabase } from './config/database';
import { createLogger } from './config/logger';
import { jwtAuth, tokenVerifier } from './middleware/auth';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { S3Client } from '@aws-sdk/client-s3';
import { CommunityService } from './modules/community/community.service';
import { configureChat } from './modules/chat/chat.socket';
import { FilesService } from './modules/files/files.service';
import { S3Storage, UnavailableStorage } from './modules/files/storage';
import { Phase5Handler } from './modules/events/phase5.handler';
import { CompanionService } from './modules/companion/companion.service';
import { HttpIdentityClient } from './clients/identityClient';
import { HttpAiClient } from './clients/aiClient';
import { CrisisService } from './modules/safety/crisis.service';
import { JournalService } from './modules/journal/journal.service';
import { kafkaAdapters } from './modules/events/kafka';
import { EventProcessor } from './modules/events/events.service';
import { eventHandler } from './modules/events/events.controller';
import { createApp } from './app';
let startupStage = 'configuration';
async function main() {
  const config = readConfig(),
    logger = createLogger(config.LOG_LEVEL);
  startupStage = 'MongoDB connection and migrations';
  await connectDatabase(config.MONGODB_URI);
  const identity = new HttpIdentityClient(
    config.IDENTITY_URL,
    config.INTERNAL_KEY,
  );
  const ai = new HttpAiClient(config.AI_URL, config.INTERNAL_KEY);
  const community = new CommunityService(identity, ai);
  const storage = config.S3_BUCKET
    ? new S3Storage(
        new S3Client({
          region: config.AWS_REGION,
          endpoint: config.S3_ENDPOINT,
          forcePathStyle: !!config.S3_ENDPOINT,
        }),
        config.S3_BUCKET,
      )
    : new UnavailableStorage();
  const files = new FilesService(storage, community);
  const companion = new CompanionService(
    identity,
    new CrisisService(ai, identity),
    ai,
  );
  const { producer, consumer } = kafkaAdapters(config.KAFKA_BROKERS);
  startupStage = 'Kafka producer connection';
  await producer.connect();
  const journal = new JournalService(
    identity,
    new CrisisService(ai, identity),
    producer,
  );
  const server = createServer(
    createApp({
      auth: jwtAuth(config),
      journal,
      companion,
      community,
      files,
      logger,
    }),
  );
  const io = new SocketServer(server);
  const chat = configureChat(io, community, tokenVerifier(config));
  const phase5 = new Phase5Handler(
    identity,
    storage,
    producer,
    chat,
  );
  startupStage = 'MongoDB indexes';
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  const processor = new EventProcessor(
    producer,
    eventHandler(
      identity,
      producer,
      undefined,
      phase5,
    ),
  );
  startupStage = 'Kafka consumer startup';
  await consumer.start((d) => processor.process(d));
  startupStage = 'HTTP listener';
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  logger.info('Content service ready');
  let dispatching = false;
  const timer = setInterval(async () => {
    if (dispatching) return;
    dispatching = true;
    try {
      const results = await Promise.allSettled([
        community.flushReports(),
        phase5.cleanupDue(),
      ]);
      if (results.some((result) => result.status === 'rejected'))
        logger.warn('Background jobs will retry');
    } catch {
      logger.warn('Analysis dispatch will retry');
    } finally {
      dispatching = false;
    }
  }, 1000);
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    await new Promise<void>((resolve, reject) =>
      io.close((error) => (error ? reject(error) : resolve())),
    );
    await consumer.stop();
    while (dispatching)
      await new Promise((r) => setTimeout(r, 20));
    await producer.close();
    await mongoose.disconnect();
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
main().catch(() => {
  // Do not log exception payloads: connection errors can contain credentials.
  console.error(`Content service startup failed during ${startupStage}; exiting in 5 seconds`);
  // Open MongoDB/Kafka handles can keep a failed startup alive indefinitely.
  // Exit explicitly so Docker's restart policy can retry after dependencies recover.
  setTimeout(() => process.exit(1), 5000);
});
