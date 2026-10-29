import { withUserTransaction } from '../../utils/userTransaction';
import { z } from 'zod';
import { IdentityClient } from '../../clients/identityClient';
import { CrisisService } from '../safety/crisis.service';
import { EventProducer } from '../events/events.service';
import { DeletedUser } from '../events/events.model';
import { JournalEntry, MoodLog } from './journal.model';
import { JournalInput, moodSchema } from './journal.schema';
import { AppError } from '../../utils/errors';
import { localDate, addDays } from '../../utils/dates';
export class JournalService {
  constructor(
    private identity: IdentityClient,
    private crisis: CrisisService,
    private producer: EventProducer,
    private now = () => new Date(),
  ) {}
  async active(user: string) {
    if (await DeletedUser.exists({ _id: user }))
      throw new AppError(403, 'ACCOUNT_DELETED', 'Access denied');
  }
  async get(user: string, id: string) {
    const entry = await JournalEntry.findOne({ _id: id, userId: user });
    if (!entry) throw new AppError(404, 'NOT_FOUND', 'Journal entry not found');
    return entry;
  }
  async list(user: string, limit: number, before?: string) {
    return JournalEntry.find({
      userId: user,
      ...(before ? { createdAt: { $lt: new Date(before) } } : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);
  }
  async save(user: string, input: JournalInput, token: string, id?: string) {
    await this.active(user);
    const existing = id ? await this.get(user, id) : null;
    const support = await this.crisis.check(
      user,
      input.text,
      token,
      input.region,
    );
    const values = {
      text: input.text,
      moodScore: input.moodScore,
      tags: input.tags,
      crisisFlag: !!support,
    };
    const entry = await withUserTransaction(user, async (session) =>
      existing
        ? await JournalEntry.findOneAndUpdate(
            { _id: id, userId: user, revision: existing.revision },
            { $set: values, $inc: { revision: 1 } },
            { new: true, runValidators: true, session },
          )
        : (
            await JournalEntry.create([{ userId: user, ...values }], {
              session,
            })
          )[0],
    );
    if (!entry)
      throw new AppError(
        409,
        'CONCURRENT_EDIT',
        'Journal entry changed; reload and retry',
      );
    const mood = await this.putMood(user, {
      moodScore: input.moodScore,
      tags: input.tags,
      timezone: input.timezone,
    });
    return { entry, support, streak: mood.streak };
  }
  async remove(user: string, id: string) {
    const result = await JournalEntry.deleteOne({ _id: id, userId: user });
    if (!result.deletedCount)
      throw new AppError(404, 'NOT_FOUND', 'Journal entry not found');
  }
  async putMood(user: string, input: z.infer<typeof moodSchema>) {
    await this.active(user);
    const date = localDate(this.now(), input.timezone);
    const { timezone, ...values } = input;
    const mood = await withUserTransaction(user, async (session) =>
      MoodLog.findOneAndUpdate(
        { userId: user, date },
        { $set: values },
        { upsert: true, new: true, runValidators: true, session },
      ),
    );
    return { mood, streak: await this.streak(user, date) };
  }
  async streak(user: string, today: string) {
    const days = await MoodLog.find({ userId: user, date: { $lte: today } })
      .sort({ date: -1 })
      .select('date')
      .lean();
    let cursor = today,
      count = 0;
    if (days[0]?.date === addDays(today, -1)) cursor = days[0].date;
    for (const day of days) {
      if (day.date !== cursor) break;
      count++;
      cursor = addDays(cursor, -1);
    }
    return count;
  }
  async summary(user: string, range: string, timezone: string) {
    const today = localDate(this.now(), timezone),
      start = addDays(today, 1 - parseInt(range));
    const rows = await MoodLog.find({
      userId: user,
      date: { $gte: start, $lte: today },
    })
      .sort({ date: 1 })
      .select('-__v')
      .lean();
    return {
      range,
      from: start,
      to: today,
      count: rows.length,
      averageMood: rows.length
        ? rows.reduce((sum, row) => sum + row.moodScore, 0) / rows.length
        : null,
      streak: await this.streak(user, today),
      days: rows,
    };
  }
  async calendar(user: string, month: string) {
    return MoodLog.find({
      userId: user,
      date: { $gte: month + '-01', $lte: month + '-31' },
    }).sort({ date: 1 });
  }
}
