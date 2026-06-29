# claude.md — Working Context

Agent-facing guide. Read before changing code. Keep it true; update it when architecture shifts. For deeper structure see `docs/design.md`; for scope/progress see `docs/plan.md`.

## Intent

One job: take an Amazon listing (URL/ASIN) and evaluate its content for **discoverability** (human + agentic) and **purchasability** (conversion). Output: scores on three axes + prioritized content fixes.

## Domain Model

The unit of work is an **evaluation run** over one **listing**.

- `Listing` — `{ ref, title, description, bullets, heroImage, secondaryImages[] }`
- `SourceOfTruth` — hierarchical claims (brand → product → category) + target `keywords[]`
- `Evaluation` — `{ content, rufus, llmSearch }`
- `Recommendation` — prioritized, actionable content change
- `Run` — `{ id, input, status, stages, result }`; status moves `queued → running → done | failed`

## Composable Steps (the spine)

The pipeline is a sequence of small steps in `pipeline/stages/`:

`ingest → scrape → research → evaluate(content, rufus, llm-search) → recommend`

Each step takes typed input, returns typed output, and never reaches into another step's internals. They are exposed two ways, both calling the same functions:

- **Individually** — synchronous endpoints (`/scrape`, `/research`, `/evaluate/*`, `/recommend`) for de-risking and reuse.
- **Together** — the async pipeline via `pipeline/orchestrator.ts`, which owns sequencing and run status (`/runs`).

## Architecture Principles

- **Deep modules, thin interfaces** — expose a small surface; hide scraping/LLM/proxy complexity. Callers depend on contracts in `domain/`, never on a concrete provider.
- **Small files, small functions** — one responsibility each. If a file explains "and", split it.
- **Provider separation** — scraping providers are isolated and swappable:
  - `scraping/playwright/` — local headless. Try first; expect Amazon bot-blocks.
  - `scraping/brightdata/unlocker.ts` — Web Unlocker; workhorse for the PDP.
  - `scraping/brightdata/browser.ts` — Browser API; for Rufus.
  - All implement the `Scraper` contract in `scraping/scraper.ts`. Never import a provider directly from a step — go through the contract + factory.
- **LLM is provider-agnostic** — `llm/client.ts` is the only thing steps call; `llm/providers/*` implement it.
- **Validate at the edge** — Zod schemas in `server/schemas.ts`; throw typed errors internally; one handler maps them to responses.
- **Config centralized** — only `config/` reads `process.env`.

## Conventions

- TypeScript strict; no `any` at module boundaries. Prefer discriminated unions for step results.
- Handlers stay thin: parse/validate → call a step/orchestrator → shape response.
- Prompts/rubrics live in `llm/prompts/`, named per asset (title, description, hero, secondary).
- No narrating comments; comment only non-obvious intent/constraints.
- One provider per file; factories select impl by config, not by caller.

## Stubbed For Now (thin contract + no-op/in-memory impl)

- `auth/` — company-email OTP login
- `billing/` — quota / unlock beyond N runs
- `persistence/` — per-user run storage (in-memory until a DB is chosen)

## De-risking Order (current focus)

1. Scrape Amazon PDP (Playwright feel-out → BrightData Web Unlocker).
2. Probe Rufus (BrightData Browser API if Playwright fails).
3. Probe ChatGPT / Claude / Perplexity via headless web.

Keep these as runnable, isolated spikes in `spikes/` before hardening into clean modules.
