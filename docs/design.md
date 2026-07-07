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
| `pipeline/stages/` | The composable steps: `ingest`, `scrape`, `parse`, `research`, `tag`, `evaluate-*`, `recommend`. |
| `pipeline/`        | `orchestrator` (sequences stages, owns run status) + `context` (provider handles). |
| `scraping/`        | `Scraper` contract + factory + per-request resolver; `playwright/`, `brightdata/`, `amazon/` (PDP parser, block-detect, country map). |
| `research/`        | Pure views over research output (`tag-matrix`); the research/tag LLM calls live in `pipeline/stages/` + `llm/prompts/research/`. |
| `llm/`             | Provider-agnostic `LlmClient` + factory + `providers/` + `prompts/` (rubrics). |
| `discoverability/` | Rufus + LLM-search probes.                                            |
| `persistence/`     | `RunRepository` contract + in-memory impl (DB later); `artifacts/` — versioned `ArtifactStore` (fs impl under `tmp/`). |
| `jobs/`            | In-process job queue (durable queue later).                          |
| `auth/`            | Company-email OTP (stub).                                             |
| `billing/`         | Quota / unlock paywall (stub).                                        |
| `server/`          | Fastify app, error handler, route registration, request schemas.     |
| `container.ts`     | Composition root; wires everything once at startup.                  |
| `spikes/`          | Throwaway de-risking experiments, promoted into `src/` once proven.   |

## Stages (the composable unit)

`ingest → scrape → parse → research → tag → evaluate(content, rufus, llm-search) → recommend`

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
| `recommend`        | `Listing`+`TagSet`+`Evaluation` → `Recommendation[]` | mock (phase 4) |

The research/tag split mirrors scrape/parse: `research` is the expensive web-enabled call (persisted), `tag` is the cheap bucketing call that can re-run against stored research. The tag model (scope × type axes, one-placement rule) is specified in [sku-tags.md](sku-tags.md).

## API routes

Composable steps are synchronous; the orchestrated pipeline is async.

| Method | Path                    | In → Out                                              |
| ------ | ----------------------- | ---------------------------------------------------- |
| POST   | `/scrape`               | `{ input, scraper?, country? }` → `{ ref, meta, blocked }` (`?include=html` adds the raw body) |
| POST   | `/parse`                | `{ input, scraper?, refetch? }` → `{ listing, source }` (reuses latest stored HTML unless `refetch`) |
| POST   | `/research`             | `{ input }` → `{ ref, identity, notes, sources }` (web-enabled LLM; reuses stored listing) |
| POST   | `/tags`                 | `{ input, refresh? }` → `{ ref, identity, tags, source }` (reuses stored research unless `refresh`; `?include=matrix` adds a markdown view) |
| GET    | `/tags`                 | `?input=url\|asin` → `{ ref, identity, tags }` (pure read of the latest stored tag set, no LLM; 404 if never tagged; `&include=matrix` adds the markdown view) |
| POST   | `/evaluate/content`     | `{ listing, tags }` → `{ content }`                   |
| POST   | `/evaluate/rufus`       | `{ listing, tags }` → `{ rufus }`                     |
| POST   | `/evaluate/llm-search`  | `{ listing, tags }` → `{ llmSearch }`                 |
| POST   | `/recommend`            | `{ listing, tags, evaluation }` → `{ recommendations }` |
| POST   | `/runs`                 | `{ input, scraper? }` → `{ runId, status }` (async pipeline) |
| GET    | `/runs/:id`             | → `Run` (status + stages + result)                   |
| POST   | `/auth/otp`             | `{ email }` → `{ sent }` (stub)                       |
| POST   | `/auth/verify`          | `{ email, code }` → `{ user }` (stub)                 |
| GET    | `/health`               | → `{ status }`                                        |

## Data model (current, in-memory)

`Run` holds `input`, `status` (`queued|running|done|failed`), per-stage `StageState[]`, and a `RunResult` (`listing`, `research`, `tags`, `evaluation`, `recommendations`). See `domain/`.

## Artifact persistence (filesystem, versioned)

`ArtifactStore` (see `persistence/artifacts/`) keeps every scrape/parse, newest pointed to by `latest.json`:

- `tmp/scrape/<MARKET>_<ASIN>/<ISOts>__<scraper>.html` + `latest.json` with provenance `{ scraper, status, country, url, fetchedAt, blocked, file }`.
- `tmp/parse/<MARKET>_<ASIN>/<ISOts>.json` + `latest.json` pointer.
- `tmp/research/<MARKET>_<ASIN>/<ISOts>.json` + `latest.json` pointer (`SkuResearch`).
- `tmp/tags/<MARKET>_<ASIN>/<ISOts>.json` + `latest.json` pointer (`TagSet`).

`/parse` loads the latest raw HTML instead of re-scraping (BrightData requests cost money); `refetch: true` forces a fresh scrape. Likewise `/tags` loads the latest stored research instead of re-running the web-enabled LLM call; `refresh: true` forces new research.

## DB tables (placeholder — not yet implemented)

When persistence lands (Postgres + a TS query layer), expected tables:

- `users` — `id`, `email`, `company_domain`, `created_at`.
- `runs` — `id`, `user_id`, `input`, `asin`, `marketplace`, `status`, `error`, `created_at`, `updated_at`.
- `run_stages` — `id`, `run_id`, `name`, `status`, `started_at`, `finished_at`, `error`.
- `run_results` — `run_id`, `listing` (jsonb), `research` (jsonb), `tags` (jsonb), `evaluation` (jsonb), `recommendations` (jsonb).
- `usage` / `billing` — `user_id`, `runs_used`, `quota`, `plan`, `period`.

## Providers & config

Selected by env via factories (`createScraper`, `createLlmClient`):

- Scrapers: `playwright` | `brightdata-unlocker` (PDP) | `brightdata-browser` (Rufus).
- LLMs: `anthropic` | `openai` (Responses API: web search + strict structured output; model via `OPENAI_MODEL`) | `perplexity`.

Keys/zones in `.env` (see `.env.example`).
