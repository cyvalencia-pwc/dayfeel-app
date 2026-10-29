import { HttpIdentityClient } from '../src/clients/identityClient';
import { HttpAiClient } from '../src/clients/aiClient';
import { RestrictionService } from '../src/modules/safety/restriction.service';
import { identityMock } from './helpers';
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
test('identity sends internal key, adapts consent, caches 60 seconds and invalidates', async () => {
  let now = 1000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  const fetcher = jest
    .fn()
    .mockImplementation(async () =>
      json({ aiAnalysis: true, companionMemory: false }),
    );
  const client = new HttpIdentityClient(
    'http://identity',
    'internal-secret',
    fetcher,
  );
  expect(await client.consent('u')).toEqual({
    companionMemoryOptIn: false,
  });
  await client.consent('u');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toBe(
    'http://identity/internal/users/u/consent',
  );
  expect(fetcher.mock.calls[0][1].headers['X-Internal-Key']).toBe(
    'internal-secret',
  );
  now += 60001;
  await client.consent('u');
  expect(fetcher).toHaveBeenCalledTimes(2);
  client.invalidate('u');
  await client.consent('u');
  expect(fetcher).toHaveBeenCalledTimes(3);
  await client.consent('u', true);
  expect(fetcher).toHaveBeenCalledTimes(4);
  clock.mockRestore();
});
test('membership and restrictions use fresh identity checks', async () => {
  const fetcher = jest
    .fn()
    .mockImplementation(async () =>
      json({ member: true, muted: false, banned: false }),
    );
  const client = new HttpIdentityClient('http://identity', 'key', fetcher);
  await client.restrictions('circle', 'user');
  await client.restrictions('circle', 'user');
  await client.membership('circle', 'user');
  await client.membership('circle', 'user');
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(String(fetcher.mock.calls[0][0])).toContain(
    '/internal/circles/circle/users/user/restrictions',
  );
  expect(String(fetcher.mock.calls[2][0])).toContain('/membership');
});
test('identity rejects malformed consent and provides the external support link without a directory request', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(json({}))
    .mockResolvedValueOnce(
      json([
        { name: 'Directory', region: 'GLOBAL', url: 'https://example.org' },
      ]),
    )
    .mockRejectedValue(new Error());
  const client = new HttpIdentityClient('http://identity', 'key', fetcher);
  await expect(client.consent('u')).rejects.toThrow();
  const first = await client.resources('GLOBAL');
  expect(await client.resources('GLOBAL')).toEqual(first);
  expect(first[0].url).toBe('https://findahelpline.com/');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test('restriction service denies nonmembers, muted and banned users', async () => {
  const identity = identityMock(),
    service = new RestrictionService(identity);
  for (const r of [
    { member: false, muted: false, banned: false },
    { member: true, muted: true, banned: false },
    { member: true, muted: false, banned: true },
  ]) {
    identity.restrictions.mockResolvedValue(r);
    await expect(service.requirePosting('c', 'u')).rejects.toMatchObject({
      status: 403,
    });
  }
});
test('AI paths carry both credentials, validate crisis response and enforce 8s abort', async () => {
  const fetcher = jest
    .fn()
    .mockImplementation(async () => json({ riskLevel: 'LOW' }));
  const client = new HttpAiClient('http://ai', 'secret', fetcher);
  await client.crisisCheck('private', 'jwt');
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    method: 'POST',
    headers: { 'X-Internal-Key': 'secret', Authorization: 'Bearer jwt' },
    body: JSON.stringify({ text: 'private' }),
  });
  await client.companionChat({}, 'jwt');
  await client.moderate({}, 'jwt');
  expect(fetcher.mock.calls.map((c) => new URL(String(c[0])).pathname)).toEqual(
    [
      '/safety/crisis-check',
      '/companion/chat',
      '/moderate',
    ],
  );
  const timed = jest.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener(
          'abort',
          () => reject(init.signal?.reason),
          { once: true },
        ),
      ),
  );
  const start = Date.now();
  await expect(
    new HttpAiClient('http://ai', 'key', timed as typeof fetch).crisisCheck(
      'text',
      'jwt',
    ),
  ).rejects.toMatchObject({ name: 'TimeoutError' });
  expect(Date.now() - start).toBeLessThan(10000);
});

test('in-flight restriction responses cannot repopulate invalidated cache', async () => {
  let release!: (response: Response) => void;
  const fetcher = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    )
    .mockImplementation(async () =>
      json({ member: true, muted: true, banned: false }),
    );
  const client = new HttpIdentityClient('http://identity', 'key', fetcher);
  const pending = client.restrictions('c', 'u');
  client.invalidate('u');
  release(json({ member: true, muted: false, banned: false }));
  expect(await pending).toMatchObject({ muted: true });
  expect(await client.restrictions('c', 'u')).toMatchObject({ muted: true });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
