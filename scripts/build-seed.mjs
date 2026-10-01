import {readFile, writeFile} from 'node:fs/promises';

const here = (path) => new URL(`../${path}`, import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(here(path), 'utf8'));
const ref = (id) => ({_type: 'reference', _ref: id});
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[®™]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const TYPES = {
  HPC: 'hydroxypropyl cellulose',
  EC: 'ethyl cellulose',
  HEC: 'hydroxyethyl cellulose',
  MC: 'methyl cellulose',
  MHEC: 'methyl hydroxyethyl cellulose',
  MHPC: 'methyl hydroxypropyl cellulose',
  'Na-CMC': 'sodium carboxymethyl cellulose',
};
const COMPOUNDS = {
  'acetic-acid': 'compound-acetic-acid',
  'formic-acid': 'compound-formic-acid',
  'carboxylic-acids': 'compound-carboxylic-acids',
  'lactic-acid': 'compound-lactic-acid',
  lactide: 'compound-lactide',
  'sulphur-derivatives': 'compound-sulphur-derivatives',
  'flame-retardant-tcpp': 'compound-tcpp',
  'glycol-derivatives': 'compound-glycol-derivatives',
  phthalates: 'compound-phthalates',
  formaldehyde: 'compound-formaldehyde',
};
const ORDER = [
  'source',
  'artifactMaterial',
  'compound',
  'testProtocol',
  'product',
  'productRevision',
  'oddyTest',
  'emissionObservation',
  'interaction',
  'evidenceClaim',
];

const curated = (await readFile(here('data/curated.ndjson'), 'utf8'))
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const interlab = await readJson('research/extracted/interlab-2024-materials.json');
const procedures = await readJson('research/extracted/interlab-2024-procedures.json');
const ratings = (await readJson('research/extracted/interlab-2024-ratings.json')).ratings;
const ms = await readJson('research/extracted/ms-2025-oddy-and-voc.json');
const msEmissions = await readJson('research/extracted/ms-2025-emissions.json');
const cellulose = await readJson('research/extracted/cellulose-2022-oddy.json');
const celluloseEmissions = await readJson('research/extracted/cellulose-2022-emissions.json');

const docs = new Map(curated.map((doc) => [doc._id, doc]));
const add = (doc) => {
  if (docs.has(doc._id)) throw new Error(`Duplicate document id ${doc._id}`);
  docs.set(doc._id, doc);
};

const ALIASES_FROM_2025_PAPER = {10: ['PLA']};
const materials = interlab.materials.map(({number, description}) => {
  const name = description.split(' (')[0];
  const defined = (/\(([A-Z]{2,5})[,)]/.exec(description) || [])[1];
  const aliases = [...(defined ? [defined] : []), ...(ALIASES_FROM_2025_PAPER[number] || [])];
  return {number, name, description, aliases, slug: slug(name)};
});
const bySlug = new Map(materials.map((m) => [m.number, m]));

for (const m of materials) {
  const detail =
    m.number === 9
      ? ' Applied as 2 g on aluminum and allowed to cure before testing, because it is the only non-solid product.'
      : '';
  add({
    _id: `product-${m.slug}`,
    _type: 'product',
    name: m.name,
    manufacturer: 'Not stated in the cited papers',
    category: 'display-case material',
    description: m.description,
    ...(m.aliases.length ? {aliases: m.aliases} : {}),
    sources: [ref('oddy-interlab'), ref('ms-optimization')],
  });
  add({
    _id: `revision-${m.slug}`,
    _type: 'productRevision',
    product: ref(`product-${m.slug}`),
    label: 'As tested in the 2024 interlaboratory comparison',
    supplier: 'CENIM (sent to each participating institution)',
    formulationIdentity: 'documented-test-sample',
    description: `Material ${m.number} of the ten materials tested.${detail}`,
    sources: [ref('oddy-interlab'), ref('ms-optimization')],
  });
}

