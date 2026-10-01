const when = (t) => (t.testDate ? ` (${t.testDate})` : '');

export function keywordBaseline(data, scenario) {
  const ids = new Set(scenario.revisionIds || []);
  const tests = data.oddyTests.filter((t) => ids.has(t.revisionId));
  const first = tests[0];
  if (!first)
    return {
      verdict: 'INSUFFICIENT',
      reason: 'No matching test text found.',
      unsupportedCertainty: false,
    };
  if (first.overallResult === 'P')
    return {
      verdict: 'SUPPORTED',
      reason: `First matching test says permanent (P)${when(first)}.`,
      unsupportedCertainty: true,
    };
  if (first.overallResult === 'T')
    return {
      verdict: 'CONDITIONAL',
      reason: `First matching test says temporary (T)${when(first)}.`,
      unsupportedCertainty: false,
    };
  return {
    verdict: 'AVOID',
    reason: `First matching test says unsuitable (U)${when(first)}.`,
    unsupportedCertainty: false,
  };
}
