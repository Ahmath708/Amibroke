import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { submitAnalysisTool } from './tool.ts';
import { getBaselinesForRequest } from './getBaselinesForRequest.ts';
import type { FinalAnalysis, UserContext } from '../../../shared/types.ts';
import { deriveMetrics } from '../../../shared/calculations.ts';
import { computeFinalScore } from '../../../shared/scoring/index.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { enforceEntitlement } from '../_shared/entitlement.ts';
const SYSTEM_PROMPT = Deno.readTextFileSync(
  new URL('./prompts/system.txt', import.meta.url),
);
if (!SYSTEM_PROMPT || SYSTEM_PROMPT.length < 100) {
  throw new Error('system.txt missing or truncated');
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
};
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const VALID_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'unknown',
]);

const VALID_AGE_BRACKETS = new Set(['18-24', '25-29', '30-34', '35-44', '45+', 'unknown']);
const VALID_INCOME_BRACKETS = new Set(['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k', 'unknown']);
const VALID_LIVING_SITUATIONS = new Set(['renting', 'owning', 'with_family', 'dorm', 'other', 'unknown']);
const VALID_EMPLOYMENT_STATUSES = new Set(['full_time', 'part_time', 'self_employed', 'student', 'between_jobs', 'unknown']);
const VALID_DEBT_BRACKETS = new Set(['none', 'under_5k', '5k_15k', '15k_50k', 'over_50k', 'unknown']);
const VALID_SAVINGS_BRACKETS = new Set(['none', 'under_500', '500_2k', '2k_10k', '10k_50k', 'over_50k', 'unknown']);
const VALID_TONES = new Set(['savage', 'gentle', 'therapist', 'older_sibling', 'finance_bro']);

const BLOCKED_PATTERNS = [/suicid/i, /kill yourself/i, /kys/i, /die\b/i, /end it all/i];

function moderateInput(text: string): { safe: boolean; reason: string | null } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text.toLowerCase())) {
      return { safe: false, reason: 'We detected potentially harmful content. If you\'re in crisis, please reach out to a professional helpline.' };
    }
  }
  if (text.length > 5000) return { safe: false, reason: 'Input too long. Please keep it under 5000 characters.' };
  if (text.length < 10) return { safe: false, reason: 'Please describe your finances in more detail.' };
  return { safe: true, reason: null };
}

function jsonResponse(body: unknown, status = 200, extraHeaders = {}) {
  const headers = { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders };
  return new Response(JSON.stringify(body), { status, headers });
}

function validateRequest(body: any): { valid: boolean; error?: string; parsed?: any } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { freeText, userContext, tone } = body;

  if (typeof freeText !== 'string' || freeText.length < 10 || freeText.length > 5000) {
    return { valid: false, error: 'freeText must be a string between 10 and 5000 characters' };
  }

  if (!userContext || typeof userContext !== 'object') {
    return { valid: false, error: 'userContext is required' };
  }

  if (!VALID_STATES.has(userContext.state)) return { valid: false, error: `Invalid state: ${userContext.state}` };
  if (!VALID_AGE_BRACKETS.has(userContext.ageBracket)) return { valid: false, error: `Invalid ageBracket: ${userContext.ageBracket}` };
  if (!VALID_INCOME_BRACKETS.has(userContext.incomeBracket)) return { valid: false, error: `Invalid incomeBracket: ${userContext.incomeBracket}` };
  if (!VALID_LIVING_SITUATIONS.has(userContext.livingSituation)) return { valid: false, error: `Invalid livingSituation: ${userContext.livingSituation}` };
  if (!VALID_EMPLOYMENT_STATUSES.has(userContext.employmentStatus)) return { valid: false, error: `Invalid employmentStatus: ${userContext.employmentStatus}` };

  const debtBracket = userContext.debtBracket || 'none';
  if (!VALID_DEBT_BRACKETS.has(debtBracket)) return { valid: false, error: `Invalid debtBracket: ${debtBracket}` };

  const liquidSavingsBracket = userContext.liquidSavingsBracket || 'under_500';
  if (!VALID_SAVINGS_BRACKETS.has(liquidSavingsBracket)) return { valid: false, error: `Invalid liquidSavingsBracket: ${liquidSavingsBracket}` };

  if (!VALID_TONES.has(tone)) return { valid: false, error: `Invalid tone: ${tone}` };

  return {
    valid: true,
    parsed: {
      freeText,
      userContext: { state: userContext.state, ageBracket: userContext.ageBracket, incomeBracket: userContext.incomeBracket, livingSituation: userContext.livingSituation, employmentStatus: userContext.employmentStatus, debtBracket, liquidSavingsBracket, primaryConcern: userContext.primaryConcern },
      tone,
    },
  };
}

