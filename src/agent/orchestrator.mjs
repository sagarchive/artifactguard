import {analyzeScenario} from '../engine/analyze.mjs';
import {keywordBaseline} from '../engine/baseline.mjs';
import {CODE_TO_TOPIC} from './guidance.mjs';
import {interpretQuestion} from './interpret.mjs';

function guidanceByCode(analysis, knowledge) {
  const topics = new Set((knowledge?.entries || []).map((e) => e.topic));
  return Object.fromEntries(
    (analysis.deductions || [])
      .filter((d) => topics.has(CODE_TO_TOPIC[d.code]))
      .map((d) => [d.code, CODE_TO_TOPIC[d.code]]),
  );
}

const GROUPS = {
  'display-case material': 'Display-case materials (2024 and 2025 studies)',
  'cellulose ether': 'Cellulose ethers (2022 study)',
};
const groupOf = (product) =>
  product.manufacturer === 'Synthetic benchmark'
    ? 'Synthetic test fixtures'
    : GROUPS[product.category] || 'Guidance and case studies';

export class ArtifactGuardAgent {
  constructor(repository) {
    this.repository = repository;
  }

  async catalog() {
    const data = await this.repository.getDataset();
    return {
      products: data.products.map((product) => ({
        id: product._id,
        name: product.name,
        aliases: product.aliases || [],
        category: product.category,
        group: groupOf(product),
        revisions: data.productRevisions
          .filter((revision) => revision.productId === product._id)
          .map((revision) => ({id: revision._id, label: revision.label})),
      })),
      artifactMaterials: data.artifactMaterials.map((item) => ({
        id: item._id,
        name: item.name,
        couponMetal: item.couponMetal || null,
      })),
    };
  }

  async analyze(scenario, {includeKnowledge = true} = {}) {
    const trace = [];
    const data = await this.repository.getDataset(trace);
    const started = performance.now();
    const analysis = analyzeScenario(data, scenario, new Date());
    const baseline = keywordBaseline(data, scenario);
    trace.push({
      tool: 'rules',
      target: 'deterministic resolver',
      ms: Math.round(performance.now() - started),
    });
    let knowledge = null;

    if (includeKnowledge) {
      try {
        knowledge = await this.repository.retrieveKnowledge({analysis, trace});
      } catch (error) {
        console.error('Knowledge Base retrieval failed:', error.message);
        knowledge = {
          error: true,
          message: 'The Knowledge Base is temporarily unavailable.',
          note: 'Structured verdict remains available; Knowledge Base retrieval failed.',
        };
      }
    }

    return {
      analysis,
      baseline,
      comparison: {
        differs: analysis.verdict !== baseline.verdict,
        baselineUnsupportedCertainty: baseline.unsupportedCertainty,
      },
      knowledge,
      guidance: guidanceByCode(analysis, knowledge),
      trace,
    };
  }

  async interpret(question) {
    return interpretQuestion(question, await this.catalog());
  }

  health() {
    return this.repository.health();
  }
}
