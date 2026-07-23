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

Notes: Local Playwright worked on both test URLs (US chair, IN shoe) without residential proxies — kept as selectable backup. Unlocker verified live on both marketplaces (`country` honored, no blocks). Parser quirks: fashion/softlines PDPs (amazon.in shoe) have no `#feature-bullets`; bullets live under "About this item" in `#productFactsDesktopExpander`. Images come from the `'colorImages': { 'initial': [...] }` ImageBlockATF script (alt-image thumbs are tiny variants). Some PDPs (US chair) have no `#productDescription` at all — description only exists as A+ content (`#aplus`), deferred. Grocery/beauty PDPs (UK Zoflora `B0BGSWJPNF`, UK Mr Muscle `B0C4BG7R2L`) nest an AUI expander *inside* `#productDescription` — the inline collapse `<script>` and "See more" prompt used to leak into the text, while the collapsed copy itself is server-rendered (nothing behind the click is lost); `extractDescription` strips that chrome, newline-separates blocks, and prefixes sub-headings ("Ingredients", "Directions", …) with `### ` so the eval UI and prompts can emphasize them. `spikes/reparse-all.ts` re-parses every stored scrape and diffs against stored parse artifacts — run it after any parser change.

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

## M4 — Hosted eval tool (single-shot generate, auth guard, eval UI, Railway) 🔶

Turn the local MVP into a teammate-facing eval tool.

- ✅ Single-shot generation replaces the four chained calls: one combined prompt (`llm/prompts/generate/listing.ts`) + strict `generated_listing` schema → all four fields in one `tier: 'fast'` call; all limit violations collected and fixed in ONE corrective full-document re-prompt (then 502). Per-field prompts and the `only`/`prior` regeneration mode deleted (git history is the archive).
- ✅ Shared-key auth guard: `ACCESS_KEY` env (unset = disabled); `server/access-guard.ts` onRequest hook; `/`, `/index.html`, `/favicon.ico`, `/health` public, everything else needs `x-access-key` (or `?key=`).
- ✅ `ARTIFACTS_DIR` env relocates the fs artifact store (Railway volume at `/data`); defaults to `<cwd>/tmp`.
- ✅ Static eval UI: `public/index.html` (self-contained dark page, no build step) via `@fastify/static` — parse/tags/generate actions + stored reads, tag matrix table, char meters, image thumbnails, key in localStorage, elapsed timers on slow calls.
- ✅ `docs/deploy.md` Railway runbook (volume, env vars, seeding, post-deploy checks).
- ⬜ Deploy to Railway + run the post-deploy verification list (needs the user's Railway account).

Notes: Live-verified locally. Single-shot generate on stored tags: `UK_B0C4BG7R2L` in ~96s (title 73, highlights 125, bullets 821/5, description 1,905 — all within limits, no corrective retry) and `IN_B07M8H2HR4` in ~55s (title 72, highlights 122, bullets 780/5, description 1,398); one LLM call each, new versions in `tmp/generate`. Single-shot runs materially faster than the ~2–3 min chained flow but lands further under the fill targets (bullets ~820 vs ~926, IN description 1,398 vs 1,612) — watch limit-packing quality during eval. Guard verified all ways: key set → `/health` + `/` 200 bare, API 401 without/with wrong key, 200 via header and `?key=`; key unset → everything open. UI verified in a browser end-to-end on stored artifacts: parse render with images, 86-tag matrix, generation view with char meters and per-bullet counts.

## M5 — Editable prompts (teammate prompt iteration) ✅

Expose the three LLM system prompts (research / tag / generate) so teammates can edit, test, and revert them from the eval tool. Decisions: system prompt only (user-message wiring stays code); research's `## Output` JSON contract is a code-owned suffix always appended (tag/generate are provider-schema-enforced, safe to edit freely); overrides are global + versioned (no per-user, no draft runs); separate editor page.

- ✅ `PromptStore` contract + versioned fs impl (`tmp/prompts/<slot>/`; revert deletes only the latest pointer, history stays). Wired via `PipelineContext`.
- ✅ `llm/prompts/registry.ts` — slot metadata (title, constraints copy, inputs note, default text, research fixed suffix) + `resolvePrompt` (override else default).
- ✅ Provenance: stages stamp `promptVersion` (`default#<hash8>` | `custom#<ISOts>`) into research/tags/generate artifacts; surfaced in `/research`, `/tags` (+ `researchPromptVersion`), `/generate` responses.
- ✅ `GET /prompts` · `PUT /prompts/:id` · `DELETE /prompts/:id` (Zod at the edge; covered by the access guard; `prompts.html` added to public paths).
- ✅ `public/prompts.html` — per-slot editor (status chip, char count, save-with-note, revert, view-default, read-only appended contract, enforced-in-code panel). `index.html` — header link, prompt version in step meta, re-run buttons persist after done (re-run tag / re-run research + tag / re-run generate), stale hint when a stored artifact's prompt ≠ active.
- ✅ Verified live on `UK_B0BGSWJPNF`: PUT tag override → POST /tags stamped `custom#…` (61 tags, artifact + response) → DELETE → back to `default#…`; fresh research ran through the split prompt + appended contract and parsed clean (`default#17d73bdb` stamped); generate stamped `default#8dd5c554` (70/125/935/1973 chars). UI driven end-to-end in a browser: save → custom chip → revert → default; hydrate shows provenance meta, re-run buttons, and the stale hint firing only where the artifact prompt differs.

Notes: default versions are content hashes (`default#17d73bdb` research, `#c3360972` tag, `#8dd5c554` generate) — they change when the in-code default text changes. Concurrent saves are last-write-wins with every version retained. Out of v1: per-user prompts, draft (unsaved) runs, model/temperature toggles, history-browsing UI, per-ASIN "what the model sees" preview.

## M6 — Five-step pipeline transparency ✅

Expose all five pipeline stages (scrape / parse / research / tag / generate) as independent cards in the eval UI, backed by symmetric pure-read GETs and a chain-provenance trail (each artifact records which upstream artifact version made it; staleness is hinted, never auto-run). Includes the shared-module extraction of `public/` (vanilla JS stays; React explicitly deferred). Full handover plan: [plans/five-step-ui.md](plans/five-step-ui.md).

- ✅ Phase A — `GET /scrape` (meta + `bytes`, `include=html`), `GET /parse`, `GET /research`; provenance stamps (`parsedAt`/`sourceFetchedAt`, `sourceParsedAt`, `taggedAt`/`sourceResearchedAt`, `sourceTaggedAt`); cost/duration stamps (`LlmResponse.usage` extracted by the OpenAI provider — generate sums its up-to-2 calls — plus `durationMs` on scrape meta + the three LLM artifacts). New fields declared optional in `listingSchema`/`tagSetSchema` so Zod reuse doesn't strip them.
- ✅ Phase B — `public/shared.css` + `public/shared.js` (tokens, api/esc/fmt*, renderers, prompt-staleness helpers, button machinery); both pages consume; behavior unchanged. `shared.css`/`shared.js` added to the access guard's public paths (`<link>`/`<script>` can't send the key header).
- ✅ Phase C — five-card run page: pure-GET hydration (fixes hydrate-writes-artifacts wart), per-card cost chips (estimate + "last run" actuals) with a chain-total strip after step 5 (rates = user-set placeholders in `PRICES`/`SCRAPE_COST`), parse-card SKU identity header (tuple from stored research, "identity pending" fallback), explicit-cost action labels (auto-resolving endpoints say what they'll run), chain + prompt stale hints, raw-JSON toggle per card; `GET /listings` stored-ASIN `<datalist>` picker (stretch, done).

Notes: Live-verified with one full chain on `UK_B0BGSWJPNF` (13 Jul): re-scrape 6.2s/1.6MB → parse → research 56s (40k in / 2k out) → tag 76s (2k/5k, 67 tags) → generate 113s (4k/6k, 71/124/874/1890 chars, no corrective retry). Every stamp matched its upstream on disk (`sourceFetchedAt`=scrape `fetchedAt`, `sourceParsedAt`=`parsedAt`, `sourceResearchedAt`=`researchedAt`, `sourceTaggedAt`=`taggedAt`); chain strip summed 3/3 stamped · 46k in / 13k out · wall 4m 11s. Stale transitions seen live: re-scrape → parse card "made from an older scrape" → cleared by re-parse; tag card's "prompt changed" (stored custom-prompt artifact vs active default) cleared on re-tag. Upstream-newer hints for research/tags/generate can only fire between artifacts that both carry stamps — pre-M6 artifacts lack them by design (no false hints, verified: nulls surfaced, no hint). Dollar math verified by injecting a test rate client-side: per-card ≈$ actuals + chain LLM ≈$0.19 rendered, then removed. `usage.model` is the resolved snapshot id (`gpt-5.5-2026-04-23`), so `PRICES` keys must match it — noted in the shared.js comment. Rates left as placeholders: ask for real BrightData + per-model contract rates. Token usage under-counts research (web-search tool billing invisible) — everything stays labeled ≈. Post-ship addition: `GET /scrape&view=html` serves the stored page as rendered `text/html` (CSP `sandbox` so third-party page JS can't run on our origin / reach the access key; `<base>` injected for asset URLs) — scrape card links both "render page" and "raw HTML (JSON)"; verified rendering the stored Zoflora PDP visually.

