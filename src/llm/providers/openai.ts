import { AppError } from '../../lib/errors';
import type { Config } from '../../config';
import type { LlmClient, LlmMessage, LlmRequest, LlmResponse } from '../client';

const API_URL = 'https://api.openai.com/v1/responses';

interface OutputTextPart {
  type: string;
  text?: string;
}

interface OutputItem {
  type: string;
  content?: OutputTextPart[];
  action?: { sources?: { url?: string }[] };
}

interface ResponsesPayload {
  output?: OutputItem[];
  error?: { message?: string } | null;
}

function toInput(messages: LlmMessage[]): { role: string; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * OpenAI Responses API client. Supports built-in web search (`web: true`,
 * source URLs surfaced via `include`) and strict structured output (`schema`).
 */
export class OpenAiClient implements LlmClient {
  readonly provider = 'openai' as const;

  constructor(private readonly config: Config) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const apiKey = this.config.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError('OPENAI_API_KEY is not set; add it to .env', 500, 'CONFIG');
    }

    const body: Record<string, unknown> = {
      model: req.model ?? this.config.OPENAI_MODEL,
      input: toInput(req.messages),
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.web) {
      body.tools = [{ type: 'web_search' }];
      body.include = ['web_search_call.action.sources'];
    }
    if (req.schema) {
      body.text = {
        format: {
          type: 'json_schema',
          name: req.schema.name,
          strict: true,
          schema: req.schema.schema,
        },
      };
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await res.json().catch(() => null)) as ResponsesPayload | null;
    if (!res.ok || !payload) {
      const detail = payload?.error?.message ?? `HTTP ${res.status}`;
      throw new AppError(`openai responses api failed: ${detail}`, 502, 'LLM');
    }

    // parse output items by type — reasoning models interleave reasoning items
    const items = payload.output ?? [];
    const text = items
      .filter((i) => i.type === 'message')
      .flatMap((i) => i.content ?? [])
      .filter((p) => p.type === 'output_text' && p.text)
      .map((p) => p.text)
      .join('');
    if (!text) {
      throw new AppError('openai response contained no output text', 502, 'LLM');
    }

    const sources = [
      ...new Set(
        items
          .filter((i) => i.type === 'web_search_call')
          .flatMap((i) => i.action?.sources ?? [])
          .map((s) => s.url)
          .filter((u): u is string => Boolean(u)),
      ),
    ];

    return { text, ...(sources.length ? { sources } : {}), raw: payload };
  }
}
