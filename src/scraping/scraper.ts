export type ScraperKind = 'playwright' | 'brightdata-unlocker' | 'brightdata-browser';

export interface ScrapeOptions {
  /** wait for full client-side render (browser-based scrapers only) */
  render?: boolean;
  timeoutMs?: number;
  /** ISO country for proxy egress (proxy-based scrapers only) */
  country?: string;
}

export interface ScrapedPage {
  url: string;
  status: number;
  html: string;
}

/**
 * Thin contract every scraping provider implements. Stages depend on this,
 * never on a concrete provider. Choose an impl via `createScraper`.
 */
export interface Scraper {
  readonly kind: ScraperKind;
  fetch(url: string, opts?: ScrapeOptions): Promise<ScrapedPage>;
}
