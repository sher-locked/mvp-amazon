import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),

  DEFAULT_SCRAPER: z
    .enum(['playwright', 'brightdata-unlocker', 'brightdata-browser'])
    .default('brightdata-unlocker'),
  DEFAULT_LLM: z.enum(['anthropic', 'openai', 'perplexity']).default('anthropic'),

  BRIGHTDATA_UNLOCKER_TOKEN: z.string().optional(),
  BRIGHTDATA_UNLOCKER_ZONE: z.string().optional(),
  BRIGHTDATA_BROWSER_WSE: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.5'),
  PERPLEXITY_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env) {
    try {
      process.loadEnvFile();
    } catch {
      // no .env file; rely on the ambient environment
    }
  }
  return schema.parse(env);
}
