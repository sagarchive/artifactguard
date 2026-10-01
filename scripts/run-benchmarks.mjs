import {runBenchmarks} from './benchmark-lib.mjs';
const r = await runBenchmarks();
console.log(
  `ArtifactGuard benchmark: ${r.passed}/${r.total} passed (${(r.passRate * 100).toFixed(1)}%)`,
);
for (const x of r.rows)
  console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.id} ${x.actual.padEnd(12)} ${x.name}`);
if (r.failed) process.exitCode = 1;
