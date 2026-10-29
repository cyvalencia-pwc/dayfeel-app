import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { EventProducer, EventConsumer, Delivery } from './events.service';
import { DomainEvent } from './events.schema';
export class KafkaProducer implements EventProducer {
  constructor(private producer: Producer) {}
  async connect() {
    await this.producer.connect();
  }
  async close() {
    await this.producer.disconnect();
  }
  async publish(topic: string, key: string, event: DomainEvent) {
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(event) }],
    });
  }
}
export class KafkaConsumer implements EventConsumer {
  constructor(private consumer: Consumer) {}
  async start(handler: (delivery: Delivery) => Promise<void>) {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: ['identity-events'],
      fromBeginning: true,
    });
    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        await handler({
          topic,
          partition,
          offset: message.offset,
          value: message.value?.toString() ?? '',
          heartbeat,
          commit: () =>
            this.consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (BigInt(message.offset) + 1n).toString(),
              },
            ]),
        });
      },
    });
  }
  async stop() {
    await this.consumer.disconnect();
  }
}
export function kafkaAdapters(brokers: string[]) {
  const kafka = new Kafka({
    clientId: 'content-service',
    brokers,
    logLevel: logLevel.NOTHING,
  });
  return {
    producer: new KafkaProducer(kafka.producer()),
    consumer: new KafkaConsumer(kafka.consumer({ groupId: 'content-service' })),
  };
}
