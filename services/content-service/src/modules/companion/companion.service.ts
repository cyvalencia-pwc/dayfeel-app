import { randomUUID } from 'crypto';
import { z } from 'zod';
import { AiClient } from '../../clients/aiClient';
import { IdentityClient } from '../../clients/identityClient';
import { AppError } from '../../utils/errors';
import { withUserTransaction } from '../../utils/userTransaction';
import { addDays, localDate } from '../../utils/dates';
import { JournalEntry, MoodLog } from '../journal/journal.model';
import { CrisisService } from '../safety/crisis.service';
import { Conversation, CompanionMessage } from './companion.model';

const replySchema = z.object({ reply: z.string().trim().min(1).max(20000) });
export const exercises = [
  {
    id: 'grounding',
    title: 'Notice your surroundings',
    steps: [
      'Name five things you can see.',
      'Notice the support beneath your feet.',
      'Choose one small next step.',
    ],
  },
  {
    id: 'reflection',
    title: 'A gentle check-in',
    steps: [
      'Name how you feel without judging it.',
      'Notice one thing you need.',
      'Consider someone you trust whom you could contact.',
    ],
  },
];
export const companionDisclaimer =
  'DayFeel supports wellbeing and self-reflection. It does not diagnose, treat, or replace professional care.';
export class CompanionService {
  constructor(
    private identity: IdentityClient,
    private crisis: CrisisService,
    private ai: AiClient,
    private now: () => Date = () => new Date(),
    private historyLimit = 20,
  ) {}
  async create(userId: string, title: string) {
    return withUserTransaction(userId, async (session) => {
      const [doc] = await Conversation.create([{ userId, title }], { session });
      return {
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        disclaimer: companionDisclaimer,
      };
    });
  }
  async list(userId: string, cursor?: string, limit = 20) {
    const docs = await Conversation.find({
      userId,
      ...(cursor ? { _id: { $lt: cursor } } : {}),
    })
      .select('_id title createdAt updatedAt')
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    return {
      conversations: docs.slice(0, limit),
      nextCursor: docs.length > limit ? String(docs[limit - 1]._id) : null,
    };
  }
  async messages(userId: string, id: string, cursor?: string, limit = 20) {
    if (!(await Conversation.exists({ _id: id, userId })))
      throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    const docs = await CompanionMessage.find({
      userId,
      conversationId: id,
      ...(cursor ? { _id: { $lt: cursor } } : {}),
    })
      .select('_id role text support createdAt')
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    return {
      messages: docs.slice(0, limit),
      nextCursor: docs.length > limit ? String(docs[limit - 1]._id) : null,
    };
  }
  async rename(userId: string, id: string, title: string) {
    return withUserTransaction(userId, async (session) => {
      const doc = await Conversation.findOneAndUpdate(
        { _id: id, userId },
        { $set: { title, titleEdited: true } },
        { session, new: true },
      );
      if (!doc) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
      return { id: doc.id, title: doc.title };
    });
  }
  async remove(userId: string, id: string) {
    await withUserTransaction(userId, async (session) => {
      const doc = await Conversation.findOneAndDelete(
        { _id: id, userId },
        { session },
      );
      if (!doc) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
      await CompanionMessage.deleteMany(
        { userId, conversationId: id },
        { session },
      );
    });
  }
  async send(
    userId: string,
    id: string,
    input: { text: string; region: string; timezone: string },
    token: string,
  ) {
    const lease = randomUUID();
    const userMessage = await withUserTransaction(userId, async (session) => {
      const conversation = await Conversation.findOneAndUpdate(
        {
          _id: id,
          userId,
          $or: [{ lease: null }, { leaseUntil: { $lt: this.now() } }],
        },
        {
          $set: { lease, leaseUntil: new Date(this.now().getTime() + 120000) },
        },
        { session },
      );
      if (!conversation) {
        if (!(await Conversation.exists({ _id: id, userId }).session(session)))
          throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
        throw new AppError(
          409,
          'CONVERSATION_BUSY',
          'Wait for the current reply',
        );
      }
      if (
        !conversation.titleEdited &&
        ['New conversation', 'A little space to reflect'].includes(
          conversation.title,
        ) &&
        !(await CompanionMessage.exists({
          conversationId: id,
          userId,
          role: 'USER',
        }).session(session))
      ) {
        const text = input.text.trim().replace(/\s+/g, ' ');
        const title =
          text.length > 80 ? text.slice(0, 79).trimEnd() + '…' : text;
        await Conversation.updateOne(
          { _id: id, userId },
          { $set: { title } },
          { session },
        );
      }
      const [message] = await CompanionMessage.create(
        [{ userId, conversationId: id, role: 'USER', text: input.text }],
        { session },
      );
      return message;
    });
    try {
      // Nothing from this turn reaches generative AI before mandatory screening.
      const support = await this.crisis.check(
        userId,
        input.text,
        token,
        input.region,
        'companion',
      );
      await withUserTransaction(userId, async (session) => {
        if (
          !(await Conversation.exists({ _id: id, userId, lease }).session(
            session,
          ))
        )
          throw new AppError(
            409,
            'CONVERSATION_CHANGED',
            'Conversation changed',
          );
        await CompanionMessage.updateOne(
          { _id: userMessage._id, userId },
          { $set: { screened: true, safe: !support } },
          { session },
        );
      });
      if (support)
        return await this.persistReply(
          userId,
          id,
          lease,
          'CRISIS',
          support.message,
          support,
        );
      const consent = await this.identity.consent(userId, true);
      let context: unknown;
      if (consent.companionMemoryOptIn) {
        const today = localDate(this.now(), input.timezone);
        const moods = await MoodLog.find({
          userId,
          date: { $gte: addDays(today, -6), $lte: today },
        }).lean();
        context = {
          averageMood: moods.length
            ? moods.reduce((sum, m) => sum + m.moodScore, 0) / moods.length
            : null,
        };
      }
      // Exclude flagged and unscreened messages, including failed previous turns.
      const history = await CompanionMessage.find({
        userId,
        conversationId: id,
        safe: true,
        screened: true,
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(this.historyLimit)
        .lean();
      const conversation = await Conversation.findOne({
        _id: id,
        userId,
        lease,
      }).lean();
      if (!conversation)
        throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
      const latest = await this.identity.consent(userId, true);
      const memory =
        consent.companionMemoryOptIn && latest.companionMemoryOptIn;
      let reply: z.infer<typeof replySchema>;
      try {
        reply = replySchema.parse(
          await this.ai.companionChat(
            {
              messages: history.reverse().map((m) => ({
                role: m.role === 'USER' ? 'user' : 'assistant',
                content: m.text,
              })),
              ...(memory ? { context, summary: conversation.summary } : {}),
              disclaimer: companionDisclaimer,
            },
            token,
          ),
        );
      } catch {
        throw new AppError(
          503,
          'AI_UNAVAILABLE',
          'Companion is temporarily unavailable. Your message was saved.',
        );
      }
      const finalConsent = await this.identity.consent(userId, true);
      return await this.persistReply(
        userId,
        id,
        lease,
        'ASSISTANT',
        reply.reply,
        undefined,
        !!finalConsent.companionMemoryOptIn,
      );
    } finally {
      await Conversation.updateOne(
        { _id: id, userId, lease },
        { $set: { lease: null, leaseUntil: null } },
      );
    }
  }
  private async persistReply(
    userId: string,
    id: string,
    lease: string,
    role: 'ASSISTANT' | 'CRISIS',
    text: string,
    support?: unknown,
    memory = false,
  ) {
    return withUserTransaction(userId, async (session) => {
      const conversation = await Conversation.findOneAndUpdate(
        { _id: id, userId, lease },
        { $inc: { replyCount: 1 } },
        { new: true, session },
      );
      if (!conversation)
        throw new AppError(409, 'CONVERSATION_CHANGED', 'Conversation changed');
      const [reply] = await CompanionMessage.create(
        [
          {
            userId,
            conversationId: id,
            role,
            text,
            support,
            screened: true,
            safe: role === 'ASSISTANT',
          },
        ],
        { session },
      );
      // Bounded extractive summary; never includes crisis or unscreened content.
      if (role === 'ASSISTANT' && !memory) {
        conversation.summary = '';
        await conversation.save({ session });
      }
      if (role === 'ASSISTANT' && memory && conversation.replyCount % 5 === 0) {
        const recent = await CompanionMessage.find({
          userId,
          conversationId: id,
          safe: true,
          screened: true,
        })
          .sort({ _id: -1 })
          .limit(10)
          .session(session);
        conversation.summary = recent
          .reverse()
          .map((m) => `${m.role}: ${m.text.slice(0, 200)}`)
          .join('\n')
          .slice(0, 2500);
        await conversation.save({ session });
      }
      return {
        message: { id: reply.id, role, text, createdAt: reply.createdAt },
        support: support ?? null,
        disclaimer: companionDisclaimer,
      };
    });
  }
}
