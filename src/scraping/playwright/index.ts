import { chromium } from 'playwright';
import type { Scraper, ScrapedPage, ScrapeOptions } from '../scraper';

const DEFAULT_TIMEOUT_MS = 30_000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Local headless browser. First attempt for de-risking; Amazon's bot
 * protection may still block this without residential proxies — in which case
 * fall back to the BrightData scrapers. See spikes/scrape-pdp.ts.
 */
export class PlaywrightScraper implements Scraper {
  readonly kind = 'playwright' as const;

  async fetch(url: string, opts: ScrapeOptions = {}): Promise<ScrapedPage> {
    const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      const response = await page.goto(url, {
        waitUntil: opts.render ? 'networkidle' : 'domcontentloaded',
        timeout,
      });
      const html = await page.content();
      return { url, status: response?.status() ?? 0, html };
    } finally {
      await browser.close();
    }
  }
}
