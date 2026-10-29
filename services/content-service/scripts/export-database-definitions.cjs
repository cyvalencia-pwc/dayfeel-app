// Offline documentation generator: imports schemas without connecting to a database.
require('tsx/cjs');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const root = path.resolve(__dirname, '../../..');
const out = path.join(root, 'docs/database');
fs.mkdirSync(out, { recursive: true });
require('../src/modules/events/phase5.handler.ts');

const migrations = path.join(root, 'services/identity-service/src/main/resources/db/migration');
const sql = fs.readdirSync(migrations).filter(f => /^V\d+.*\.sql$/.test(f))
  .sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]))
  .map(f => `-- Source: ${f}\n${fs.readFileSync(path.join(migrations, f), 'utf8')}`).join('\n\n');
fs.writeFileSync(path.join(out, 'mysql-schema.sql'),
  '-- MySQL 8; fresh database only. Snapshot of Flyway V1-V3, including seed rows.\n' +
  '-- Do not run against the application database or a database managed by Flyway.\n' +
  '-- Select an EMPTY scratch database first; this script does not CREATE/DROP a database.\n\n' + sql);

function fields(schema) {
  return Object.entries(schema.paths).map(([name, p]) => {
    const o = p.options;
    const field = { name, type: p.instance, requiredByMongoose: !!p.isRequired };
    if (p.caster) field.elementType = p.caster.instance;
    if (o.default !== undefined) field.default = typeof o.default === 'function' ? String(o.default) : o.default;
    if (o.enum) field.enum = o.enum;
    if (o.min !== undefined) field.min = o.min;
    if (o.max !== undefined) field.max = o.max;
    if (p.schema) field.fields = fields(p.schema);
    return field;
  });
}
const collections = Object.values(mongoose.models).map(m => ({
  collection: m.collection.collectionName,
  model: m.modelName,
  timestamps: !!m.schema.options.timestamps,
  strict: m.schema.options.strict,
  fields: fields(m.schema),
  indexes: m.schema.indexes().map(([keys, options]) => ({ keys, options })),
})).sort((a, b) => a.collection.localeCompare(b.collection));
fs.writeFileSync(path.join(out, 'mongodb-models.json'), JSON.stringify(collections, null, 2) + '\n');

let js = '// mongosh collection/index DDL. Select an EMPTY scratch database first.\n' +
  '// Mirrors existing models: intentionally NO MongoDB server validators or foreign keys.\n' +
  '// Required fields, defaults, enums and ranges are Mongoose rules; see mongodb-models.json.\n' +
  '// MongoDB automatically creates the unique _id index. No documents are inserted.\n' +
  'if (db.getCollectionNames().length) throw new Error("Select an empty scratch database");\n\n';
let dictionary = 'DAYFEEL MONGODB DATA DICTIONARY\n\n' +
  'Source: current Mongoose models. No live database was inspected.\n' +
  'Required/default/enum/min/max are application-level Mongoose rules, not server validators.\n' +
  'ObjectId identifiers are MongoDB IDs; user/circle UUID references are strings.\n' +
  '_id is always unique at the database level. __v is the Mongoose version key.\n' +
  'Automatic timestamps appear explicitly below. Mixed means unconstrained data.\n\n';
function describe(list, prefix = '') {
  return list.map(f => {
    const { name, fields: nested, ...details } = f;
    return `${prefix}${name}: ${JSON.stringify(details)}\n` + (nested ? describe(nested, `${prefix}${name}.`) : '');
  }).join('');
}
for (const c of collections) {
  js += `db.createCollection(${JSON.stringify(c.collection)});\n`;
  for (const {keys, options} of c.indexes) {
    const {background, ...rest} = options;
    js += `db.getCollection(${JSON.stringify(c.collection)}).createIndex(${JSON.stringify(keys)}, ${JSON.stringify(rest)});\n`;
  }
  js += '\n';
  dictionary += `${c.collection} (${c.model})\n${'='.repeat(c.collection.length)}\n` + describe(c.fields) +
    `Indexes in addition to unique _id: ${JSON.stringify(c.indexes)}\n\n`;
}
fs.writeFileSync(path.join(out, 'mongodb-schema.js'), js);
fs.writeFileSync(path.join(out, 'mongodb-dictionary.txt'), dictionary);
// Include final column additions while deriving every physical FK from migrations.
const tables = [...sql.matchAll(/CREATE TABLE (\w+)\s*\(([\s\S]*?)\);/g)];
let mysqlDiagram = 'erDiagram\n';
for (const [, table, body] of tables) {
  let columns = body;
  for (const [, altered, column] of sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN ([^;]+);/g)) {
    if (altered === table) columns += ', ' + column;
  }
  mysqlDiagram += `    ${table} {\n`;
  for (const [, name, type] of columns.matchAll(/(?:^|,)\s*(\w+)\s+(VARCHAR\(\d+\)|CHAR\(\d+\)|DATETIME\(\d+\)|BIGINT|INT|BOOLEAN|TEXT)/g)) {
    mysqlDiagram += `        ${type.replace(/[()]/g, '')} ${name}\n`;
  }
  mysqlDiagram += '    }\n';
  for (const [, column, parent, target] of body.matchAll(/FOREIGN KEY\((\w+)\) REFERENCES (\w+)\((\w+)\)/g)) {
    const required = new RegExp(`\\b${column}\\s+\\w+(?:\\([^)]*\\))?\\s+NOT NULL`).test(body);
    mysqlDiagram += `    ${parent} ${required ? '||' : '|o'}--o{ ${table} : "${column} to ${target}"\n`;
  }
}
fs.writeFileSync(path.join(out, 'mysql-relationships.mmd'), mysqlDiagram);
console.log(`Generated MySQL snapshot and ${collections.length} MongoDB collection definitions in ${out}`);
