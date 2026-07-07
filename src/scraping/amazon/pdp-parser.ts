import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Listing, ListingImage, ListingRef } from '../../domain/listing';
import type { ScrapedPage } from '../scraper';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

interface ImageBlockEntry {
  hiRes?: string | null;
  large?: string | null;
  thumb?: string | null;
}

/**
 * Extract the `'colorImages': { 'initial': [...] }` array embedded in the
 * ImageBlockATF script. More reliable than the alt-image thumbnails, which
 * only carry tiny variants in the server-rendered HTML.
 */
function extractImageBlock(html: string): ImageBlockEntry[] {
  const marker = /['"]colorImages['"]:\s*\{\s*['"]initial['"]:\s*/.exec(html);
  if (!marker) return [];
  const start = marker.index + marker[0].length;
  if (html[start] !== '[') return [];

  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as ImageBlockEntry[];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function heroFromDom($: CheerioAPI): ListingImage | null {
  const img = $('#landingImage');
  if (!img.length) return null;
  const alt = clean(img.attr('alt') ?? '') || undefined;

  const hiRes = img.attr('data-old-hires');
  if (hiRes) return { url: hiRes, alt };

  const dynamic = img.attr('data-a-dynamic-image');
  if (dynamic) {
    try {
      const sizes = JSON.parse(dynamic) as Record<string, [number, number]>;
      const largest = Object.entries(sizes).sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0];
      if (largest) return { url: largest[0], alt };
    } catch {
      // fall through to src
    }
  }

  const src = img.attr('src');
  return src ? { url: src, alt } : null;
}

/**
 * Bullets live in `#feature-bullets` on most PDPs; fashion/softlines pages
 * instead render them under a "About this item" heading inside the product
 * facts expander.
 */
function extractBullets($: CheerioAPI): string[] {
  const standard = $('#feature-bullets ul li span.a-list-item')
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean);
  if (standard.length) return standard;

  const heading = $('#productFactsDesktopExpander h3.product-facts-title').filter(
    (_, el) => clean($(el).text()).toLowerCase() === 'about this item',
  );
  return heading
    .nextAll('ul')
    .first()
    .find('li span.a-list-item')
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean);
}

/**
 * A+ modules are marketing-designed HTML; pull the readable text (headings,
 * paragraphs, list items, image alt copy) as flat evidence. Amazon renders
 * duplicate `#aplus` ids — one per module block ("From the brand", "From the
 * manufacturer") — so walk them all. Best-effort; degrades to ''.
 */
function extractAplus($: CheerioAPI): string {
  const roots = $('#aplus');
  if (!roots.length) return '';
  roots.find('script, style, noscript').remove();

  const parts = roots
    .find('h1, h2, h3, h4, h5, p, li')
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean);

  // image-only A+ modules carry their copy in alt text
  const alts = roots
    .find('img[alt]')
    .map((_, el) => clean($(el).attr('alt') ?? ''))
    .get()
    .filter((alt) => alt.length > 3);

  return [...new Set([...parts, ...alts])].join('\n');
}

/**
 * Turn a scraped Amazon PDP into a structured Listing. Amazon markup varies
 * by category/marketplace, so missing pieces degrade to empty values rather
 * than throwing.
 */
export function parsePdp(ref: ListingRef, page: ScrapedPage): Listing {
  const $ = cheerio.load(page.html);

  const title = clean($('#productTitle').first().text());
  const bullets = extractBullets($);

  const description = clean($('#productDescription').first().text());
  const aplusContent = extractAplus($);

  const imageBlock = extractImageBlock(page.html);
  const blockImages: ListingImage[] = imageBlock
    .map((e) => e.hiRes || e.large || e.thumb)
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url }));

  const heroImage = blockImages[0] ?? heroFromDom($);
  const secondaryImages = blockImages.slice(1);

  return { ref, title, description, bullets, aplusContent, heroImage, secondaryImages };
}
