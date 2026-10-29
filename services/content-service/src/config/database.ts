import mongoose from 'mongoose';
export async function connectDatabase(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.db!.collection('journal_entries').updateMany({}, { $unset: { analysis: '', jobId: '', jobPublished: '' } });
  // Retired feature data only; all other collections are preserved.
  for (const name of ['notifications', 'notification_preferences', 'weekly_insights']) {
    try {
      await mongoose.connection.db!.dropCollection(name);
    } catch (error) {
      if ((error as { code?: number }).code !== 26) throw error;
    }
  }
}
