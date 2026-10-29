import express, { RequestHandler } from 'express';
import { Logger } from 'pino';
import { trace, limiter, errorHandler } from './middleware/http';
import { JournalService } from './modules/journal/journal.service';
import { journalRoutes } from './modules/journal/journal.routes';
import { AppError } from './utils/errors';
import { CompanionService } from './modules/companion/companion.service';
import { companionRoutes } from './modules/companion/companion.routes';
import { CommunityService } from './modules/community/community.service';
import { communityRoutes } from './modules/community/community.routes';
import { FilesService } from './modules/files/files.service';
import { filesRoutes } from './modules/files/files.routes';
import { documentationRoutes } from './documentation/routes';
export function createApp(deps: {
  auth: RequestHandler;
  journal: JournalService;
  logger: Logger;
  rateLimit?: number;
  companion?: CompanionService;
  community?: CommunityService;
  files?: FilesService;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(trace(deps.logger), limiter(deps.rateLimit));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(documentationRoutes());
  app.use(
    express.json({ limit: '64kb' }),
    deps.auth,
    journalRoutes(deps.journal),
  );
  if (deps.companion) app.use(companionRoutes(deps.companion));
  if (deps.community) app.use(communityRoutes(deps.community));
  if (deps.files) app.use(filesRoutes(deps.files));
  app.use((_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Route not found')),
  );
  app.use(errorHandler);
  return app;
}
