import { Logger } from 'pino';
declare global {
  namespace Express {
    interface Request {
      traceId: string;
      log: Logger;
      auth: { userId: string; roles: string[]; token: string };
    }
  }
}
export {};
