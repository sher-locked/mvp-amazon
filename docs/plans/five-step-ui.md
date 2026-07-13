# Handover: five-step pipeline transparency (M6)

Written 2026-07-11. Self-contained execution plan for a fresh agent. Read `CLAUDE.md` (repo root) and `docs/design.md` before starting; `docs/plan.md` M4/M5 notes explain the eval UI and the prompt-override system you are building on.

## Why

The eval UI (`public/index.html`) shows 3 steps, but the pipeline underneath has 5 observable stages: **scrape → parse → research → tag → generate**. The UI currently combines scrape+parse and research+tag, which hides the two intermediates teammates most need when hunting discrepancies: the raw-scrape provenance (was the page blocked? which scraper? how stale?) and the research output (identity + ~4k-char notes — the input that *determines* tag quality, currently invisible). This milestone exposes all five stages as independent cards, backed by symmetric read APIs and a provenance chain, so any step can be inspected and re-run in isolation.

## Locked decisions (do not re-litigate)

1. **Vanilla JS + extraction, no build step.** Shared CSS/JS pulled into `public/shared.*` ES modules. React is explicitly deferred until we build interactive tooling (inline tag editing, side-by-side comparisons); extracted renderers should convert to components mechanically when that day comes.
2. **Independent step cards with cost guardrails** — no sequential lock-chain. Every card hydrates from stored artifacts via pure GETs; every POST is a button click; cost-bearing actions carry explicit labels (re-scrape = BrightData spend; research = ~60–75 s web-enabled LLM call).
3. **Chain provenance**: each artifact records which upstream artifact version produced it; the UI shows chain-staleness hints (same pattern as the existing prompt-staleness hints). Hints only — never auto-re-run.
4. **Tag taxonomy flexibility is HANDOVER 2** (see "Parked" at the bottom). Direction is locked (config-driven, versioned, snapshot-in-artifact) but do NOT implement it here.

## What you inherit

- Pipeline stages in `src/pipeline/stages/` (`scrape`, `parse`, `research`, `tag`, `generate`), each persisting versioned artifacts via `ArtifactStore` (`tmp/<kind>/<MARKET>_<ASIN>/<ISOts>.json|.html` + `latest.json` pointer). Stateless routes in `src/server/routes/` call the same stage functions.
- Endpoints today: `POST /scrape` (fresh fetch, persists; `?include=html`), `POST /parse` (reuses stored HTML unless `refetch`), `POST /research` (always live LLM), `POST /tags` (reuses stored research unless `refresh: true`; auto-researches when missing), `POST /generate` (reuses stored tags; auto-chains when missing), plus pure reads `GET /tags` and `GET /generate` only.
- Prompt system (M5): three editable system prompts with global versioned overrides (`GET/PUT/DELETE /prompts`, `public/prompts.html`); every research/tags/generate artifact is stamped `promptVersion` (`default#<hash8>` | `custom#<ISOts>`); the run page shows "prompt changed — re-run to apply" when a stored artifact's prompt ≠ active (see `fmtPrompt`/`isStale`/`setStale` in index.html).
- UI: two self-contained dark-mode pages sharing (duplicated) design tokens and helpers. `ACCESS_KEY` guard: all routes except `/`, `/index.html`, `/prompts.html`, `/favicon.ico`, `/health` require `x-access-key` (`server/access-guard.ts`); the pages keep the key in localStorage.
- Stored test artifacts exist for ~11 ASINs under `tmp/` — use them; scrapes and research calls cost real money. `UK_B0BGSWJPNF` (Zoflora wipes) has a full chain (scrape→…→generate) and is the designated live-test listing.

## Phase A — API symmetry + chain provenance (backend only)

**New pure reads** (mirror the existing `GET /tags` pattern: `ingest(input)` → load latest artifact → 404 `NotFoundError` if absent; register in `server/app.ts`; Zod query schemas in `server/schemas.ts`):

- `GET /scrape?input=` → `{ ref, meta }` where meta is the stored raw pointer (scraper, status, country, url, fetchedAt, blocked, blockMarker?) **plus `bytes`** (HTML size — cheap `stat` or `Buffer.byteLength`). `&include=html` adds the raw HTML (large; the UI links to it, never inlines it).
- `GET /parse?input=` → `{ ref, listing }`.
- `GET /research?input=` → `{ ref, identity, notes, sources, researchedAt, promptVersion }`.

**Chain provenance** — stamp each artifact with its direct input's identifying timestamp:

- `Listing` gains `parsedAt?: string` and `sourceFetchedAt?: string` (the scrape's `fetchedAt`). The parse stage needs the fetchedAt of the HTML it consumed: thread it from callers (`routes/parse.ts`, `server/resolve-listing.ts`, orchestrator) — suggested: widen the parse stage signature to accept the raw meta (or just `fetchedAt`) alongside `ScrapedPage`; both callers have it (`loadRaw().meta.fetchedAt` or the fresh scrape's meta).
- `SkuResearch` gains `sourceParsedAt?: string` (= `listing.parsedAt`).
- `TagSet` gains `taggedAt?: string` (it has no own timestamp today) and `sourceResearchedAt?: string` (= `research.researchedAt`).
- `GeneratedListing` gains `sourceTaggedAt?: string` (= `tags.taggedAt`).

