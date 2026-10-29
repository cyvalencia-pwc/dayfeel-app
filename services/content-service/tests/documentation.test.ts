import request from 'supertest';
import { runInNewContext } from 'node:vm';
import { createApp } from '../src/app';
import { createLogger } from '../src/config/logger';
import { JournalService } from '../src/modules/journal/journal.service';

test('Swagger is public, serves the current contract, and does not bypass API auth', async () => {
  const auth = jest.fn((_req, res) =>
    res.status(401).json({ code: 'UNAUTHORIZED' }),
  );
  const app = createApp({
    auth,
    journal: {} as JournalService,
    logger: createLogger('silent'),
  });
  const html = await request(app).get('/docs').expect(200);
  expect(html.text).toContain('SwaggerUIBundle');
  const script = html.text.match(/<script>([\s\S]*?)<\/script>/)![1];
  for (const path of ['/docs', '/docs/', '/swagger-ui.html', '/api/content/docs', '/api/content/docs/', '/api/content/swagger-ui']) {
    const base = path.startsWith('/api/content') ? '/api/content' : '';
    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ openapi: '3.0.3' }) });
    const render = jest.fn();
    runInNewContext(script, {
      window: { location: { pathname: path }, SwaggerUIBundle: render },
      SwaggerUIBundle: render,
      fetch,
      document: { getElementById: () => ({ remove: jest.fn() }) },
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(fetch).toHaveBeenCalledWith(base + '/openapi.json');
    expect(render.mock.calls[0][0].spec.servers).toEqual([{ url: base || '/' }]);
  }
  const spec = (await request(app).get('/openapi.json').expect(200)).body;
  expect(spec.servers).toEqual([{ url: '/' }]);
  expect(spec.paths['/companion/conversations/{id}'].patch).toBeDefined();
  expect(spec.paths['/notifications/preferences']).toBeUndefined();
  expect(spec.paths['/notifications']).toBeUndefined();
  expect(auth).not.toHaveBeenCalled();
  await request(app).get('/journal').expect(401);
  expect(auth).toHaveBeenCalled();
});
