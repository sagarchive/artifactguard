import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRepository} from './agent/repository.mjs';
import {ArtifactGuardAgent} from './agent/orchestrator.mjs';
import {estimateEnclosureConcentration} from './engine/enclosure.mjs';
import {json, readJson} from './lib/http.mjs';
import {parseAnalyzeBody, isPlainObject, createRateLimiter} from './lib/validate.mjs';
import {runBenchmarks} from '../scripts/benchmark-lib.mjs';
const ROOT = fileURLToPath(new URL('../public/', import.meta.url)),
  PORT = Number(process.env.PORT || 3000),
  agent = new ArtifactGuardAgent(createRepository());
const limitAnalyze = createRateLimiter({limit: 30, windowMs: 60000}),
  limitApi = createRateLimiter({limit: 120, windowMs: 60000}),
  clientKey = (req) =>
    (req.headers['x-forwarded-for'] || '').split(',').pop().trim() ||
    req.socket.remoteAddress ||
    'unknown';
let benchmark = null;
let healthCache = {until: 0, value: null};
async function health() {
  if (Date.now() < healthCache.until) return healthCache.value;
  const value = await agent.health();
  healthCache = {until: Date.now() + 15000, value};
  return value;
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};
const sec = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'content-security-policy':
    "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};
async function serve(res, path) {
  let rel = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
  if (!rel.includes('.') && !rel.endsWith('/')) rel += '.html';
  const p = normalize(join(ROOT, rel));
  if (!p.startsWith(ROOT)) return false;
  try {
    const s = await stat(p);
    if (!s.isFile()) return false;
    const b = await readFile(p);
    res.writeHead(200, {
      ...sec,
      'content-type': MIME[extname(p)] || 'application/octet-stream',
      'content-length': b.length,
      'cache-control': 'no-cache',
    });
    res.end(b);
    return true;
  } catch {
    return false;
  }
}
const server = http.createServer(async (req, res) => {
  const id = crypto.randomUUID();
  const started = performance.now();
  res.on('finish', () =>
    console.log(
      JSON.stringify({
        time: new Date().toISOString(),
        requestId: id,
        method: req.method,
        path: String(req.url).split('?')[0].slice(0, 200),
        status: res.statusCode,
        ms: Math.round(performance.now() - started),
      }),
    ),
  );
  if (req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('strict-transport-security', 'max-age=15552000');
  }
  // Origin-form only: "//host/path" would otherwise parse as another host and "//" throws.
  let u;
  try {
    if (!/^\/(?!\/)/.test(req.url)) throw new Error('not origin-form');
    u = new URL(req.url, 'http://localhost');
  } catch {
    return json(res, 400, {requestId: id, error: 'Bad request'});
  }
  if (u.pathname.startsWith('/api/')) {
    const rl = limitApi(clientKey(req));
    if (!rl.allowed) {
      res.setHeader('retry-after', rl.retryAfterSec);
      return json(res, 429, {requestId: id, error: 'Too many requests. Try again shortly.'});
    }
  }
  try {
    if (req.method === 'GET' && u.pathname === '/api/health')
      return json(res, 200, {ok: true, requestId: id, context: await health()});
    if (req.method === 'GET' && u.pathname === '/api/catalog')
      return json(res, 200, {requestId: id, ...(await agent.catalog())});
    if (req.method === 'GET' && u.pathname === '/api/context-status') {
      try {
        return json(res, 200, {requestId: id, ...(await health())});
      } catch (e) {
        console.error('Context status check failed:', e.message);
        return json(res, 503, {requestId: id, ok: false, error: 'Sanity Context is unreachable'});
      }
    }
    if (req.method === 'POST' && u.pathname === '/api/analyze') {
      const rl = limitAnalyze(clientKey(req));
      if (!rl.allowed) {
        res.setHeader('retry-after', rl.retryAfterSec);
        return json(res, 429, {requestId: id, error: 'Too many requests. Try again shortly.'});
      }
      const {scenario, includeKnowledge} = parseAnalyzeBody(await readJson(req, {maxBytes: 16384}));
      return json(res, 200, {
        requestId: id,
        ...(await agent.analyze(scenario, {includeKnowledge})),
      });
    }
    if (req.method === 'POST' && u.pathname === '/api/interpret') {
      const rl = limitAnalyze(clientKey(req));
      if (!rl.allowed) {
        res.setHeader('retry-after', rl.retryAfterSec);
        return json(res, 429, {requestId: id, error: 'Too many requests. Try again shortly.'});
      }
      const b = await readJson(req, {maxBytes: 2048});
      if (
        !isPlainObject(b) ||
        typeof b.question !== 'string' ||
        !b.question.trim() ||
        b.question.length > 500
      )
        return json(res, 400, {
          requestId: id,
          error: 'question must be a non-empty string up to 500 characters',
        });
      return json(res, 200, {requestId: id, ...(await agent.interpret(b.question))});
    }
    if (req.method === 'POST' && u.pathname === '/api/enclosure') {
      const b = await readJson(req, {maxBytes: 4096});
      if (!isPlainObject(b))
        return json(res, 400, {
          requestId: id,
          ok: false,
          reason: 'Request body must be a JSON object',
        });
      const r = estimateEnclosureConcentration(b);
      return json(res, r.ok ? 200 : 400, {requestId: id, ...r});
    }
    if (req.method === 'GET' && u.pathname === '/api/benchmark')
      return json(res, 200, {requestId: id, ...(benchmark ??= await runBenchmarks())});
    if (req.method === 'GET' && u.pathname === '/api/meta')
      return json(res, 200, {
        requestId: id,
        name: 'ArtifactGuard',
        challenge: 'DEV/Sanity 2026 — Path One',
        sanityProjectId: process.env.SANITY_PROJECT_ID || null,
        mode: process.env.ARTIFACTGUARD_MODE || 'local',
      });
    if ((req.method === 'GET' || req.method === 'HEAD') && (await serve(res, u.pathname))) return;
    return json(res, 404, {requestId: id, error: 'Not found'});
  } catch (e) {
    const status = Number(e.statusCode || 500);
    return json(res, status, {
      requestId: id,
      error: status >= 500 ? 'Internal server error' : e.message,
      detail: process.env.NODE_ENV === 'development' ? e.message : undefined,
    });
  }
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(PORT, () =>
  console.log(
    `ArtifactGuard listening on http://localhost:${PORT} (${process.env.ARTIFACTGUARD_MODE || 'local'} mode)`,
  ),
);
