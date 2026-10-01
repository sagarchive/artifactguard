import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {analyzeScenario} from '../src/engine/analyze.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const seed = (await read('data/sanity-seed.ndjson'))
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const fixture = JSON.parse(await read('data/fixture-dataset.json'));
const sourcesOf = (doc) => (doc.sources || []).map((r) => r._ref);
const terostat = {
  revisionIds: ['revision-terostat-historic'],
  artifactMaterialIds: ['artifact-paper'],
  environment: 'sealed',
  contact: 'indirect',
};

test('every real-source record cites at least one source; synthetic records cite none as evidence', () => {
  for (const doc of seed) {
    if (doc.evidenceClass === 'real-source') assert.ok(sourcesOf(doc).length > 0, doc._id);
    if (doc.evidenceClass === 'synthetic-rule') assert.equal(sourcesOf(doc).length, 0, doc._id);
  }
});

test('real Oddy records carry per-coupon results only where a published table gives them, and no dates the papers do not give', () => {
  const real = seed.filter((d) => d._type === 'oddyTest' && d.evidenceClass === 'real-source');
  assert.ok(real.length > 100);
  for (const t of real) {
    assert.equal(t.testDate, undefined, `${t._id} must not carry a date the papers do not give`);
    const coupons = ['silverResult', 'copperResult', 'leadResult'].filter((k) => t[k]);
    if (coupons.length)
      assert.match(t.notes, /Table \d/, `${t._id} cites no table for its coupon results`);
  }
  const terostat = seed.find((d) => d._id === 'oddy-terostat-pass');
  for (const k of ['silverResult', 'copperResult', 'leadResult'])
    assert.equal(terostat[k], undefined, k);
});

test("ratings use the papers' P/T/U scale, and every overall rating is the worst of its coupons", () => {
  const rank = {P: 0, T: 1, U: 2};
  for (const t of seed.filter((d) => d._type === 'oddyTest')) {
    for (const k of ['silverResult', 'copperResult', 'leadResult', 'overallResult'])
      if (t[k] !== undefined) assert.ok(t[k] in rank, `${t._id}.${k}=${t[k]}`);
    const coupons = ['silverResult', 'copperResult', 'leadResult'].map((k) => t[k]).filter(Boolean);
    if (coupons.length === 3)
      assert.equal(
        t.overallResult,
        coupons.reduce((a, b) => (rank[b] > rank[a] ? b : a)),
        t._id,
      );
  }
});

test('interlaboratory procedures match the values in Tables 3 to 5 of the 2024 study', () => {
  const by = (id) => seed.find((d) => d._id === id);
  assert.deepEqual(
    ['couponAbrasion', 'vesselType', 'vesselVolumeMl', 'waterVolumeMl', 'stopper'].map(
      (k) => by('protocol-ilc-iii')[k],
    ),
    ['glass bristle brushes', 'Erlenmeyer flask with ground glass lid', 250, 2.5, 'glass lid'],
  );
  assert.equal(by('protocol-ilc-iv').couponAbrasion, '1500 grit micromesh pad');
  assert.equal(by('protocol-ilc-iv').waterVolumeMl, 1.23);
  assert.equal(by('protocol-ilc-vii').vesselVolumeMl, 54);
  assert.equal(
    seed.filter((d) => d._type === 'oddyTest' && d._id.startsWith('oddy-ilc-')).length,
    70,
  );
});

test('cellulose ether revisions keep their own supplier, purchase date and rating', () => {
  const klucelG = seed.filter(
    (d) => d._type === 'productRevision' && d.product._ref === 'product-klucel-g',
  );
  assert.equal(klucelG.length, 3);
  const overall = (revision) =>
    seed.find((d) => d._type === 'oddyTest' && d.revision._ref === revision._id).overallResult;
  assert.deepEqual(
    klucelG.map((r) => [r.supplier, r.purchaseDate, overall(r)]),
    [
      ['GMW (Ashland)', '03.2017', 'P'],
      ['Deffner (Ashland)', '08.2021', 'T'],
      ['Kremer (Ashland)', '11.2021', 'T'],
    ],
  );
});

test('Terostat-specific records do not cite a paper that never mentions Terostat', () => {
  const specific = seed.filter(
    (d) =>
      ['product', 'productRevision', 'oddyTest', 'emissionObservation'].includes(d._type) &&
      /terostat/i.test(JSON.stringify(d)),
  );
  assert.ok(specific.length >= 4);
  for (const d of specific)
    assert.ok(!sourcesOf(d).includes('oddy-cnn'), `${d._id} cites oddy-cnn`);
});

test('the Terostat naming discrepancy between sources is recorded and surfaced', () => {
  const revision = seed.find((d) => d._id === 'revision-terostat-historic');
  assert.match(revision.identityNote, /MS 937/);
  const codes = analyzeScenario(fixture, terostat).deductions.map((d) => d.code);
  assert.ok(codes.includes('IDENTITY_NOTE'));
});

test('the engine contains no product, artifact or revision ids: verdicts come from the data', async () => {
  const code = await read('src/engine/analyze.mjs');
  assert.doesNotMatch(
    code,
    /(revision|artifact|product|emission|interaction|claim|oddy)-[a-z0-9-]+['"]/,
  );
});

test('removing the challenged claim removes the PASS_NOT_COMPREHENSIVE deduction', () => {
  const withClaim = analyzeScenario(fixture, terostat).deductions.map((d) => d.code);
  const without = analyzeScenario({...fixture, evidenceClaims: []}, terostat).deductions.map(
    (d) => d.code,
  );
  assert.ok(withClaim.includes('PASS_NOT_COMPREHENSIVE'));
  assert.ok(!without.includes('PASS_NOT_COMPREHENSIVE'));
});

test('removing the contact interaction removes the flexible PVC contact deduction', () => {
  const pvc = {
    revisionIds: ['revision-flex-pvc-generic'],
    artifactMaterialIds: ['artifact-paper'],
    environment: 'open',
    contact: 'direct',
  };
  assert.equal(analyzeScenario(fixture, pvc).verdict, 'AVOID');
  const without = analyzeScenario({...fixture, interactions: []}, pvc);
  assert.notEqual(without.verdict, 'AVOID');
});

test('a no-conflict deduction cites no source, because no source supports it', () => {
  const r = analyzeScenario(fixture, {
    revisionIds: ['revision-paint-current'],
    artifactMaterialIds: ['artifact-paper'],
    environment: 'open',
    contact: 'indirect',
  });
  assert.equal(r.verdict, 'SUPPORTED');
  assert.deepEqual(r.deductions.find((d) => d.code === 'NO_CONFLICT_FOUND').sourceIds, []);
});

test('the seed is exactly what the generator builds from curated records and extracted tables', async () => {
  const {execFileSync} = await import('node:child_process');
  execFileSync(process.execPath, ['scripts/build-seed.mjs', '--check'], {
    cwd: new URL('..', import.meta.url),
  });
});

test(
  'the local fixture is exactly the live GROQ projection of the seed',
  {skip: !existsSync(new URL('../studio/node_modules/groq-js', import.meta.url))},
  async () => {
    const {QUERY} = await import('../src/infra/live-repository.mjs');
    const {parse, evaluate} = createRequire(new URL('../studio/package.json', import.meta.url))(
      'groq-js',
    );
    const projected = await (await evaluate(parse(QUERY), {dataset: seed})).get();
    assert.deepEqual(fixture, JSON.parse(JSON.stringify(projected)));
  },
);
