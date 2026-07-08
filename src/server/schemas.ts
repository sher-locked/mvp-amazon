import { z } from 'zod';
import type { Listing } from '../domain/listing';
import type { Identity, Tag, TagSet } from '../domain/research';
import type { Evaluation } from '../domain/evaluation';

const marketplace = z.enum(['US', 'UK', 'DE', 'FR', 'ES', 'IT', 'IN', 'JP', 'CA', 'AU']);

const image = z.object({ url: z.string(), alt: z.string().optional() });

export const listingSchema = z.object({
  ref: z.object({ asin: z.string(), marketplace, url: z.string().url() }),
  title: z.string(),
  description: z.string(),
  bullets: z.array(z.string()),
  // default keeps parse artifacts stored before aplusContent existed loadable
  aplusContent: z.string().default(''),
  heroImage: image.nullable(),
  secondaryImages: z.array(image),
}) satisfies z.ZodType<Listing, z.ZodTypeDef, unknown>;

export const identitySchema = z.object({
  brand: z.object({ name: z.string(), parentBrand: z.string().nullable() }),
  category: z.string(),
  family: z.object({ name: z.string(), variantAttributes: z.record(z.string()) }),
  sku: z.record(z.string()),
  displayName: z.string(),
}) satisfies z.ZodType<Identity>;

export const tagSchema = z.object({
  value: z.string(),
  type: z.enum(['fact', 'functional', 'sensory', 'emotional', 'occasion', 'audience']),
  scope: z.enum(['brand', 'category', 'family', 'sku']),
  complianceSensitive: z.boolean(),
  source: z.enum(['observed', 'inferred']),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
}) satisfies z.ZodType<Tag>;

export const tagSetSchema = z.object({
  identity: identitySchema,
  tags: z.array(tagSchema),
}) satisfies z.ZodType<TagSet>;

const score = z.object({ value: z.number(), max: z.number(), notes: z.string().optional() });

const discoverability = z.object({
  channel: z.enum(['rufus', 'llm-search']),
  searchable: z.boolean(),
  retrievable: z.boolean(),
  recommended: z.boolean(),
  evidence: z.array(z.string()),
});

export const evaluationSchema = z.object({
  content: z.object({
    assets: z.array(
      z.object({
        asset: z.enum(['title', 'description', 'hero', 'secondary']),
        score,
        findings: z.array(z.string()),
      }),
    ),
    overall: score,
  }),
  rufus: discoverability,
  llmSearch: discoverability,
}) satisfies z.ZodType<Evaluation>;

export const scraperKind = z.enum(['playwright', 'brightdata-unlocker', 'brightdata-browser']);

export const scrapeBody = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
  scraper: scraperKind.optional(),
  country: z.string().length(2).optional(),
});

export const scrapeQuery = z.object({ include: z.enum(['html']).optional() });

export const parseBody = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
  scraper: scraperKind.optional(),
  refetch: z.boolean().optional(),
});
export const researchBody = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
});

export const tagsBody = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
  refresh: z.boolean().optional(),
});

export const tagsQuery = z.object({ include: z.enum(['matrix']).optional() });

export const getTagsQuery = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
  include: z.enum(['matrix']).optional(),
});

export const evaluateBody = z.object({ listing: listingSchema, tags: tagSetSchema });

export const generateBody = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
  refresh: z.boolean().optional(),
  only: z.enum(['title', 'highlights', 'bullets', 'description']).optional(),
});

export const getGenerateQuery = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
});