**Cost + duration capture** (feeds the Phase C cost chips; keep it observational — no budgets, no gating):

- `LlmResponse` (`src/llm/client.ts`) gains `usage?: { model: string; inputTokens: number; outputTokens: number }`; the OpenAI provider extracts it from the Responses API usage block (the other providers may leave it undefined). The generate stage makes up to 2 calls (corrective retry) — sum them.
- Artifacts gain optional stamps, set by their stages: `RawArtifactMeta.durationMs?` (scrape fetch time), and `usage?` + `durationMs?` on `SkuResearch`, `TagSet`, `GeneratedListing`. Parse is local/instant — no stamp.
- Token usage under-counts research's true cost (web-search tool billing isn't in token usage) — everything downstream must be labeled approximate (≈).

**Gotchas (real, verified in code):**

- `server/resolve-listing.ts` runs stored listings through `listingSchema.parse(...)`, and Zod **strips unknown keys** — add the new optional fields to `listingSchema` in `server/schemas.ts` or provenance silently vanishes on reuse. Same check for `tagSetSchema` (used by `/evaluate/*` bodies) — additions are optional there.
- Old artifacts predate every new field: every consumer (API responses, UI) must treat all provenance fields as possibly absent.
- Keep POST endpoint behavior byte-compatible otherwise; add fields to responses, never remove. `POST /tags` should also return `taggedAt`/`sourceResearchedAt`; `GET /tags` likewise (it already returns `promptVersion` + `researchPromptVersion`).

**Verification (zero LLM cost):** typecheck + lint; curl the three new GETs against stored ASINs (hit + 404 for an unknown ASIN); `POST /parse` on `UK_B0BGSWJPNF` → new artifact carries `parsedAt` + `sourceFetchedAt` matching `tmp/scrape/UK_B0BGSWJPNF/latest.json`. Tag/generate provenance is verified in the Phase C live run (below) — don't burn calls here.

## Phase B — shared-module extraction (no behavior change)

Create `public/shared.css` (the `:root` tokens + header/nav/inputs/buttons/step-card/chips/matrix/meters/desc/error/stale/details styles — superset of both pages' current CSS) and `public/shared.js` (ES module) exporting: `api` (fetch wrapper reading the localStorage access key), `esc`, `fmtPrompt`, `fmtTime`, `renderDesc`, `renderListing`, `renderTags`, `renderGenerated`, `meter`, `chip`, `runAction`/`setBtnLabel` (button timer + relabel machinery), and a small `initHeader` (key input wiring). Both pages switch to `<link rel="stylesheet" href="/shared.css">` + `<script type="module">`. Notes: keep localStorage keys (`accessKey`, `lastInput`) unchanged; `type="module"` defers execution — current code has no inline handlers, so this is safe; keep both pages public in the access guard (no changes needed).

**Verification:** open both pages in the browser (see "Browser verification" below) — identical behavior/appearance to before; zero console errors.

## Phase C — the five-step page

Rebuild `public/index.html`'s main flow as five cards. Shared pattern per card: hydrate from its GET on load/input-change (pure read, no side effects — this also fixes today's wart where hydration `POST /parse`-ed and persisted a new artifact on every page load); a **cost chip in the card header** (see "Cost transparency" below); meta line = ref · timestamps · prompt version (where applicable); a collapsed `<details>` "raw JSON" block showing the artifact/response pretty-printed; stale hints (see below); explicit action buttons.

