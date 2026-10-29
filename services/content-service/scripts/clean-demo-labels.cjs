// Remove display prefixes only from the five local sample accounts.
const { MongoClient } = require('mongodb');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
async function main() {
  const config = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env')));
  const uri = process.env.MONGODB_URI || config.MONGODB_URI;
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\//.test(uri || '')) throw new Error('Local MongoDB required');
  const ids = [];
  for (const name of ['maya', 'leo', 'sam', 'moderator', 'admin']) {
    const r = await fetch('http://127.0.0.1:8081/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${name}@demo.dayfeel.test`, password: 'DayFeelDemo!2026' }), signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`Demo login failed: ${name} (${r.status})`);
    const { accessToken } = await r.json();
    ids.push(JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()).sub);
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    for (const [collection, field] of [['journal_entries','text'], ['posts','text'], ['comments','text'], ['companion_messages','text'], ['companion_conversations','title']]) {
      let changed = 0;
      const c = client.db().collection(collection);
      for await (const doc of c.find({ userId: { $in: ids }, [field]: { $regex: '^(\\[Demo[^\\]]*\\] |Demo: )' } })) {
        const value = doc[field].replace(/^\[Demo[^\]]*\] /, '').replace(/^Demo: making/, 'Making');
        const result = await c.updateOne({ _id: doc._id, [field]: doc[field] }, { $set: { [field]: value } });
        changed += result.modifiedCount;
      }
      console.log(`${collection}: ${changed} labels removed`);
    }
  } finally { await client.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
