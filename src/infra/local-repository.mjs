import {readFile} from 'node:fs/promises';
import {readdir} from 'node:fs/promises';
import {TOPICS, toEntry, topicsFor} from '../agent/guidance.mjs';

export class LocalRepository {
  constructor(path = new URL('../../data/fixture-dataset.json', import.meta.url)) {
    this.path = path;
    this.cache = null;
  }

  async getDataset(trace = []) {
    if (!this.cache) this.cache = JSON.parse(await readFile(this.path, 'utf8'));
    trace.push({tool: 'fixture dataset', target: 'data/fixture-dataset.json', ms: 0, cached: true});
    return structuredClone(this.cache);
  }

  async health() {
    const d = await this.getDataset();
    return {
      mode: 'local',
      ok: true,
      counts: Object.fromEntries(
        Object.entries(d)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => [k, v.length]),
      ),
    };
  }

  async retrieveKnowledge({analysis, trace = []} = {}) {
    const directory = new URL('../../knowledge-base/', import.meta.url);
    const files = await Promise.all(
      (await readdir(directory))
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map(async (name) => ({name, text: await readFile(new URL(name, directory), 'utf8')})),
    );
    const entries = topicsFor(analysis).map((topic) => {
      const keywords = TOPICS[topic].toLowerCase().split(' ');
      const score = (file) => keywords.filter((w) => file.text.toLowerCase().includes(w)).length;
      const best = [...files].sort((a, b) => score(b) - score(a))[0];
      trace.push({
        tool: 'fixture search',
        target: `knowledge-base/${best.name}`,
        query: TOPICS[topic],
        ms: 0,
        cached: true,
      });
      return toEntry(topic, best.name.replace(/\.md$/, ''), best.text);
    });
    return {
      mode: 'local-fixture',
      note: 'Local mode: bundled copies of the Knowledge Base files, not the live Sanity Knowledge Base.',
      paths: [...new Set(entries.map((e) => e.path))],
      entries,
    };
  }
}
