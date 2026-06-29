/**
 * Spike 3 — check LLM-search visibility (ChatGPT / Claude / Perplexity).
 * Goal: ask a buyer-style query and see if our product/brand is surfaced.
 * Plan: prefer headless web (closest to a real shopper) over plain APIs.
 *
 * Run: pnpm spike spikes/probe-llm-search.ts "<query>"
 */
async function main(): Promise<void> {
  const query = process.argv[2] ?? 'recommend a good ... under $50';
  console.log({ query });

  // TODO: drive each surface via headless web (BrightData browser) and capture answers.
  // TODO: optionally compare with provider APIs (with web search enabled).
  // TODO: detect brand/product mentions + citations; record evidence.
  console.log('next: automate chatgpt/claude/perplexity web, capture + parse answers');
}

void main();
