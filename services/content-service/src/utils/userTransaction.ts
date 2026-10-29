import mongoose, { ClientSession, Schema, model } from 'mongoose';
import { AppError } from './errors';
// Every user-data writer takes this document's write lock. A deletion therefore
// cannot race with a writer and leave resurrected content after its tombstone.
export const UserState = model(
  'UserState',
  new Schema(
    {
      _id: String,
      deleted: { type: Boolean, default: false },
      generation: { type: Number, default: 0 },
    },
    { collection: 'user_states' },
  ),
);
export async function withUserTransaction<T>(
  userId: string,
  work: (session: ClientSession) => Promise<T>,
  deleting = false,
): Promise<T> {
  await UserState.updateOne(
    { _id: userId },
    { $setOnInsert: { deleted: false, generation: 0 } },
    { upsert: true },
  ).catch((error) => {
    if (error.code !== 11000) throw error;
  });
  return mongoose.connection.transaction(async (session) => {
    const state = await UserState.findOneAndUpdate(
      { _id: userId },
      { $inc: { generation: 1 } },
      { new: true, session },
    );
    if (state?.deleted && !deleting)
      throw new AppError(403, 'ACCOUNT_DELETED', 'Access denied');
    if (deleting)
      await UserState.updateOne(
        { _id: userId },
        { $set: { deleted: true } },
        { session },
      );
    return work(session);
  });
}
