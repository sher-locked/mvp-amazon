import { NotImplementedError } from '../../lib/errors';
import type { Scraper, ScrapedPage, ScrapeOptions } from '../scraper';

/**
 * Local headless browser. First attempt for de-risking; expect Amazon
 * bot-protection to block this without residential proxies. See spikes/.
 */
export class PlaywrightScraper implements Scraper {
  readonly kind = 'playwright' as const;

  async fetch(_url: string, _opts?: ScrapeOptions): Promise<ScrapedPage> {
    throw new NotImplementedError('PlaywrightScraper.fetch (phase 1)');
  }
}
