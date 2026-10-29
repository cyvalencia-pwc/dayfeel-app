const assert = require('node:assert/strict');
async function main() {
  async function request(port, route, token, body) {
    const r = await fetch(`http://127.0.0.1:${port}${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    assert.equal(r.status, 200, `${route}: HTTP ${r.status}`);
    return r.json();
  }
  const users = [];
  for (const name of ['maya', 'leo', 'sam', 'moderator', 'admin']) {
    const { accessToken: token } = await request(8081, '/auth/login', null, { email: `${name}@demo.dayfeel.test`, password: 'DayFeelDemo!2026' });
    const session = await request(8081, '/me/session', token);
    assert.equal(session.onboardingComplete, true);
    if (process.argv.includes('--roles') && ['moderator', 'admin'].includes(name)) assert.ok(session.roles.includes(name.toUpperCase()), `Apply scripts/demo-roles.sql: ${name} role missing`);
    const moods = await request(8082, '/mood/summary?range=30d&timezone=Asia%2FSingapore', token);
    assert.ok(moods.count >= 21);
    const journal = await request(8082, '/journal?limit=100', token);
    assert.ok(journal.entries.length >= 21);
    users.push({ token, journal });
    console.log(`${name}: login, onboarding, check-ins, journal OK; roles=${session.roles.join(',')}`);
  }
  const denied = await fetch(`http://127.0.0.1:8082/journal/${users[0].journal.entries[0]._id}`, { headers: { Authorization: `Bearer ${users[1].token}` } });
  assert.ok([403,404].includes(denied.status), 'Private journal must not be visible to another user');
  const circles = await request(8081, '/circles?size=100', users[0].token);
  for (const circle of circles.filter(c => c.name.startsWith('Demo '))) {
    const { posts } = await request(8082, `/circles/${circle.id}/posts`, users[0].token);
    assert.equal(posts.filter(p => ['DemoMaya', 'DemoLeo', 'DemoSam'].includes(p.authorAlias)).length, 3);
    assert.ok(posts.every(p => !('userId' in p) && !('authorId' in p)));
    const reports = await request(8081, `/circles/${circle.id}/reports`, users[3].token);
    assert.equal(reports.length, 1, 'Demo reports must not duplicate on rerun');
  }
  console.log('Community feeds, moderator report access, author privacy, and cross-user journal isolation OK.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
