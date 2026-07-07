# Plan

Step-wise plan and progress tracker. High-level scope only — implementation detail lives in the code. Update statuses and notes as work lands.

Legend: ✅ done · 🔶 in progress · ⬜ not started

## Phase 0 — Scaffold ✅

Boilerplate, contracts, composable stages, async pipeline — runs end-to-end with mock outputs.

- ✅ TS + Fastify + Zod project, pnpm, strict tsconfig, eslint/prettier.
- ✅ `domain/` types + contracts; `config/`; `lib/` (logger, errors).
- ✅ Stages + orchestrator; in-memory `RunRepository`; in-process job queue.
- ✅ Provider contracts + factories + stubs (scraping, llm).
- ✅ Composable step endpoints (`/scrape`, `/research`, `/evaluate/*`, `/recommend`) + async `/runs`.
- ✅ Auth/billing stubs behind thin contracts.

Notes: `ingest` is the only fully-real stage; everything else returns mocks.

## Phase 1 — De-risk #1: Scrape Amazon PDP ✅

Get the 4 parts (title, description, hero, secondary images) from a real PDP.

- ✅ Spike local Playwright on a real PDP; assess Amazon bot-blocking.
- ✅ Implement `brightdata/unlocker.ts` (Web Unlocker) as the default PDP fetch path (`api.brightdata.com/request`, egress country mapped from marketplace).
- ✅ Real `amazon/pdp-parser.ts` (cheerio; HTML → `Listing`); handles marketplace variants.
- ✅ Split `scrape` (raw HTML) and `parse` (Listing) stages; `/scrape` + `/parse` endpoints with per-request `scraper` selection.
- ✅ Versioned filesystem `ArtifactStore` (`tmp/scrape`, `tmp/parse`); `/parse` reuses stored HTML unless `refetch`.

Notes: Local Playwright worked on both test URLs (US chair, IN shoe) without residential proxies — kept as selectable backup. Unlocker verified live on both marketplaces (`country` honored, no blocks). Parser quirks: fashion/softlines PDPs (amazon.in shoe) have no `#feature-bullets`; bullets live under "About this item" in `#productFactsDesktopExpander`. Images come from the `'colorImages': { 'initial': [...] }` ImageBlockATF script (alt-image thumbs are tiny variants). Some PDPs (US chair) have no `#productDescription` at all — description only exists as A+ content (`#aplus`), deferred.

## Phase 2 — De-risk #2: Probe Rufus ⬜

Determine if the product is searchable / retrievable / recommended by Rufus.

- ⬜ Spike `brightdata/browser.ts` (Browser API over CDP).
- ⬜ Drive Rufus with buyer-style queries; capture responses.
- ⬜ Detect ASIN presence in recommendations; populate `DiscoverabilityResult`.

Notes: _record findings._

## Phase 3 — De-risk #3: Probe LLM search ⬜

Check visibility in ChatGPT / Claude / Perplexity, ideally via headless web.

- ⬜ Spike headless web probes per surface; capture + parse answers.
- ⬜ Detect brand/product mentions + citations; populate `DiscoverabilityResult`.

Notes: _record findings._

## Phase 4 — Research + Evaluation + Recommendations ⬜

Turn mock evaluation into real scoring.

- ⬜ `research/` — web search + LLM synthesis → hierarchical `SourceOfTruth` + keywords.
- ⬜ Real LLM clients in `llm/providers/*`.
- ⬜ Content rubrics in `llm/prompts/content/*` (title, description, hero, secondary; vision for images).
- ⬜ `recommend` synthesis over the three axes.

## Phase 5 — Persistence, Auth, Billing ⬜

Make runs durable and gated.

- ⬜ Postgres + query layer; implement `RunRepository`; create tables (see Design).
- ⬜ Company-email OTP login (renderable OTP email) + sessions.
- ⬜ Quota + payments to unlock beyond N runs.
- ⬜ Durable job queue (retries, concurrency) replacing in-process queue.

## Backlog / open questions

- Sync vs async for slow composable steps (scrape/research/rufus) under real latency.
- Caching scrapes/research per ASIN to save cost.
- Marketplace coverage + localization of rubrics.
