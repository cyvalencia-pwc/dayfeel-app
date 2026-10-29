import { createServer } from 'http';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as connect, Socket } from 'socket.io-client';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { database, fixture } from './helpers';
import { configureChat } from '../src/modules/chat/chat.socket';
import { ChatMessage } from '../src/modules/community/community.model';
database();
const sockets: Socket[] = [];
let io: Server;
afterEach(async () => {
  sockets.forEach((s) => s.disconnect());
  sockets.length = 0;
  if (io) await new Promise<void>((resolve) => io.close(() => resolve()));
});
async function setup() {
  const f = fixture(),
    http = createServer();
  io = new Server(http);
  const keys = await generateKeyPair('RS256');
  const chat = configureChat(
    io,
    f.community,
    async (token) =>
      (
        await jwtVerify(token, keys.publicKey, {
          algorithms: ['RS256'],
          issuer: 'test',
          audience: 'dayfeel',
        })
      ).payload,
  );
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const url =
    'http://127.0.0.1:' + (http.address() as AddressInfo).port + '/chat';
  async function client(user = 'user-1') {
    const token = await new SignJWT({})
      .setSubject(user)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer('test')
      .setAudience('dayfeel')
      .setProtectedHeader({ alg: 'RS256' })
      .sign(keys.privateKey);
    const socket = connect(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }
  return { ...f, chat, client, url };
}
const send = (s: Socket, event: string, data: unknown): Promise<any> =>
  s.timeout(4000).emitWithAck(event, data);
test('banned user cannot join chat, and invalid JWT cannot connect', async () => {
  const f = await setup(),
    client = await f.client();
  f.identity.restrictions.mockResolvedValue({
    member: true,
    muted: false,
    banned: true,
  });
  expect(
    await send(client, 'room:join', { circleId: randomUUID() }),
  ).toMatchObject({ ok: false, error: { code: 'RESTRICTED' } });
  expect(f.ai.moderate).not.toHaveBeenCalled();
  const bad = connect(f.url, {
    auth: { token: 'invalid' },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(bad);
  await new Promise<void>((resolve) =>
    bad.once('connect_error', () => resolve()),
  );
  expect(bad.connected).toBe(false);
});
test('chat moderates before broadcast, keeps support private, limits sends and emits removal/presence', async () => {
  const f = await setup(),
    circleId = randomUUID(),
    a = await f.client(),
    b = await f.client('other');
  const broadcasts: any[] = [],
    presences: any[] = [],
    removed: any[] = [];
  b.on('message:new', (value) => broadcasts.push(value));
  b.on('presence', (value) => presences.push(value));
  b.on('message:removed', (value) => removed.push(value));
  expect((await send(a, 'room:join', { circleId })).ok).toBe(true);
  await send(b, 'room:join', { circleId });
  f.ai.moderate.mockResolvedValueOnce({ verdict: 'SPAM' });
  const held = await send(a, 'message:send', {
    circleId,
    text: 'Spam fixture',
  });
  expect(held.data.content.status).toBe('HELD');
  f.ai.moderate.mockResolvedValueOnce({ verdict: 'SELF_HARM_RISK' });
  const risky = await send(a, 'message:send', {
    circleId,
    text: 'Synthetic risk',
  });
  expect(risky.data.support.crisisDetected).toBe(true);
  // An ack on the same connection after the broadcast provides ordering without arbitrary sleeps.
  await send(b, 'room:join', { circleId });
  expect(broadcasts).toHaveLength(1);
  expect(JSON.stringify(broadcasts)).not.toMatch(/support|userId|authorId/);
  expect(presences.at(-1)).toHaveProperty('aliases');
  f.chat.removed(circleId, risky.data.content.id);
  await send(b, 'room:join', { circleId });
  expect(removed).toHaveLength(1);
  for (let i = 2; i < 20; i++)
    expect(
      (await send(a, 'message:send', { circleId, text: 'Hello' })).ok,
    ).toBe(true);
  expect(
    await send(a, 'message:send', { circleId, text: 'Limit' }),
  ).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
  expect(await ChatMessage.countDocuments()).toBe(20);
  await send(a, 'room:leave', { circleId });
  expect(
    (await send(a, 'message:send', { circleId, text: 'No room' })).ok,
  ).toBe(false);
});
