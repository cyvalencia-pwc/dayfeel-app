import { database, MemoryConsumer, MemoryProducer } from './helpers';
import {
  EventProcessor,
  event,
  Delivery,
} from '../src/modules/events/events.service';
import { ProcessedEvent } from '../src/modules/events/events.model';
database();
function delivery(
  value = JSON.stringify(event('Test', { userId: 'u' })),
): Delivery {
  return {
    topic: 'identity-events',
    partition: 0,
    offset: '9007199254740993',
    value,
    commit: jest.fn().mockResolvedValue(undefined),
    heartbeat: jest.fn().mockResolvedValue(undefined),
  };
}
test('in-memory consumer processes once, commits duplicate and persists 7-day TTL', async () => {
  const producer = new MemoryProducer(),
    handle = jest.fn(),
    processor = new EventProcessor(producer, handle),
    consumer = new MemoryConsumer();
  await consumer.start((d) => processor.process(d));
  const d = delivery();
  await consumer.deliver(d);
  await consumer.deliver(d);
  expect(handle).toHaveBeenCalledTimes(1);
  expect(d.commit).toHaveBeenCalledTimes(2);
  const indexes = await ProcessedEvent.collection.indexes();
  expect(indexes.some((i) => i.expireAfterSeconds === 604800)).toBe(true);
  await consumer.stop();
});
test('three attempts/backoff precede DLT and commit; raw content is excluded', async () => {
  const producer = new MemoryProducer(),
    handle = jest.fn().mockRejectedValue(new Error('private text')),
    pause = jest.fn().mockResolvedValue(undefined);
  const processor = new EventProcessor(producer, handle, pause),
    d = delivery(JSON.stringify(event('Test', { text: 'private text' })));
  await processor.process(d);
  expect(handle).toHaveBeenCalledTimes(3);
  expect(pause.mock.calls).toEqual([[100], [200]]);
  expect(producer.messages[0].topic).toBe('identity-events.DLT');
  expect(JSON.stringify(producer.messages)).not.toContain('private text');
  expect(d.commit).toHaveBeenCalledTimes(1);
});
test('failed DLT is not committed or marked processed', async () => {
  const producer = new MemoryProducer();
  producer.publish.mockRejectedValue(new Error('broker down'));
  const d = delivery();
  await expect(
    new EventProcessor(
      producer,
      jest.fn().mockRejectedValue(new Error()),
      async () => {},
    ).process(d),
  ).rejects.toThrow('broker down');
  expect(d.commit).not.toHaveBeenCalled();
  expect(await ProcessedEvent.countDocuments()).toBe(0);
});
test('malformed payload goes to sanitized DLT', async () => {
  const producer = new MemoryProducer(),
    handle = jest.fn(),
    d = delivery('not json secret');
  await new EventProcessor(producer, handle, async () => {}).process(d);
  expect(handle).not.toHaveBeenCalled();
  expect(producer.messages).toHaveLength(1);
  expect(JSON.stringify(producer.messages)).not.toContain('secret');
});

test('offset commit failure propagates without DLT and redelivery skips business work', async () => {
  const producer = new MemoryProducer(),
    handle = jest.fn(),
    processor = new EventProcessor(producer, handle);
  const d = delivery();
  (d.commit as jest.Mock).mockRejectedValueOnce(new Error('commit failed'));
  await expect(processor.process(d)).rejects.toThrow('commit failed');
  expect(producer.publish).not.toHaveBeenCalled();
  await processor.process(d);
  expect(handle).toHaveBeenCalledTimes(1);
});
