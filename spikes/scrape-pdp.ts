/**
 * Spike 1 — feel out local Playwright against real Amazon PDPs.
 * Fetches each URL with the local PlaywrightScraper and reports whether Amazon
 * served the real product page or a bot wall / CAPTCHA.
 *
 * Run:
 *   pnpm spike spikes/scrape-pdp.ts
 *   pnpm spike spikes/scrape-pdp.ts "<url-or-asin>" "<url-or-asin>" ...
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ingest } from '../src/pipeline/stages/ingest';
import { PlaywrightScraper } from '../src/scraping/playwright';

const DEFAULTS = [
  'https://www.amazon.com/dp/B0CG9CW14Q/',
  'https://www.amazon.in/dp/B07M8H2HR4/',
];

const BLOCK_MARKERS = [
  'Type the characters you see in this image',
  'Enter the characters you see below',
  "make sure you're not a robot",
  'To discuss automated access to Amazon data',
  'Click the button below to continue shopping',
  'api-services-support@amazon.com',
  'Robot Check',
  'captcha',
];

const CONTENT_MARKERS = ['id="productTitle"', 'feature-bullets', 'landingImage'];

const pick = (html: string, markers: string[]) =>
  markers.filter((m) => html.toLowerCase().includes(m.toLowerCase()));

const extract = (html: string, re: RegExp) => html.match(re)?.[1]?.trim();

async function probe(scraper: PlaywrightScraper, input: string, outDir: string): Promise<void> {
  const ref = ingest(input);
  const startedAt = Date.now();
  try {
    const page = await scraper.fetch(ref.url);
    const elapsedMs = Date.now() - startedAt;

    const blockedBy = pick(page.html, BLOCK_MARKERS);
    const contentHits = pick(page.html, CONTENT_MARKERS);
    const pageTitle = extract(page.html, /<title[^>]*>([^<]*)<\/title>/i);
    const productTitle = extract(page.html, /id="productTitle"[^>]*>([^<]+)</i);

    const file = join(outDir, `${ref.asin}-${ref.marketplace}.html`);
    writeFileSync(file, page.html);

    console.log(`\n=== ${ref.marketplace}  ${ref.asin}  (${ref.url}) ===`);
    console.log(`  http status   : ${page.status}`);
    console.log(`  elapsed       : ${elapsedMs} ms`);
    console.log(`  html length   : ${page.html.length}`);
    console.log(`  <title>       : ${pageTitle ?? '(none)'}`);
    console.log(`  blocked?      : ${blockedBy.length ? `YES → ${blockedBy.join(', ')}` : 'no'}`);
    console.log(`  content found : ${contentHits.length ? contentHits.join(', ') : '(none)'}`);
    console.log(`  #productTitle : ${productTitle ?? '(not found)'}`);
    console.log(`  saved html    : ${file}`);
  } catch (err) {
    console.log(`\n=== ${ref.marketplace}  ${ref.asin} ===`);
    console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  const inputs = process.argv.slice(2);
  const targets = inputs.length ? inputs : DEFAULTS;
  const outDir = join(process.cwd(), 'tmp', 'scrape');
  mkdirSync(outDir, { recursive: true });

  const scraper = new PlaywrightScraper();
  for (const input of targets) {
    await probe(scraper, input, outDir);
  }
  console.log('\nInspect the saved html to see exactly what Amazon returned.');
}

void main();
