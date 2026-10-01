// No language model: anything missing or ambiguous becomes a question, never a guess.

const normalize = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const tokensOf = (text) => normalize(text).split(' ').filter(Boolean);

const PRODUCT_GENERIC = new Set([
  'display',
  'case',
  'enclosure',
  'adhesive',
  'current',
  'commercial',
  'sheet',
  'material',
  'materials',
  'class',
  'generic',
  'plastic',
  'coating',
  'structural',
]);
const ARTIFACT_STOP = new Set(['and', 'alloys', 'material', 'materials', 'black', 'white']);
const REVISION_STOP = new Set([
  'revision',
  'tested',
  'use',
  'museum',
  'purchased',
  'batch',
  'as',
  'the',
  'interlaboratory',
  'comparison',
  'casework',
  'unknown',
]);

const hasToken = (words, key) =>
  words.some((w) => w === key || (key.length >= 5 && w.startsWith(key.slice(0, 5))));

function pickBest(candidates) {
  if (!candidates.length) return {chosen: null, tied: []};
  const best = Math.max(...candidates.map((c) => c.score));
  const top = candidates.filter((c) => c.score === best);
  return {chosen: top.length === 1 ? top[0] : null, tied: top};
}

function matchProducts(text, words, products) {
  const padded = ` ${text} `;
  const named = products
    .flatMap((product) =>
      [product.name, ...(product.aliases || [])].map((label) => ({
        product,
        name: normalize(label),
      })),
    )
    .filter(({name}) => name && padded.includes(` ${name} `));
  if (named.length) {
    const longest = Math.max(...named.map(({name}) => name.length));
    const top = named.filter(({name}) => name.length === longest);
    return {chosen: top.length === 1 ? top[0] : null, tied: top};
  }
  const strong = [];
  const weak = [];
  for (const product of products) {
    const all = tokensOf(product.name).filter((t) => t.length > 1);
    const distinctive = all.filter((t) => !PRODUCT_GENERIC.has(t));
    const keys = distinctive.length
      ? distinctive
      : all.filter((t) => t !== 'current' && t !== 'commercial');
    const matched = keys.filter((k) => hasToken(words, k)).length;
    if (matched) (distinctive.length ? strong : weak).push({product, score: matched});
  }
  return pickBest(strong.length ? strong : weak);
}

function matchRevision(words, product) {
  if (product.revisions.length === 1) return {chosen: product.revisions[0], tied: []};
  const scored = product.revisions
    .map((revision) => ({
      revision,
      score: tokensOf(revision.label).filter((t) => !REVISION_STOP.has(t) && hasToken(words, t))
        .length,
    }))
    .filter((c) => c.score);
  const {chosen, tied} = pickBest(scored);
  return {chosen: chosen?.revision || null, tied: tied.map((t) => t.revision)};
}

function matchArtifacts(words, artifacts) {
  return artifacts.filter((a) =>
    tokensOf(a.name)
      .filter((t) => !ARTIFACT_STOP.has(t))
      .some((k) => hasToken(words, k)),
  );
}

function readEnvironment(text) {
  const sealed = /\b(sealed|airtight|hermetic)\b/.test(text);
  const open = /\bopen\b|\bon (an )?open shelf\b|\bno (case|enclosure)\b/.test(text);
  const enclosed = /\b(enclosed|enclosure|vitrine|cabinet|showcase|case|ventilated)\b/.test(text);
  if (sealed && open) return null;
  if (sealed) return 'sealed';
  if (open) return 'open';
  return enclosed ? 'enclosed' : null;
}

function readContact(text) {
  if (
    /\b(no|not|without|never)\b[^.]{0,24}\b(contact|touch\w*)\b|\bindirect\b|\bnot in contact\b/.test(
      text,
    )
  )
    return 'indirect';
  if (/\b(direct|touch\w*|contact|against|resting on|lying on|wrapped|placed on)\b/.test(text))
    return 'direct';
  return null;
}

export function interpretQuestion(question, catalog) {
  const text = normalize(question);
  const words = text.split(' ').filter(Boolean);
  const missing = [];
  const understood = {
    product: null,
    revision: null,
    artifact: null,
    environment: null,
    contact: null,
  };
  const scenario = {
    revisionIds: [],
    artifactMaterialIds: [],
    environment: undefined,
    contact: undefined,
  };

  const {chosen, tied} = matchProducts(text, words, catalog.products);
  if (chosen) {
    understood.product = chosen.product.name;
    const rev = matchRevision(words, chosen.product);
    if (rev.chosen) {
      understood.revision = rev.chosen.label;
      scenario.revisionIds = [rev.chosen.id];
    } else {
      missing.push({
        field: 'revision',
        question: `Which version of ${chosen.product.name}?`,
        options: (rev.tied.length ? rev.tied : chosen.product.revisions).map((r) => ({
          id: r.id,
          label: r.label,
        })),
      });
    }
  } else {
    const options = tied.flatMap(({product}) =>
      product.revisions.map((r) => ({id: r.id, label: `${product.name} — ${r.label}`})),
    );
    missing.push({
      field: 'product',
      question: tied.length ? 'Which of these materials do you mean?' : 'Which material is it?',
      ...(options.length ? {options} : {}),
    });
  }

  const artifacts = matchArtifacts(words, catalog.artifactMaterials);
  if (artifacts.length === 1) {
    understood.artifact = artifacts[0].name;
    scenario.artifactMaterialIds = [artifacts[0].id];
  } else {
    const options = (artifacts.length ? artifacts : catalog.artifactMaterials).map((a) => ({
      id: a.id,
      label: a.name,
    }));
    missing.push({
      field: 'artifact',
      question: artifacts.length
        ? 'Which one object material should I check first?'
        : 'Which artifact material is it next to?',
      options,
    });
  }

  scenario.environment = readEnvironment(text) || undefined;
  understood.environment = scenario.environment || null;
  if (!scenario.environment)
    missing.push({field: 'environment', question: 'Is the display sealed, enclosed, or open?'});

  scenario.contact = readContact(text) || undefined;
  understood.contact = scenario.contact || null;
  if (!scenario.contact)
    missing.push({field: 'contact', question: 'Do the two materials touch each other directly?'});

  return {scenario, understood, missing, complete: missing.length === 0};
}
