import { z } from 'zod';
import { regionSchema } from '../safety/safety.schema';
export const timezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid timezone')
  .default('UTC');
const moodScore = z.number().int().min(1).max(5);
const tags = z.array(z.string().trim().min(1).max(40)).max(20).default([]);
export const journalSchema = z
  .object({
    text: z.string().trim().min(1).max(20000),
    moodScore,
    tags,
    timezone,
    region: regionSchema,
  })
  .strict();
export type JournalInput = z.infer<typeof journalSchema>;
export const idSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) });
export const journalPutSchema = journalSchema.extend({
  id: z.string().regex(/^[a-f0-9]{24}$/i),
});
export const deleteSchema = z
  .object({ id: z.string().regex(/^[a-f0-9]{24}$/i) })
  .strict();
export const listSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.string().datetime().optional(),
  })
  .strict();
export const moodSchema = z
  .object({
    moodScore,
    energy: z.number().int().min(1).max(5).optional(),
    sleepHours: z.number().min(0).max(24).optional(),
    tags,
    note: z.string().max(2000).optional(),
    timezone,
  })
  .strict();
export const summarySchema = z
  .object({ range: z.enum(['7d', '30d', '90d']).default('7d'), timezone })
  .strict();
export const calendarSchema = z
  .object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
  .strict();
