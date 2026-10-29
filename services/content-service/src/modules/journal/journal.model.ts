import { Schema, model } from 'mongoose';
const journal = new Schema(
  {
    userId: { type: String, required: true },
    text: { type: String, required: true },
    moodScore: { type: Number, min: 1, max: 5, required: true },
    tags: [String],
    crisisFlag: { type: Boolean, required: true },
    revision: { type: Number, default: 1 },
  },
  { timestamps: true, collection: 'journal_entries' },
);
journal.set('toJSON', {
  transform: (_doc, value) => {
    const { __v, ...publicEntry } = value;
    return publicEntry;
  },
});
journal.index({ userId: 1, createdAt: -1 });
export const JournalEntry = model('JournalEntry', journal);
const mood = new Schema(
  {
    userId: { type: String, required: true },
    date: { type: String, required: true },
    moodScore: { type: Number, min: 1, max: 5, required: true },
    energy: { type: Number, min: 1, max: 5 },
    sleepHours: { type: Number, min: 0, max: 24 },
    tags: [String],
    note: String,
  },
  { collection: 'mood_logs' },
);
mood.set('toJSON', {
  transform: (_doc, value) => {
    const { __v, ...publicMood } = value;
    return publicMood;
  },
});
mood.index({ userId: 1, date: 1 }, { unique: true });
export const MoodLog = model('MoodLog', mood);
