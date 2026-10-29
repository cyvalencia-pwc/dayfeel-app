import pino from 'pino';
export const createLogger = (level = 'info') =>
  pino({
    level,
    base: { service: 'content-service' },
    redact: ['text', 'note', 'authorization', 'internalKey', 'req', 'res'],
  });
