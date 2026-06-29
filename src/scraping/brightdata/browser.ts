import { NotImplementedError } from '../../lib/errors';
import type { Config } from '../../config';
import type { Scraper, ScrapedPage, ScrapeOptions } from '../scraper';

/**
 * BrightData Browser API (remote Chrome over CDP/websocket). Needed where we
 * must drive a real, interactive session — e.g. probing Rufus. Connects via
 * BRIGHTDATA_BROWSER_WSE.
 */
export class BrightDataBrowserScraper implements Scraper {
  readonly kind = 'brightdata-browser' as const;

  constructor(private readonly config: Config) {}

  async fetch(_url: string, _opts?: ScrapeOptions): Promise<ScrapedPage> {
    throw new NotImplementedError('BrightDataBrowserScraper.fetch (phase 2)');
  }
}