for (const [roman, p] of Object.entries(procedures.institutions)) {
  const note =
    roman === 'III'
      ? ' Institution III could not meet the recommended glassware cleaning and coupon preparation constraints because of its internal operating policy.'
      : '';
  add({
    _id: `protocol-ilc-${roman.toLowerCase()}`,
    _type: 'testProtocol',
    name: `Institution ${roman} procedure (2024 interlaboratory comparison)`,
    temperatureC: procedures.common.temperatureC,
    durationDays: procedures.common.durationDays,
    sampleMassG: procedures.common.sampleMassG,
    ...p,
    standardized: false,
    notes: `Comparative 3-in-1 Oddy test (28 days, 60 ºC); materials blind tested in duplicate.${note}`,
    sources: [ref('oddy-interlab')],
  });
  for (const r of ratings[roman]) {
    const m = bySlug.get(r.material);
    add({
      _id: `oddy-ilc-${roman.toLowerCase()}-${m.slug}`,
      _type: 'oddyTest',
      institution: `Institution ${roman} (anonymized participant)`,
      silverResult: r.silver,
      copperResult: r.copper,
      leadResult: r.lead,
      overallResult: r.overall,
      evidenceClass: 'real-source',
      notes: `Material ${r.material} in Table 7 of the 2024 interlaboratory comparison.`,
      revision: ref(`revision-${m.slug}`),
      protocol: ref(`protocol-ilc-${roman.toLowerCase()}`),
      sources: [ref('oddy-interlab')],
    });
  }
}

add({
  _id: 'protocol-ms2025-cenim',
  _type: 'testProtocol',
  name: 'Oddy test as reported in the 2025 mass spectrometry study (CENIM)',
  standardized: false,
  notes:
    'Ratings are the visual examination of the coupons by independent expert judges from CENIM. The paper refers to the 2024 interlaboratory comparison for the procedure and does not restate temperature or duration for these tests.',
  sources: [ref('ms-optimization')],
});
for (const row of ms.rows) {
  const m = bySlug.get(row.material);
  add({
    _id: `oddy-ms2025-${m.slug}`,
    _type: 'oddyTest',
    institution: 'CENIM (visual examination by independent expert judges)',
    silverResult: row.silver,
    copperResult: row.copper,
    leadResult: row.lead,
    overallResult: row.overall,
    evidenceClass: 'real-source',
    notes: `Material ${row.material} in Table 3 of the 2025 study.`,
    revision: ref(`revision-${m.slug}`),
    protocol: ref('protocol-ms2025-cenim'),
    sources: [ref('ms-optimization')],
  });
}

add({
  _id: 'protocol-cellulose-2022',
  _type: 'testProtocol',
  name: 'Oddy test as reported in the 2022 cellulose ether study',
  temperatureC: 60,
  durationDays: 28,
  standardized: false,
  notes:
    'Oven at 60 °C for 28 days with a relative humidity of 100% inside the tubes. All materials ran in duplicate and were repeated if the results differed. Coupons were evaluated visually against blank coupons and rated P, T or F.',
  sources: [ref('cellulose-ethers')],
});
const celluloseRevision = new Map();
cellulose.rows.forEach((row, index) => {
  const n = String(index + 1).padStart(2, '0');
  const name = row.product.replace(/[®™]/g, '').trim();
  const productId = `product-${slug(name)}`;
  if (!docs.has(productId))
    add({
      _id: productId,
      _type: 'product',
      name,
      manufacturer: 'Not stated in the cited paper',
      category: 'cellulose ether',
      description: `Commercial cellulose ether, type ${row.type} (${TYPES[row.type] || row.type}).`,
      sources: [ref('cellulose-ethers')],
    });
  const facts = [
    row.viscosity && `viscosity ${row.viscosity} (Brookfield RVT, mPa s, 20 °C)`,
    row.molecularWeight && `MW ${row.molecularWeight}`,
    row.additionalInformation,
  ].filter(Boolean);
  celluloseRevision.set(`${name}|${row.supplier}|${row.purchased}`, `revision-cellulose-${n}`);
  add({
    _id: `revision-cellulose-${n}`,
    _type: 'productRevision',
    product: ref(productId),
    label: `${row.supplier}, purchased ${row.purchased}${row.batch ? `, batch ${row.batch}` : ''}`,
    supplier: row.supplier,
    purchaseDate: row.purchased,
    ...(row.batch ? {batch: row.batch} : {}),
    formulationIdentity: 'documented-test-sample',
    description: `As reported by the manufacturers: ${facts.join('; ')}.`,
    sources: [ref('cellulose-ethers')],
  });
  const rate = (value) => (value === 'F' ? 'U' : value);
  add({
    _id: `oddy-cellulose-${n}`,
    _type: 'oddyTest',
    institution: 'Study authors (State Academy of Art and Design Stuttgart; BEMMA at BAM)',
    silverResult: rate(row.silver),
    copperResult: rate(row.copper),
    leadResult: rate(row.lead),
    overallResult: rate(row.overall),
    evidenceClass: 'real-source',
    ...(row.corrosionProducts ? {corrosionProducts: row.corrosionProducts} : {}),
    notes: `Row ${index + 1} of Table 1 of the 2022 cellulose ether study.${
      row.overall === 'F'
        ? ' The study rates this F (fail, heavy corrosion). Recorded as U, unsuitable.'
        : ''
    }`,
    revision: ref(`revision-cellulose-${n}`),
    protocol: ref('protocol-cellulose-2022'),
    sources: [ref('cellulose-ethers')],
  });
});

