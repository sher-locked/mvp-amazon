import { NotImplementedError } from '../../lib/errors';
import type { Config } from '../../config';
import type { Scraper, ScrapedPage, ScrapeOptions } from '../scraper';

/**
 * BrightData Web Unlocker. Workhorse for fetching the Amazon PDP HTML:
 * handles proxy rotation, CAPTCHAs, and geo via a single request API.
 */
export class BrightDataUnlockerScraper implements Scraper {
  readonly kind = 'brightdata-unlocker' as const;

  constructor(private readonly config: Config) {}

  async fetch(_url: string, _opts?: ScrapeOptions): Promise<ScrapedPage> {
    throw new NotImplementedError('BrightDataUnlockerScraper.fetch (phase 1)');
  }
}
