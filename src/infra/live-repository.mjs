import {ContextMcpClient, unwrapMcpToolContent} from './context-mcp.mjs';
import {TOPICS, parseSearchHits, toEntry, topicsFor} from '../agent/guidance.mjs';
import {traced, endpointName} from '../lib/trace.mjs';

// Flattens native references to ids; the local fixture is generated from this same query.
export const QUERY = `{
  "artifactMaterials": *[_type=="artifactMaterial"]{_id,_type,name,couponMetal,sensitiveTo,notes,"sourceIds":sources[]._ref},
  "compounds": *[_type=="compound"]{_id,_type,name,classes,notes,"affectsArtifactMaterials":affectsArtifactMaterials[]._ref,"sourceIds":sources[]._ref},
  "products": *[_type=="product"]{_id,_type,name,manufacturer,category,description,aliases,"sourceIds":sources[]._ref},
  "productRevisions": *[_type=="productRevision"]{_id,_type,label,supplier,purchaseDate,batch,description,validFrom,validUntil,formulationIdentity,identityNote,"productId":product._ref,"previousRevisionId":previousRevision._ref,"sourceIds":sources[]._ref},
  "protocols": *[_type=="testProtocol"]{_id,_type,name,temperatureC,durationDays,sampleMassG,vesselType,vesselVolumeMl,waterVolumeMl,stopper,couponAbrasion,glasswareCleaning,standardized,notes,"sourceIds":sources[]._ref},
  "oddyTests": *[_type=="oddyTest"]{_id,_type,testDate,institution,corrosionProducts,notes,silverResult,copperResult,leadResult,overallResult,evidenceClass,"revisionId":revision._ref,"protocolId":protocol._ref,"sourceIds":sources[]._ref,"basisSourceIds":basisSources[]._ref},
  "emissionObservations": *[_type=="emissionObservation"]{_id,_type,method,observedEffect,evidenceClass,"revisionId":revision._ref,"compoundId":compound._ref,"sourceIds":sources[]._ref},
  "interactions": *[_type=="interaction"]{_id,_type,rightClass,conditions,effect,evidenceClass,"leftCompoundId":leftCompound._ref,"affectedArtifactMaterialIds":affectedArtifactMaterials[]._ref,"sourceIds":sources[]._ref},
  "evidenceClaims": *[_type=="evidenceClaim"]{_id,_type,statement,status,scope,rationale,"supports":supports[]._ref,"challenges":challenges[]._ref,"sourceIds":sources[]._ref},
  "sources": *[_type=="source"]{_id,_type,title,publisher,url,authority,reviewed}
}`;

export class LiveRepository {
  constructor({groqUrl, kbUrl, token}) {
    this.g = new ContextMcpClient({url: groqUrl, token});
    this.k = new ContextMcpClient({url: kbUrl, token});
    this.groqName = endpointName(groqUrl);
    this.kbName = endpointName(kbUrl);
    this.cache = null;
    this.until = 0;
    this.kbCache = new Map();
  }
  async kbCached(trace, tool, key, detail, fn) {
    const hit = this.kbCache.get(key);
    if (hit && Date.now() < hit.until) {
      trace.push({tool, ...detail, ms: 0, cached: true});
      return hit.value;
    }
    const value = await traced(trace, tool, detail, fn);
    if (this.kbCache.size > 50) this.kbCache.clear();
    this.kbCache.set(key, {value, until: Date.now() + 300000});
    return value;
  }
  async getDataset(trace = []) {
    const target = this.groqName;
    if (this.cache && Date.now() < this.until) {
      trace.push({tool: 'groq_query', target, ms: 0, cached: true});
      return structuredClone(this.cache);
    }
    const raw = unwrapMcpToolContent(
        await traced(trace, 'groq_query', {target}, () => this.g.groq(QUERY)),
      ),
      d = raw?.result || raw;
    if (!d || !Array.isArray(d.products)) throw new Error('Unexpected GROQ response shape');
    this.cache = d;
    this.until = Date.now() + 30000;
    return structuredClone(d);
  }
  async health() {
    const [g, k] = await Promise.all([this.g.listTools(), this.k.listTools()]);
    return {
      mode: 'live',
      ok: true,
      groqTools: (g?.tools || []).map((x) => x.name),
      kbTools: (k?.tools || []).map((x) => x.name),
    };
  }
  async retrieveKnowledge({analysis, trace = []} = {}) {
    const target = this.kbName;
    const outline = await this.kbCached(trace, 'initial_context', 'outline', {target}, () =>
      this.k.initialContext(),
    );
    const id = (outline.match(/Knowledge base id:\s*`?(kb[A-Za-z0-9_-]+)/i) || [])[1];
    if (!id)
      return {
        mode: 'live',
        paths: [],
        entries: [],
        note: 'KB id could not be parsed from initial context',
      };
    const available = new Set(
      outline
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/\s+\[(?:core|peripheral)\]\s*$/i, ''))
        .filter((l) => /^[a-z0-9_]+(?:\/[a-z0-9_]+)*$/i.test(l)),
    );
    const found = await Promise.all(
      topicsFor(analysis).map(async (topic) => {
        const query = TOPICS[topic];
        const hits = parseSearchHits(
          unwrapMcpToolContent(
            await this.kbCached(
              trace,
              'knowledge_base_search',
              `search:${id}:${topic}`,
              {target, query},
              () => this.k.knowledgeBaseSearch(id, query),
            ),
          ),
        );
        const hit = hits.find((h) => available.has(h.path));
        if (!hit) return null;
        const raw = unwrapMcpToolContent(
          await this.kbCached(
            trace,
            'knowledge_base_read',
            `read:${id}:${hit.path}`,
            {target, path: hit.path},
            () => this.k.knowledgeBaseRead(id, [hit.path]),
          ),
        );
        return toEntry(topic, hit.path, typeof raw === 'string' ? raw : JSON.stringify(raw), {
          skipSummary: true,
        });
      }),
    );
    const entries = found.filter(Boolean);
    return {
      mode: 'live',
      knowledgeBaseId: id,
      paths: [...new Set(entries.map((e) => e.path))],
      entries,
      ...(entries.length ? {} : {note: 'No Knowledge Base entry applies to this result.'}),
    };
  }
}
