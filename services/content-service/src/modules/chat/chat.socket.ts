import { Server } from 'socket.io';
import { JWTPayload } from 'jose';
import { Schema, model } from 'mongoose';
import { z } from 'zod';
import { CommunityService } from '../community/community.service';
import { DeletedUser } from '../events/events.model';
import { AppError } from '../../utils/errors';
import { withUserTransaction } from '../../utils/userTransaction';
const rate = new Schema(
  {
    _id: String,
    userId: String,
    count: { type: Number, default: 0 },
    expiresAt: Date,
  },
  { collection: 'chat_rate_limits' },
);
rate.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const ChatRate = model('ChatRate', rate);
const roomInput = z.object({ circleId: z.string().uuid() }).strict();
export function configureChat(
  io: Server,
  community: CommunityService,
  verify: (token: string) => Promise<JWTPayload>,
) {
  const n = io.of('/chat');
  n.use((socket, next) => {
    void (async () => {
      try {
        const token = z.string().min(1).parse(socket.handshake.auth?.token),
          claims = await verify(token);
        if (
          !claims.sub ||
          !claims.exp ||
          claims.exp * 1000 <= Date.now() ||
          (await DeletedUser.exists({ _id: claims.sub }))
        )
          throw new Error();
        socket.data.userId = claims.sub;
        socket.data.exp = claims.exp;
        socket.data.token = token;
        next();
      } catch {
        next(new Error('Valid authentication required'));
      }
    })();
  });
  const room = (circle: string) => 'circle:' + circle;
  const presence = (circle: string) => {
    const aliases = new Set<string>();
    for (const socket of n.sockets.values())
      if (socket.rooms.has(room(circle))) aliases.add(socket.data.alias);
    n.to(room(circle)).emit('presence', {
      circleId: circle,
      aliases: [...aliases],
    });
  };
  n.on('connection', (socket) => {
    let lastTyping = 0;
    const execute =
      (fn: (input: unknown) => Promise<unknown>) =>
      (input: unknown, ack?: (response: unknown) => void) => {
        void (async () => {
          try {
            if (socket.data.exp * 1000 <= Date.now()) {
              socket.disconnect(true);
              return;
            }
            if (await DeletedUser.exists({ _id: socket.data.userId }))
              throw new AppError(403, 'ACCOUNT_DELETED', 'Access denied');
            const data = await fn(input);
            if (typeof ack === 'function') ack({ ok: true, data });
          } catch (error) {
            const code =
              error instanceof AppError
                ? error.code
                : error instanceof z.ZodError
                  ? 'VALIDATION_ERROR'
                  : 'REQUEST_FAILED';
            const result = { code, message: 'Request could not be completed' };
            socket.emit('error', result);
            if (typeof ack === 'function') ack({ ok: false, error: result });
          }
        })();
      };
    socket.on(
      'room:join',
      execute(async (input) => {
        const { circleId } = roomInput.parse(input);
        if (socket.rooms.size > 20)
          throw new AppError(429, 'TOO_MANY_ROOMS', 'Room limit reached');
        await community.access(socket.data.userId, circleId);
        socket.data.alias = await community.alias(socket.data.userId);
        await socket.join(room(circleId));
        presence(circleId);
        return { circleId };
      }),
    );
    socket.on(
      'room:leave',
      execute(async (input) => {
        const { circleId } = roomInput.parse(input);
        await socket.leave(room(circleId));
        presence(circleId);
        return { circleId };
      }),
    );
    socket.on(
      'message:send',
      execute(async (input) => {
        const { circleId, text } = roomInput
          .extend({ text: z.string().trim().min(1).max(5000) })
          .parse(input);
        if (!socket.rooms.has(room(circleId)))
          throw new AppError(403, 'NOT_JOINED', 'Join the room first');
        await community.access(socket.data.userId, circleId);
        const bucket = Math.floor(Date.now() / 60000),
          userId: string = socket.data.userId;
        await withUserTransaction(userId, async (session) => {
          const count = await ChatRate.findOneAndUpdate(
            { _id: userId + ':' + bucket },
            {
              $inc: { count: 1 },
              $setOnInsert: {
                userId,
                expiresAt: new Date((bucket + 2) * 60000),
              },
            },
            { upsert: true, new: true, session },
          );
          if (count.count > 20)
            throw new AppError(429, 'RATE_LIMITED', 'Too many messages');
        });
        const result = await community.create(
          userId,
          circleId,
          text,
          socket.data.token,
          'chat',
        );
        if (result.content.status === 'VISIBLE') {
          const recipients = await n.in(room(circleId)).fetchSockets();
          for (const recipient of recipients) {
            recipient.emit('message:new', { ...result.content, own: recipient.data.userId === userId });
          }
        }
        return result;
      }),
    );
    socket.on(
      'typing',
      execute(async (input) => {
        const { circleId } = roomInput.parse(input);
        if (Date.now() - lastTyping < 1000) return;
        lastTyping = Date.now();
        if (!socket.rooms.has(room(circleId)))
          throw new AppError(403, 'NOT_JOINED', 'Join the room first');
        await community.access(socket.data.userId, circleId);
        socket
          .to(room(circleId))
          .emit('typing', { circleId, authorAlias: socket.data.alias });
      }),
    );
    const expires = setTimeout(
      () => socket.disconnect(true),
      Math.min(2147483647, socket.data.exp * 1000 - Date.now()),
    );
    expires.unref();
    socket.on('disconnecting', () => {
      const circles = [...socket.rooms]
        .filter((r) => r.startsWith('circle:'))
        .map((r) => r.slice(7));
      setImmediate(() => circles.forEach(presence));
    });
    socket.on('disconnect', () => clearTimeout(expires));
  });
  return {
    namespace: n,
    evict: (userId: string, circleId?: string) => {
      for (const socket of n.sockets.values())
        if (socket.data.userId === userId) {
          if (circleId) {
            void socket.leave(room(circleId));
            presence(circleId);
          } else socket.disconnect(true);
        }
    },
    removed: (circleId: string, id: string) => {
      n.to(room(circleId)).emit('message:removed', { id, circleId });
    },
    aliasChanged: (userId: string, alias: string) => {
      for (const socket of n.sockets.values())
        if (socket.data.userId === userId) {
          socket.data.alias = alias;
          for (const r of socket.rooms)
            if (r.startsWith('circle:')) presence(r.slice(7));
        }
    },
  };
}
