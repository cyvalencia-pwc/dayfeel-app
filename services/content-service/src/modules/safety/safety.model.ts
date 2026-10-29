import { Schema, model } from 'mongoose';
export const CrisisEvent = model(
  'CrisisEvent',
  new Schema(
    {
      userId: { type: String, required: true },
      source: { type: String, enum: ['journal', 'companion'], required: true },
      crisisDetected: { type: Boolean, required: true },
      createdAt: { type: Date, default: Date.now },
    },
    { collection: 'crisis_events', strict: 'throw' },
  ),
);