function validateAiOutput(raw: any): { valid: boolean; error?: string; parsed?: any } {
  if (!raw || typeof raw !== 'object') return { valid: false, error: 'AI output must be a JSON object' };

  const required = ['monthlyIncome', 'monthlyExpenses', 'liquidSavings', 'debts', 'cfpb_responses', 'scoreModifier', 'summary'];
  for (const field of required) {
    if (raw[field] === undefined || raw[field] === null) return { valid: false, error: `Missing required field: ${field}` };
  }

  for (const field of ['monthlyIncome', 'monthlyExpenses', 'liquidSavings'] as const) {
    const obj = raw[field];
    if (typeof obj.value !== 'number' || obj.value < 0) return { valid: false, error: `${field}.value must be non-negative` };
    if (!['low', 'medium', 'high'].includes(obj.confidence)) return { valid: false, error: `${field}.confidence invalid` };
  }

  if (!Array.isArray(raw.debts) || raw.debts.length > 8) return { valid: false, error: 'debts must be array ≤ 8' };

  const cfpb = raw.cfpb_responses;
  if (!Array.isArray(cfpb) || cfpb.length !== 10) return { valid: false, error: 'cfpb_responses must be exactly 10' };
  for (let i = 0; i < cfpb.length; i++) {
    const r = cfpb[i];
    if (typeof r.value !== 'number' || !Number.isInteger(r.value) || r.value < 0 || r.value > 4) return { valid: false, error: `cfpb_responses[${i}].value must be int 0-4` };
    if (!['low', 'medium', 'high'].includes(r.confidence)) return { valid: false, error: `cfpb_responses[${i}].confidence invalid` };
  }

  if (typeof raw.scoreModifier !== 'number' || !Number.isInteger(raw.scoreModifier) || raw.scoreModifier < -10 || raw.scoreModifier > 10) return { valid: false, error: 'scoreModifier must be int -10..10' };

  return { valid: true, parsed: raw };
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
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        temperature: 0.2,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [submitAnalysisTool],
        tool_choice: { type: 'tool', name: 'submit_analysis' },
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      console.warn(`[claude] Rate limited, retrying after ${retryAfter}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callClaude(messages, attempt + 1);
    }

    if (response.status >= 500) {
      console.warn(`[claude] Server error ${response.status}, retrying... (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, 2000));
      return callClaude(messages, attempt + 1);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[claude] API error: ${response.status} — body: ${errorBody}`);
      let apiMessage = `Claude API error: ${response.status}`;
      try { const parsed = JSON.parse(errorBody); if (parsed.error?.message) apiMessage = `Claude API error: ${parsed.error.message}`; } catch { /* ignore */ }
      const error: any = new Error(apiMessage);
      error.status = response.status;
      error.rawResponse = errorBody;
      error.stage = 'claude_api_error';
      error.detail = apiMessage;
      throw error;
    }

    const data = await response.json();
    console.log('[claude] API success');
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[claude] Request timed out after ${UPSTREAM_TIMEOUT_MS}ms (attempt ${attempt + 1})`);
      if (attempt + 1 < MAX_RETRIES) {
        return callClaude(messages, attempt + 1);
      }
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2500,
        temperature: 0.2,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      console.warn(`[groq] Rate limited, retrying after ${retryAfter}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callGroq(messages, attempt + 1);
    }

    if (response.status >= 500) {
      console.warn(`[groq] Server error ${response.status}, retrying... (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, 2000));
      return callGroq(messages, attempt + 1);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[groq] API error: ${response.status} — body: ${errorBody}`);
      let apiMessage = `Groq API error: ${response.status}`;
      try { const parsed = JSON.parse(errorBody); if (parsed.error?.message) apiMessage = `Groq API error: ${parsed.error.message}`; } catch { /* ignore */ }
      const error: any = new Error(apiMessage);
      error.status = response.status;
      error.rawResponse = errorBody;
      error.stage = 'groq_api_error';
      error.detail = apiMessage;
      throw error;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[groq] API success');

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
      console.warn(`[groq] Request timed out after ${UPSTREAM_TIMEOUT_MS}ms (attempt ${attempt + 1})`);
      if (attempt + 1 < MAX_RETRIES) {
        return callGroq(messages, attempt + 1);
      }
      const error: any = new Error('Groq upstream timeout');
      error.stage = 'upstream_timeout';
      error.status = 504;
      throw error;
    }
    if (err.stage) throw err;
    throw err;
  }
}

function sanitizeAiOutput(raw: any): any {
  const clone = JSON.parse(JSON.stringify(raw));
  const truncate = (s: any, max: number) => typeof s === 'string' && s.length > max ? s.slice(0, max) : s;
  if (clone.summary) clone.summary = truncate(clone.summary, 400);
  if (clone.roast) clone.roast = truncate(clone.roast, 240);
  if (clone.scoreModifierReason) clone.scoreModifierReason = truncate(clone.scoreModifierReason, 200);
  if (clone.emotionalStatus) {
    clone.emotionalStatus.label = truncate(clone.emotionalStatus.label, 40);
    clone.emotionalStatus.emoji = truncate(clone.emotionalStatus.emoji, 4);
  }
  if (clone.topFix?.action) clone.topFix.action = truncate(clone.topFix.action, 200);
  for (const key of ['insights', 'topProblems', 'positiveBehaviors'] as const) {
    if (Array.isArray(clone[key])) {
      clone[key] = clone[key].map((s: string) => truncate(s, key === 'insights' ? 160 : 140));
    }
  }
  return clone;
}

function composeFinalAnalysis(rawOutput: any): any {
  const derived = deriveMetrics({
    monthlyIncome: rawOutput.monthlyIncome.value,
    monthlyExpenses: rawOutput.monthlyExpenses.value,
    liquidSavings: rawOutput.liquidSavings.value,
    debts: rawOutput.debts,
  });

  const scoring = computeFinalScore(rawOutput.cfpb_responses, rawOutput.scoreModifier);

  return {
    ...rawOutput,
    ...derived,
    score: scoring.score,
    scoreLabel: scoring.scoreLabel,
    scoreColor: scoring.scoreColor,
    avgConfidence: scoring.avgConfidence,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', stage: 'request_validation' }, 405);
  }

  try {
    const body = await req.json();
    const { provider } = body;
    const selectedProvider: string = (provider === 'groq' ? 'groq' : 'claude');

    const validation = validateRequest(body);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error, stage: 'parse_error' }, 400);
    }

    const { freeText, userContext, tone } = validation.parsed;

    await enforceRateLimit(req, 'analyze');
    await enforceEntitlement(req); // hard paywall (flagged off by default) — reject before the paid AI call

    if (selectedProvider === 'groq' && !GROQ_API_KEY) {
      return jsonResponse({ error: 'Server misconfiguration: Groq API key not set.', stage: 'config_error' }, 500);
    }
    if (selectedProvider === 'claude' && !ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'Server misconfiguration: Claude API key not set.', stage: 'config_error' }, 500);
    }

    const moderation = moderateInput(freeText);
    if (!moderation.safe) {
      return jsonResponse({ error: moderation.reason, stage: 'moderation_failed' }, 400);
    }

    const userMessage = JSON.stringify({
      freeText,
      userContext,
      baselines: getBaselinesForRequest(userContext),
      tone,
    });

    let rawOutput: any;
    const messages = [{ role: 'user', content: userMessage }];

    if (selectedProvider === 'groq') {
      rawOutput = await callGroq(messages);
    } else {
      const data = await callClaude(messages);
      const toolUse = data.content.find((c: any) => c.type === 'tool_use');
      if (!toolUse) {
        const error: any = new Error('No tool_use block in response');
        error.stage = 'tool_use_missing';
        error.rawResponse = JSON.stringify(data);
        throw error;
      }
      rawOutput = toolUse.input;
    }

    const sanitized = sanitizeAiOutput(rawOutput);
    const finalAnalysis = composeFinalAnalysis(sanitized);

    return jsonResponse(
      { ...finalAnalysis, _provider: selectedProvider },
      200,
    );
  } catch (error: any) {
    console.error('[analyze] Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stage = error.stage || 'exception';
    const status = error.status || 500;
    const rawResponse = error.rawResponse?.slice(0, 500);
    const httpStatus = error.httpStatus || null;

    const envelope = { error: `Analysis failed: ${message}`, stage, httpStatus, rawResponse, detail: error.detail || null };
    console.error('[analyze] Error envelope:', JSON.stringify(envelope));

    return jsonResponse(envelope, status);
  }
});
