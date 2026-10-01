# QA report

Reproduce everything with `npm run qa`. Last full run: 2026-10-01.

| Check | Result |
|---|---|
| Project lint (no keys or tokens in the repo) | pass |
| Seed integrity | 363 documents, 848 references, every target resolves; seed and fixture match their generators |
| Unit and integration tests | 62 / 62 |
| Benchmark | 25 / 25 distinct scenarios, also run against the live Sanity data with `npm run check:deployed` |
| Red-team assertions | 11 / 11 |
| Fuzz | 1,000 scenarios, fixed seed `0x5a17c0de`, no invariant failures, including references and template leaks |
| Sweep | All 2,250 revision × artifact × environment × contact combinations: no unsupported SUPPORTED, no unhandled unsuitable or major-conflict result, no broken source ids |
| HTTP smoke | pass |

The benchmark baseline is a first-match keyword matcher written for this project, not a production RAG system. Benchmark rows of kind `synthetic-rule` are rule tests, not laboratory results, and are labelled that way in `benchmarks/cases.json`.

## Live acceptance

Run against the real Sanity project and both Context endpoints:

| Scenario | Result |
|---|---|
| Terostat-9220, lead, sealed, indirect contact | `CONDITIONAL` (keyword baseline: `SUPPORTED`) |
| Flexible PVC, paper, direct contact | `AVOID` |
| Unknown artifact id | `INSUFFICIENT` |
| Knowledge Base reads | Flagship case searches two topics (`terostat`, `enclosure`) and reads `materials_compatibility` and `enclosure_effects`, each via `knowledge_base_search` then `knowledge_base_read`. `check:deployed` also asserts the reads are not empty. |
| Repeat request | Every Sanity call served from cache (trace shows `cached`) |
| Plain-English question | "Is Terostat-9220 okay next to lead in a sealed case, not touching?" resolves to the flagship scenario |
| `/api/context-status` | GROQ endpoint lists `groq_query`, Knowledge Base endpoint lists `knowledge_base_read` |

## Data audit against the sources

Every record in the seed was checked against the retrieved text of its cited sources (see `research/sources.md`). Findings and fixes:

| Finding | Fix |
|---|---|
| The Terostat Oddy test carried an exact date (`2010-01-01`) and per-coupon results that no cited paper states | Removed. The schema no longer requires per-coupon results, which is what forced them to be invented. |
| The CNN paper was cited for Terostat facts but never mentions Terostat | Cited only for the general statements it makes |
| The primary NMAI study names Terostat MS 937 as the confirmed source; the 2025 review names Terostat-9220 | Added the NMAI study as a source and an `identityNote` that surfaces the disagreement |
| Acetic acid was listed as affecting copper and paper; CCI lists it for lead (copper is listed under benzoic and formic acid) | Sensitivities now mirror CCI's pollutant-by-pollutant table |
| "Unstable glass" and its humidity sensitivity are not in the cited CCI pages | Removed |
| Flexible PVC rule said "substantial plasticizer"; CCI's entries are for *degraded* flexible PVC | Reworded to CCI's terms; added CCI's benzoic acid entry for copper |
| Interaction with acids applied only to acid-sensitive artifacts; the sources report it on exhibited objects generally | `any-object` interaction class |
| "No conflict found" and "artifact required" cited CCI, which does not support them | No source cited |
| Knowledge Base files claimed CCI says suitability "depends on object and use context" and that PVC "commonly contains substantial plasticizer" | Rewritten to statements located in the sources |
| Four benchmark cases were the same scenario; two more were near-duplicates | 16 distinct scenarios, each tagged by evidence kind |

## Knowledge Base verification

Sanity's builder writes the entries from the eight files in `knowledge-base/`. Its first output added claims the files do not make, so each rebuild was read against the files.

