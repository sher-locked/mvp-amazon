# Design

How the codebase is organized, so you can navigate it without reading every file. Keep this current when structure changes.

## Overview

One job: take an Amazon listing (URL/ASIN) and evaluate its content for **discoverability** (human + agentic search) and **purchasability** (conversion).

The work decomposes into small, **composable steps**. Each step is a pure-ish function in `pipeline/stages/`, exposed two ways:

- individually, as a synchronous API endpoint (call one part in isolation), and
- together, via the orchestrated async pipeline (`/runs`).

Both paths call the same stage functions — no duplicated logic.

## Principles

- **Deep modules, thin interfaces** — stages depend on contracts in `domain/`, never on a concrete provider.
- **Provider separation** — scraping/LLM providers are isolated, swappable impls behind a contract + factory.
- **Validate at the edge** — Zod in `server/schemas.ts`; typed errors inside; one error handler maps them.
- **Config centralized** — only `config/` reads `process.env`.

## Module map

| Module             | Intent                                                                |
| ------------------ | --------------------------------------------------------------------- |
| `config/`          | Typed env/config; sole reader of `process.env`.                       |
| `lib/`             | Logger, typed errors, small shared utils (`Result`, `now`).           |
| `domain/`          | Core types + contracts: `Listing`, `Identity`/`Tag`/`TagSet`, `Evaluation`, `Run`. No impl. |
| `pipeline/stages/` | The composable steps: `ingest`, `scrape`, `parse`, `research`, `tag`, `evaluate-*`, `generate`. |
| `pipeline/`        | `orchestrator` (sequences stages, owns run status) + `context` (provider handles). |
| `scraping/`        | `Scraper` contract + factory + per-request resolver; `playwright/`, `brightdata/`, `amazon/` (PDP parser, block-detect, country map). |
| `research/`        | Pure views over research output (`tag-matrix`); the research/tag LLM calls live in `pipeline/stages/` + `llm/prompts/research/`. |
| `llm/`             | Provider-agnostic `LlmClient` + factory + `providers/` + `prompts/` (rubrics) + `prompts/registry.ts` (the three editable prompt slots + resolver). |
| `discoverability/` | Rufus + LLM-search probes.                                            |
| `persistence/`     | `RunRepository` contract + in-memory impl (DB later); `artifacts/` — versioned `ArtifactStore` (fs impl under `tmp/`); `prompts/` — global versioned `PromptStore` for prompt overrides. |
| `jobs/`            | In-process job queue (durable queue later).                          |
| `auth/`            | Company-email OTP (stub).                                             |
| `billing/`         | Quota / unlock paywall (stub).                                        |
| `server/`          | Fastify app, error handler, access guard, route registration, request schemas. |
| `public/`          | Static eval UI (no build step) via `@fastify/static`: `index.html` (five step cards) + `prompts.html` (prompt editors) + `shared.css`/`shared.js` (design tokens, api/esc, renderers, cost constants — ES module both pages import). |
| `container.ts`     | Composition root; wires everything once at startup.                  |
| `spikes/`          | Throwaway de-risking experiments, promoted into `src/` once proven.   |

## Stages (the composable unit)

`ingest → scrape → parse → research → tag → evaluate(content, rufus, llm-search) → generate`

| Stage              | In → Out                                  | Status         |
| ------------------ | ----------------------------------------- | -------------- |
| `ingest`           | url/asin → `ListingRef`                    | real           |
| `scrape`           | `ListingRef` → raw PDP HTML (persisted)    | real           |
| `parse`            | raw HTML → `Listing` (persisted)           | real           |
| `research`         | `Listing` → `SkuResearch` (identity + notes + sources, persisted) | real (web-enabled LLM) |
| `tag`              | `Listing`+`SkuResearch` → `TagSet` (persisted) | real (strict structured output) |
| `evaluate-content` | `Listing`+`TagSet` → `ContentEvaluation`   | mock (phase 4) |
| `evaluate-rufus`   | `Listing`+`TagSet` → `DiscoverabilityResult` | mock (phase 2) |
| `evaluate-llm-search` | `Listing`+`TagSet` → `DiscoverabilityResult` | mock (phase 3) |
| `generate`         | `Listing`+`TagSet` → `GeneratedListing` (persisted) | real (one single-shot schema-strict call) |

The research/tag split mirrors scrape/parse: `research` is the expensive web-enabled call (persisted), `tag` is the cheap bucketing call that can re-run against stored research. The tag model (scope × type axes, one-placement rule) is specified in [sku-tags.md](reference/sku-tags.md).

`generate` turns the stored `TagSet` + `Listing` into the four post-July-2026 Amazon fields (Title ≤75, Item Highlights ≤125, five About This Item bullets <1,000 together, Description ≤2,000) via ONE single-shot no-web call on the fast model tier (`OPENAI_MODEL_FAST`, falls back to `OPENAI_MODEL`) — one combined prompt (`llm/prompts/generate/listing.ts`) generates all four fields in order with an in-prompt no-repetition rule. Hard limits and the mechanical compliance gates (drop inferred+complianceSensitive, drop confidence <0.6) are enforced in code; every limit violation is collected and fed back in a single corrective re-prompt that regenerates the whole document (then 502). Field rules: [amazon-generation-prompts.md](reference/amazon-generation-prompts.md).

