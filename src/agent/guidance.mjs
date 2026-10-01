// Keywords that locate guidance for a deduction. Sanity names and merges entries when it builds,
// so the agent searches by topic instead of relying on entry paths.
export const TOPICS = {
  enclosure: 'well-sealed enclosure most dangerous scenario emissive surface area',
  terostat: 'Terostat adhesive TMP-ol efflorescence formulation Oddy passed',
  oddy: 'Oddy test coupons silver copper lead rating visual inspection',
  variation: 'institutions interlaboratory coupon preparation differences disagreement',
  contact: 'flexible PVC plasticizer direct contact stains exudate',
  vulnerability: 'pollutant corroded lead copper silver acid damage',
  language: 'prohibited safe certified probabilities cited source synthetic fixtures',
};

export const CODE_TO_TOPIC = {
  ENCLOSURE_ACCUMULATION_CONTEXT: 'enclosure',
  PASS_NOT_COMPREHENSIVE: 'terostat',
  IDENTITY_NOTE: 'terostat',
  ODDY_FAIL: 'oddy',
  ODDY_TEMPORARY: 'oddy',
  NO_ODDY_TEST: 'oddy',
  NO_COUPON_FOR_ARTIFACT: 'oddy',
  FORMULATION_IDENTITY_UNCERTAIN: 'oddy',
  OLD_TEST_INTERNAL_TRIGGER: 'variation',
  MAJOR_TEST_CONFLICT: 'variation',
  MINOR_TEST_CONFLICT: 'variation',
  PROTOCOL_VARIATION: 'variation',
  DIRECT_CONTACT_INTERACTION: 'contact',
  EMISSION_ARTIFACT_SENSITIVITY: 'vulnerability',
  NO_CONFLICT_FOUND: 'language',
  NO_PRODUCT_REVISION: 'language',
  NO_ARTIFACT_MATERIAL: 'language',
  UNKNOWN_REVISION: 'language',
  UNKNOWN_ARTIFACT_MATERIAL: 'language',
};

const MAX_TOPICS = 6;

export function topicsFor(analysis) {
  const wanted = (analysis?.deductions || []).map((d) => CODE_TO_TOPIC[d.code]).filter(Boolean);
  return [...new Set(wanted)].slice(0, MAX_TOPICS);
}

export function parseSearchHits(text) {
  return [...String(text).matchAll(/^\d+\.\s+`([^`]+)`\s+\(score\s+([\d.]+)\)/gm)].map((m) => ({
    path: m[1],
    score: Number(m[2]),
  }));
}

export const titleOf = (markdown) => (/^#\s+(.+)$/m.exec(markdown) || [])[1]?.trim() || '';

export function withoutSummary(markdown) {
  const match = /^(#\s+.*\n+)([^\n#][^\n]*)\n+/.exec(markdown);
  return match && !/\[\d+\]/.test(match[2]) ? markdown.replace(match[0], match[1]) : markdown;
}

const sentence = (line) => (/[.!?:;)"']$/.test(line) ? line : `${line}.`);

function flatten(block) {
  const lines = block.split(/\n+/).map((line) => line.trim());
  if (lines[0]?.startsWith('|'))
    return lines
      .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
      .slice(1)
      .map((line) =>
        line
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(' — '),
      )
      .join('; ');
  return lines.map((line) => sentence(line.replace(/^[-*]\s+/, ''))).join(' ');
}

const words = (text) => [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || [])];

function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > 150
    ? cut.slice(0, end + 1)
    : `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[;,:\s-]+$/, '')}…`;
}

// The passage of an entry that shares the most keywords with the topic. Merged entries cover
// several subjects, so the first paragraph is often the wrong one.
export function pickPassage(markdown, query, max = 420) {
  const body = markdown
    .replace(/^#\s+.*\n+/, '')
    .split(/\n(?:##\s+Sources|Sources:)/i)[0]
    .replace(/\s*\[\d+\]/g, '')
    .replace(/[*`]/g, '');
  const blocks = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b && !b.startsWith('#'))
    .map(flatten);
  const want = words(query);
  const scored = blocks.map((block, index) => ({
    block,
    index,
    score: want.filter((w) => block.toLowerCase().includes(w)).length,
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = scored[0];
  if (!best) return '';
  const before = blocks[best.index - 1]?.endsWith(':') ? blocks[best.index - 1] : undefined;
  const after = best.block.endsWith(':') ? blocks[best.index + 1] : undefined;
  return shorten([before, best.block, after].filter(Boolean).join(' '), max);
}

export function toEntry(topic, path, markdown, options) {
  const text = options?.skipSummary ? withoutSummary(markdown) : markdown;
  return {topic, path, title: titleOf(markdown), excerpt: pickPassage(text, TOPICS[topic]), text};
}
