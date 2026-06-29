import type { Config } from '../config';
import type { LlmClient, LlmProvider } from './client';
import { AnthropicClient } from './providers/anthropic';
import { OpenAiClient } from './providers/openai';
import { PerplexityClient } from './providers/perplexity';

export type { LlmClient, LlmProvider, LlmMessage, LlmRequest, LlmResponse } from './client';

export function createLlmClient(provider: LlmProvider, config: Config): LlmClient {
  switch (provider) {
    case 'anthropic':
      return new AnthropicClient(config);
    case 'openai':
      return new OpenAiClient(config);
    case 'perplexity':
      return new PerplexityClient(config);
  }
}
