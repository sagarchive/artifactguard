import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {QUERY} from '../src/infra/live-repository.mjs';

const require = createRequire(new URL('../studio/package.json', import.meta.url));
const {parse, evaluate} = require('groq-js');

const seedPath = new URL('../data/sanity-seed.ndjson', import.meta.url);
const fixturePath = new URL('../data/fixture-dataset.json', import.meta.url);
const documents = (await readFile(seedPath, 'utf8'))
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const projected = await (await evaluate(parse(QUERY), {dataset: documents})).get();
const next = `${JSON.stringify(projected, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(fixturePath, 'utf8');
  if (current !== next) {
    console.error('data/fixture-dataset.json is out of date. Run: npm run build:fixture');
    process.exit(1);
  }
  console.log('Fixture matches the seed.');
} else {
  await writeFile(fixturePath, next);
  console.log(`Wrote fixture from ${documents.length} seed documents.`);
}
