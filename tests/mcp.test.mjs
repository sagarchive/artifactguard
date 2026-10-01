import test from 'node:test';
import assert from 'node:assert/strict';
import {ContextMcpClient, unwrapMcpToolContent} from '../src/infra/context-mcp.mjs';
test('MCP bearer token and tools/list', async () => {
  let cap;
  const fake = async (url, init) => {
    cap = {url, init};
    return new Response(
      JSON.stringify({jsonrpc: '2.0', id: 1, result: {tools: [{name: 'groq_query'}]}}),
      {status: 200, headers: {'content-type': 'application/json'}},
    );
  };
  const c = new ContextMcpClient({
    url: 'https://example.invalid/mcp',
    token: 'secret',
    fetchImpl: fake,
  });
  const r = await c.listTools();
  assert.equal(r.tools[0].name, 'groq_query');
  assert.equal(cap.init.headers.authorization, 'Bearer secret');
  assert.equal(JSON.parse(cap.init.body).method, 'tools/list');
});
test('MCP parses SSE', async () => {
  const fake = async () =>
    new Response('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n', {
      status: 200,
      headers: {'content-type': 'text/event-stream'},
    });
  const c = new ContextMcpClient({
    url: 'https://example.invalid/mcp',
    token: 'secret',
    fetchImpl: fake,
  });
  assert.deepEqual((await c.listTools()).tools, []);
});
test('unwrap JSON text', () =>
  assert.deepEqual(unwrapMcpToolContent({content: [{type: 'text', text: '{"result":[1]}'}]}), {
    result: [1],
  }));
import {LiveRepository} from '../src/infra/live-repository.mjs';
const OUTLINE =
  '## Knowledge bases\n\nKnowledge base id: `kbTEST123`\n\n### X — purpose\n3 entries.\n\ncontact_migration [core]\n\nenclosure_effects [core]\n\noddy_test [core]\n';
const ENTRY = {
  oddy_test:
    '# Oddy Test\n\nSummary line with no citation\n\nThe Oddy test exposes silver, copper and lead coupons to emitted compounds [1].\n\n## Terostat case\n\nTerostat-9220 passed an Oddy test and TMP-ol efflorescence followed [2].\n\n## Sources\n\n1. a.md',
  enclosure_effects:
    '# Enclosure\n\nSummary\n\nA well-sealed enclosure raises concentration [1].\n',
};
function liveRepo() {
  const calls = {search: [], read: []};
  const r = new LiveRepository({
    groqUrl: 'https://x/mcp/artifactguard-graph?secret=1',
    kbUrl: 'https://y/mcp/artifactguard-knowledge',
    token: 't',
  });
  r.k = {
    initialContext: async () => OUTLINE,
    knowledgeBaseSearch: async (id, query) => {
      calls.search.push([id, query]);
      const path = /Terostat/.test(query)
        ? 'oddy_test'
        : /enclosure/i.test(query)
          ? 'enclosure_effects'
          : 'missing_entry';
      return {
        content: [
          {
            type: 'text',
            text: `Entries matching "q", ranked by relevance:\n\n1. \`${path}\` (score 9.5): Title\n   Summary`,
          },
        ],
      };
    },
    knowledgeBaseRead: async (id, paths) => {
      calls.read.push([id, paths]);
      return {content: [{type: 'text', text: ENTRY[paths[0]] ?? '# Other\n\nText.'}]};
    },
  };
  return {r, calls};
}
const analysisWith = (...codes) => ({deductions: codes.map((code) => ({code}))});

test('live KB: parses the real outline format and finds entries by searching their topic', async () => {
  const {r, calls} = liveRepo();
  const k = await r.retrieveKnowledge({
    analysis: analysisWith(
      'ENCLOSURE_ACCUMULATION_CONTEXT',
      'PASS_NOT_COMPREHENSIVE',
      'IDENTITY_NOTE',
    ),
  });
  assert.equal(k.knowledgeBaseId, 'kbTEST123');
  assert.deepEqual(
    k.entries.map((e) => [e.topic, e.path]),
    [
      ['enclosure', 'enclosure_effects'],
      ['terostat', 'oddy_test'],
    ],
  );
  assert.equal(calls.search.length, 2);
  assert.equal(calls.read.length, 2);
});

test('live KB: the excerpt is the passage for the topic, and the generated summary line is removed', async () => {
  const {r} = liveRepo();
  const k = await r.retrieveKnowledge({analysis: analysisWith('PASS_NOT_COMPREHENSIVE')});
  const entry = k.entries[0];
  assert.match(entry.excerpt, /Terostat-9220 passed an Oddy test/);
  assert.ok(!entry.text.includes('Summary line'));
});

test('live KB: a topic whose search finds no known entry is skipped, and nothing is read for it', async () => {
  const {r, calls} = liveRepo();
  const k = await r.retrieveKnowledge({analysis: analysisWith('DIRECT_CONTACT_INTERACTION')});
  assert.deepEqual(k.entries, []);
  assert.equal(calls.read.length, 0);
  assert.match(k.note, /No Knowledge Base entry/);
});

test('live KB: trace records searches and reads, marks cache hits, and never includes query strings from the endpoint url', async () => {
  const {r} = liveRepo();
  const analysis = analysisWith('ENCLOSURE_ACCUMULATION_CONTEXT');
  const first = [];
  await r.retrieveKnowledge({analysis, trace: first});
  assert.deepEqual(
    first.map((s) => s.tool),
    ['initial_context', 'knowledge_base_search', 'knowledge_base_read'],
  );
  const second = [];
  await r.retrieveKnowledge({analysis, trace: second});
  assert.ok(second.every((s) => s.cached));
  assert.equal(r.groqName, 'artifactguard-graph');
});
