import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute, validate } from '../../middleware/http';
import { objectId, pagination } from '../companion/companion.routes';
import { CommunityService } from './community.service';
export function communityRoutes(s: CommunityService) {
  const r = Router(),
    id = validate(z.object({ id: objectId }), 'params'),
    circle = validate(z.object({ id: z.string().uuid() }), 'params');
  const body = validate(
    z.object({ text: z.string().trim().min(1).max(10000) }).strict(),
  );
  r.get('/moderation/reports/:id/content', validate(z.object({ id: z.string().uuid() }), 'params'),
    asyncRoute(async (req, res) => res.json(await s.reportedContent(req.auth.token, req.params.id))));
  r.post('/comments/:id/report', id,
    validate(z.object({ reason: z.enum(['HARASSMENT', 'SPAM', 'UNSAFE', 'OTHER']) }).strict()),
    asyncRoute(async (req, res) => {
      res.status(201).json(await s.reportComment(req.auth.userId, req.params.id, req.body.reason, req.auth.token));
    }));
  r.get('/circles/:id/chat/messages', circle,
    validate(z.object({ cursor: objectId.optional() }), 'query'),
    asyncRoute(async (req, res) => {
      res.json(await s.chatHistory(req.auth.userId, req.params.id, req.query.cursor as string | undefined));
    }));
  r.get(
    '/circles/:id/posts',
    circle,
    validate(pagination, 'query'),
    asyncRoute(async (req, res) => {
      res.json(
        await s.posts(
          req.auth.userId,
          req.params.id,
          req.query.cursor as string | undefined,
          Number(req.query.limit),
        ),
      );
    }),
  );
  r.post(
    '/circles/:id/posts',
    circle,
    body,
    asyncRoute(async (req, res) => {
      res
        .status(201)
        .json(
          await s.create(
            req.auth.userId,
            req.params.id,
            req.body.text,
            req.auth.token,
          ),
        );
    }),
  );
  r.get(
    '/posts/:id',
    id,
    asyncRoute(async (req, res) => {
      res.json(s.dto(await s.getPost(req.auth.userId, req.params.id), req.auth.userId));
    }),
  );
  r.post('/posts/:id/report', id,
    validate(z.object({ reason: z.enum(['HARASSMENT', 'SPAM', 'UNSAFE', 'OTHER']) }).strict()),
    asyncRoute(async (req, res) => {
      res.status(201).json(await s.reportPost(req.auth.userId, req.params.id, req.body.reason, req.auth.token));
    }));
  r.delete(
    '/posts/:id',
    id,
    asyncRoute(async (req, res) => {
      await s.remove(req.auth.userId, req.params.id, 'post');
      res.sendStatus(204);
    }),
  );
  r.get(
    '/posts/:id/comments',
    id,
    validate(pagination, 'query'),
    asyncRoute(async (req, res) => {
      res.json(
        await s.comments(
          req.auth.userId,
          req.params.id,
          req.query.cursor as string | undefined,
          Number(req.query.limit),
        ),
      );
    }),
  );
  r.post(
    '/posts/:id/comments',
    id,
    body,
    asyncRoute(async (req, res) => {
      const post = await s.getPost(req.auth.userId, req.params.id);
      res
        .status(201)
        .json(
          await s.create(
            req.auth.userId,
            post.circleId,
            req.body.text,
            req.auth.token,
            'comment',
            post.id,
          ),
        );
    }),
  );
  r.get('/posts/:id/reactions', id, asyncRoute(async (req, res) => {
    res.json(await s.reactions(req.auth.userId, req.params.id));
  }));
  r.put(
    '/posts/:id/reactions',
    id,
    validate(
      z
        .object({ type: z.enum(['support', 'hug', 'relate', 'helpful']).nullable() })
        .strict(),
    ),
    asyncRoute(async (req, res) => {
      res.json(await s.react(req.auth.userId, req.params.id, req.body.type));
    }),
  );
  r.delete(
    '/comments/:id',
    id,
    asyncRoute(async (req, res) => {
      await s.remove(req.auth.userId, req.params.id, 'comment');
      res.sendStatus(204);
    }),
  );
  return r;
}
