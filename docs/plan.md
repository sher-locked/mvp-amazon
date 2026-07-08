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

## Phase 4 — Research + Evaluation + Recommendations 🔶

Turn mock evaluation into real scoring.

- ✅ Research landed early (M2): `research` stage = web-enabled OpenAI call resolving the identity tuple + notes; `tag` stage = strict-structured-output bucketing into the flat scope×type `TagSet` (replaces the old `SourceOfTruth` model — see `docs/sku-tags.md`). Exposed as stateless `POST /research` + `POST /tags` with versioned `tmp/research`, `tmp/tags` artifacts; `/tags` reuses stored research unless `refresh`.
- ✅ Real OpenAI client (`llm/providers/openai.ts`, Responses API: web_search tool + json_schema strict output + source URLs). Anthropic/Perplexity still stubs.
- ✅ A+ content (`#aplus`) extracted into `Listing.aplusContent` as research evidence.
- ✅ `GET /tags?input=...` — pure read of the latest stored tag set (no LLM), `&include=matrix` for the markdown view.
- ⬜ Content rubrics in `llm/prompts/content/*` (title, description, hero, secondary; vision for images). **Parked** — generation (M3) jumped the queue per the 27 July 2026 title change.

Notes: Live-verified with `gpt-5.5` on the IN adidas shoe (`B07M8H2HR4`: 66 tags) and `B0B8PDHRWY` — which on amazon.in is a Kodak PIXPRO FZ45 camera, not the Dettol wipes from `sku-tags.md` (the doc's example ASIN is fictional/stale; 82 tags). Identity tuples sane (incl. `parentBrand: Kodak` for PIXPRO), zero cross-scope repeats, `/tags` reuse of stored research confirmed. Each web-enabled research call runs ~50–75s — factor into sync-endpoint timeouts when this joins `/runs`. `sources[]` is broad provenance (everything consulted), not citations.

## M3 — Listing generation (the four post-July-2026 fields) ✅

Turn the stored `TagSet` + `Listing` into Title (≤75), Item Highlights (≤125), five About This Item bullets (<1,000 together), and Product Description (≤2,000) — spec in `docs/reference/amazon-generation-prompts.md`. Replaces the mock `recommend` stage (evaluation rubrics stay parked).

- ✅ `generate` stage: four chained schema-strict calls (Title → Highlights → Bullets → Description), each later prompt seeing the earlier fields to avoid repetition; one `GeneratedListing` document persisted per version under `tmp/generate`.
- ✅ Hard rules in code, not prompts: char counting/limits after each call with one corrective re-prompt (then 502), bullets exactly-5 + per-bullet 10–500 + total budget; mechanical §4 gates (drop inferred+complianceSensitive, drop confidence <0.6) pre-filter the tags.
- ✅ Fast model tier: `tier: 'fast'` on the four calls, resolved by the OpenAI provider from `OPENAI_MODEL_FAST` (falls back to `OPENAI_MODEL` when unset). Research/tag stay on the default model.
- ✅ `POST /generate { input, refresh?, only? }` (reuses stored tags; `only` regenerates one field into the latest stored generation) + `GET /generate?input=...` (pure read). `/recommend` removed; orchestrator ends at `generate`, `RunResult.generated`.

Notes: Live-verified on `UK_B0C4BG7R2L` (Mr Muscle spray: title 72, highlights 125, bullets 926/5, description 1,939) and `IN_B07M8H2HR4` (adidas Drogo: title 71, highlights 119, bullets 910/5, description 1,612 — under target, over is what fails). Full run ~2–3 min on the default `gpt-5.5` fallback (`OPENAI_MODEL_FAST` unset); `only: 'title'` regeneration ~1 min, one call, other fields byte-identical, new full-document version in `tmp/generate`. The corrective retry fired in anger once: first description attempt came back 2,049 chars twice with a soft "compress" nudge, so the retry prompt now demands cutting whole sentences with a stated char count — passed after that. `GET /generate` needs the marketplace-bearing URL (bare ASIN ingests as US), same as `/tags`. Post-launch fixes: `ingest` now 400s on unknown amazon domains with a "did you mean" hint (a typo'd amazon.co.in used to silently become a US ref and re-run the full scrape→research→tag chain against amazon.com), and `only` regeneration checks the stored-generation pointer before any scraping or LLM work (was 404ing after ~2 min of wasted calls).

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
