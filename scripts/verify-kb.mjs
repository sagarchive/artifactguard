import {readdir, readFile} from 'node:fs/promises';
import {ContextMcpClient, unwrapMcpToolContent} from '../src/infra/context-mcp.mjs';
import {withoutSummary} from '../src/agent/guidance.mjs';

const THRESHOLD = Number(process.env.KB_SUPPORT_THRESHOLD || 0.8);
const STOP = new Set(
  'that this with from have been were which their there when only also into than then them such these those about after before between under over more most other some each both does would could should being while where whose whom will shall must your very much many same just like what whether through during within without'.split(
    ' ',
  ),
);
const words = (text) =>
  (text.toLowerCase().match(/[a-zµ0-9][a-zµ0-9°²³⁻-]{3,}/g) || []).filter((w) => !STOP.has(w));

const directory = new URL('../knowledge-base/', import.meta.url);
const sourceText = (
  await Promise.all(
    (await readdir(directory)).map((file) => readFile(new URL(file, directory), 'utf8')),
  )
).join('\n');
const vocabulary = new Set(words(sourceText));

const client = new ContextMcpClient({
  url: process.env.SANITY_KB_MCP_URL,
  token: process.env.SANITY_ORGANIZATION_TOKEN,
});
const outline = await client.initialContext();
const id = outline.match(/Knowledge base id:\s*`?(kb[A-Za-z0-9_-]+)/i)[1];
const paths = [
  ...new Set(
    outline
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\s+\[(?:core|peripheral)\]\s*$/i, ''))
      .filter((l) => /^[a-z0-9_]+(?:\/[a-z0-9_]+)*$/i.test(l)),
  ),
];

let flagged = 0;
for (const path of paths) {
  const markdown = String(unwrapMcpToolContent(await client.knowledgeBaseRead(id, [path])));
  const body = withoutSummary(markdown)
    .split(/\n##\s+Sources/i)[0]
    .replace(/^#\s+.*\n+/, '')
    .replace(/\[\d+\]/g, '');
  const sentences = body
    .split(/\n+|(?<=[.!?])\s+/)
    .filter((line) => !line.trim().startsWith('#'))
    .map((line) => line.replace(/^[-*|\d.\s]+/, '').trim())
    .filter((line) => words(line).length >= 5);
  for (const sentence of sentences) {
    const content = words(sentence);
    const supported = content.filter((w) => vocabulary.has(w)).length / content.length;
    if (supported < THRESHOLD) {
      flagged += 1;
      console.log(`${path} (${Math.round(supported * 100)}% supported): ${sentence}`);
    }
  }
}
console.log(
  `${paths.length} entries checked, ${flagged} sentences below ${THRESHOLD * 100}% support`,
);
process.exit(process.argv.includes('--strict') && flagged ? 1 : 0);
