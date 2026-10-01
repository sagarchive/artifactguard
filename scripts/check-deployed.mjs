import {readFile} from 'node:fs/promises';

const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const cases = JSON.parse(
  await readFile(new URL('../benchmarks/cases.json', import.meta.url), 'utf8'),
);
const status = await (await fetch(`${base}/api/context-status`)).json();
console.log(`${base} (${status.mode} mode)`);

const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
async function analyze(scenario) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({scenario, includeKnowledge: false}),
    });
    if (response.status !== 429 || attempt >= 3) return response;
    await sleep(Number(response.headers.get('retry-after')) || 5);
  }
}

let failed = 0;
for (const c of cases) {
  const response = await analyze(c.scenario);
  const body = await response.json();
  const codes = new Set((body.analysis?.deductions || []).map((d) => d.code));
  const ok =
    response.ok &&
    c.expected.includes(body.analysis.verdict) &&
    (c.mustCodes || []).every((code) => codes.has(code)) &&
    !(c.mustNotCodes || []).some((code) => codes.has(code));
  if (!ok) failed += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${c.id} ${body.analysis?.verdict ?? response.status} ${c.name}`,
  );
}
const flagship = cases.find((c) => c.mustCodes?.includes('PASS_NOT_COMPREHENSIVE')) || cases[0];
const withKnowledge = await (
  await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({scenario: flagship.scenario, includeKnowledge: true}),
  })
).json();
const entries = withKnowledge.knowledge?.entries?.length || 0;
if (status.mode === 'live' && entries === 0) {
  failed += 1;
  console.log(
    `FAIL Knowledge Base returned no entries for ${flagship.id}. The entry paths in the code may not match the built entries.`,
  );
} else {
  console.log(`PASS Knowledge Base: ${entries} entries read for ${flagship.id}`);
}
console.log(
  failed
    ? `${failed} checks failed`
    : `All ${cases.length} scenarios and the Knowledge Base check pass`,
);
process.exit(failed ? 1 : 0);
