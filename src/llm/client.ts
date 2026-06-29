export type LlmProvider = 'anthropic' | 'openai' | 'perplexity';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  /** allow the provider to use web search where supported */
  web?: boolean;
}

export interface LlmResponse {
  text: string;
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
