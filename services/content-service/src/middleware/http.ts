import { randomUUID } from 'crypto';
import { RequestHandler, ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { Logger } from 'pino';
import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors';
export const trace =
  (logger: Logger): RequestHandler =>
  (req, res, next) => {
    req.traceId = randomUUID();
    req.log = logger.child({ traceId: req.traceId });
    res.setHeader('X-Trace-Id', req.traceId);
    res.on('finish', () =>
      req.log.info(
        { method: req.method, status: res.statusCode },
        'request completed',
      ),
    );
    next();
  };
export const validate =
  (
    schema: z.ZodTypeAny,
    source: 'body' | 'query' | 'params' = 'body',
  ): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success)
      return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request'));
    req[source] = result.data;
    next();
  };
export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) =>
    next(
      req.auth?.roles.some((r) => roles.includes(r))
        ? undefined
        : new AppError(403, 'FORBIDDEN', 'Access denied'),
    );
export const limiter = (limit = 120) =>
  rateLimit({
    windowMs: 60000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests')),
  });
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const known = err instanceof AppError;
  const status = known
    ? err.status
    : err.type === 'entity.parse.failed'
      ? 400
      : err.type === 'entity.too.large'
        ? 413
        : 500;
  req.log?.error(
    { status, code: known ? err.code : 'REQUEST_FAILED' },
    'request failed',
  );
  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    code: known ? err.code : 'REQUEST_FAILED',
    message: known ? err.message : 'Request could not be completed',
    ...(known && err.restrictedUntil ? { restrictedUntil: err.restrictedUntil } : {}),
    path: req.path,
    traceId: req.traceId,
  });
};
export const asyncRoute =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
