# meobyr — Amazon Listing Evaluator

Evaluate an Amazon listing for **discoverability** (human + agentic search) and **purchasability** (conversion).

Give it a URL or ASIN. It scrapes the product detail page, researches the brand/product to build a source-of-truth, then scores the listing on three axes and recommends concrete content changes.

## Why

Amazon shoppers increasingly arrive via agents — Rufus (Amazon's shopping agent) and general LLMs (ChatGPT, Claude, Perplexity). A listing can rank fine for keyword search yet be invisible to agents, or visible but unconvincing. meobyr measures both and tells you what to fix.

## How It Works

The work decomposes into small, composable steps over one listing:

1. **Ingest** — normalize URL/ASIN → `{ asin, marketplace }`.
2. **Scrape** — pull title, description/bullets, hero image, secondary images from the PDP.
3. **Research** — web/agentic search + LLM synthesis → hierarchical source-of-truth (brand claims, product claims, category, target keywords).
4. **Evaluate** — three axes:
   - **Content** — listing vs Amazon guidelines + marketing rubric (custom prompts per asset).
   - **Rufus** — is the product searchable / retrievable / recommended by Amazon's Rufus agent.
   - **LLM search** — is the product surfaced by ChatGPT / Claude / Perplexity (via headless web).
5. **Recommend** — synthesize prioritized content changes.

Each step is exposed as its own endpoint (call one part in isolation), and they also run together via the orchestrated async pipeline (`/runs`).

## Stack

- **Node + TypeScript**, **pnpm**
- **Fastify + Zod** — HTTP API, schema-validated
- **Playwright** — local headless browser (first attempt)
- **BrightData** — Web Unlocker (PDP) + Browser API (Rufus), as cleanly separated modules
- **LLM** — provider-agnostic client (Anthropic / OpenAI / Perplexity)

## API

Composable steps are synchronous; the full pipeline is async.

| Method | Path                   | Purpose                                          |
| ------ | ---------------------- | ------------------------------------------------ |
| POST   | `/scrape`              | URL/ASIN → listing (the 4 parts)                 |
| POST   | `/research`            | listing → source-of-truth                        |
| POST   | `/evaluate/content`    | listing + source-of-truth → content scores       |
| POST   | `/evaluate/rufus`      | listing + source-of-truth → Rufus discoverability |
| POST   | `/evaluate/llm-search` | listing + source-of-truth → LLM-search discoverability |
| POST   | `/recommend`           | listing + source-of-truth + evaluation → changes |
| POST   | `/runs`                | run the full pipeline; returns a runId           |
| GET    | `/runs/:id`            | run status + result                              |
| GET    | `/health`              | liveness                                         |

## Status

MVP, de-risking in order:

1. ⬜ Scrape Amazon PDP from URL/ASIN
2. ⬜ Probe Rufus programmatically
3. ⬜ Probe ChatGPT / Claude / Perplexity programmatically

Auth (company-email OTP), payments, and persistence are scaffolded as thin interfaces with stub implementations; real versions come later.

## Getting Started

```bash
pnpm install
cp .env.example .env   # fill in BrightData + LLM keys
pnpm dev
```

## Docs

- `docs/design.md` — structure, module intents, routes, DB placeholders.
- `docs/plan.md` — step-wise plan and progress tracker.
- `claude.md` — agent-facing working context.

## Env

See `.env.example`. Core keys: `BRIGHTDATA_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`.
