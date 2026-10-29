import { Schema, model } from 'mongoose';
const processed = new Schema(
  { _id: String, processedAt: { type: Date, default: Date.now } },
  { collection: 'processed_events' },
);
processed.index({ processedAt: 1 }, { expireAfterSeconds: 604800 });
export const ProcessedEvent = model('ProcessedEvent', processed);
export const DeletedUser = model(
  'DeletedUser',
  new Schema({ _id: String }, { collection: 'deleted_users' }),
);
