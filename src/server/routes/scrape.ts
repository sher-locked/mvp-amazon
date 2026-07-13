import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { NotFoundError } from '../../lib/errors';
import { getScrapeQuery, scrapeBody, scrapeQuery } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { scrape } from '../../pipeline/stages/scrape';

/**
 * Inject <base> so the page's relative asset URLs resolve against Amazon when
 * the stored HTML is rendered in a browser. View-time only — artifacts stay pristine.
 */
function withBaseHref(html: string, url: string): string {
  const href = url.replace(/"/g, '&quot;');
  return html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}<base href="${href}">`);
}

/**
 * Composable step: url/asin → raw PDP HTML (persisted). POST fetches fresh
 * (BrightData spend); GET is a pure read of the latest stored scrape. Both
 * return provenance only by default; pass `?include=html` for the multi-MB body,
 * or `?view=html` (GET) to render the stored page itself.
 */
export function registerScrapeRoutes(app: FastifyInstance, c: Container): void {
  app.post('/scrape', async (req, reply) => {
    const { input, scraper: kind, country } = scrapeBody.parse(req.body);
    const { include } = scrapeQuery.parse(req.query);

    const ref = ingest(input);
    const scraper = c.getScraper(kind);
    const ctx = { ...c.ctx, scraper };
    const { page, meta } = await scrape(ref, ctx, { country });

    return reply.send({
      ref,
      meta: { ...meta, bytes: Buffer.byteLength(page.html) },
      blocked: meta.blocked,
      ...(include === 'html' ? { html: page.html } : {}),
    });
  });

  // read-only view of the latest stored scrape — no fetch, no spend
  app.get('/scrape', async (req, reply) => {
    const { input, include, view } = getScrapeQuery.parse(req.query);

    const ref = ingest(input);
    const stored = await c.ctx.artifacts.loadRaw(ref);
    if (!stored) {
      throw new NotFoundError(
        `no stored scrape for ${ref.marketplace}_${ref.asin}; run POST /scrape first`,
      );
    }

    if (view === 'html') {
      // sandbox: unique origin, scripts blocked — third-party page JS must not
      // run on this origin (localStorage holds the access key)
      return reply
        .header('content-security-policy', 'sandbox')
        .type('text/html; charset=utf-8')
        .send(withBaseHref(stored.html, stored.meta.url));
    }

    return reply.send({
      ref,
      meta: { ...stored.meta, bytes: Buffer.byteLength(stored.html) },
      ...(include === 'html' ? { html: stored.html } : {}),
    });
  });
}
