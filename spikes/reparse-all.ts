/**
 * Regression check for parser changes: re-parse every stored scrape in
 * tmp/scrape with the CURRENT parser and diff against the latest stored
 * parse artifact in tmp/parse. Run: npx tsx spikes/reparse-all.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parsePdp } from '../src/scraping/amazon/pdp-parser';
import type { Listing, ListingRef, Marketplace } from '../src/domain/listing';

const SCRAPE = 'tmp/scrape';
const PARSE = 'tmp/parse';

const latestJson = <T>(dir: string): T | null => {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json') && f !== 'latest.json')
      .sort();
    const last = files.at(-1);
    return last ? (JSON.parse(readFileSync(join(dir, last), 'utf8')) as T) : null;
  } catch {
    return null;
  }
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

for (const refDir of readdirSync(SCRAPE).sort()) {
  const meta = JSON.parse(readFileSync(join(SCRAPE, refDir, 'latest.json'), 'utf8')) as {
    file: string;
    url: string;
    status: number;
  };
  const html = readFileSync(join(SCRAPE, refDir, meta.file), 'utf8');
  const [marketplace, asin] = refDir.split('_') as [Marketplace, string];
  const ref: ListingRef = { asin, marketplace, url: meta.url };
  const next = parsePdp(ref, { url: meta.url, status: meta.status, html });

  const prev = latestJson<Listing>(join(PARSE, refDir));
  console.log(`\n=== ${refDir} ===`);
  if (!prev) {
    console.log('no stored parse — fresh description:', JSON.stringify(next.description.slice(0, 200)));
    continue;
  }

  console.log('title unchanged:  ', prev.title === next.title);
  console.log('bullets unchanged:', same(prev.bullets, next.bullets), `(${next.bullets.length})`);
  console.log(
    'images unchanged: ',
    same(prev.heroImage, next.heroImage) && same(prev.secondaryImages, next.secondaryImages),
    `(hero + ${next.secondaryImages.length} secondary)`,
  );
  console.log('aplus unchanged:  ', prev.aplusContent === next.aplusContent, `(${next.aplusContent.length} chars)`);
  if (prev.description === next.description) {
    console.log('description unchanged', `(${next.description.length} chars)`);
  } else {
    console.log(`description BEFORE (${prev.description.length}):`, JSON.stringify(prev.description.slice(0, 350)));
    console.log(`description AFTER  (${next.description.length}):`, JSON.stringify(next.description.slice(0, 350)));
  }
}
