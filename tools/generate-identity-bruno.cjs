const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'http/bruno/identity-service');
const spec = fs.readFileSync(path.join(root, 'docs/openapi/identity-service.yaml'), 'utf8');
const write = (file, value) => {
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, value + '\n');
};
const v = name => '{{' + name + '}}';
const report = { targetId: v('targetUserId'), circleId: v('circleId'), contentId: null, reason: 'SPAM' };
const bodies = {
  Credentials: { email: v('email'), password: v('password') },
  Refresh: { refreshToken: v('refreshToken') },
  Alias: { alias: 'QuietOtter42' },
  Consent: { aiAnalysis: false, companionMemory: false },
  AvatarRequest: { contentType: 'image/png', size: 1024 },
  CreateCircle: { name: 'Bruno test circle' },
  ReportInput: report,
  Moderation: { targetId: v('targetUserId'), action: 'UNBAN', until: null, contentId: null },
  Aliases: { userIds: [v('userId')] },
};
write('bruno.json', JSON.stringify({ version: '1', name: 'DayFeel Identity Service', type: 'collection', ignore: ['node_modules', '.git'] }, null, 2));
write('environments/Local.bru', `vars {
  baseUrl: http://localhost:8081
  email: bruno-test@example.com
  password: DayFeel-local-test-2026
  accessToken:
  refreshToken:
  internalKey:
  adminAccessToken:
  userId:
  targetUserId:
  circleId:
  exportRequestId:
  deletionRequestId:
  resourceId:
}`);
const groups = ['Operations', 'Auth', 'Profile', 'Circles', 'Moderation', 'Privacy', 'Crisis', 'Internal'];
groups.forEach((g, i) => write(`${g}/folder.bru`, `meta {\n  name: ${g}\n  seq: ${i + 1}\n}`));
let count = 0;
const actual = [];
const pathsText = spec.split('paths:\n')[1]?.split('\ncomponents:')[0] || spec.replace(/\r/g, '').split('paths:\n')[1].split('\ncomponents:')[0];
for (const match of pathsText.matchAll(/^  (\/[^\n]+):\r?\n([\s\S]*?)(?=^  \/|$(?![\s\S]))/gm)) {
  const endpoint = match[1].trim();
  for (const operation of match[2].matchAll(/^    (get|post|put|patch|delete):\r?\n([\s\S]*?)(?=^    (?:get|post|put|patch|delete):|$(?![\s\S]))/gm)) {
    const method = operation[1], text = operation[2];
    const tag = text.match(/tags:\r?\n      - (\w+)/)[1];
    const name = text.match(/summary: (.+)/)[1].trim();
    const status = Number(text.match(/responses:\r?\n        '(\d+)'/)[1]);
    const schema = text.split('requestBody:')[1]?.match(/schemas\/(\w+)/)?.[1];
    let body = schema ? bodies[schema] : undefined;
    if (schema === 'Completion') {
      const deletion = endpoint.includes('deletions');
      body = { requestId: v(deletion ? 'deletionRequestId' : 'exportRequestId'), userId: v('userId') };
      if (!deletion) body.objectKey = 'exports/' + v('exportRequestId') + '/test.zip';
    }
    if (schema && !body) throw new Error('Missing body: ' + schema);
    const publicRequest = text.includes('security: []');
    const internal = tag === 'Internal';
    const admin = endpoint.startsWith('/admin/');
    let url = v('baseUrl') + endpoint.replace(/\{(\w+)\}/g, (_, p) => v(({circle:'circleId', target:'targetUserId', user:'userId', id: admin ? 'resourceId' : 'exportRequestId'})[p]));
    if (endpoint === '/circles' && method === 'get') url += '?page=0&size=20';
    if (endpoint === '/crisis-resources') url += '?region=GLOBAL';
    let file = `meta {\n  name: ${name}\n  type: http\n  seq: ${++count}\n}\n\n${method} {\n  url: ${url}\n  body: ${body ? 'json' : 'none'}\n  auth: ${publicRequest || internal ? 'none' : 'bearer'}\n}`;
    if (!publicRequest && !internal) file += `\n\nauth:bearer {\n  token: ${v(admin ? 'adminAccessToken' : 'accessToken')}\n}`;
    if (body || internal) file += '\n\nheaders {\n' + (body ? '  Content-Type: application/json\n' : '') + (internal ? '  X-Internal-Key: {{internalKey}}\n' : '') + '}';
    if (body) file += '\n\nbody:json {\n' + JSON.stringify(body, null, 2).split('\n').map(l => '  ' + l).join('\n') + '\n}';
    const scripts = [];
    if (['/auth/register', '/auth/login', '/auth/refresh'].includes(endpoint)) {
      scripts.push('const body = res.getBody();', 'bru.setVar("accessToken", body.accessToken);', 'bru.setVar("refreshToken", body.refreshToken);', 'const claims = JSON.parse(Buffer.from(body.accessToken.split(".")[1], "base64").toString("utf8"));', 'bru.setVar("userId", claims.sub);');
    }
    const capture = endpoint === '/circles' && method === 'post' ? 'circleId' : endpoint === '/me/exports' ? 'exportRequestId' : endpoint === '/me/deletion' ? 'deletionRequestId' : endpoint === '/admin/crisis-resources' ? 'resourceId' : null;
    if (capture) scripts.push(`bru.setVar("${capture}", res.getBody().id);`);
    if (endpoint === '/auth/logout' || endpoint === '/me/deletion') scripts.push('bru.setVar("accessToken", "");', 'bru.setVar("refreshToken", "");');
    if (scripts.length) file += `\n\nscript:post-response {\n  if (res.getStatus() === ${status}) {\n${scripts.map(s => '    ' + s).join('\n')}\n  }\n}`;
    file += `\n\ntests {\n  test("Expected HTTP ${status}", function () {\n    expect(res.getStatus()).to.equal(${status});\n  });\n}`;
    const notes = [name + '.', `Expected status: ${status}.`];
    if (admin) notes.push('Requires adminAccessToken from an account with ADMIN role. Registration creates USER accounts. Use only synthetic test resources.');
    if (internal) notes.push('Set internalKey to the running identity-service INTERNAL_KEY. Call the service directly.');
    if (endpoint.includes('/completed')) notes.push('Manual backend callback: use a matching pending request and its owning userId. Export completion only records an object key; it does not create an archive. Deletion completion removes account data.');
    if (endpoint === '/me/deletion') notes.push('Manual destructive action: marks the account for deletion and immediately revokes sessions. Run last on a disposable account.');
    if (endpoint === '/auth/logout') notes.push('Manual session action: revokes all sessions. Log in again to continue.');
    if (endpoint.includes('/members/me') && method === 'delete') notes.push('Use a non-owner account that previously joined this circle. Owners and restricted members cannot leave.');
    if (endpoint.includes('/moderators/') || tag === 'Moderation') notes.push('Set targetUserId to another account. Moderation requires authorized circle privileges; the target must meet membership rules.');
    if (endpoint.includes('privacy-requests')) notes.push('Defaults to exportRequestId. Account deletion revokes access, so deletion status cannot be read using the revoked token.');
    if (endpoint.includes('avatar-upload')) notes.push('With STORAGE_MODE=local, uploadSupported is false and no actual upload URL is issued.');
    if (endpoint === '/auth/register') notes.push('Choose an unused email in Local before registering. Repeating registration returns 409.');
    file += '\n\ndocs {\n' + notes.map(n => '  ' + n).join('\n\n') + '\n}';
    const slug = method.toUpperCase() + ' ' + endpoint.replace(/^\//, '').replace(/[^a-zA-Z0-9.-]+/g, '-');
    write(`${tag}/${slug}.bru`, file);
    actual.push(method.toUpperCase() + ' ' + endpoint);
  }
}
const expectedCount = (spec.match(/operationId:/g) || []).length;
if (count !== expectedCount) throw new Error(`Generated ${count}, expected ${expectedCount}`);
console.log(`Generated ${count} requests in ${out}`);
