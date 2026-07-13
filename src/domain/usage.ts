/**
 * Observed LLM spend for one stage run. Approximate by design: token usage
 * misses web-search tool billing, so downstream cost math must stay labeled ≈.
 */
export interface LlmUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}
