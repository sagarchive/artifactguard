# Architecture

```text
Browser
  |
Node agent service
  |
  +--> Sanity Context MCP — dataset source / GROQ mode
  |      typed products, revisions, tests, compounds, interactions
  |
  +--> Sanity Context MCP — Knowledge Base mode
         institutional guidance and peer-reviewed context

Both -> deterministic evidence resolver -> source-linked disposition
```

Two endpoints are deliberate: current Sanity Context behavior serves GROQ mode when a dataset source is present; Knowledge Base mode has its own tool set.

Local mode is an offline adapter over a bundled fixture, used for QA and trying the app. `ARTIFACTGUARD_MODE=live` reads from Sanity.

The verdict is not model-generated. Missing scope fails closed, and a Context error never turns into `SUPPORTED`.

## Rules come from the data

The engine contains no product, artifact or revision ids. Each deduction is derived from records:

- `PASS_NOT_COMPREHENSIVE`: a passing Oddy test is the target of an `evidenceClaim` with status `challenged`. The claim's `rationale` becomes the message, and its sources are cited.
- `MATERIAL_INTERACTION` and `DIRECT_CONTACT_INTERACTION`: an `interaction` applies when the revision has an emission of its compound and the scenario meets its `conditions`. `rightClass` is a pollutant class the artifact must be sensitive to, `direct-contact`, or `any-object` when the sources report the effect on exhibited objects in general.
- `MAJOR_TEST_CONFLICT`, `MINOR_TEST_CONFLICT`, `ODDY_FAIL`, `ODDY_TEMPORARY`: computed from the ratings of every test on the revision. When the selected artifact has a `couponMetal` (silver, copper or lead), the ratings for that coupon are used, falling back to a test's overall rating where the coupon result is not stated. Otherwise the overall ratings are used and `NO_COUPON_FOR_ARTIFACT` explains that Oddy coupons do not measure that material directly.
- `PROTOCOL_VARIATION`: when the tests come from two or more protocols, the fields that differ (coupon abrasion, vessel type, vessel and water volume, stopper) are listed.
- `EMISSION_ARTIFACT_SENSITIVITY`: an emitted compound's class matches a class in the artifact material's `sensitiveTo`.
- `EMISSION_REPORTED`: an emission that matches no sensitivity is still shown, unless a fired claim already explains it.
- `IDENTITY_NOTE`: a revision's `identityNote` records where sources disagree about what the revision is. It informs the result without changing the verdict.

Removing the claim or the interaction from the data removes the deduction. Tests cover both.

## Data provenance

`data/sanity-seed.ndjson` is built by `scripts/build-seed.mjs` from `data/curated.ndjson` (records written from the papers' prose and the CCI bulletin) and `research/extracted/` (table data taken verbatim from the papers, plus the statements about emissions with their quotes). `tests/extracted.test.mjs` checks that the transcribed Table 7 reproduces every count in the paper's own Table 8, and that the other tables match their papers' text and abstract.

## Local fixture

`data/fixture-dataset.json` is generated from `data/sanity-seed.ndjson` by running the same GROQ projection the live app sends (`npm run build:fixture`). A test fails if the two drift apart, so local mode and live mode resolve the same data.

## Request path

`POST /api/analyze` validates the body (`src/lib/validate.mjs`), rate-limits per client, loads the dataset (30-second cache), runs the rules (`src/engine/analyze.mjs`) and the keyword baseline for comparison, then optionally retrieves Knowledge Base context (5-minute cache).

## Native Sanity relationship graph

The Studio stores graph edges as native Sanity `reference` fields (products to revisions, tests to revisions/protocols/sources, emissions to compounds, interactions to compounds/artifact materials, and claims to evidence). The live GROQ query projects those references into the compact ID shape used by the deterministic engine. Local fixtures use that same normalized shape, so QA and live mode exercise the same resolver contract.

## Knowledge Base retrieval

The agent does not read the Knowledge Base wholesale. After the rules run, each deduction code maps to a topic (`CODE_TO_TOPIC` in `src/agent/guidance.mjs`). For each distinct topic the agent calls `knowledge_base_search` with the topic's query, reads the top hit with `knowledge_base_read`, and displays the passage that matches the topic. Entry paths are never hard-coded, so a rebuilt Knowledge Base keeps working. At most six topics, cached for five minutes.

The UI shows an excerpt of each entry under the deduction that cited it, with the full text one click away. The entries explain the verdict; they cannot change it.

## Plain-English questions

`POST /api/interpret` matches a question against the live catalog by keyword (`src/agent/interpret.mjs`). It resolves the material, version, artifact material, environment and contact. Anything missing or ambiguous comes back as a question with options. Nothing is defaulted or guessed, and there is no language model.

## Trace

Every analysis returns the list of steps the agent took: each Sanity tool call with its endpoint, entry path, duration and cache status, plus the rules step. The UI shows it under the result.
