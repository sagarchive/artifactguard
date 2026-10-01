import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalRepository} from '../src/infra/local-repository.mjs';
import {ArtifactGuardAgent} from '../src/agent/orchestrator.mjs';
import {interpretQuestion} from '../src/agent/interpret.mjs';
import {
  CODE_TO_TOPIC,
  TOPICS,
  parseSearchHits,
  pickPassage,
  toEntry,
  topicsFor,
  withoutSummary,
} from '../src/agent/guidance.mjs';
const agent = new ArtifactGuardAgent(new LocalRepository());
const catalog = await agent.catalog();
const ask = (q) => interpretQuestion(q, catalog);

test('plain English: flagship question resolves fully', () => {
  const r = ask('Is Terostat-9220 okay next to lead in a sealed case, not touching?');
  assert.equal(r.complete, true);
  assert.deepEqual(r.scenario, {
    revisionIds: ['revision-terostat-historic'],
    artifactMaterialIds: ['artifact-lead'],
    environment: 'sealed',
    contact: 'indirect',
  });
});
test('plain English: direct contact and open display', () => {
  const r = ask('flexible PVC touching paper on an open shelf');
  assert.equal(r.complete, true);
  assert.equal(r.scenario.contact, 'direct');
  assert.equal(r.scenario.environment, 'open');
  assert.deepEqual(r.scenario.revisionIds, ['revision-flex-pvc-generic']);
});
test('plain English: a vitrine is an enclosed case; "no direct contact" is indirect', () => {
  const r = ask('paint next to paper in a vitrine, no direct contact');
  assert.equal(r.scenario.environment, 'enclosed');
  assert.equal(r.scenario.contact, 'indirect');
});
test('plain English: an ambiguous product asks which version instead of guessing', () => {
  const r = ask('is the adhesive ok with copper in a sealed case, not touching');
  assert.equal(r.complete, false);
  const m = r.missing.find((x) => x.field === 'revision');
  assert.ok(m && m.options.length === 2);
  assert.deepEqual(r.scenario.revisionIds, []);
});
test('plain English: missing details become questions, never defaults', () => {
  const r = ask('hello');
  assert.deepEqual(r.missing.map((m) => m.field).sort(), [
    'artifact',
    'contact',
    'environment',
    'product',
  ]);
  assert.equal(r.scenario.environment, undefined);
  assert.equal(r.scenario.contact, undefined);
  assert.deepEqual(r.scenario.artifactMaterialIds, []);
});
test('plain English: two artifact materials ask for one; conflicting environments ask again', () => {
  assert.ok(
    ask('Terostat-9220 with lead and silver, sealed, not touching').missing.some(
      (m) => m.field === 'artifact',
    ),
  );
  assert.equal(
    ask('Terostat-9220 with lead, sealed or open, not touching').scenario.environment,
    undefined,
  );
});
test('plain English: words inside other words do not match', () => {
  assert.equal(ask('leadership meeting').scenario.artifactMaterialIds.length, 0);
});

test('guidance: topics follow the deductions, deduplicate in order, and every code maps to a defined topic', () => {
  const a = {
    deductions: [
      {code: 'ENCLOSURE_ACCUMULATION_CONTEXT'},
      {code: 'PASS_NOT_COMPREHENSIVE'},
      {code: 'IDENTITY_NOTE'},
      {code: 'NOPE'},
    ],
  };
  assert.deepEqual(topicsFor(a), ['enclosure', 'terostat']);
  for (const topic of Object.values(CODE_TO_TOPIC)) assert.ok(TOPICS[topic], topic);
});

test('guidance: search hits are parsed from the Knowledge Base search format', () => {
  const text =
    'Entries matching "x", ranked by relevance:\n\n1. `materials_compatibility` (score 18.76): Title\n   Summary\n2. `oddy_test` (score 11.07): Other\n   Summary';
  assert.deepEqual(parseSearchHits(text), [
    {path: 'materials_compatibility', score: 18.76},
    {path: 'oddy_test', score: 11.07},
  ]);
  assert.deepEqual(parseSearchHits('No matches'), []);
});

