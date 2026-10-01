import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeScenario} from '../src/engine/analyze.mjs';
import {describeProtocolVariation} from '../src/engine/oddy.mjs';

const dataset = (tests, protocols = []) => ({
  products: [{_id: 'p', name: 'Foam'}],
  productRevisions: [
    {_id: 'r', productId: 'p', label: 'batch', formulationIdentity: 'documented-test-sample'},
  ],
  artifactMaterials: [
    {_id: 'lead', name: 'Lead', couponMetal: 'lead', sensitiveTo: []},
    {_id: 'silver', name: 'Silver', couponMetal: 'silver', sensitiveTo: []},
    {_id: 'paper', name: 'Paper', sensitiveTo: []},
  ],
  oddyTests: tests.map((t, i) => ({_id: `t${i}`, revisionId: 'r', sourceIds: ['s'], ...t})),
  protocols,
  compounds: [],
  emissionObservations: [],
  interactions: [],
  evidenceClaims: [],
  sources: [
    {_id: 's', title: 'S', publisher: 'P', url: 'https://example.org', authority: 'peer-reviewed'},
  ],
});
const scenario = (artifact) => ({
  revisionIds: ['r'],
  artifactMaterialIds: [artifact],
  environment: 'open',
  contact: 'indirect',
});
const run = (data, artifact) => {
  const r = analyzeScenario(data, scenario(artifact));
  return {verdict: r.verdict, codes: r.deductions.map((d) => d.code)};
};

test('the lead coupon, not the overall rating, decides for lead; silver is judged on its own coupon', () => {
  const data = dataset([
    {silverResult: 'P', copperResult: 'P', leadResult: 'U', overallResult: 'U'},
  ]);
  assert.deepEqual(run(data, 'lead'), {verdict: 'AVOID', codes: ['ODDY_FAIL']});
  assert.equal(run(data, 'silver').verdict, 'SUPPORTED');
});

test('an artifact without a coupon metal uses the overall rating and says why that is weaker', () => {
  const data = dataset([
    {silverResult: 'P', copperResult: 'P', leadResult: 'U', overallResult: 'U'},
  ]);
  const r = run(data, 'paper');
  assert.equal(r.verdict, 'AVOID');
  assert.ok(r.codes.includes('NO_COUPON_FOR_ARTIFACT'));
});

test('where a test does not state the coupon result, its overall rating is used', () => {
  assert.equal(run(dataset([{overallResult: 'T'}]), 'lead').verdict, 'CONDITIONAL');
});

test('permanent against unsuitable is a major conflict; permanent against temporary is minor; both resolve to CONFLICTED', () => {
  const major = run(
    dataset([
      {leadResult: 'P', overallResult: 'P'},
      {leadResult: 'U', overallResult: 'U'},
    ]),
    'lead',
  );
  assert.deepEqual(major, {verdict: 'CONFLICTED', codes: ['MAJOR_TEST_CONFLICT']});
  const minor = run(
    dataset([
      {leadResult: 'P', overallResult: 'P'},
      {leadResult: 'T', overallResult: 'T'},
    ]),
    'lead',
  );
  assert.deepEqual(minor, {verdict: 'CONFLICTED', codes: ['MINOR_TEST_CONFLICT']});
});

test('unanimous permanent ratings raise nothing', () => {
  const data = dataset([
    {leadResult: 'P', overallResult: 'P'},
    {leadResult: 'P', overallResult: 'P'},
  ]);
  assert.deepEqual(run(data, 'lead').codes, ['NO_CONFLICT_FOUND']);
});

test('protocol variation lists only the fields that differ, with numeric ranges', () => {
  const protocols = new Map([
    [
      'a',
      {
        _id: 'a',
        couponAbrasion: 'P600 sandpaper',
        vesselType: 'jar',
        vesselVolumeMl: 50,
        waterVolumeMl: 0.5,
        sourceIds: ['s'],
      },
    ],
    [
      'b',
      {
        _id: 'b',
        couponAbrasion: '1500 micromesh',
        vesselType: 'jar',
        vesselVolumeMl: 250,
        waterVolumeMl: 0.5,
        sourceIds: ['s'],
      },
    ],
  ]);
  const tests = [{protocolId: 'a'}, {protocolId: 'b'}, {protocolId: 'b'}];
  const {message} = describeProtocolVariation(tests, protocols);
  assert.match(message, /2 different procedures/);
  assert.match(message, /coupon abrasion \(P600 sandpaper, 1500 micromesh\)/);
  assert.match(message, /vessel volume \(mL\) \(50–250\)/);
  assert.doesNotMatch(message, /vessel type|water volume/);
  assert.equal(describeProtocolVariation([{protocolId: 'a'}, {protocolId: 'a'}], protocols), null);
});
