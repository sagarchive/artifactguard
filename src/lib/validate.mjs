const ENVIRONMENTS = ['sealed', 'enclosed', 'open'];
const CONTACTS = ['direct', 'indirect'];
const MAX_IDS = 10;
const MAX_ID_LEN = 100;

function bad(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function idList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw bad(`${field} must be an array of strings`);
  if (value.length > MAX_IDS) throw bad(`${field} accepts at most ${MAX_IDS} ids`);
  for (const id of value) {
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LEN) {
      throw bad(`${field} must contain non-empty strings up to ${MAX_ID_LEN} characters`);
    }
  }
  return [...new Set(value)];
}

function oneOf(value, allowed, field) {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) throw bad(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function parseScenario(input) {
  if (!isPlainObject(input)) throw bad('scenario must be a JSON object');
  return {
    revisionIds: idList(input.revisionIds, 'revisionIds'),
    artifactMaterialIds: idList(input.artifactMaterialIds, 'artifactMaterialIds'),
    environment: oneOf(input.environment, ENVIRONMENTS, 'environment'),
    contact: oneOf(input.contact, CONTACTS, 'contact'),
  };
}

export function parseAnalyzeBody(body) {
  if (!isPlainObject(body)) throw bad('Request body must be a JSON object');
  if (body.includeKnowledge !== undefined && typeof body.includeKnowledge !== 'boolean') {
    throw bad('includeKnowledge must be a boolean');
  }
  return {
    scenario: parseScenario(body.scenario ?? body),
    includeKnowledge: body.includeKnowledge !== false,
  };
}

export function createRateLimiter({limit, windowMs}) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const entry = hits.get(key);
    if (!entry || now >= entry.reset) {
      if (hits.size > 5000) for (const [k, v] of hits) if (now >= v.reset) hits.delete(k);
      if (hits.size > 20000) hits.clear();
      hits.set(key, {count: 1, reset: now + windowMs});
      return {allowed: true, retryAfterSec: 0};
    }
    entry.count += 1;
    return {allowed: entry.count <= limit, retryAfterSec: Math.ceil((entry.reset - now) / 1000)};
  };
}
