import assert from 'node:assert/strict';
import {LocalRepository} from '../src/infra/local-repository.mjs';
import {ArtifactGuardAgent} from '../src/agent/orchestrator.mjs';

const VALID = new Set([
  'SUPPORTED',
  'CONDITIONAL',
  'CONFLICTED',
  'INSUFFICIENT',
  'RETEST',
  'AVOID',
]);
const envs = [undefined, 'open', 'enclosed', 'sealed', 'nonsense'];
const contacts = [undefined, 'none', 'indirect', 'direct', 'nonsense'];
const repo = new LocalRepository();
const data = await repo.getDataset();
const agent = new ArtifactGuardAgent(repo);
const revisionPool = [
  ...data.productRevisions.map((x) => x._id),
  'unknown-revision',
  null,
  42,
  {},
  '',
];
const artifactPool = [
  ...data.artifactMaterials.map((x) => x._id),
  'unknown-artifact',
  null,
  42,
  {},
  '',
];
let seed = 0x5a17c0de;
const rnd = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
const pick = (a) => a[Math.floor(rnd() * a.length)];
function subset(pool, max = 3) {
  const n = Math.floor(rnd() * (max + 1)),
    out = [];
  for (let i = 0; i < n; i++) out.push(pick(pool));
  return out;
}

let runs = 0;
for (let i = 0; i < 1000; i++) {
  const scenario = {
    revisionIds: subset(revisionPool),
    artifactMaterialIds: subset(artifactPool),
    environment: pick(envs),
    contact: pick(contacts),
  };
  const r = await agent.analyze(scenario, {includeKnowledge: false});
  const a = r.analysis;
  assert.ok(VALID.has(a.verdict), `invalid verdict ${a.verdict}`);
  assert.doesNotThrow(() => JSON.stringify(r));
  assert.equal(/\b\d+(?:\.\d+)?%/.test(JSON.stringify(a)), false, 'invented percentage detected');
  if (!scenario.revisionIds.length || !scenario.artifactMaterialIds.length)
    assert.notEqual(a.verdict, 'SUPPORTED', 'incomplete scenario must not be SUPPORTED');
  if (
    scenario.revisionIds.includes('unknown-revision') ||
    scenario.artifactMaterialIds.includes('unknown-artifact')
  )
    assert.notEqual(a.verdict, 'SUPPORTED', 'unknown evidence identity must not be SUPPORTED');
  const sourceIds = new Set(data.sources.map((x) => x._id));
  const known = new Set(
    Object.values(data)
      .filter(Array.isArray)
      .flat()
      .map((x) => x._id),
  );
  for (const d of a.deductions) {
    assert.equal(
      /undefined|null|NaN|\[object/.test(d.message),
      false,
      `template leak: ${d.message}`,
    );
    for (const id of d.sourceIds || [])
      assert.ok(sourceIds.has(id), `unknown source ${id} in ${d.code}`);
    for (const id of d.evidenceIds || [])
      assert.ok(known.has(id), `unknown evidence ${id} in ${d.code}`);
  }
  assert.equal(
    /undefined|null|NaN/.test(a.summary),
    false,
    `template leak in summary: ${a.summary}`,
  );
  assert.equal(
    a.deductions.some((d) => d.code === 'NO_CONFLICT_FOUND'),
    a.verdict === 'SUPPORTED' && !a.deductions.some((d) => ['error', 'warning'].includes(d.level)),
  );
  runs++;
}
console.log(`Fuzz scenarios completed: ${runs}; seed=0x5a17c0de`);