## Phase 5 — Persistence, Auth, Billing ⬜

Make runs durable and gated.

- ✅ Plain-English target domain model + glossary; separates Organization tenancy, Product/Variant/SKU/Listing identity, Claims/Evidence, and execution history (`docs/domain-model.md`, `docs/glossary.md`).
- ⬜ Postgres + query layer; implement `RunRepository`; create tables (see Design).
- ⬜ Company-email OTP login (renderable OTP email) + sessions.
- ⬜ Quota + payments to unlock beyond N runs.
- ⬜ Durable job queue (retries, concurrency) replacing in-process queue.

Notes: Direction agreed before schema work: Organization is the workspace boundary; catalog identity is Product → Variant → SKU → Listing → Offer with Category orthogonal; durable knowledge is Claims + Evidence with Tags as classifications; only approved knowledge/content versions are permanent product history. Run summaries, usage/accounting, identity corrections, security audit, and evidence supporting retained records remain durable exceptions. Detailed unpromoted artifacts should start with a reversible 30–90 day retention window rather than immediate deletion.

## Backlog / open questions

- **Handover 2 (after M6 settles): config-driven tag taxonomy** — types/scopes become versioned data (same override pattern as prompts) feeding the provider schema, a generated prompt suffix, and the matrix renderers; `TagSet` snapshots its taxonomy. Direction locked 2026-07-11 (see plans/five-step-ui.md "Parked"); spec deliberately written after teammates use the five-step view.
- React migration trigger: first genuinely interactive tooling (inline tag editing, side-by-side comparisons, run history) — not before.
- Sync vs async for slow composable steps (scrape/research/rufus) under real latency.
- Caching scrapes/research per ASIN to save cost.
- Marketplace coverage + localization of rubrics.
