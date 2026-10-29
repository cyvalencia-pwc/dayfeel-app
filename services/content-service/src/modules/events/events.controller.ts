import { IdentityClient } from '../../clients/identityClient';
import { JournalEntry, MoodLog } from '../journal/journal.model';
import { CrisisEvent } from '../safety/safety.model';
import { FileMetadata } from '../files/files.model';
import { DeletedUser } from './events.model';
import { DomainEvent } from './events.schema';
import { EventProducer } from './events.service';
import { withUserTransaction } from '../../utils/userTransaction';
import { z } from 'zod';
import { Conversation, CompanionMessage } from '../companion/companion.model';
import { Phase5Handler } from './phase5.handler';
export function eventHandler(
  identity: IdentityClient,
  producer: EventProducer,
  phase4?: {
    deleted?: (userId: string) => void;
  },
  phase5?: Phase5Handler,
) {
  return async (topic: string, event: DomainEvent) => {
    event = {
      ...event,
      type: event.type[0].toUpperCase() + event.type.slice(1),
    };
    if (topic === 'identity-events' && phase5 && (await phase5.handle(event)))
      return;
    if (topic !== 'identity-events') return;
    const userId = z.string().min(1).parse(event.payload.userId);
    identity.invalidate(userId);
    if (event.type === 'ConsentChanged') {
      if (event.payload.companionMemory === false) {
        await Conversation.updateMany({ userId }, { $set: { summary: '' } });
      }
    } else if (event.type === 'UserDeletionRequested') {
      const requestId = z.string().uuid().parse(event.payload.requestId);
      await withUserTransaction(
        userId,
        async (session) => {
          await DeletedUser.updateOne(
            { _id: userId },
            { $setOnInsert: { _id: userId } },
            { upsert: true, session },
          );
          // MongoDB sessions do not support parallel operations within transactions.
          await JournalEntry.deleteMany({ userId }, { session });
          await MoodLog.deleteMany({ userId }, { session });
          await CrisisEvent.deleteMany({ userId }, { session });
          await FileMetadata.deleteMany({ userId }, { session });
          await CompanionMessage.deleteMany({ userId }, { session });
          await Conversation.deleteMany({ userId }, { session });
        },
        true,
      );
      phase4?.deleted?.(userId);
      await producer.publish('content-events', userId, {
        ...event,
        type: 'UserDeletionCompleted',
        payload: { userId, requestId },
      });
    } else if (event.type !== 'ModerationActionCreated') {
      // Unsupported sagas must be visible to operators, never silently acknowledged.
      throw new Error('Unsupported identity event');
    }
  };
}
