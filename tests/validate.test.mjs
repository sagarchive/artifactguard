import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAnalyzeBody, parseScenario, createRateLimiter} from '../src/lib/validate.mjs';
import {estimateEnclosureConcentration} from '../src/engine/enclosure.mjs';
const ok = {
  revisionIds: ['revision-terostat-historic'],
  artifactMaterialIds: ['artifact-lead'],
  environment: 'sealed',
  contact: 'indirect',
};
const code = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.statusCode;
  }
};

test('non-object bodies are rejected with 400', () => {
  for (const b of [null, [], 'x', 5, true])
    assert.equal(
      code(() => parseAnalyzeBody(b)),
      400,
    );
});
test('invalid environment/contact are rejected, never guessed', () => {
  assert.equal(
    code(() => parseScenario({...ok, environment: '<script>'})),
    400,
  );
  assert.equal(
    code(() => parseScenario({...ok, contact: 'x'})),
    400,
  );
});
test('ids must be string arrays within limits', () => {
  assert.equal(
    code(() => parseScenario({...ok, revisionIds: 'revision-terostat-historic'})),
    400,
  );
  assert.equal(
    code(() => parseScenario({...ok, revisionIds: [1, {a: 1}]})),
    400,
  );
  assert.equal(
    code(() => parseScenario({...ok, artifactMaterialIds: Array(11).fill('a')})),
    400,
  );
});
test('valid scenario passes, dedupes, drops unknown keys, returns a new object', () => {
  const input = {
    ...ok,
    artifactMaterialIds: ['artifact-lead', 'artifact-lead'],
    __proto__: {x: 1},
    durationMonths: 24,
  };
  const s = parseScenario(input);
  assert.deepEqual(s.artifactMaterialIds, ['artifact-lead']);
  assert.equal('durationMonths' in s, false);
  assert.notEqual(s, input);
});
test('empty ids stay valid so the engine can return INSUFFICIENT', () =>
  assert.deepEqual(parseScenario({}).revisionIds, []));
test('includeKnowledge must be boolean', () => {
  assert.equal(
    code(() => parseAnalyzeBody({scenario: ok, includeKnowledge: 'false'})),
    400,
  );
  assert.equal(parseAnalyzeBody({scenario: ok, includeKnowledge: false}).includeKnowledge, false);
});
test('enclosure rejects strings, booleans and overflow', () => {
  assert.equal(
    estimateEnclosureConcentration({
      emissionRateUgM2H: '2',
      areaM2: 1,
      volumeM3: 1,
      leakagePerHour: 1,
    }).ok,
    false,
  );
  assert.equal(
    estimateEnclosureConcentration({
      emissionRateUgM2H: true,
      areaM2: 1,
      volumeM3: 1,
      leakagePerHour: 1,
    }).ok,
    false,
  );
  assert.equal(
    estimateEnclosureConcentration({
      emissionRateUgM2H: 2,
      areaM2: 1e308,
      volumeM3: 1e-320,
      leakagePerHour: 1,
    }).ok,
    false,
  );
  assert.equal(
    estimateEnclosureConcentration({
      emissionRateUgM2H: 2,
      areaM2: 1,
      volumeM3: 0.5,
      leakagePerHour: 0.25,
    }).concentrationUgM3,
    16,
  );
});
test('rate limiter blocks after the limit and recovers after the window', () => {
  const rl = createRateLimiter({limit: 2, windowMs: 1000});
  assert.equal(rl('a', 0).allowed, true);
  assert.equal(rl('a', 1).allowed, true);
  assert.equal(rl('a', 2).allowed, false);
  assert.equal(rl('b', 2).allowed, true);
  assert.equal(rl('a', 1001).allowed, true);
});
test('frontend: compare.js is loaded as a module (it uses top-level await)', async () => {
  assert.match(
    await readFile('public/compare.html', 'utf8'),
    /<script type="module" src="\/assets\/compare\.js">/,
  );
});
test('frontend: no inline style attributes (server CSP is style-src self)', async () => {
  for (const f of [
    'index.html',
    'compare.html',
    'method.html',
    'assets/app.js',
    'assets/compare.js',
  ])
    assert.doesNotMatch(await readFile(`public/${f}`, 'utf8'), /\sstyle=/, f);
});
