import { z } from 'zod';
import type { Listing } from '../domain/listing';
import type { SourceOfTruth } from '../domain/research';
import type { Evaluation } from '../domain/evaluation';

const marketplace = z.enum(['US', 'UK', 'DE', 'FR', 'ES', 'IT', 'IN', 'JP', 'CA', 'AU']);

const image = z.object({ url: z.string(), alt: z.string().optional() });

export const listingSchema = z.object({
  ref: z.object({ asin: z.string(), marketplace, url: z.string().url() }),
  title: z.string(),
  description: z.string(),
  bullets: z.array(z.string()),
  heroImage: image.nullable(),
  secondaryImages: z.array(image),
}) satisfies z.ZodType<Listing>;

export const sourceOfTruthSchema = z.object({
  claims: z.array(
    z.object({
      scope: z.enum(['brand', 'product', 'category']),
      text: z.string(),
      source: z.string().optional(),
      confidence: z.number().optional(),
    }),
  ),
  keywords: z.array(z.string()),
}) satisfies z.ZodType<SourceOfTruth>;

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

export const scrapeBody = z.object({ input: z.string().min(1, 'input (url or ASIN) is required') });
export const researchBody = z.object({ listing: listingSchema });
export const evaluateBody = z.object({ listing: listingSchema, sourceOfTruth: sourceOfTruthSchema });
export const recommendBody = evaluateBody.extend({ evaluation: evaluationSchema });
