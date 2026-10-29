import express from 'express';
import request from 'supertest';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { generateKeyPair, exportJWK, SignJWT, KeyLike, JWK } from 'jose';
import { jwtAuth } from '../src/middleware/auth';
import {
  trace,
  errorHandler,
  requireRole,
  limiter,
} from '../src/middleware/http';
import { createLogger } from '../src/config/logger';
import { envSchema } from '../src/config/env';
let server: Server,
  url: string,
  keys: JWK[],
  hits = 0,
  privateKey: KeyLike,
  secondKey: KeyLike;
beforeAll(async () => {
  const first = await generateKeyPair('RS256'),
    second = await generateKeyPair('RS256');
  privateKey = first.privateKey;
  secondKey = second.privateKey;
  keys = [
    { ...(await exportJWK(first.publicKey)), kid: 'first', alg: 'RS256' },
  ];
  server = createServer((_req, res) => {
    hits++;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
function app() {
  const a = express();
  a.use(
    trace(createLogger('silent')),
    jwtAuth({ JWKS_URL: url, JWT_ISSUER: 'issuer', JWT_AUDIENCE: 'audience' }),
  );
  a.get('/', (_req, res) => res.json({ ok: true }));
  a.get('/admin', requireRole('ADMIN'), (_req, res) => res.json({ ok: true }));
  a.use(errorHandler);
  return a;
}
function token(
  key = privateKey,
  kid = 'first',
  issuer = 'issuer',
  exp = '1h',
  roles: string[] = [],
) {
  return new SignJWT({ roles })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject('user')
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience('audience')
    .setExpirationTime(exp)
    .sign(key);
}
test('JWKS caches and refreshes immediately on rotated unknown kid', async () => {
  const a = app(),
    jwt = await token();
  await request(a).get('/').auth(jwt, { type: 'bearer' }).expect(200);
  const count = hits;
  await request(a).get('/').auth(jwt, { type: 'bearer' }).expect(200);
  expect(hits).toBe(count);
  const publicKey = await import('crypto').then((c) =>
    c.createPublicKey(secondKey as never),
  );
  keys = [
    ...keys,
    { ...(await exportJWK(publicKey)), kid: 'second', alg: 'RS256' },
  ];
  await request(a)
    .get('/')
    .auth(await token(secondKey, 'second'), { type: 'bearer' })
    .expect(200);
  expect(hits).toBe(count + 1);
});
test('auth rejects missing, wrong issuer, expired and unsigned tokens with standard safe errors', async () => {
  const a = app();
  for (const jwt of [
    '',
    await token(privateKey, 'first', 'wrong'),
    await token(privateKey, 'first', 'issuer', '-1h'),
    'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1In0.',
  ]) {
    const result = await request(a)
      .get('/')
      .set('Authorization', 'Bearer ' + jwt)
      .expect(401);
    expect(Object.keys(result.body).sort()).toEqual(
      ['timestamp', 'status', 'code', 'message', 'path', 'traceId'].sort(),
    );
    expect(result.body.traceId).toBe(result.headers['x-trace-id']);
  }
});
test('role middleware denies missing role and allows signed administrator role', async () => {
  const a = app();
  await request(a)
    .get('/admin')
    .auth(await token(), { type: 'bearer' })
    .expect(403);
  await request(a)
    .get('/admin')
    .auth(await token(privateKey, 'first', 'issuer', '1h', ['ADMIN']), {
      type: 'bearer',
    })
    .expect(200);
});
test('rate limiting uses standard error body', async () => {
  const a = express();
  a.use(trace(createLogger('silent')), limiter(1));
  a.get('/', (_req, res) => res.sendStatus(200));
  a.use(errorHandler);
  await request(a).get('/').expect(200);
  await request(a)
    .get('/')
    .expect(429)
    .expect((r) => expect(r.body.code).toBe('RATE_LIMITED'));
});
test('configuration rejects missing secrets and invalid port', () => {
  expect(envSchema.safeParse({}).success).toBe(false);
  expect(envSchema.safeParse({ PORT: 99999, MONGODB_URI: 'bad' }).success).toBe(
    false,
  );
});
