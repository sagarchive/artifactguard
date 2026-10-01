function parsePayload(text, type = '') {
  if (type.includes('application/json')) return JSON.parse(text);
  const lines = text
    .split(/\r?\n/)
    .filter((x) => x.startsWith('data:'))
    .map((x) => x.slice(5).trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === '[DONE]') continue;
    try {
      return JSON.parse(lines[i]);
    } catch {}
  }
  return JSON.parse(text);
}
export class ContextMcpClient {
  constructor({url, token, fetchImpl = fetch, timeoutMs = 20000}) {
    if (!url || !token) throw new Error('Context MCP URL and organization token are required');
    this.url = url;
    this.token = token;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.id = 0;
  }
  async initialContext() {
    const u = new URL(this.url);
    u.pathname = `${u.pathname.replace(/\/$/, '')}/initial-context`;
    const r = await this.fetch(u, {
      headers: {authorization: `Bearer ${this.token}`},
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!r.ok) throw new Error(`Sanity initial-context failed: HTTP ${r.status}`);
    return r.text();
  }
  async rpc(method, params) {
    const body = {jsonrpc: '2.0', id: ++this.id, method};
    if (params !== undefined) body.params = params;
    const r = await this.fetch(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Sanity Context MCP HTTP ${r.status}: ${text.slice(0, 400)}`);
    const p = parsePayload(text, r.headers.get('content-type') || '');
    if (p?.error) {
      const e = new Error(p.error.message || 'Context MCP JSON-RPC error');
      e.code = p.error.code;
      throw e;
    }
    return p?.result;
  }
  listTools() {
    return this.rpc('tools/list');
  }
  callTool(name, args = {}) {
    return this.rpc('tools/call', {name, arguments: args});
  }
  groq(query) {
    return this.callTool('groq_query', {query});
  }
  knowledgeBaseSearch(knowledgeBase, query) {
    return this.callTool('knowledge_base_search', {knowledgeBase, query});
  }
  knowledgeBaseRead(knowledgeBase, paths) {
    return this.callTool('knowledge_base_read', {knowledgeBase, paths});
  }
}
export function unwrapMcpToolContent(result) {
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  const texts = (result.content || []).filter((b) => b.type === 'text').map((b) => b.text);
  if (texts.length === 1) {
    try {
      return JSON.parse(texts[0]);
    } catch {
      return texts[0];
    }
  }
  return texts.length ? texts : result;
}
