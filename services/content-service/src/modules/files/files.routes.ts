import { Router } from 'express';
import { z } from 'zod';
import { validate, asyncRoute } from '../../middleware/http';
import { FilesService } from './files.service';
export function filesRoutes(s: FilesService) {
  const r = Router();
  r.get(
    '/files/download-url',
    validate(
      z.object({ objectKey: z.string().min(1).max(512) }).strict(),
      'query',
    ),
    asyncRoute(async (req, res) => {
      res.json(await s.download(req.auth.userId, String(req.query.objectKey)));
    }),
  );
  return r;
}
