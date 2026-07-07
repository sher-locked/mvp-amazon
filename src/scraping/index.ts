import type { Config } from '../config';
import type { Scraper, ScraperKind } from './scraper';
import { PlaywrightScraper } from './playwright';
import { BrightDataUnlockerScraper } from './brightdata/unlocker';
import { BrightDataBrowserScraper } from './brightdata/browser';

export type { Scraper, ScraperKind, ScrapedPage, ScrapeOptions } from './scraper';

export function createScraper(kind: ScraperKind, config: Config): Scraper {
  switch (kind) {
    case 'playwright':
      return new PlaywrightScraper();
    case 'brightdata-unlocker':
      return new BrightDataUnlockerScraper(config);
    case 'brightdata-browser':
      return new BrightDataBrowserScraper(config);
  }
}

export type ScraperResolver = (kind?: ScraperKind) => Scraper;

/** Lazily builds and memoizes one scraper per kind; default from config. */
export function createScraperResolver(config: Config): ScraperResolver {
  const cache = new Map<ScraperKind, Scraper>();
  return (kind = config.DEFAULT_SCRAPER) => {
    let scraper = cache.get(kind);
    if (!scraper) {
      scraper = createScraper(kind, config);
      cache.set(kind, scraper);
    }
    return scraper;
  };
}
