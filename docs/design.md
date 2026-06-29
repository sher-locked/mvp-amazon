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
| `domain/`          | Core types + contracts: `Listing`, `SourceOfTruth`, `Evaluation`, `Run`. No impl. |
| `pipeline/stages/` | The composable steps: `ingest`, `scrape`, `research`, `evaluate-*`, `recommend`. |
| `pipeline/`        | `orchestrator` (sequences stages, owns run status) + `context` (provider handles). |
| `scraping/`        | `Scraper` contract + factory; `playwright/`, `brightdata/`, `amazon/` (PDP parser). |
| `research/`        | Web search + LLM synthesis → `SourceOfTruth`.                         |
| `llm/`             | Provider-agnostic `LlmClient` + factory + `providers/` + `prompts/` (rubrics). |
| `discoverability/` | Rufus + LLM-search probes.                                            |
| `persistence/`     | `RunRepository` contract + in-memory impl (DB later).                 |
| `jobs/`            | In-process job queue (durable queue later).                          |
| `auth/`            | Company-email OTP (stub).                                             |
| `billing/`         | Quota / unlock paywall (stub).                                        |
| `server/`          | Fastify app, error handler, route registration, request schemas.     |
| `container.ts`     | Composition root; wires everything once at startup.                  |
| `spikes/`          | Throwaway de-risking experiments, promoted into `src/` once proven.   |

## Stages (the composable unit)

`ingest → scrape → research → evaluate(content, rufus, llm-search) → recommend`

| Stage              | In → Out                                  | Status         |
| ------------------ | ----------------------------------------- | -------------- |
| `ingest`           | url/asin → `ListingRef`                    | real           |
| `scrape`           | `ListingRef` → `Listing`                   | mock (phase 1) |
| `research`         | `Listing` → `SourceOfTruth`                | mock (phase 4) |
| `evaluate-content` | `Listing`+`SourceOfTruth` → `ContentEvaluation` | mock (phase 4) |
| `evaluate-rufus`   | `Listing`+`SourceOfTruth` → `DiscoverabilityResult` | mock (phase 2) |
| `evaluate-llm-search` | `Listing`+`SourceOfTruth` → `DiscoverabilityResult` | mock (phase 3) |
| `recommend`        | `Listing`+`SourceOfTruth`+`Evaluation` → `Recommendation[]` | mock (phase 4) |

## API routes

Composable steps are synchronous; the orchestrated pipeline is async.

| Method | Path                    | In → Out                                              |
| ------ | ----------------------- | ---------------------------------------------------- |
| POST   | `/scrape`               | `{ input }` → `{ listing }`                           |
| POST   | `/research`             | `{ listing }` → `{ sourceOfTruth }`                   |
| POST   | `/evaluate/content`     | `{ listing, sourceOfTruth }` → `{ content }`          |
| POST   | `/evaluate/rufus`       | `{ listing, sourceOfTruth }` → `{ rufus }`            |
| POST   | `/evaluate/llm-search`  | `{ listing, sourceOfTruth }` → `{ llmSearch }`        |
| POST   | `/recommend`            | `{ listing, sourceOfTruth, evaluation }` → `{ recommendations }` |
| POST   | `/runs`                 | `{ input }` → `{ runId, status }` (async pipeline)   |
| GET    | `/runs/:id`             | → `Run` (status + stages + result)                   |
| POST   | `/auth/otp`             | `{ email }` → `{ sent }` (stub)                       |
| POST   | `/auth/verify`          | `{ email, code }` → `{ user }` (stub)                 |
| GET    | `/health`               | → `{ status }`                                        |

## Data model (current, in-memory)

`Run` holds `input`, `status` (`queued|running|done|failed`), per-stage `StageState[]`, and a `RunResult` (`listing`, `sourceOfTruth`, `evaluation`, `recommendations`). See `domain/`.

## DB tables (placeholder — not yet implemented)

When persistence lands (Postgres + a TS query layer), expected tables:

- `users` — `id`, `email`, `company_domain`, `created_at`.
- `runs` — `id`, `user_id`, `input`, `asin`, `marketplace`, `status`, `error`, `created_at`, `updated_at`.
- `run_stages` — `id`, `run_id`, `name`, `status`, `started_at`, `finished_at`, `error`.
- `run_results` — `run_id`, `listing` (jsonb), `source_of_truth` (jsonb), `evaluation` (jsonb), `recommendations` (jsonb).
- `usage` / `billing` — `user_id`, `runs_used`, `quota`, `plan`, `period`.

## Providers & config

Selected by env via factories (`createScraper`, `createLlmClient`):

- Scrapers: `playwright` | `brightdata-unlocker` (PDP) | `brightdata-browser` (Rufus).
- LLMs: `anthropic` | `openai` | `perplexity`.

Keys/zones in `.env` (see `.env.example`).