| Finding in the generated text | Action |
|---|---|
| "Terostat-9220 (also formulated as Terostat MS 937)": the sources describe two separate formulations | Sanity filed a conflict; resolved in favour of the source |
| "a common off-gas from wood and many adhesives", "silver objects (including photographic materials)", "sources … are often enclosure or storage materials": in none of the files | Removed by a standing instruction that limits entries to statements in the files |
| Invented ranking of conflict factors and an example about manufacturer data sheets | Cause: replacing two files detached the instruction from them. Recreated the instruction over all eight current sources and applied the flagged rewrites |
| Qualifiers such as "related", "airborne", "steady-state", and "see entry X" lines | Second round of the instruction and applied rewrites; most are gone |
| Generator-written one-line summaries under each title, which contain invented phrases | Not shown by the app, and skipped by the checker |
| A critical conflict that the entries name Terostat-9220 and Terostat MS 937 differently without saying which was Oddy tested | Dismissed on purpose: the papers disagree and the evidence does not say, so the entries state that |

Final state: 8 entries, 0 open issues (1 conflict accepted, 14 rewrites applied, 1 conflict dismissed). `npm run verify:kb` flags 5 of about 100 body sentences below 80% word support. They are connective phrasing, a count of three listed items, and two statements of this project's own policy; none asserts a fact the sources contradict.

## Data expansion verification

The dataset grew from 38 to 363 documents using three studies' published tables. Each step was checked against the papers:

| Check | Result |
|---|---|
| Table 7 of the 2024 study (an image) transcribed, then compared with the paper's Table 8 | All 63 per-coupon counts and 21 totals reproduced |
| Overall rating equals the worst of the three coupons | True for all 70 interlaboratory cells, 10 cells of the 2025 study and all 60 cellulose ether rows |
| 2025 Table 3 against the paper's text | The P, T and U materials and the unsuitable coupons match the text |
| Cellulose ether Table 1 against the abstract | 60 products, 33 P, 20 T, 7 F |
| Quotes stored with each emission statement | Each found verbatim in the paper text when stored |
| Inconsistencies inside the papers | Listed in `research/sources.md`; statements that depend on them are not in the dataset |

## Defects found and fixed

Each has a regression test in `tests/` or `scripts/smoke.mjs`.

| Defect | Area |
|---|---|
| Unknown artifact ids were dropped silently when another id was valid | engine |
| Live Knowledge Base id was never parsed (backticks in the real outline) | Context client |
| Knowledge Base "relevance gate" always selected all 8 entries, and the UI never showed their content | agent, frontend |
| Live path filter dropped top-level Knowledge Base entries | Context client |
| `compare.js` used top-level `await` as a classic script, so `/compare` never rendered | frontend |
| `null` body returned 500; arrays, strings and numbers were accepted | API |
| Invalid `environment` or `contact` values were accepted | API |
| Non-string ids and non-array id fields were accepted | API |
| Calculator accepted numeric strings and booleans, and returned `ok:true` with `null` on overflow | API |
| Upstream Sanity error text could reach the browser | API |
| No rate limit and no Knowledge Base cache | API |
| Static files cached for 5 minutes, so a deploy could serve stale JavaScript | server |
| Form kept the previous material selected after the agent asked which one | frontend |
| Agent trace table overflowed phone screens whenever a result was showing | frontend |
| Rules still tested for the old `F` rating, so a permanent-versus-unsuitable disagreement was classed as minor | engine |
| Synthetic tests' basis sources were listed in the source trail as if they were evidence | engine |
| The flagship and flexible-PVC verdicts were hardcoded in the engine instead of derived from the data | engine |
| `GET //` crashed the server process (unhandled `ERR_INVALID_URL`) | server |
| `/api/context-status` could return upstream Sanity error text to anonymous callers | server |
| "Exposure duration" input was sent but never used | frontend |
| Closed product dropdown hid the product name | frontend |
| Inline style blocked by the server's own CSP | frontend |

## Not covered

- The Docker image was built and run in live mode against the real endpoints (non-root, healthcheck passing). It has not been run on a hosting platform.
- Studio UI behaviour is not tested. Only the schema deploys and the seed imports.
- Layout is checked manually in a headless browser at 320, 360, 390, 768 and 1280 px. There is no automated visual test.
- No load testing. The rate limiter is covered by a unit test and the smoke test only.