1. **Scrape** — body: provenance chips (scraper, HTTP status, blocked verdict, country, fetchedAt, size) + "view raw HTML" link opening `GET /scrape?input=…&include=html&key=…` in a new tab (the `?key=` query form is already supported by the guard). Actions: nothing stored → "Scrape (1 BrightData request)"; stored → secondary "Re-scrape (new BrightData request)". Both `POST /scrape`.
2. **Parse** — body opens with a **clean SKU identity header**, then `renderListing` as today. The header renders the identity tuple in the `docs/reference/sku-tags.md` format — `displayName` prominent, then `{brand} × {category} × {variantAttributes} × {size}` with the claim-bearing axes (family.variantAttributes) and logistical axes (sku) as visually distinct chip groups, parent brand noted when non-null. **Domain caveat, honor it**: identity is RESEARCH output, never parsed from HTML (sku-tags.md: scrape/parse returns `identity: null`) — this header is a view join sourced from the stored research the page already hydrates, labeled "identity · from research"; before research exists it falls back to `marketplace · ASIN` + the raw scraped title + a muted "identity pending research (step 3)". Action: "Parse stored HTML" / "Re-parse" (`POST /parse`, never `refetch` — re-fetching is the scrape card's job). Stale when `listing.sourceFetchedAt ≠ scrape.meta.fetchedAt` → "made from an older scrape".
3. **Research** — body (new renderer): identity tuple block (displayName, brand/parent, category, family attrs, sku axes), notes rendered with paragraph breaks, collapsed sources list (count + URLs), prompt version. Action: "Run research (~1 min, web LLM)" / "Re-run research (~1 min, web LLM)" (`POST /research`). Stale when research `promptVersion` ≠ active research prompt, or `sourceParsedAt ≠ listing.parsedAt`.
4. **Tag** — body: matrix as today. Action: "Bucket tags (uses stored research)" (`POST /tags`); keep the copy honest: if research is missing the endpoint auto-runs it (~1 min extra). **Drop the old combined "Re-run research + tag" button** — the research card now owns that; the `refresh` API param stays for scripting. Stale when tag `promptVersion` ≠ active, or research `promptVersion` ≠ active (research is upstream), or `sourceResearchedAt ≠ research.researchedAt`.
5. **Generate** — body as today. Action: "Generate listing (1–2 min)" / "Re-run generate" (`POST /generate`). Stale when generated `promptVersion` ≠ active, or `sourceTaggedAt ≠ tags.taggedAt`.

**Cost transparency** (user-requested; keep it approximate and observational):

- **Per-card header chip — the estimate**: each card header shows what a run of that step costs before you click, e.g. scrape "1 unlocker request · ~5–10 s", parse "free · instant", research "LLM + web ≈ $— · ~1 min", tag "LLM ≈ $— · ~30–60 s", generate "LLM fast ≈ $— · ~1–2 min". All copy and numbers live in ONE editable constant in `shared.js` (`STEP_ESTIMATES`).
- **Actuals beside the estimate**: when the stored artifact carries the Phase A stamps, append them — "last run: 62 s · 41k in / 3k out ≈ $0.09". Dollar math = client-side `PRICES` constant in `shared.js` keyed by `usage.model` (per-1M-token rates) + `SCRAPE_COST` for BrightData.
- **Chain total after card 5**: a small summary strip totalling the stored chain — LLM calls, summed tokens, ≈ $ total, scrape count ≈ $, wall time — with "—" for artifacts missing stamps (old artifacts will miss them). Label the whole strip ≈ approximate.
- **Rates are placeholders**: do NOT invent confident prices. Ship `PRICES`/`SCRAPE_COST` with clearly-marked placeholder values and a one-line "edit your rates here" comment, and ask the user for their actual BrightData + model rates during verification (they're contract-specific). Until set, chips show token/request counts with "≈ $—".

No locking: all cards visible and enabled; cards whose endpoint auto-resolves missing inputs (tags, generate) say so in their labels. Cards with a hard missing input (parse with no scrape) show the error the API returns — that's fine and informative. Keep `loadActivePrompts()` + the prompt-staleness helpers from today's code (move into shared.js).

**Optional stretch (do only if smooth):** `GET /listings` → refs of everything under `tmp/scrape` (readdir, no HTML reads), rendered as a `<datalist>` on the URL input so teammates can jump to already-scraped ASINs instead of re-spending.

## Browser verification (how to see it live)

`.claude/launch.json` has a `dev` config (`pnpm dev`, port 3000, `autoPort: true` — if 3000 is busy it auto-assigns; the app reads `PORT` env). The server hot-reloads via tsx watch. Config loads `.env` itself (`process.loadEnvFile`) — BrightData/OpenAI keys are in it; `ACCESS_KEY` is unset locally. Use the preview tools (or ask the user) to click through both pages.

**End-to-end live budget: ONE full chain on `UK_B0BGSWJPNF`** — re-scrape (1 BrightData request) → parse → research (~1 min) → tags → generate (~1–2 min), verifying every provenance stamp and stale-hint transition along the way (e.g. after re-research, tag card must show "made from older research" until re-tagged), plus the cost stamps: each LLM artifact carries `usage` + `durationMs`, the card chips show actuals, the chain-total strip sums them, and the parse card's identity header appears once research lands. Everything else verifies against stored artifacts at zero cost.

## Bookkeeping (same session as the code)

- `docs/design.md`: routes table (3 new GETs, optional `/listings`), module map unchanged, add provenance fields to the artifact-persistence section, describe the 5-card UI in the `public/` row + eval-UI paragraph.
- `docs/plan.md`: fill in the M6 milestone entry (already stubbed) with statuses + verification notes, in the established style.
- `CLAUDE.md`: update the eval-UI paragraph (5 steps, shared modules, pure-GET hydration).
- Conventions (from CLAUDE.md, non-negotiable): handlers stay thin; only `config/` reads env; no narrating comments; `spikes/reparse-all.ts` is the parser regression harness if you touch the parser.

## Parked — do NOT build now

- **Handover 2: config-driven tag taxonomy.** Direction locked: taxonomy (`types[]` + ordered `scopes[]`, with descriptions) becomes data — default in code, global versioned override (same pattern as prompts), editor UI; the provider JSON-schema enums, an auto-generated axis-definition prompt suffix (like research's output contract), and both matrix renderers derive from it; each `TagSet` snapshots the taxonomy it was made with; code keeps owning one-placement dedupe (scope rank) and compliance gates. Spec will be written after teammates use the five-step view — what they see in research notes may change the axes they want.
- **React migration.** Trigger: the first genuinely interactive tooling (inline tag editing, side-by-side prompt comparisons, run-history browsing). Not before.