const MERGED = `# Materials

## Flexible PVC

CCI lists plasticizer from degraded flexible PVC as a cause of stains [1]:

- **Stains** in objects in direct contact.
- **Leaching** of compounds from a surface.

| Symbol | Meaning |
|---|---|
| C | Concentration |

## Terostat case

A 2025 review reports that Terostat-9220 passed an Oddy test and TMP-ol efflorescence appeared in display cases [2].

## Sources

1. 06.md`;

test('guidance: the passage is chosen by topic inside a merged entry, not the first paragraph', () => {
  assert.match(pickPassage(MERGED, TOPICS.terostat), /Terostat-9220 passed an Oddy test/);
  assert.match(pickPassage(MERGED, TOPICS.contact), /plasticizer from degraded flexible PVC/);
  assert.doesNotMatch(pickPassage(MERGED, TOPICS.terostat), /\[\d\]|\||Sources/);
});

test('guidance: a long run of clauses is cut with an ellipsis, never on a dangling semicolon', () => {
  const out = pickPassage(
    `# T\n\n${'It lists lead as corroded by acetic acid; '.repeat(30)}`,
    TOPICS.vulnerability,
  );
  assert.ok(out.endsWith('…'));
  assert.ok(!out.endsWith(';…') && !out.endsWith('; …'));
  assert.ok(out.length <= 421);
});

test('guidance: an entry without a matching passage falls back to its first block', () => {
  assert.equal(
    pickPassage('# T\n\nFirst block here.\n\nSecond block here.', 'zzz qqq'),
    'First block here.',
  );
  assert.equal(pickPassage('# T', TOPICS.oddy), '');
});

test('live entries drop the generated one-line summary from the displayed text, but cited bodies are kept', () => {
  const md =
    '# Title\n\nA generated one-line summary with no citation\n\nThe body says something [1].\n\n## Sources\n\n1. file.md';
  assert.equal(
    withoutSummary(md),
    '# Title\n\nThe body says something [1].\n\n## Sources\n\n1. file.md',
  );
  assert.ok(!toEntry('terostat', 'p', md, {skipSummary: true}).text.includes('generated one-line'));
  assert.ok(toEntry('terostat', 'p', md).text.includes('generated one-line'));
  const cited = '# Title\n\nOnly a cited line [1].\n\n## Sources';
  assert.equal(withoutSummary(cited), cited);
});

test('analyze returns a trace, and guidance only for topics whose entries were found', async () => {
  const r = await agent.analyze({
    revisionIds: ['revision-terostat-historic'],
    artifactMaterialIds: ['artifact-lead'],
    environment: 'sealed',
    contact: 'indirect',
  });
  assert.ok(r.trace.some((s) => s.tool === 'rules'));
  const topics = r.knowledge.entries.map((e) => e.topic);
  assert.ok(topics.length >= 2 && topics.length <= 6);
  for (const [code, topic] of Object.entries(r.guidance)) {
    assert.ok(topics.includes(topic));
    assert.ok(r.analysis.deductions.some((d) => d.code === code));
  }
  const terostat = r.knowledge.entries.find((e) => e.topic === 'terostat');
  assert.match(terostat.excerpt, /Terostat/);
});

test('guidance: an intro line that ends in a colon is returned together with the list it introduces', () => {
  const md =
    '# T\n\nSummary\n\nCCI ties damage to pollutants:\n\n- Lead: acetic acid\n- Silver: hydrogen sulfide\n\nOther text about enclosures.';
  assert.equal(
    pickPassage(md, TOPICS.vulnerability),
    'CCI ties damage to pollutants: Lead: acetic acid. Silver: hydrogen sulfide.',
  );
});
