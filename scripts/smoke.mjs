import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {readFile} from 'node:fs/promises';

const port = 8799;
const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: {...process.env, PORT: String(port), ARTIFACTGUARD_MODE: 'local'},
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));
const base = `http://127.0.0.1:${port}`;
async function wait() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not start: ${log}`);
}
try {
  await wait();
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.context.mode, 'local');
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-frame-options'), 'DENY');
  assert.match(home.headers.get('content-security-policy') || '', /default-src 'self'/);
  const analysisRes = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      scenario: {
        revisionIds: ['revision-terostat-historic'],
        artifactMaterialIds: ['artifact-lead'],
        environment: 'sealed',
        contact: 'indirect',
      },
      includeKnowledge: false,
    }),
  });
  assert.equal(analysisRes.status, 200);
  const analysis = await analysisRes.json();
  assert.equal(analysis.analysis.verdict, 'CONDITIONAL');
  assert.equal(analysis.baseline.verdict, 'SUPPORTED');
  const calc = await (
    await fetch(`${base}/api/enclosure`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({emissionRateUgM2H: 4, areaM2: 2, volumeM3: 1, leakagePerHour: 0.5}),
    })
  ).json();
  assert.equal(calc.concentrationUgM3, 16);
  const bad = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: '{bad',
  });
  assert.equal(bad.status, 400);
  const bench = await (await fetch(`${base}/api/benchmark`)).json();
  assert.equal(bench.failed, 0);
  const caseCount = JSON.parse(
    await readFile(new URL('../benchmarks/cases.json', import.meta.url), 'utf8'),
  ).length;
  assert.equal(bench.total, caseCount);
  const post = (path, body) =>
    fetch(`${base}${path}`, {method: 'POST', headers: {'content-type': 'application/json'}, body});
  for (const [label, body] of [
    ['null', 'null'],
    ['array', '[]'],
    [
      'bad environment',
      JSON.stringify({
        scenario: {
          revisionIds: ['revision-terostat-historic'],
          artifactMaterialIds: ['artifact-lead'],
          environment: '<script>',
        },
      }),
    ],
    [
      'bad contact',
      JSON.stringify({
        scenario: {
          revisionIds: ['revision-terostat-historic'],
          artifactMaterialIds: ['artifact-lead'],
          contact: 'x',
        },
      }),
    ],
  ]) {
    const r = await post('/api/analyze', body);
    assert.equal(r.status, 400, `analyze ${label} must be 400`);
  }
  assert.equal((await post('/api/enclosure', 'null')).status, 400);
  assert.equal(
    (
      await post(
        '/api/enclosure',
        JSON.stringify({emissionRateUgM2H: 2, areaM2: 1e308, volumeM3: 1e-320, leakagePerHour: 1}),
      )
    ).status,
    400,
  );
  for (const path of ['/compare', '/method', '/assets/app.js', '/assets/compare.js']) {
    assert.equal((await fetch(`${base}${path}`)).status, 200, path);
  }
  assert.equal((await fetch(`${base}/assets/app.js`)).headers.get('cache-control'), 'no-cache');
  for (const path of ['/.env', '/src/server.mjs', '/..%2f..%2fpackage.json']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  }
  const ask = await (
    await post(
      '/api/interpret',
      JSON.stringify({
        question: 'Is Terostat-9220 okay next to lead in a sealed case, not touching?',
      }),
    )
  ).json();
  assert.equal(ask.complete, true);
  assert.deepEqual(ask.scenario.revisionIds, ['revision-terostat-historic']);
  for (const body of [
    'null',
    '{}',
    JSON.stringify({question: ''}),
    JSON.stringify({question: 'x'.repeat(501)}),
    JSON.stringify({question: 5}),
  ])
    assert.equal((await post('/api/interpret', body)).status, 400);
  const full = await (
    await post(
      '/api/analyze',
      JSON.stringify({
        scenario: {
          revisionIds: ['revision-terostat-historic'],
          artifactMaterialIds: ['artifact-lead'],
          environment: 'sealed',
          contact: 'indirect',
        },
      }),
    )
  ).json();
  assert.ok(Array.isArray(full.trace) && full.trace.length >= 2);
  assert.ok(full.knowledge.entries.length > 0);
  assert.ok(Object.keys(full.guidance).length > 0);
  const raw = (target, headers = {}) =>
    new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      let data = '';
      socket.on('data', (d) => (data += d));
      socket.on('close', () => resolve(data.split('\r\n')[0]));
      socket.on('error', () => resolve('socket error'));
      const extra = Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('');
      socket.write(
        `GET ${target} HTTP/1.1\r\nHost: localhost\r\n${extra}Connection: close\r\n\r\n`,
      );
    });
  for (const target of ['//', '///x', 'http://']) {
    assert.match(
      await raw(target),
      / 400 /,
      `malformed target ${target} must not crash the server`,
    );
  }
  assert.equal(
    (await fetch(`${base}/api/health`)).status,
    200,
    'server must survive malformed request targets',
  );
  assert.equal((await fetch(`${base}/`)).headers.get('strict-transport-security'), null);
  const page = await fetch(`${base}/`);
  assert.equal(page.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.match(page.headers.get('content-security-policy'), /form-action 'self'/);
  const a1 = await (await fetch(`${base}/api/health`)).json();
  const a2 = await (await fetch(`${base}/api/health`)).json();
  assert.equal(a1.ok && a2.ok, true);
  assert.match(
    (await fetch(`${base}/`, {headers: {'x-forwarded-proto': 'https'}})).headers.get(
      'strict-transport-security',
    ) || '',
    /max-age=\d+/,
  );
  assert.match(log, /"path":"\/api\/health"/, 'access log must record requests');
  assert.doesNotMatch(log, /error":"Sanity|Bearer/);
  let limited = 0;
  for (let i = 0; i < 40; i++) {
    const r = await post('/api/analyze', '{}');
    if (r.status === 429) limited++;
  }
  assert.ok(limited > 0, 'rate limiter must engage');
  console.log(
    'HTTP smoke passed: health, security headers, analysis, enclosure, invalid JSON, benchmark, input rejection, plain-English interpretation, trace and guidance, static pages, path traversal, rate limit',
  );
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 1000);
    child.once('exit', () => {
      clearTimeout(t);
      resolve();
    });
  });
}
