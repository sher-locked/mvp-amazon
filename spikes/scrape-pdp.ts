/**
 * Spike 1 — read an Amazon PDP.
 * Goal: get title + images out of a real product page.
 * Plan: try local Playwright; if Amazon blocks, switch to BrightData Web Unlocker.
 *
 * Run: pnpm spike spikes/scrape-pdp.ts "<amazon-url-or-asin>"
 */
import { ingest } from '../src/pipeline/stages/ingest';

async function main(): Promise<void> {
  const input = process.argv[2] ?? 'B08N5WRWNW';
  const ref = ingest(input);
  console.log('resolved listing ref:', ref);

  // TODO(playwright): launch headless chromium, goto ref.url, dump html/title.
  // TODO(fallback): if blocked/captcha, fetch ref.url via BrightData Web Unlocker.
  // TODO: feed html into src/scraping/amazon/pdp-parser.ts and inspect the Listing.
  console.log('next: implement playwright fetch, then brightdata unlocker fallback');
}

void main();
