import { z } from 'zod';
export const eventSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  version: z.literal(1),
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()),
});
export type DomainEvent = z.infer<typeof eventSchema>;
