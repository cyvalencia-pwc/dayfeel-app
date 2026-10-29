// Export the generated native folder as Bruno's single-file JSON interchange format.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../http/bruno/identity-service');
const block = (text, name) => text.match(new RegExp('^' + name + ' \\{\\r?\\n([\\s\\S]*?)^\\}', 'm'))?.[1].trim() || '';
const fields = text => text.split(/\r?\n/).filter(line => line.trim()).map(line => {
  const colon = line.indexOf(':');
  if (colon < 0) throw new Error('Invalid field: ' + line);
  return { name: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim(), enabled: true };
});
const items = [];
let count = 0;
for (const folder of fs.readdirSync(root, {withFileTypes: true})) {
  if (!folder.isDirectory() || folder.name === 'environments') continue;
  const folderPath = path.join(root, folder.name);
  const meta = Object.fromEntries(fields(block(fs.readFileSync(path.join(folderPath, 'folder.bru'), 'utf8'), 'meta')).map(f => [f.name, f.value]));
  const group = { name: meta.name, type: 'folder', seq: Number(meta.seq), items: [] };
  for (const filename of fs.readdirSync(folderPath)) {
    if (!filename.endsWith('.bru') || filename === 'folder.bru') continue;
    const source = fs.readFileSync(path.join(folderPath, filename), 'utf8');
    const metadata = Object.fromEntries(fields(block(source, 'meta')).map(f => [f.name, f.value]));
    const method = source.match(/^(get|post|put|patch|delete) \{/m)[1];
    const http = Object.fromEntries(fields(block(source, method)).map(f => [f.name, f.value]));
    const auth = {mode: http.auth};
    if (auth.mode === 'bearer') auth.bearer = { token: fields(block(source, 'auth:bearer'))[0].value };
    const body = {mode: http.body};
    if (body.mode === 'json') {
      body.json = block(source, 'body:json');
      JSON.parse(body.json);
    }
    const request = {
      url: http.url, method: method.toUpperCase(),
      headers: fields(block(source, 'headers')), params: [], auth, body,
      script: {req: '', res: block(source, 'script:post-response')},
      vars: {req: [], res: []}, assertions: [],
      tests: block(source, 'tests'), docs: block(source, 'docs')
    };
    new vm.Script(request.script.res);
    new vm.Script(request.tests);
    group.items.push({name: metadata.name, type: 'http', seq: Number(metadata.seq), request});
    count++;
  }
  group.items.sort((a,b) => a.seq - b.seq);
  items.push(group);
}
items.sort((a,b) => a.seq - b.seq);
// Export only the public template variables; do not read locally edited credentials.
const defaults = {
  baseUrl: 'http://localhost:8081', email: 'bruno-test@example.com',
  password: 'DayFeel-local-test-2026', accessToken: '', refreshToken: '',
  internalKey: '', adminAccessToken: '', userId: '', targetUserId: '',
  circleId: '', exportRequestId: '', deletionRequestId: '', resourceId: ''
};
const collection = {
  version: '1', name: 'DayFeel Identity Service', items,
  environments: [{name: 'Local', variables: Object.entries(defaults).map(([name,value]) => ({name, value, enabled: true, type: 'text', secret: false}))}],
  exportedAt: new Date().toISOString(), exportedUsing: 'Bruno'
};
const expected = (fs.readFileSync(path.resolve(root, '../../../docs/openapi/identity-service.yaml'), 'utf8').match(/operationId:/g) || []).length;
if (count !== expected) throw new Error(`Expected ${expected} requests, got ${count}`);
const destination = path.resolve(root, '../identity-service.bruno.json');
fs.writeFileSync(destination, JSON.stringify(collection, null, 2) + '\n');
console.log(`Exported ${count} requests with checked JSON bodies and JavaScript syntax to ${destination}`);
