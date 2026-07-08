export type LlmProvider = 'anthropic' | 'openai' | 'perplexity';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  model?: string;
  /** resolved by the provider to a cheaper/faster model when configured */
  tier?: 'fast';
  temperature?: number;
  /** allow the provider to use web search where supported */
  web?: boolean;
  /** strict structured output: provider enforces this JSON schema on the reply */
  schema?: { name: string; schema: Record<string, unknown> };
}

export interface LlmResponse {
  text: string;
  /** URLs consulted when web search was enabled, where the provider reports them */
  sources?: string[];
  raw?: unknown;
}

/**
 * Provider-agnostic LLM contract. The only thing stages call. Concrete
 * providers live in llm/providers/* and are selected by `createLlmClient`.
 */
export interface LlmClient {
  readonly provider: LlmProvider;
  complete(req: LlmRequest): Promise<LlmResponse>;
}
