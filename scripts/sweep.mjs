import assert from 'node:assert/strict';
import {LocalRepository} from '../src/infra/local-repository.mjs';
import {analyzeScenario} from '../src/engine/analyze.mjs';

const data = await new LocalRepository().getDataset();
const sourceIds = new Set(data.sources.map((s) => s._id));
const leak = /undefined|null|NaN|\[object/;
const tally = {};
let combinations = 0;

for (const revision of data.productRevisions)
  for (const artifact of data.artifactMaterials)
    for (const environment of ['open', 'enclosed', 'sealed'])
      for (const contact of ['direct', 'indirect']) {
        const key = [revision._id, artifact._id, environment, contact].join(' | ');
        const result = analyzeScenario(data, {
          revisionIds: [revision._id],
          artifactMaterialIds: [artifact._id],
          environment,
          contact,
        });
        const codes = result.deductions.map((d) => d.code);
        const levels = result.deductions.map((d) => d.level);
        combinations += 1;
        tally[result.verdict] = (tally[result.verdict] || 0) + 1;
        if (result.verdict === 'SUPPORTED')
          assert.ok(
            !levels.some((l) => l === 'warning' || l === 'error'),
            `${key}: SUPPORTED with a warning`,
          );
        if (codes.includes('ODDY_FAIL')) assert.equal(result.verdict, 'AVOID', key);
        if (codes.includes('DIRECT_CONTACT_INTERACTION'))
          assert.equal(result.verdict, 'AVOID', key);
        if (codes.includes('MAJOR_TEST_CONFLICT'))
          assert.ok(
            ['CONFLICTED', 'INSUFFICIENT', 'AVOID'].includes(result.verdict),
            `${key}: ${result.verdict}`,
          );
        assert.equal(leak.test(result.summary), false, `${key}: ${result.summary}`);
        for (const d of result.deductions) {
          assert.equal(leak.test(d.message), false, `${key}: ${d.message}`);
          for (const id of d.sourceIds || [])
            assert.ok(sourceIds.has(id), `${key}: unknown source ${id}`);
        }
      }

console.log(`Sweep completed: ${combinations} combinations, verdicts ${JSON.stringify(tally)}`);
