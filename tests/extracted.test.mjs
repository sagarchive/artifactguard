import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load = async (name) =>
  JSON.parse(
    await readFile(new URL(`../research/extracted/${name}.json`, import.meta.url), 'utf8'),
  );
const interlab = await load('interlab-2024-ratings');
const counts = (await load('interlab-2024-table8-counts')).counts;
const ms = await load('ms-2025-oddy-and-voc');
const cellulose = await load('cellulose-2022-oddy');
const rank = {P: 0, T: 1, U: 2, F: 2};
const worst = (...r) => r.reduce((a, b) => (rank[b] > rank[a] ? b : a));
const tally = (values) => ({
  P: values.filter((v) => v === 'P').length,
  T: values.filter((v) => v === 'T').length,
  U: values.filter((v) => v === 'U').length,
});

test('Table 7 transcription reproduces every per-coupon count printed in Table 8', () => {
  for (const [inst, expected] of Object.entries(counts)) {
    const rows = interlab.ratings[inst];
    assert.equal(rows.length, 10, inst);
    const metals = {
      silver: tally(rows.map((r) => r.silver)),
      copper: tally(rows.map((r) => r.copper)),
      lead: tally(rows.map((r) => r.lead)),
    };
    for (const metal of Object.keys(metals))
      assert.deepEqual(metals[metal], expected[metal], `${inst} ${metal}`);
    assert.deepEqual(
      tally(rows.flatMap((r) => [r.silver, r.copper, r.lead])),
      expected.total,
      `${inst} total`,
    );
  }
});

test('in the interlaboratory table the overall rating is the worst of the three coupons', () => {
  for (const [inst, rows] of Object.entries(interlab.ratings))
    for (const r of rows)
      assert.equal(r.overall, worst(r.silver, r.copper, r.lead), `${inst} material ${r.material}`);
});

test('2025 study table agrees with the paper text: which materials passed, were temporary, or unsuitable', () => {
  const by = (overall) => ms.rows.filter((r) => r.overall === overall).map((r) => r.material);
  assert.deepEqual(by('P'), [1, 9]);
  assert.deepEqual(by('T'), [2, 3, 4, 6]);
  assert.deepEqual(by('U'), [5, 7, 8, 10]);
  const metal = (m, v) => ms.rows.filter((r) => r[m] === v).map((r) => r.material);
  assert.deepEqual(metal('silver', 'U'), [5]);
  assert.deepEqual(metal('copper', 'U'), [5, 10]);
  assert.deepEqual(metal('lead', 'U'), [7, 8, 10]);
  for (const r of ms.rows)
    assert.equal(r.overall, worst(r.silver, r.copper, r.lead), `material ${r.material}`);
});

test('cellulose ether table matches the paper abstract: 60 products, 55% P, 33% T, 11% F', () => {
  const rows = cellulose.rows;
  assert.equal(rows.length, 60);
  const overall = rows.map((r) => r.overall);
  assert.deepEqual(
    [
      overall.filter((v) => v === 'P').length,
      overall.filter((v) => v === 'T').length,
      overall.filter((v) => v === 'F').length,
    ],
    [33, 20, 7],
  );
  for (const r of rows)
    assert.equal(r.overall, worst(r.silver, r.copper, r.lead), `${r.product} ${r.supplier}`);
});
