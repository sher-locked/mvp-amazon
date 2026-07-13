# claude.md — Working Context

Agent-facing guide. Read before changing code. Keep it true; update it when architecture shifts. For deeper structure see `docs/design.md`; for scope/progress see `docs/plan.md`.

## Intent

One job: take an Amazon listing (URL/ASIN) and evaluate its content for **discoverability** (human + agentic) and **purchasability** (conversion). Output: scores on three axes + prioritized content fixes.

## Domain Model

The unit of work is an **evaluation run** over one **listing**.

- `Listing` — `{ ref, title, description, bullets, aplusContent, heroImage, secondaryImages[] }`
- `Identity` — the SKU tuple `{brand} × {category} × {variantAttributes} × {size}`; `displayName` derived, never parsed
- `Tag` — atomic claim on two axes: `type` (fact|functional|sensory|emotional|occasion|audience) × `scope` (brand|category|family|sku), stored once at its highest true scope (see `docs/reference/sku-tags.md`)
- `SkuResearch` — call-1 output `{ identity, notes, sources[] }`; `TagSet` — call-2 output `{ identity, tags[] }`, what downstream consumes
- `Evaluation` — `{ content, rufus, llmSearch }`
- `GeneratedListing` — the four post-July-2026 fields `{ title, itemHighlights, bullets, description }`, each with code-counted `chars` + `rationale` (see `docs/reference/amazon-generation-prompts.md`)
- `Run` — `{ id, input, status, stages, result }`; status moves `queued → running → done | failed`

## Composable Steps (the spine)

The pipeline is a sequence of small steps in `pipeline/stages/`:

`ingest → scrape → parse → research → tag → evaluate(content, rufus, llm-search) → generate`

Each step takes typed input, returns typed output, and never reaches into another step's internals. `research` (web-enabled LLM, expensive) and `tag` (strict structured output, cheap) mirror the scrape/parse split — the intermediate is persisted so re-bucketing is free. `generate` makes ONE single-shot schema-strict fast-tier call producing all four fields in order (`llm/prompts/generate/listing.ts`); hard char limits and mechanical compliance gates live in code, not prompts — all violations are collected into one corrective full-document re-prompt. Steps are exposed two ways, both calling the same functions:

- **Individually** — synchronous endpoints (`/scrape`, `/parse`, `/research`, `/tags`, `/evaluate/*`, `/generate`) for de-risking and reuse.
- **Together** — the async pipeline via `pipeline/orchestrator.ts`, which owns sequencing and run status (`/runs`).

A static dark-mode eval UI (`public/index.html`, served by `@fastify/static`) shows all five stages as independent cards for teammates — each hydrates from its pure GET (`/scrape`, `/parse`, `/research`, `/tags`, `/generate` — reads never persist), every POST is an explicit button with its cost in the label, and chain/prompt staleness is hinted (never auto-run) via the provenance stamps each artifact carries (`sourceFetchedAt`/`sourceParsedAt`/`sourceResearchedAt`/`sourceTaggedAt` + `usage`/`durationMs`). Both pages import `public/shared.css` + `shared.js` (ES module: tokens, api/esc, renderers, `STEP_ESTIMATES`/`PRICES` cost constants — rates are user-set placeholders); vanilla JS, no build step, React deferred. The three LLM system prompts are teammate-editable via `public/prompts.html` + `GET/PUT/DELETE /prompts` — defaults live in the prompt files, `llm/prompts/registry.ts` resolves override-else-default per call, overrides are global + versioned under `tmp/prompts/`, and every research/tags/generate artifact records the `promptVersion` that made it. Only the system prompt is editable: user-message wiring, output schemas, char limits, and research's appended `## Output` contract stay in code. When `ACCESS_KEY` is set, `server/access-guard.ts` requires `x-access-key` on every route except the UI pages + `shared.*` assets and `/health`; unset disables the guard (local dev). Artifact store base dir is `ARTIFACTS_DIR` (default `<cwd>/tmp`; a Railway volume in prod — see `docs/deploy.md`).

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
