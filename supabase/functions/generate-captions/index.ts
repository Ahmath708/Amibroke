import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { submitCaptionsTool } from './tool.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const SYSTEM_PROMPT = Deno.readTextFileSync(
  new URL('./prompts/system.txt', import.meta.url),
);
if (!SYSTEM_PROMPT || SYSTEM_PROMPT.length < 100) {
  throw new Error('system.txt missing or truncated');
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const API_URL = 'https://api.anthropic.com/v1/messages';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
};
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const VALID_TONES = new Set(['savage', 'gentle', 'therapist', 'older_sibling', 'finance_bro']);

function validateRequest(body: any): { valid: boolean; error?: string; parsed?: { score: number; scoreLabel: string; roast: string; tone: string } } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object' };
  const { score, scoreLabel, roast, tone } = body;
  if (typeof score !== 'number' || score < 0 || score > 100) return { valid: false, error: 'score must be a number 0-100' };
  if (typeof scoreLabel !== 'string') return { valid: false, error: 'scoreLabel is required' };
  if (typeof roast !== 'string' || roast.length === 0) return { valid: false, error: 'roast is required' };
  if (!VALID_TONES.has(tone)) return { valid: false, error: `Invalid tone: ${tone}` };
  return { valid: true, parsed: { score, scoreLabel, roast, tone } };
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers = { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders };
  return new Response(JSON.stringify(body), { status, headers });
}

function sanitizeCaptions(raw: any): string[] {
  const captions = Array.isArray(raw?.captions) ? raw.captions.slice(0, 3) : [];
  return captions.map((c: any) => typeof c === 'string' && c.length > 150 ? c.slice(0, 150) : String(c ?? ''));
}

async function callClaude(messages: Array<{ role: string; content: string }>, attempt = 0): Promise<any> {
  if (attempt >= MAX_RETRIES) {
    const error: any = new Error('Claude upstream unavailable after retries');
    error.stage = 'upstream_unavailable';
    error.status = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        temperature: 0.8,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [submitCaptionsTool],
        tool_choice: { type: 'tool', name: 'submit_captions' },
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      console.warn('[generate-captions] Rate limited, retrying after', retryAfter, 's', `(attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callClaude(messages, attempt + 1);
    }

    if (response.status >= 500) {
      console.warn(`[generate-captions] Server error ${response.status}, retrying... (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, 2000));
      return callClaude(messages, attempt + 1);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let apiMessage = `Claude API error: ${response.status}`;
      try { const parsed = JSON.parse(errorBody); if (parsed.error?.message) apiMessage = `Claude API error: ${parsed.error.message}`; } catch { /* ignore */ }
      const error: any = new Error(apiMessage);
      error.status = response.status;
      error.stage = 'claude_api_error';
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[generate-captions] Request timed out after ${UPSTREAM_TIMEOUT_MS}ms (attempt ${attempt + 1})`);
      if (attempt + 1 < MAX_RETRIES) return callClaude(messages, attempt + 1);
      const error: any = new Error('Claude upstream timeout');
      error.stage = 'upstream_timeout';
      error.status = 504;
      throw error;
    }
    if (err.stage) throw err;
    throw err;
  }
}

async function callGroq(messages: Array<{ role: string; content: string }>, attempt = 0): Promise<any> {
  if (attempt >= MAX_RETRIES) {
    const error: any = new Error('Groq upstream unavailable after retries');
    error.stage = 'upstream_unavailable';
    error.status = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        temperature: 0.8,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      console.warn(`[generate-captions] Groq rate limited, retrying after ${retryAfter}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callGroq(messages, attempt + 1);
    }

    if (response.status >= 500) {
      console.warn(`[generate-captions] Groq server error ${response.status}, retrying... (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, 2000));
      return callGroq(messages, attempt + 1);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let apiMessage = `Groq API error: ${response.status}`;
      try { const parsed = JSON.parse(errorBody); if (parsed.error?.message) apiMessage = `Groq API error: ${parsed.error.message}`; } catch { /* ignore */ }
      const error: any = new Error(apiMessage);
      error.status = response.status;
      error.stage = 'groq_api_error';
      throw error;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let parsed: any;
    try {
      const cleaned = content.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const error: any = new Error('Failed to parse Groq response as JSON');
      error.stage = 'parse_error';
      error.rawResponse = content;
      throw error;
    }

    return parsed;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[generate-captions] Groq request timed out after ${UPSTREAM_TIMEOUT_MS}ms (attempt ${attempt + 1})`);
      if (attempt + 1 < MAX_RETRIES) return callGroq(messages, attempt + 1);
      const error: any = new Error('Groq upstream timeout');
      error.stage = 'upstream_timeout';
      error.status = 504;
      throw error;
    }
    if (err.stage) throw err;
    throw err;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed', stage: 'request_validation' }, 405);

  try {
    const body = await req.json();
    const { provider } = body;
    const selectedProvider = provider === 'groq' ? 'groq' : 'claude';

    const validation = validateRequest(body);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error, stage: 'request_validation' }, 400);
    }
    const parsedBody = validation.parsed!;

    await enforceRateLimit(req, 'generate-captions');

    if (selectedProvider === 'groq' && !GROQ_API_KEY) return jsonResponse({ error: 'Groq API key not set', stage: 'config_error' }, 500);
    if (selectedProvider === 'claude' && !ANTHROPIC_API_KEY) return jsonResponse({ error: 'Claude API key not set', stage: 'config_error' }, 500);

    const userMessage = JSON.stringify(parsedBody);
    const messages = [{ role: 'user', content: userMessage }];

    let rawOutput: any;

    if (selectedProvider === 'groq') {
      rawOutput = await callGroq(messages);
    } else {
      const data = await callClaude(messages);
      const toolUse = data.content.find((c: any) => c.type === 'tool_use');
      if (!toolUse) {
        const error: any = new Error('No tool_use block in response');
        error.stage = 'tool_use_missing';
        throw error;
      }
      rawOutput = toolUse.input;
    }

    const sanitized = sanitizeCaptions(rawOutput);

    if (sanitized.length < 3) {
      const error: any = new Error(`Expected 3 captions, got ${sanitized.length}`);
      error.stage = 'validation_error';
      throw error;
    }

    const validated = sanitized.map((c: string) => c.length > 150 ? c.slice(0, 150) : c);
    return jsonResponse({ captions: validated, _provider: selectedProvider });
  } catch (error: any) {
    console.error('[generate-captions] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stage = error.stage || 'exception';
    const status = error.status || 500;
    return jsonResponse({ error: `Caption generation failed: ${message}`, stage }, status);
  }
});
