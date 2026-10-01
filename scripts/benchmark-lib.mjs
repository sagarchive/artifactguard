import {readFile} from 'node:fs/promises';
import {LocalRepository} from '../src/infra/local-repository.mjs';
import {ArtifactGuardAgent} from '../src/agent/orchestrator.mjs';
export async function runBenchmarks() {
  const cases = JSON.parse(
    await readFile(new URL('../benchmarks/cases.json', import.meta.url), 'utf8'),
  );
  const agent = new ArtifactGuardAgent(new LocalRepository()),
    rows = [];
  for (const t of cases) {
    const r = await agent.analyze(t.scenario, {includeKnowledge: false}),
      codes = new Set(r.analysis.deductions.map((d) => d.code));
    const verdictOk = t.expected.includes(r.analysis.verdict),
      codesOk =
        (t.mustCodes || []).every((c) => codes.has(c)) &&
        !(t.mustNotCodes || []).some((c) => codes.has(c));
    const baselineOk =
      t.expectBaselineUnsupportedCertainty === undefined ||
      r.baseline.unsupportedCertainty === t.expectBaselineUnsupportedCertainty;
    rows.push({
      id: t.id,
      name: t.name,
      pass: verdictOk && codesOk && baselineOk,
      actual: r.analysis.verdict,
      expected: t.expected,
      observedCodes: [...codes],
      requiredCodes: t.mustCodes || [],
      kind: t.kind,
      baseline: r.baseline.verdict,
      baselineUnsupportedCertainty: r.baseline.unsupportedCertainty,
    });
  }
  const passed = rows.filter((r) => r.pass).length;
  return {
    total: rows.length,
    passed,
    failed: rows.length - passed,
    passRate: Number((passed / rows.length).toFixed(4)),
    baselineUnsupportedCertaintyCount: rows.filter((r) => r.baselineUnsupportedCertainty).length,
    rows,
  };
}
