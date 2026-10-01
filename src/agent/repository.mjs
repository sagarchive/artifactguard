import {LocalRepository} from '../infra/local-repository.mjs';
import {LiveRepository} from '../infra/live-repository.mjs';
export function createRepository(env = process.env) {
  const mode = (env.ARTIFACTGUARD_MODE || 'local').toLowerCase();
  if (mode === 'live') {
    const miss = ['SANITY_GROQ_MCP_URL', 'SANITY_KB_MCP_URL', 'SANITY_ORGANIZATION_TOKEN'].filter(
      (k) => !env[k],
    );
    if (miss.length) throw new Error(`Live mode missing: ${miss.join(', ')}`);
    return new LiveRepository({
      groqUrl: env.SANITY_GROQ_MCP_URL,
      kbUrl: env.SANITY_KB_MCP_URL,
      token: env.SANITY_ORGANIZATION_TOKEN,
    });
  }
  return new LocalRepository();
}
