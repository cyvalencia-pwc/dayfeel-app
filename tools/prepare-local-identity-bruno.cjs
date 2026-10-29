const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'http/bruno/identity-service.bruno.json');
const collection = JSON.parse(fs.readFileSync(file, 'utf8'));
const env = fs.readFileSync(path.join(root, 'services/content-service/.env'), 'utf8');
function value(name) {
  const line = env.split(/\r?\n/).find(l => new RegExp('^\\s*' + name + '\\s*=').test(l));
  if (!line) return '';
  let raw = line.slice(line.indexOf('=') + 1).trim();
  if (raw.startsWith('"') || raw.startsWith("'")) return raw.slice(1, raw.indexOf(raw[0], 1));
  return raw.split(/\s+#/)[0].trim();
}
const variables = collection.environments[0].variables;
const key = value('INTERNAL_KEY');
if (!key) throw new Error('INTERNAL_KEY is missing from content-service/.env');
variables.find(v => v.name === 'internalKey').value = key;
variables.find(v => v.name === 'baseUrl').value = value('IDENTITY_URL') || 'http://localhost:8081';
collection.name = 'DayFeel Identity Service - Local';
fs.writeFileSync(path.join(root, 'http/bruno/identity-service.local.bruno.json'), JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'http/bruno/identity-service/environments/Local-private.bru'), 'vars {\n' + variables.map(v => `  ${v.name}: ${v.value}`).join('\n') + '\n}\n');
console.log('Prepared ignored local import and Local-private environment; internal key copied without printing it.');
