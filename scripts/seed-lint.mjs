import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const lines = (await readFile(new URL('../data/sanity-seed.ndjson', import.meta.url), 'utf8'))
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
const docs = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`seed line ${i + 1}: ${e.message}`);
    }
  }),
  ids = new Set(docs.map((x) => x._id));
assert.equal(ids.size, docs.length, 'duplicate document IDs');
const refs = [];
function walk(v, path) {
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
  if (!v || typeof v !== 'object') return;
  if (v._type === 'reference') {
    assert.equal(typeof v._ref, 'string', `${path} missing _ref`);
    refs.push([path, v._ref]);
    return;
  }
  for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
}
for (const d of docs) walk(d, d._id);
for (const [path, id] of refs) assert.ok(ids.has(id), `${path} points to missing ${id}`);
const relTypes = [
  'productRevision',
  'oddyTest',
  'emissionObservation',
  'interaction',
  'evidenceClaim',
];
for (const t of relTypes)
  assert.ok(
    docs.some((d) => d._type === t),
    `missing ${t}`,
  );
assert.ok(refs.length >= 25, `expected a relationship-rich seed, found ${refs.length} references`);
console.log(
  `Sanity seed lint passed: ${docs.length} docs, ${refs.length} native references, all targets resolve`,
);
