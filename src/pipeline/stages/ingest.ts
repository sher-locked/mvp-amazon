import { ValidationError } from '../../lib/errors';
import type { ListingRef, Marketplace } from '../../domain/listing';

const ASIN_RE = /\b([A-Z0-9]{10})\b/;
const PATH_ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})/i;

const TLD_TO_MARKET: Record<string, Marketplace> = {
  com: 'US',
  'co.uk': 'UK',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  it: 'IT',
  in: 'IN',
  'co.jp': 'JP',
  ca: 'CA',
  'com.au': 'AU',
};

const MARKET_TO_TLD: Record<Marketplace, string> = {
  US: 'com',
  UK: 'co.uk',
  DE: 'de',
  FR: 'fr',
  ES: 'es',
  IT: 'it',
  IN: 'in',
  JP: 'co.jp',
  CA: 'ca',
  AU: 'com.au',
};

/** Fail loudly on unknown domains — a silent US fallback once turned a typo'd
 * amazon.co.in run into a fresh amazon.com scrape + research chain. */
function marketFromHost(host: string): Marketplace {
  const m = host.match(/amazon\.([a-z.]+)$/i);
  const tld = m?.[1]?.toLowerCase();
  if (!tld) throw new ValidationError(`not an amazon url: ${host}`);
  const market = TLD_TO_MARKET[tld];
  if (!market) {
    const nearest = Object.keys(TLD_TO_MARKET).find((known) => tld.endsWith(known));
    throw new ValidationError(
      `unsupported amazon domain "amazon.${tld}"` +
        (nearest ? ` — did you mean amazon.${nearest}?` : ''),
    );
  }
  return market;
}

function buildUrl(asin: string, market: Marketplace): string {
  return `https://www.amazon.${MARKET_TO_TLD[market]}/dp/${asin}`;
}

/** Rebuild a ListingRef from a stored-artifact dir name (`<MARKET>_<ASIN>`). */
export function refFromArtifactId(id: string): ListingRef | null {
  const m = /^([A-Z]{2})_([A-Z0-9]{10})$/.exec(id);
  const market = m?.[1];
  const asin = m?.[2];
  if (!market || !asin || !(market in MARKET_TO_TLD)) return null;
  const marketplace = market as Marketplace;
  return { asin, marketplace, url: buildUrl(asin, marketplace) };
}

/** Resolve a raw url/asin into a normalized ListingRef. */
export function ingest(input: string): ListingRef {
  const raw = input.trim();

  if (/^https?:\/\//i.test(raw)) {
    let host: string;
    try {
      host = new URL(raw).host;
    } catch {
      throw new ValidationError(`invalid url: ${raw}`);
    }
    const asin = raw.match(PATH_ASIN_RE)?.[1] ?? raw.match(ASIN_RE)?.[1];
    if (!asin) throw new ValidationError('could not find an ASIN in the url');
    const marketplace = marketFromHost(host);
    return { asin: asin.toUpperCase(), marketplace, url: buildUrl(asin.toUpperCase(), marketplace) };
  }

  const asin = raw.match(ASIN_RE)?.[1];
  if (!asin) throw new ValidationError('input is neither a valid url nor an ASIN');
  const marketplace: Marketplace = 'US';
  return { asin: asin.toUpperCase(), marketplace, url: buildUrl(asin.toUpperCase(), marketplace) };
}