## Editable prompts (global, versioned)

The three LLM system prompts (`research`, `tag`, `generate`) are editable by teammates. Defaults live in code (the prompt files); `llm/prompts/registry.ts` holds slot metadata and resolves the active prompt per call: stored override if present, else the default. Overrides are **global for everyone** and versioned under `tmp/prompts/<slot>/` (`PromptStore`, fs impl); revert deletes only the latest pointer, so history stays and the slot tracks the code default again. Only the system prompt is editable — the user-message assembly (evidence, notes, generation input) and all schema/limit enforcement stay in code. The research slot has no provider-enforced schema, so its `## Output` JSON contract is a code-owned block appended after the editable text. Every research/tags/generate artifact is stamped with `promptVersion` (`default#<hash8>` | `custom#<ISOts>`), surfaced in API responses and the UI; the run page shows a stale hint when a stored artifact's prompt differs from the active one (re-runs are always explicit — never automatic, research costs ~60–75 s).

## API routes

Composable steps are synchronous; the orchestrated pipeline is async.

| Method | Path                    | In → Out                                              |
| ------ | ----------------------- | ---------------------------------------------------- |
| POST   | `/scrape`               | `{ input, scraper?, country? }` → `{ ref, meta, blocked }` (`?include=html` adds the raw body; `meta` includes `bytes` + `durationMs`) |
| GET    | `/scrape`               | `?input=url\|asin` → `{ ref, meta }` (pure read of the latest stored scrape, no fetch; `meta` includes `bytes`; 404 if never scraped; `&include=html` adds the raw body; `&view=html` returns the stored page as rendered `text/html` — CSP-sandboxed, scripts blocked, `<base>` injected so assets resolve) |
| POST   | `/parse`                | `{ input, scraper?, refetch? }` → `{ listing, source }` (reuses latest stored HTML unless `refetch`) |
| GET    | `/parse`                | `?input=url\|asin` → `{ ref, listing }` (pure read of the latest stored parse, never scrapes or persists; 404 if never parsed) |
| POST   | `/research`             | `{ input }` → `{ ref, identity, notes, sources, researchedAt, promptVersion, sourceParsedAt, usage, durationMs }` (web-enabled LLM; reuses stored listing) |
| GET    | `/research`             | `?input=url\|asin` → same shape as POST (pure read of the latest stored research, no LLM; 404 if never researched) |
| POST   | `/tags`                 | `{ input, refresh? }` → `{ ref, identity, tags, source, taggedAt, sourceResearchedAt, usage, durationMs }` (reuses stored research unless `refresh`; `?include=matrix` adds a markdown view) |
| GET    | `/tags`                 | `?input=url\|asin` → `{ ref, identity, tags, taggedAt, sourceResearchedAt, … }` (pure read of the latest stored tag set, no LLM; 404 if never tagged; `&include=matrix` adds the markdown view) |
| POST   | `/evaluate/content`     | `{ listing, tags }` → `{ content }`                   |
| POST   | `/evaluate/rufus`       | `{ listing, tags }` → `{ rufus }`                     |
| POST   | `/evaluate/llm-search`  | `{ listing, tags }` → `{ llmSearch }`                 |
| POST   | `/generate`             | `{ input, refresh? }` → `{ ref, generated, source }` (reuses stored tags; `refresh` re-runs research→tag; always regenerates the full four-field document in one call) |
| GET    | `/generate`             | `?input=url\|asin` → `{ ref, generated }` (pure read of the latest stored generation, no LLM; 404 if never generated) |
| GET    | `/prompts`              | → `{ prompts: [{ id, title, constraints, defaultText, override, active, … }] }` (the three editable slots) |
| PUT    | `/prompts/:id`          | `{ text, note? }` → `{ id, override, active }` (save a new global override version) |
| DELETE | `/prompts/:id`          | → `{ id, active }` (revert to the code default; history kept) |
| GET    | `/listings`             | → `{ listings: ListingRef[] }` (every listing with a stored scrape — readdir only; feeds the UI's known-ASIN picker) |
| POST   | `/runs`                 | `{ input, scraper? }` → `{ runId, status }` (async pipeline) |
| GET    | `/runs/:id`             | → `Run` (status + stages + result)                   |
| POST   | `/auth/otp`             | `{ email }` → `{ sent }` (stub)                       |
| POST   | `/auth/verify`          | `{ email, code }` → `{ user }` (stub)                 |
| GET    | `/health`               | → `{ status }`                                        |
| GET    | `/`                     | static eval UI (`public/index.html`)                  |

When `ACCESS_KEY` is set, every route except the UI pages + assets (`/`, `/index.html`, `/prompts.html`, `/shared.css`, `/shared.js`, `/favicon.ico`) and `/health` requires `x-access-key` (or `?key=`) to match, else 401 (`server/access-guard.ts`). Unset = guard disabled (local dev). The UI keeps the key in localStorage and sends it on every call.

### Eval UI (five step cards)

`index.html` shows the five observable stages — scrape / parse / research / tag / generate — as independent cards. Each card hydrates from its pure GET on load and input change (never persists), and re-hydrates the whole chain after any action POST. Per card: a header cost chip (static estimate from `STEP_ESTIMATES` in `shared.js`, plus "last run" actuals from the artifact's `usage`/`durationMs` stamps), a meta line (ref · timestamps · prompt version), chain + prompt stale hints (hint only, never auto-run), a collapsed raw-JSON block, and one explicit action button whose label states the cost (auto-resolving endpoints say what they'll run). The parse card opens with the SKU identity tuple — a view join over stored research (identity is research output, never parsed), falling back to "identity pending research". A chain-total strip after card 5 sums tokens / ≈ dollars / scrape count / wall time across the stored chain, "—" where stamps are missing. Dollar math uses the `PRICES` / `SCRAPE_COST` placeholder constants in `shared.js` (per-1M-token rates keyed by `usage.model`, unset by default → "$—") — set real contract rates there. A `<datalist>` fed by `GET /listings` suggests already-scraped ASINs.

## Data model (current, in-memory)

`Run` holds `input`, `status` (`queued|running|done|failed`), per-stage `StageState[]`, and a `RunResult` (`listing`, `research`, `tags`, `evaluation`, `generated`). See `domain/`.

## Artifact persistence (filesystem, versioned)

`ArtifactStore` (see `persistence/artifacts/`) keeps every scrape/parse, newest pointed to by `latest.json`:

- `tmp/scrape/<MARKET>_<ASIN>/<ISOts>__<scraper>.html` + `latest.json` with provenance `{ scraper, status, country, url, fetchedAt, blocked, durationMs, file }`.
- `tmp/parse/<MARKET>_<ASIN>/<ISOts>.json` + `latest.json` pointer.
- `tmp/research/<MARKET>_<ASIN>/<ISOts>.json` + `latest.json` pointer (`SkuResearch`).
- `tmp/tags/<MARKET>_<ASIN>/<ISOts>.json` + `latest.json` pointer (`TagSet`).
- `tmp/generate/<MARKET>_<ASIN>/<ISOts>.json` + `latest.json` pointer (`GeneratedListing` — always a complete four-field document).
- `tmp/prompts/<slot>/<ISOts>.json` + `latest.json` pointer (global prompt overrides; revert removes only the pointer).

`/parse` loads the latest raw HTML instead of re-scraping (BrightData requests cost money); `refetch: true` forces a fresh scrape. Likewise `/tags` loads the latest stored research instead of re-running the web-enabled LLM call; `refresh: true` forces new research.

**Chain provenance (M6):** each artifact stamps the identifying timestamp of the direct input it consumed, so the UI can hint when a downstream artifact was made from a since-replaced upstream — hints only, re-runs stay explicit. `Listing.parsedAt` + `sourceFetchedAt` (the scrape's `fetchedAt`), `SkuResearch.sourceParsedAt`, `TagSet.taggedAt` + `sourceResearchedAt`, `GeneratedListing.sourceTaggedAt`. Cost observability rides along: `LlmResponse.usage` (`{ model, inputTokens, outputTokens }`, extracted by the OpenAI provider; generate sums its up-to-2 calls) and `durationMs` are stamped on the three LLM artifacts and scrape meta. Token usage misses web-search tool billing, so all downstream cost math is labeled approximate. All provenance/cost fields are optional — artifacts stored before M6 simply lack them, and every consumer must tolerate that. They are also declared (optional) in `server/schemas.ts` `listingSchema`/`tagSetSchema`: Zod strips unknown keys, so an undeclared field would silently vanish when `resolve-listing` re-validates a stored artifact.

## DB tables (placeholder — not yet implemented)

When persistence lands (Postgres + a TS query layer), expected tables:

- `users` — `id`, `email`, `company_domain`, `created_at`.
- `runs` — `id`, `user_id`, `input`, `asin`, `marketplace`, `status`, `error`, `created_at`, `updated_at`.
- `run_stages` — `id`, `run_id`, `name`, `status`, `started_at`, `finished_at`, `error`.
- `run_results` — `run_id`, `listing` (jsonb), `research` (jsonb), `tags` (jsonb), `evaluation` (jsonb), `generated` (jsonb).
- `usage` / `billing` — `user_id`, `runs_used`, `quota`, `plan`, `period`.

## Providers & config

Selected by env via factories (`createScraper`, `createLlmClient`):

- Scrapers: `playwright` | `brightdata-unlocker` (PDP) | `brightdata-browser` (Rufus).
- LLMs: `anthropic` | `openai` (Responses API: web search + strict structured output; model via `OPENAI_MODEL`, `tier: 'fast'` requests via `OPENAI_MODEL_FAST` with fallback) | `perplexity`.

Keys/zones in `.env` (see `.env.example`). `ACCESS_KEY` enables the shared-key API guard; `ARTIFACTS_DIR` relocates the artifact store (defaults to `<cwd>/tmp`; on Railway a volume at `/data`).

## Deployment

Railway, single service + volume — runbook in [deploy.md](deploy.md).
