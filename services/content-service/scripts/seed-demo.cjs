/* Local demo fixtures. Run from any directory; uses content-service dependencies. */
const { MongoClient, ObjectId } = require('mongoose').mongo;
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../../..');
const envPath = path.resolve(__dirname, '../.env');
const config = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
const uri = process.env.MONGODB_URI || config.MONGODB_URI;
const dockerDemo = process.env.DEMO_DOCKER === 'true';
const identity = dockerDemo ? 'http://identity:8081' : 'http://127.0.0.1:8081';
const password = process.env.DEMO_PASSWORD || (dockerDemo ? '' : 'DayFeelDemo!2026');
const rolesFile = dockerDemo ? '/tmp/dayfeel-demo-roles.sql' : path.join(root, 'scripts/demo-roles.sql');
const people = [
  ['maya', 'Maya', 'USER'], ['leo', 'Leo', 'USER'],
  ['sam', 'Sam', 'USER'], ['moderator', 'Guide', 'MODERATOR'],
  ['admin', 'Admin', 'ADMIN'],
].map(([name, alias, role]) => ({ email: `${name}@demo.dayfeel.test`, alias, role }));
const oid = (key) => new ObjectId(createHash('sha256').update(`dayfeel-demo-v1:${key}`).digest('hex').slice(0, 24));
const day = (offset) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
};
async function api(route, method = 'GET', body, token) {
  const r = await fetch(identity + route, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) { const e = new Error(`${method} ${route}: HTTP ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
async function main() {
  const allowedUri = dockerDemo ? /^mongodb:\/\/mongo:27017\/dayfeel_content(?:\?|$)/ : /^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\//;
  if (!uri || !allowedUri.test(uri)) throw new Error('Demo seed requires a local MongoDB URI, or DEMO_DOCKER=true with the Docker dayfeel_content database.');
  if (!password) throw new Error('Set DEMO_PASSWORD before seeding Docker demo accounts.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const db = client.db();
    for (const p of people) {
      const creds = { email: p.email, password };
      let tokens;
      try { tokens = await api('/auth/register', 'POST', creds); }
      catch (e) { if (e.status !== 409) throw e; tokens = await api('/auth/login', 'POST', creds); }
      p.token = tokens.accessToken;
      p.id = JSON.parse(Buffer.from(p.token.split('.')[1], 'base64url').toString()).sub;
      if (!/^[a-f0-9-]{36}$/i.test(p.id)) throw new Error('Invalid account identifier');
      await api('/me', 'PATCH', { alias: p.alias }, p.token);
      await api('/me/onboarding', 'POST', { acknowledged: true }, p.token);
      await api('/me/consent', 'PUT', { companionMemory: false }, p.token);
      console.log(`Account ready: ${p.email}`);
    }
    const sql = ['-- Local demo accounts only. Run after seed-demo.cjs.', 'START TRANSACTION;'];
    for (const p of people.filter(p => p.role !== 'USER')) sql.push(`INSERT IGNORE INTO user_roles(user_id,role_name) SELECT id,'${p.role}' FROM users WHERE id='${p.id}' AND email='${p.email}';`);
    sql.push('COMMIT;');
    fs.writeFileSync(rolesFile, sql.join('\n') + '\n', { mode: 0o600 });
    const admin = people[4], guide = people[3];
    const circles = [];
    const existing = await api('/circles?size=100', 'GET', undefined, admin.token);
    for (const name of ['Small Wins', 'Study Break', 'Rest and Recharge']) {
      const c = existing.find(c => c.name === name || c.name === `Demo ${name}`) || await api('/circles', 'POST', { name }, admin.token);
      circles.push(c);
      for (const p of people) await api(`/circles/${c.id}/members/me`, 'POST', undefined, p.token);
      await api(`/circles/${c.id}/moderators/${guide.id}`, 'PUT', undefined, admin.token);
    }
    const insert = (collection, key, document) => db.collection(collection).updateOne({ _id: oid(key) }, { $setOnInsert: document }, { upsert: true });
    const texts = [
      'I took a short walk and noticed the trees along my street. A small pause helped.',
      'A busy study day. I broke one big task into smaller steps and asked a friend for help.',
      'I made time for dinner without my phone. It was good to slow down.',
      'Today felt harder than expected. I gave myself permission to rest and try again tomorrow.',
      'I finished something I had been putting off. I want to remember this small win.',
    ];
    for (const [index, p] of people.entries()) {
      const moods = [];
      for (let offset = -20; offset <= 0; offset++) {
        const date = day(offset), score = [3, 4, 2, 3, 5, 4, 4][(offset + 21 + index) % 7];
        const when = new Date(`${date}T04:00:00Z`);
        const mood = { userId: p.id, date, moodScore: score, energy: score, sleepHours: 5 + score * 0.5, tags: ['daily-life'], note: 'Taking a moment to notice how I feel today.' };
        await db.collection('mood_logs').updateOne({ userId: p.id, date }, { $setOnInsert: mood }, { upsert: true });
        moods.push(mood);
        await insert('journal_entries', `${p.id}:journal:${date}`, { userId: p.id, text: `${texts[(offset + 21 + index) % texts.length]}`, moodScore: score, tags: ['daily-life'], crisisFlag: false, revision: 1, createdAt: when, updatedAt: when });
      }
      const conversationId = oid(`${p.id}:conversation`);
      await insert('companion_conversations', `${p.id}:conversation`, { userId: p.id, title: 'Making space for a pause', summary: 'Taking a quiet moment after a busy day.', replyCount: 1, lease: null, leaseUntil: null, createdAt: new Date(), updatedAt: new Date() });
      for (const [n, text] of ['I have had a busy day and would like a quiet moment.', 'We can take a small pause. Would you like to try a breathing exercise?'].entries()) await insert('companion_messages', `${p.id}:message:${n}`, { userId: p.id, conversationId, role: n ? 'ASSISTANT' : 'USER', text, screened: true, safe: true, createdAt: new Date(Date.now() + n), updatedAt: new Date() });
    }
    for (const [ci, circle] of circles.entries()) {
      for (const [pi, p] of people.slice(0,3).entries()) {
        const key = `post:${circle.id}:${p.id}`, postId = oid(key);
        const base = { userId: p.id, authorAlias: p.alias, circleId: circle.id, status: 'VISIBLE', createdAt: new Date(), updatedAt: new Date() };
        await insert('posts', key, { ...base, text: `${texts[(ci + pi) % texts.length]} What small thing helped you today?` });
        const friend = people[(pi + 1) % 3];
        await insert('comments', `comment:${key}`, { ...base, userId: friend.id, authorAlias: friend.alias, postId, text: 'Thank you for sharing. Taking a short break helped me too.' });
        await db.collection('reactions').updateOne({ userId: friend.id, targetId: postId, targetType: 'POST' }, { $setOnInsert: { type: 'support', createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
      }
      const key = `held:${circle.id}`, contentId = oid(key).toHexString();
      await insert('posts', key, { userId: people[2].id, authorAlias: people[2].alias, circleId: circle.id, text: 'Join my promotion today! Message me for exclusive offers!', status: 'HELD', createdAt: new Date(), updatedAt: new Date() });
      const reports = await api(`/circles/${circle.id}/reports`, 'GET', undefined, admin.token);
      if (!reports.some(r => r.contentId === contentId)) await api('/reports', 'POST', { targetId: people[2].id, circleId: circle.id, contentId, reason: 'SPAM' }, people[0].token);
    }
    console.log('Seed complete: 5 accounts; 105 check-ins; 105 journal entries; 3 circles; 9 visible posts; 9 comments; 9 reactions; 3 held posts/reports; 5 companion conversations.');
    console.log(`Next: apply ${rolesFile} to the identity database, then sign in again.`);
  } finally { await client.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
