import { AppError } from '../../lib/errors';
import type { Config } from '../../config';
import type { Scraper, ScrapedPage, ScrapeOptions } from '../scraper';

const API_URL = 'https://api.brightdata.com/request';

/**
 * BrightData Web Unlocker. Workhorse for fetching the Amazon PDP HTML:
 * handles proxy rotation, CAPTCHAs, and geo via a single request API.
 */
export class BrightDataUnlockerScraper implements Scraper {
  readonly kind = 'brightdata-unlocker' as const;

  constructor(private readonly config: Config) {}

  async fetch(url: string, opts: ScrapeOptions = {}): Promise<ScrapedPage> {
    const token = this.config.BRIGHTDATA_UNLOCKER_TOKEN;
    const zone = this.config.BRIGHTDATA_UNLOCKER_ZONE;
    if (!token || !zone) {
      throw new AppError(
        'BRIGHTDATA_UNLOCKER_TOKEN and BRIGHTDATA_UNLOCKER_ZONE must be set to use the brightdata-unlocker scraper',
        500,
        'CONFIG',
      );
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        zone,
        url,
        format: 'raw',
        ...(opts.country ? { country: opts.country } : {}),
      }),
      signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
    });

    const html = await res.text();
    if (!res.ok) {
      throw new AppError(
        `brightdata unlocker request failed (${res.status}): ${html.slice(0, 300)}`,
        502,
        'UPSTREAM',
      );
    }
    return { url, status: res.status, html };
  }
}
