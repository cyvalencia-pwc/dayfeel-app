import { randomUUID } from 'crypto';
import { DomainEvent, eventSchema } from './events.schema';
import { ProcessedEvent } from './events.model';
export interface EventProducer {
  publish(topic: string, key: string, event: DomainEvent): Promise<void>;
}
export interface Delivery {
  topic: string;
  partition: number;
  offset: string;
  value: string;
  commit(): Promise<void>;
  heartbeat(): Promise<void>;
}
export interface EventConsumer {
  start(handler: (delivery: Delivery) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}
export function event(
  type: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    id: randomUUID(),
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    payload,
  };
}
export class EventProcessor {
  constructor(
    private producer: EventProducer,
    private handle: (topic: string, event: DomainEvent) => Promise<void>,
    private pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  ) {}
  async process(delivery: Delivery) {
    let parsed: DomainEvent | undefined,
      processed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        parsed = eventSchema.parse(JSON.parse(delivery.value));
        const key = delivery.topic + ':' + parsed.id;
        if (!(await ProcessedEvent.exists({ _id: key }))) {
          await this.handle(delivery.topic, parsed);
          await ProcessedEvent.updateOne(
            { _id: key },
            { $setOnInsert: { processedAt: new Date() } },
            { upsert: true },
          );
        }
        processed = true;
        break;
      } catch {
        if (attempt < 2) {
          await delivery.heartbeat();
          await this.pause(100 * 2 ** attempt);
        }
      }
    }
    if (!processed) {
      // Never copy untrusted bodies, tokens or journal text into a DLT.
      await this.producer.publish(
        delivery.topic + '.DLT',
        String(delivery.partition),
        event('ProcessingFailed', {
          eventId: parsed?.id,
          sourceTopic: delivery.topic,
          partition: delivery.partition,
          offset: delivery.offset,
          code: 'PROCESSING_FAILED',
        }),
      );
    }
    // Commit failures propagate for broker redelivery; they are not processing failures.
    await delivery.commit();
  }
}
