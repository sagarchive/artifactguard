import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalRepository} from '../src/infra/local-repository.mjs';
import {analyzeScenario} from '../src/engine/analyze.mjs';
const repo = new LocalRepository();
test('Terostat source case does not flatten PASS into SUPPORTED', async () => {
  const d = await repo.getDataset(),
    r = analyzeScenario(d, {
      revisionIds: ['revision-terostat-historic'],
      artifactMaterialIds: ['artifact-lead'],
      environment: 'sealed',
      contact: 'indirect',
    });
  assert.equal(r.verdict, 'CONDITIONAL');
  assert.ok(r.deductions.some((x) => x.code === 'PASS_NOT_COMPREHENSIVE'));
  assert.ok(r.sources.some((s) => s.id === 'ms-optimization'));
});
test('direct contact with flexible PVC is stopped', async () => {
  const d = await repo.getDataset(),
    r = analyzeScenario(d, {
      revisionIds: ['revision-flex-pvc-generic'],
      artifactMaterialIds: ['artifact-paper'],
      environment: 'open',
      contact: 'direct',
    });
  assert.equal(r.verdict, 'AVOID');
});
test('unknown material refuses rather than guessing', async () => {
  const d = await repo.getDataset(),
    r = analyzeScenario(d, {revisionIds: ['not-real'], artifactMaterialIds: ['artifact-paper']});
  assert.equal(r.verdict, 'INSUFFICIENT');
});

test('unknown artifact identity refuses rather than silently dropping it', async () => {
  const d = await repo.getDataset(),
    r = analyzeScenario(d, {
      revisionIds: ['revision-paint-current'],
      artifactMaterialIds: ['artifact-paper', 'does-not-exist'],
      environment: 'open',
      contact: 'indirect',
    });
  assert.equal(r.verdict, 'INSUFFICIENT');
  assert.ok(r.deductions.some((x) => x.code === 'UNKNOWN_ARTIFACT_MATERIAL'));
});

test('structured interaction graph is surfaced for enclosed Terostat scenario', async () => {
  const d = await repo.getDataset(),
    r = analyzeScenario(d, {
      revisionIds: ['revision-terostat-historic'],
      artifactMaterialIds: ['artifact-lead'],
      environment: 'sealed',
      contact: 'indirect',
    });
  assert.ok(r.facts.interactions.some((x) => x.interactionId === 'interaction-tmpol-acidic'));
  assert.ok(r.evidence.some((x) => x._id === 'interaction-tmpol-acidic'));
});
