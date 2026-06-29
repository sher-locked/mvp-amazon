import { NotImplementedError } from '../../lib/errors';
import type { Config } from '../../config';
import type { LlmClient, LlmRequest, LlmResponse } from '../client';

export class AnthropicClient implements LlmClient {
  readonly provider = 'anthropic' as const;

  constructor(private readonly config: Config) {}

  async complete(_req: LlmRequest): Promise<LlmResponse> {
    throw new NotImplementedError('AnthropicClient.complete');
  }
}