const emissionIds = [];
for (const obs of msEmissions.observations)
  for (const number of obs.materials) {
    const m = bySlug.get(number);
    const id = `emission-ms2025-${obs.compound}-${m.slug}`;
    emissionIds.push(id);
    add({
      _id: id,
      _type: 'emissionObservation',
      method: obs.technique,
      observedEffect: obs.observedEffect,
      evidenceClass: 'real-source',
      revision: ref(`revision-${m.slug}`),
      compound: ref(COMPOUNDS[obs.compound]),
      sources: [ref('ms-optimization')],
    });
  }
for (const obs of celluloseEmissions.observations) {
  const revisionId = celluloseRevision.get(`${obs.product}|${obs.supplier}|${obs.purchased}`);
  if (!revisionId) throw new Error(`No cellulose revision for ${obs.product} ${obs.supplier}`);
  add({
    _id: `emission-cellulose-${obs.compound}-${revisionId.slice(-2)}`,
    _type: 'emissionObservation',
    method: obs.technique,
    observedEffect: obs.observedEffect,
    evidenceClass: 'real-source',
    revision: ref(revisionId),
    compound: ref(COMPOUNDS[obs.compound]),
    sources: [ref('cellulose-ethers')],
  });
}

const ms35 = bySlug.get(9);
add({
  _id: 'claim-ms35-oddy-pass',
  _type: 'evidenceClaim',
  statement:
    'Passing the Oddy test shows MS-35 sealing can be used in a museum setting without further consideration.',
  status: 'challenged',
  scope: 'as tested in the 2024 and 2025 studies',
  rationale:
    'In the 2025 study MS-35 sealant passed the Oddy test but showed the largest number of phthalates in its emission profile of all ten materials analyzed. The authors conclude it must be carefully considered before use in a museum setting, an insight that would be missed without GC-MS analysis.',
  supports: [...docs.values()]
    .filter(
      (d) =>
        d._type === 'oddyTest' &&
        d.revision._ref === `revision-${ms35.slug}` &&
        d.overallResult === 'P',
    )
    .map((d) => ref(d._id)),
  challenges: [
    ref(`emission-ms2025-phthalates-${ms35.slug}`),
    ref('interaction-phthalate-softening'),
  ],
  sources: [ref('ms-optimization')],
});

const clean = (doc) => JSON.parse(JSON.stringify(doc));
const sorted = [...docs.values()]
  .map(clean)
  .sort((a, b) => ORDER.indexOf(a._type) - ORDER.indexOf(b._type) || a._id.localeCompare(b._id));
const ndjson = sorted.map((doc) => JSON.stringify(doc)).join('\n') + '\n';

if (process.argv.includes('--check')) {
  const current = await readFile(here('data/sanity-seed.ndjson'), 'utf8');
  if (current !== ndjson) {
    console.error('data/sanity-seed.ndjson is out of date. Run: npm run build:seed');
    process.exit(1);
  }
  console.log('Seed matches its sources.');
} else {
  await writeFile(here('data/sanity-seed.ndjson'), ndjson);
  console.log(`Wrote ${sorted.length} seed documents.`);
}
