import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute, validate } from '../../middleware/http';
import {
  CompanionService,
  exercises,
  companionDisclaimer,
} from './companion.service';
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
export const pagination = z
  .object({
    cursor: objectId.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
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
  });
export function companionRoutes(service: CompanionService) {
  const r = Router();
  r.get(
    '/companion/exercises',
    asyncRoute(async (_req, res) => {
      res.json({ exercises, disclaimer: companionDisclaimer });
    }),
  );
  r.post(
    '/companion/conversations',
    validate(
      z
        .object({
          title: z.string().trim().min(1).max(120).default('New conversation'),
        })
        .strict(),
    ),
    asyncRoute(async (req, res) => {
      res
        .status(201)
        .json(await service.create(req.auth.userId, req.body.title));
    }),
  );
  r.get(
    '/companion/conversations',
    validate(pagination, 'query'),
    asyncRoute(async (req, res) => {
      res.json(
        await service.list(
          req.auth.userId,
          req.query.cursor as string | undefined,
          Number(req.query.limit),
        ),
      );
    }),
  );
  r.get(
    '/companion/conversations/:id/messages',
    validate(z.object({ id: objectId }), 'params'),
    validate(pagination, 'query'),
    asyncRoute(async (req, res) => {
      res.json(
        await service.messages(
          req.auth.userId,
          req.params.id,
          req.query.cursor as string | undefined,
          Number(req.query.limit),
        ),
      );
    }),
  );
  r.post(
    '/companion/conversations/:id/messages',
    validate(z.object({ id: objectId }), 'params'),
    validate(
      z
        .object({
          text: z.string().trim().min(1).max(20000),
          region: z.string().min(1).max(16).default('GLOBAL'),
          timezone: timezone.default('UTC'),
        })
        .strict(),
    ),
    asyncRoute(async (req, res) => {
      res
        .status(201)
        .json(
          await service.send(
            req.auth.userId,
            req.params.id,
            req.body,
            req.auth.token,
          ),
        );
    }),
  );
  r.patch(
    '/companion/conversations/:id',
    validate(z.object({ id: objectId }), 'params'),
    validate(z.object({ title: z.string().trim().min(1).max(120) }).strict()),
    asyncRoute(async (req, res) => {
      res.json(
        await service.rename(req.auth.userId, req.params.id, req.body.title),
      );
    }),
  );
  r.delete(
    '/companion/conversations/:id',
    validate(z.object({ id: objectId }), 'params'),
    asyncRoute(async (req, res) => {
      await service.remove(req.auth.userId, req.params.id);
      res.sendStatus(204);
    }),
  );
  return r;
}
