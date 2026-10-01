import {readFile, readdir, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const base = fileURLToPath(new URL('../', import.meta.url)),
  fail = [];
async function walk(d) {
  const a = [];
  for (const e of await readdir(d, {withFileTypes: true})) {
    if (['node_modules', '.git'].includes(e.name)) continue;
    const p = join(d, e.name);
    e.isDirectory() ? a.push(...(await walk(p))) : a.push(p);
  }
  return a;
}
const files = await walk(base);
for (const f of files) {
  if (/\.(mjs|js|json|md|html|css|ts)$/.test(f)) {
    const t = await readFile(f, 'utf8');
    if (/sk-[A-Za-z0-9_-]{20,}/.test(t)) fail.push(`${f}: possible API key`);
    if (/SANITY_ORGANIZATION_TOKEN\s*=\s*\S{20,}/.test(t)) fail.push(`${f}: possible Sanity token`);
  }
}
for (const rel of [
  'README.md',
  '.env.example',
  'docs/SANITY_SETUP.md',
  'docs/DEPLOYMENT.md',
  'docs/THREAT_MODEL.md',
  'docs/QA_REPORT.md',
  'research/sources.md',
  'benchmarks/cases.json',
  'data/sanity-seed.ndjson',
]) {
  try {
    await stat(join(base, rel));
  } catch {
    fail.push(`missing ${rel}`);
  }
}
if (fail.length) {
  fail.forEach((x) => console.error('FAIL', x));
  process.exit(1);
}
console.log(`Project lint passed (${files.length} files scanned).`);
