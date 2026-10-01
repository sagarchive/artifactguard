import {worse, yearsBetween} from './rules.mjs';
import {evaluateOddy, describeProtocolVariation} from './oddy.mjs';
const byId = (items) => new Map(items.map((x) => [x._id, x]));
function refs(ids, data) {
  const m = byId(data.sources);
  return [...new Set(ids.flat().filter(Boolean))]
    .map((id) => m.get(id))
    .filter(Boolean)
    .map(({_id, title, publisher, url, authority}) => ({
      id: _id,
      title,
      publisher,
      url,
      authority,
    }));
}
function push(out, code, level, message, evidenceIds = [], sourceIds = []) {
  out.deductions.push({code, level, message, evidenceIds, sourceIds});
}
export function analyzeScenario(data, scenario, now = new Date()) {
  const revs = byId(data.productRevisions),
    products = byId(data.products),
    compounds = byId(data.compounds),
    artifacts = byId(data.artifactMaterials),
    protocols = byId(data.protocols || []);
  const out = {
    verdict: 'SUPPORTED',
    scenario,
    deductions: [],
    evidence: [],
    sources: [],
    facts: {testResults: [], knownCompounds: [], interactions: []},
  };
  if (!scenario || typeof scenario !== 'object')
    return {
      ...out,
      verdict: 'INSUFFICIENT',
      deductions: [
        {
          code: 'NO_SCENARIO',
          level: 'error',
          message: 'No scenario supplied.',
          evidenceIds: [],
          sourceIds: [],
        },
      ],
    };
  const rids = Array.isArray(scenario.revisionIds) ? scenario.revisionIds : [],
    aids = Array.isArray(scenario.artifactMaterialIds) ? scenario.artifactMaterialIds : [];
  if (!rids.length) {
    out.verdict = 'INSUFFICIENT';
    push(
      out,
      'NO_PRODUCT_REVISION',
      'error',
      'Select at least one product/material revision. ArtifactGuard will not infer an unnamed product.',
    );
  }
  if (!aids.length) {
    out.verdict = worse(out.verdict, 'INSUFFICIENT');
    push(
      out,
      'NO_ARTIFACT_MATERIAL',
      'error',
      'Artifact material is required because compatibility is context-specific.',
    );
  }
  const selected = rids.map((id) => revs.get(id)).filter(Boolean),
    selectedArts = aids.map((id) => artifacts.get(id)).filter(Boolean),
    sensitivities = new Set(selectedArts.flatMap((x) => x.sensitiveTo || []));
  if (selected.length !== rids.length) {
    out.verdict = worse(out.verdict, 'INSUFFICIENT');
    push(
      out,
      'UNKNOWN_REVISION',
      'error',
      'At least one selected product revision is not present in the evidence graph.',
    );
  }
  if (selectedArts.length !== aids.length) {
    out.verdict = worse(out.verdict, 'INSUFFICIENT');
    push(
      out,
      'UNKNOWN_ARTIFACT_MATERIAL',
      'error',
      'At least one selected artifact material is not present in the evidence graph. ArtifactGuard will not silently drop an unknown artifact identity.',
    );
  }
  const passingTests = new Map(
    data.oddyTests
      .filter((t) => rids.includes(t.revisionId) && t.overallResult === 'P')
      .map((t) => [t._id, t]),
  );
  const firedClaims = (data.evidenceClaims || []).filter(
    (claim) =>
      claim.status === 'challenged' && (claim.supports || []).some((id) => passingTests.has(id)),
  );
  const explained = new Set(firedClaims.flatMap((claim) => claim.challenges || []));
  for (const rev of selected) {
    const product = products.get(rev.productId),
      tests = data.oddyTests.filter((t) => t.revisionId === rev._id),
      emissions = data.emissionObservations.filter((e) => e.revisionId === rev._id);
    out.evidence.push(...tests, ...emissions);
    if (!tests.length) {
      out.verdict = worse(out.verdict, 'INSUFFICIENT');
      push(
        out,
        'NO_ODDY_TEST',
        'warning',
        `${product?.name || rev.label} has no Oddy test record in the structured evidence set.`,
        [],
        rev.sourceIds || [],
      );
    } else {
      out.facts.testResults.push(
        ...tests.map((t) => ({
          product: product?.name || rev.label,
          testId: t._id,
          date: t.testDate,
          institution: t.institution,
          overall: t.overallResult,
        })),
      );
      for (const line of evaluateOddy({
        name: product?.name || rev.label,
        tests,
        artifacts: selectedArts,
      })) {
        out.verdict = worse(out.verdict, line.verdict);
        push(out, line.code, line.level, line.message, line.evidenceIds, line.sourceIds);
      }
      const variation = describeProtocolVariation(tests, protocols);
      if (variation)
        push(
          out,
          'PROTOCOL_VARIATION',
          'info',
          variation.message,
          variation.evidenceIds,
          variation.sourceIds,
        );
      const latest = tests
        .map((t) => ({t, age: yearsBetween(t.testDate, now.toISOString())}))
        .sort((a, b) => (a.age ?? 999) - (b.age ?? 999))[0];
      if (
        latest?.age != null &&
        latest.age > 7 &&
        rev.formulationIdentity !== 'documented-historic'
      ) {
        out.verdict = worse(out.verdict, 'RETEST');
        push(
          out,
          'OLD_TEST_INTERNAL_TRIGGER',
          'warning',
          `The newest test in this fixture is ${latest.age.toFixed(1)} years old. ArtifactGuard's internal QA policy requests review/retest when current formulation identity is not demonstrated; this is not represented as a universal conservation-industry expiry rule.`,
          [latest.t._id],
          latest.t.sourceIds || latest.t.basisSourceIds || [],
        );
      }
    }
    if (rev.identityNote)
      push(out, 'IDENTITY_NOTE', 'info', rev.identityNote, [rev._id], rev.sourceIds || []);
    if (rev.formulationIdentity?.startsWith('unknown')) {
      out.verdict = worse(out.verdict, 'RETEST');
      push(
        out,
        'FORMULATION_IDENTITY_UNCERTAIN',
        'warning',
        `${product?.name || rev.label}: current formulation identity is not demonstrated to match the historic tested revision.`,
        [rev._id],
        rev.sourceIds || [],
      );
    }
    for (const e of emissions) {
      const c = compounds.get(e.compoundId);
      if (!c) continue;
      out.facts.knownCompounds.push({
        product: product?.name || rev.label,
        compound: c.name,
        observationId: e._id,
      });
      if ((c.classes || []).some((x) => sensitivities.has(x))) {
        out.verdict = worse(out.verdict, 'CONDITIONAL');
        push(
          out,
          'EMISSION_ARTIFACT_SENSITIVITY',
          'warning',
          `${c.name} (${product?.name || rev.label}) matches a pollutant the selected artifact material is sensitive to. ${e.observedEffect}`,
          [e._id, c._id],
          [...(e.sourceIds || []), ...(c.sourceIds || [])],
        );
      } else if (!explained.has(e._id)) {
        push(
          out,
          'EMISSION_REPORTED',
          'info',
          `${c.name} (${product?.name || rev.label}): ${e.observedEffect}`,
          [e._id, c._id],
          [...(e.sourceIds || []), ...(c.sourceIds || [])],
        );
      }
    }
  }
  const emittedCompoundIds = new Set(
    data.emissionObservations.filter((e) => rids.includes(e.revisionId)).map((e) => e.compoundId),
  );
  for (const interaction of data.interactions || []) {
    if (!emittedCompoundIds.has(interaction.leftCompoundId)) continue;
    const conditions = interaction.conditions || [];
    const conditionMatch =
      !conditions.length ||
      conditions.every((c) =>
        c === 'direct-contact'
          ? scenario.contact === 'direct'
          : c === 'enclosed-display'
            ? ['sealed', 'enclosed'].includes(scenario.environment)
            : false,
      );
    if (!conditionMatch) continue;
    const classMatch =
      interaction.rightClass === 'direct-contact' ||
      interaction.rightClass === 'any-object' ||
      sensitivities.has(interaction.rightClass) ||
      [...emittedCompoundIds].some((id) =>
        (compounds.get(id)?.classes || []).includes(interaction.rightClass),
      );
    if (!classMatch) continue;
    out.evidence.push(interaction);
    out.facts.interactions.push({
      interactionId: interaction._id,
      rightClass: interaction.rightClass,
      effect: interaction.effect,
    });
    const direct = interaction.rightClass === 'direct-contact' && scenario.contact === 'direct';
    out.verdict = worse(out.verdict, direct ? 'AVOID' : 'CONDITIONAL');
    push(
      out,
      direct ? 'DIRECT_CONTACT_INTERACTION' : 'MATERIAL_INTERACTION',
      direct ? 'error' : 'warning',
      interaction.effect,
      [interaction._id],
      interaction.sourceIds || [],
    );
  }
  for (const claim of firedClaims) {
    const covered = (claim.supports || []).filter((id) => passingTests.has(id));
    out.verdict = worse(out.verdict, 'CONDITIONAL');
    const challenges = claim.challenges || [];
    for (const doc of [...data.emissionObservations, ...(data.interactions || [])])
      if (challenges.includes(doc._id)) out.evidence.push(doc);
    push(
      out,
      'PASS_NOT_COMPREHENSIVE',
      'error',
      claim.rationale || claim.statement,
      [...covered, ...challenges],
      claim.sourceIds || [],
    );
  }
  if (scenario.environment === 'sealed' || scenario.environment === 'enclosed')
    push(
      out,
      'ENCLOSURE_ACCUMULATION_CONTEXT',
      'info',
      'CCI describes a vulnerable object in a well-sealed enclosure with a large surface area of an emissive product as the most dangerous scenario, while closed enclosures also reduce risks from external pollutants.',
      [],
      ['cci-products', 'cci-basic'],
    );
  if (
    !out.deductions.some((d) => ['error', 'warning'].includes(d.level)) &&
    out.verdict === 'SUPPORTED'
  )
    push(
      out,
      'NO_CONFLICT_FOUND',
      'info',
      'No conflicting or adverse evidence was found in the scoped dataset. This means only that the available evidence supports the scenario; it is not a guarantee of safety.',
    );
  out.sources = refs(
    out.deductions.flatMap((d) => d.sourceIds || []),
    data,
  );
  out.evidence = [...new Map(out.evidence.map((e) => [e._id, e])).values()];
  const names = selected.map((r) => products.get(r.productId)?.name || r.label),
    findings = out.deductions.filter((d) => ['error', 'warning'].includes(d.level)).length,
    setting = {sealed: 'a sealed case', enclosed: 'an enclosed case', open: 'an open display'},
    touch = {direct: 'in direct contact', indirect: 'without direct contact'},
    where = [
      setting[scenario.environment] && `in ${setting[scenario.environment]}`,
      touch[scenario.contact],
    ]
      .filter(Boolean)
      .join(', ');
  out.summary = `${out.verdict}: ${names.join(' + ') || 'the selected materials'}${
    selectedArts.length ? ` with ${selectedArts.map((a) => a.name).join(' + ')}` : ''
  }${where ? `, ${where}` : ''}. ${
    findings
      ? `${findings} ${findings === 1 ? 'finding' : 'findings'} below.`
      : 'No adverse or conflicting evidence was found in the scoped dataset.'
  }`;
  return out;
}
