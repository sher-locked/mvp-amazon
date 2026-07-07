import { AppError } from '../lib/errors';

/** Parse a JSON reply, tolerating markdown code fences some models emit. */
export function parseJsonReply(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    throw new AppError('llm returned invalid JSON', 502, 'LLM');
  }
}
