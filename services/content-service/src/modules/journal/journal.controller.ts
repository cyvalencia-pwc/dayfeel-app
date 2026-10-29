import { RequestHandler } from 'express';
import { JournalService } from './journal.service';
import { asyncRoute } from '../../middleware/http';
export class JournalController {
  constructor(private service: JournalService) {}
  create: RequestHandler = asyncRoute(async (req, res) => {
    res
      .status(201)
      .json(await this.service.save(req.auth.userId, req.body, req.auth.token));
  });
  update: RequestHandler = asyncRoute(async (req, res) => {
    const { id, ...body } = req.body;
    res.json(
      await this.service.save(
        req.auth.userId,
        body,
        req.auth.token,
        req.params.id ?? id,
      ),
    );
  });
  get: RequestHandler = asyncRoute(async (req, res) => {
    res.json(await this.service.get(req.auth.userId, req.params.id));
  });
  list: RequestHandler = asyncRoute(async (req, res) => {
    res.json({
      entries: await this.service.list(
        req.auth.userId,
        Number(req.query.limit),
        req.query.before as string | undefined,
      ),
    });
  });
  remove: RequestHandler = asyncRoute(async (req, res) => {
    await this.service.remove(req.auth.userId, req.params.id ?? req.body.id);
    res.sendStatus(204);
  });
  mood: RequestHandler = asyncRoute(async (req, res) => {
    res.json(await this.service.putMood(req.auth.userId, req.body));
  });
  summary: RequestHandler = asyncRoute(async (req, res) => {
    res.json(
      await this.service.summary(
        req.auth.userId,
        String(req.query.range),
        String(req.query.timezone),
      ),
    );
  });
  calendar: RequestHandler = asyncRoute(async (req, res) => {
    res.json({
      days: await this.service.calendar(
        req.auth.userId,
        String(req.query.month),
      ),
    });
  });
}
