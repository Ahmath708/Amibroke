import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { generatePlanTool } from './tool.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { enforceEntitlement } from '../_shared/entitlement.ts';
const ACTION_PLAN_PROMPT = Deno.readTextFileSync(
  new URL('./prompts/system.txt', import.meta.url),
);
if (!ACTION_PLAN_PROMPT || ACTION_PLAN_PROMPT.length < 100) {
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

function jsonResponse(body: unknown, status = 200, extraHeaders = {}) {
  const headers = { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders };
  return new Response(JSON.stringify(body), { status, headers });
}

function validateRequest(body: any): { valid: boolean; error?: string; parsed?: any } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object' };
  const { analysis, tone, userContext } = body;
  if (!analysis || typeof analysis !== 'object') return { valid: false, error: 'analysis is required' };
  if (typeof analysis.score !== 'number') return { valid: false, error: 'analysis.score required' };
  if (!VALID_TONES.has(tone)) return { valid: false, error: `Invalid tone: ${tone}` };
  return { valid: true, parsed: { analysis, tone, userContext: userContext || {} } };
}

function sanitizePlanOutput(raw: any): any {
  const clone = JSON.parse(JSON.stringify(raw));
  const truncate = (s: any, max: number) => typeof s === 'string' && s.length > max ? s.slice(0, max) : s;
  if (clone.overallMessage) clone.overallMessage = truncate(clone.overallMessage, 400);
  if (Array.isArray(clone.steps)) {
    clone.steps = clone.steps.map((step: any) => ({
      ...step,
      week: truncate(step.week, 20),
      title: truncate(step.title, 80),
      description: truncate(step.description, 300),
      impact: truncate(step.impact, 200),
    }));
  }
  return clone;
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
        max_tokens: 2000,
        temperature: 0.2,
        system: [{ type: 'text', text: ACTION_PLAN_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [generatePlanTool],
        tool_choice: { type: 'tool', name: 'generate_plan' },
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      console.warn('[action-plan] Rate limited, retrying after', retryAfter, 's', `(attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callClaude(messages, attempt + 1);
    }

    if (response.status >= 500) {
      console.warn(`[action-plan] Server error ${response.status}, retrying... (attempt ${attempt + 1})`);
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
      console.warn(`[action-plan] Request timed out after ${UPSTREAM_TIMEOUT_MS}ms (attempt ${attempt + 1})`);
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
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{ role: 'system', content: ACTION_PLAN_PROMPT }, ...messages],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      console.warn(`[action-plan] Groq rate limited, retrying after ${retryAfter}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callGroq(messages, attempt + 1);
    }

    if (response.status >= 500) {
      console.warn(`[action-plan] Groq server error ${response.status}, retrying... (attempt ${attempt + 1})`);
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

    const rawText = await response.text();
    if (!rawText) {
      throw new Error('Empty response from Groq API');
    }
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr: any) {
      console.error('[action-plan] Groq response parse error:', parseErr.message);
      console.error('[action-plan] Raw response (first 500 chars):', rawText.slice(0, 500));
      const err: any = new Error(`Groq response parse error: ${parseErr.message}`);
      err.stage = 'groq_parse_error';
      err.rawResponse = rawText.slice(0, 1000);
      throw err;
    }
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
      console.warn(`[action-plan] Groq request timed out after ${UPSTREAM_TIMEOUT_MS}ms (attempt ${attempt + 1})`);
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
    if (!validation.valid) return jsonResponse({ error: validation.error, stage: 'parse_error' }, 400);

    await enforceRateLimit(req, 'action-plan');
    await enforceEntitlement(req); // hard paywall (flagged off by default) — reject before the paid AI call

    if (selectedProvider === 'groq' && !GROQ_API_KEY) return jsonResponse({ error: 'Groq API key not set', stage: 'config_error' }, 500);
    if (selectedProvider === 'claude' && !ANTHROPIC_API_KEY) return jsonResponse({ error: 'Claude API key not set', stage: 'config_error' }, 500);

    const userMessage = JSON.stringify(validation.parsed);
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

    const sanitized = sanitizePlanOutput(rawOutput);

    return jsonResponse({ ...sanitized, _provider: selectedProvider });
  } catch (error: any) {
    console.error('[action-plan] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stage = error.stage || 'exception';
    const status = error.status || 500;
    const rawResponse = error.rawResponse?.slice(0, 500) || null;
    return jsonResponse({ error: `Plan generation failed: ${message}`, stage, rawResponse }, status);
  }
});
