# Spikes

Throwaway-ish experiments to de-risk the hard parts before hardening into `src/`.
Run with: `pnpm spike spikes/<file>.ts`

Order:

1. `scrape-pdp.ts` — can we read an Amazon PDP? Local Playwright first → BrightData Web Unlocker.
2. `probe-rufus.ts` — can we drive Rufus and read its results? BrightData Browser API.
3. `probe-llm-search.ts` — do ChatGPT/Claude/Perplexity surface the product (via headless web)?

Once a spike works, promote the logic into the matching `src/` module and delete the throwaway bits.
