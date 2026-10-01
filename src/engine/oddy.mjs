import {testConflict} from './rules.mjs';

const unique = (values) => [...new Set(values.filter((v) => v !== undefined && v !== null))];
const tally = (values) =>
  ['P', 'T', 'U']
    .filter((k) => values.includes(k))
    .map((k) => `${values.filter((v) => v === k).length} ${k}`)
    .join(', ');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ratingFor = (test, metal) => (metal && test[`${metal}Result`]) || test.overallResult;
const sourcesOf = (tests) => unique(tests.flatMap((t) => t.sourceIds || []));

const VARIATION_FIELDS = [
  ['couponAbrasion', 'coupon abrasion'],
  ['vesselType', 'vessel type'],
  ['vesselVolumeMl', 'vessel volume (mL)'],
  ['waterVolumeMl', 'water volume (mL)'],
  ['stopper', 'stopper'],
];

export function evaluateOddy({name, tests, artifacts}) {
  const lines = [];
  const evidenceIds = tests.map((t) => t._id);
  const sourceIds = sourcesOf(tests);
  for (const artifact of artifacts.length ? artifacts : [null]) {
    const metal = artifact?.couponMetal;
    const values = tests.map((t) => ratingFor(t, metal));
    const scope = metal ? `${metal} coupon` : 'overall rating';
    const summary = `${plural(tests.length, 'test')} (${tally(values)})`;
    const conflict = testConflict(values);
    const add = (verdict, code, level, message) =>
      lines.push({verdict, code, level, message, evidenceIds, sourceIds});
    if (conflict === 'MAJOR_CONFLICT')
      add(
        'CONFLICTED',
        'MAJOR_TEST_CONFLICT',
        'error',
        `${name}, ${scope}: ${summary} include both permanent and unsuitable outcomes.`,
      );
    else if (conflict === 'MINOR_CONFLICT')
      add(
        'CONFLICTED',
        'MINOR_TEST_CONFLICT',
        'warning',
        `${name}, ${scope}: ${summary} do not agree.`,
      );
    else if (values[0] === 'U')
      add('AVOID', 'ODDY_FAIL', 'error', `${name}, ${scope}: all ${summary} are unsuitable (U).`);
    else if (values[0] === 'T')
      add(
        'CONDITIONAL',
        'ODDY_TEMPORARY',
        'warning',
        `${name}, ${scope}: ${summary} are temporary (T); permanent-use support is not established.`,
      );
    if (artifact && !metal)
      lines.push({
        verdict: 'SUPPORTED',
        code: 'NO_COUPON_FOR_ARTIFACT',
        level: 'info',
        message: `Oddy coupons are silver, copper and lead, so these results do not measure risk to ${artifact.name} directly. A 2025 review says the test may not effectively assess the risk to materials such as paper, paints or plastics, while the cellulose ether study cites British Museum experience that the results for these metals can be generalized to all materials. The overall rating is shown as a general screen.`,
        evidenceIds: [],
        sourceIds: ['ms-optimization', 'cellulose-ethers'],
      });
  }
  return lines;
}

export function describeProtocolVariation(tests, protocols) {
  const used = unique(tests.map((t) => t.protocolId))
    .map((id) => protocols.get(id))
    .filter(Boolean);
  if (used.length < 2) return null;
  const parts = [];
  for (const [field, label] of VARIATION_FIELDS) {
    const values = unique(used.map((p) => p[field]));
    if (values.length < 2) continue;
    const numeric = values.every((v) => typeof v === 'number');
    parts.push(
      `${label} (${numeric ? `${Math.min(...values)}–${Math.max(...values)}` : values.join(', ')})`,
    );
  }
  if (!parts.length) return null;
  return {
    message: `These ratings come from ${used.length} different procedures. They differ in ${parts.join('; ')}.`,
    evidenceIds: used.map((p) => p._id),
    sourceIds: unique(used.flatMap((p) => p.sourceIds || [])),
  };
}
