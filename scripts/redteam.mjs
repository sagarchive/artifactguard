import assert from 'node:assert/strict';
import {LocalRepository} from '../src/infra/local-repository.mjs';
import {ArtifactGuardAgent} from '../src/agent/orchestrator.mjs';
import {estimateEnclosureConcentration} from '../src/engine/enclosure.mjs';
const agent = new ArtifactGuardAgent(new LocalRepository());
let n = 0;
async function check(name, fn) {
  try {
    await fn();
    n++;
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}
await check('empty scenario refuses', async () => {
  const r = await agent.analyze(
    {revisionIds: [], artifactMaterialIds: []},
    {includeKnowledge: false},
  );
  assert.equal(r.analysis.verdict, 'INSUFFICIENT');
});
await check('prototype pollution inert', async () => {
  const p = JSON.parse('{"revisionIds":[],"artifactMaterialIds":[],"__proto__":{"polluted":true}}');
  await agent.analyze(p, {includeKnowledge: false});
  assert.equal({}.polluted, undefined);
});
await check('unknown revision refuses', async () => {
  const r = await agent.analyze(
    {revisionIds: ['x'], artifactMaterialIds: ['artifact-lead']},
    {includeKnowledge: false},
  );
  assert.notEqual(r.analysis.verdict, 'SUPPORTED');
});
await check('Terostat never unconditional supported', async () => {
  const r = await agent.analyze(
    {
      revisionIds: ['revision-terostat-historic'],
      artifactMaterialIds: ['artifact-lead'],
      environment: 'sealed',
      contact: 'indirect',
    },
    {includeKnowledge: false},
  );
  assert.equal(r.analysis.verdict, 'CONDITIONAL');
});
await check('PVC direct contact avoid', async () => {
  const r = await agent.analyze(
    {
      revisionIds: ['revision-flex-pvc-generic'],
      artifactMaterialIds: ['artifact-paper'],
      contact: 'direct',
    },
    {includeKnowledge: false},
  );
  assert.equal(r.analysis.verdict, 'AVOID');
});
await check('calculator rejects zero volume', () =>
  assert.equal(
    estimateEnclosureConcentration({
      emissionRateUgM2H: 1,
      areaM2: 1,
      volumeM3: 0,
      leakagePerHour: 1,
    }).ok,
    false,
  ),
);
await check('calculator exact equation', () =>
  assert.equal(
    estimateEnclosureConcentration({
      emissionRateUgM2H: 4,
      areaM2: 2,
      volumeM3: 1,
      leakagePerHour: 0.5,
    }).concentrationUgM3,
    16,
  ),
);
await check('no fake percentages', async () => {
  const r = await agent.analyze(
    {revisionIds: ['revision-terostat-historic'], artifactMaterialIds: ['artifact-paper']},
    {includeKnowledge: false},
  );
  assert.equal(/\b\d+(?:\.\d+)?%/.test(JSON.stringify(r.analysis)), false);
});
await check('source URLs https', async () => {
  const d = await new LocalRepository().getDataset();
  assert.ok(d.sources.every((s) => s.url.startsWith('https://')));
});
await check('synthetic labs labelled synthetic', async () => {
  const d = await new LocalRepository().getDataset(),
    s = d.oddyTests.filter((t) => t.institution?.startsWith('Synthetic'));
  assert.ok(s.every((t) => t.evidenceClass === 'synthetic-rule'));
});
await check('local KB honesty', async () => {
  const r = await agent.analyze({
    revisionIds: ['revision-terostat-historic'],
    artifactMaterialIds: ['artifact-paper'],
  });
  assert.equal(r.knowledge.mode, 'local-fixture');
});
console.log(`Red-team checks completed: ${n}`);
if (process.exitCode) process.exit(process.exitCode);
