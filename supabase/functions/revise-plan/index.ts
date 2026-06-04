import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { generatePlanTool, revisePatchTool } from './tool.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { enforceEntitlement } from '../_shared/entitlement.ts';

// Inlined (not a file read) so it always bundles into the deployed function.
const REVISE_PROMPT = `You are "Am I Broke?" — REVISING a user's existing 90-day action plan because their finances changed. You return ONLY the generate_plan tool call. No prose, no markdown, no commentary.

The user message is JSON: { completedSteps, remainingSteps, change, startSnapshot, currentSnapshot, tone }.
- completedSteps: steps the user already finished (their wins). Do NOT re-list these as todos.
- remainingSteps: the not-yet-done steps from the current plan.
- change: a plain-English description of what changed (an event, a check-in, or a re-analysis).
- startSnapshot: their numbers when the plan started.
- currentSnapshot: their numbers now (the source of truth — revise to THIS).
- tone: the user's roast tone (savage | gentle | therapist | older_sibling | finance_bro). Match it in overallMessage; keep step text practical regardless.

# How to revise
1. overallMessage (1-2 sentences): acknowledge what they finished and what changed. Reference a specific number from currentSnapshot. Match the tone.
2. Produce 4-6 steps that REPLACE remainingSteps, re-fit to currentSnapshot:
   - DROP any remaining step that no longer applies (e.g. a debt step once that debt is $0; an emergency-fund step once it's fully funded).
   - KEEP/adapt remaining steps that still make sense.
   - ADD new steps that fit the new reality (e.g. a larger surplus -> aggressive saving, investing, or a bigger goal).
3. Anchor EVERY step to a specific dollar amount or percentage from currentSnapshot — never generic advice. "Automate $1,400/mo into a HYSA" not "save more".
4. Order steps by urgency/sequence across the remaining ~90 days (week labels like "Weeks 2-4", "Month 2", "Weeks 9-12").
5. confidence must reflect how achievable the step is given currentSnapshot — do not mark everything "high".

# Categories
Each step's category is one of: 'savings', 'debt', 'income', 'mindset'.

# Situation logic
- If debt is now $0, do NOT include 'debt' steps — pivot that energy to savings/investing.
- If currentSnapshot shows a strong surplus and no debt, focus on optimization and growth (emergency fund -> invest -> long-term goals), not survival.
- If things got WORSE since startSnapshot (income dropped, new debt), prioritize stabilization: cut spending, protect cash, tackle the most urgent debt first.

NEVER pretend to be a licensed financial advisor, give illegal tax advice, guarantee investment outcomes, shame the user aggressively, or mention self-harm.`;

// Patch mode (hybrid): emit a diff over the existing steps instead of a whole plan.
const PATCH_PROMPT = `You are "Am I Broke?" — REVISING a user's existing 90-day plan by emitting a PATCH, not a new plan. You return ONLY the revise_plan_patch tool call. No prose, no markdown.

The user message is JSON: { currentSteps, change, startSnapshot, currentSnapshot, tone }.
- currentSteps: the user's plan right now. Each has an "id", a "status" ('done' | 'pending' | 'skipped'), and the step fields. Steps with status 'done' are finished — wins, not todos.
- change / startSnapshot / currentSnapshot / tone: what changed, their numbers then vs now (current = source of truth), and the roast tone.

Classify EVERY step in currentSteps into exactly ONE of keep / drop / modify, by id:
- keep: still correct as-is. ALWAYS keep 'done' steps — never undo someone's progress.
- drop: no longer applies given currentSnapshot (e.g. a debt step once debt is $0; an emergency-fund step once it's funded).
- modify: still relevant but the numbers or wording should change — include the id and ONLY the fields that change.
Then "add": brand-new steps the new situation calls for (no id — the server assigns one; they start pending).

Hard rules:
- Account for every currentSteps id EXACTLY ONCE across keep, drop, and modify. Never invent an id that isn't in currentSteps.
- After applying, the plan must total 4-6 steps. Add or drop to land in that range.
- Anchor every modified/added step to a specific dollar amount or percentage from currentSnapshot — never generic advice.
- overallMessage (<=400 chars): acknowledge the wins + what changed, reference a current number, match the tone.

Situation logic:
- debt now $0 -> drop debt steps, pivot to savings/investing.
- got WORSE (income dropped, new debt) -> stabilize first (cut spending, protect cash, most-urgent debt); do NOT add investing steps.
- strong surplus + no debt -> optimization/growth.

Step kinds (prevents duplicate goals):
- Every step has target.kind: 'debt_paydown' | 'build_efund' | 'cut_spend' | 'grow_income' | 'habit'. Set it on EVERY modify and add.
- 'build_efund' and 'debt_paydown' are SINGULAR — at most ONE active (non-done) step each.
- If the change adjusts a goal an existing step ALREADY covers (paying MORE toward the same debt, raising the emergency-fund target), MODIFY that step by id. Do NOT add a second step of the same singular kind. The intended revision of an existing entry is a modify, never a near-duplicate add.

NEVER reference these input field names in user-facing text, guarantee outcomes, or mention self-harm.`;

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const API_URL = 'https://api.anthropic.com/v1/messages';

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

function validateRequest(body: any): { valid: boolean; error?: string; mode?: 'plan' | 'patch'; parsed?: any } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object' };
  const { completedSteps, remainingSteps, currentSteps, change, startSnapshot, currentSnapshot, tone } = body;
  const mode: 'plan' | 'patch' = body.mode === 'patch' ? 'patch' : 'plan';
  if (typeof change !== 'string' || change.trim().length === 0) return { valid: false, error: 'change (non-empty string) is required' };
  if (!currentSnapshot || typeof currentSnapshot !== 'object') return { valid: false, error: 'currentSnapshot (object) is required' };
  if (tone !== undefined && !VALID_TONES.has(tone)) return { valid: false, error: `Invalid tone: ${tone}` };

  if (mode === 'patch') {
    if (!Array.isArray(currentSteps) || currentSteps.length === 0) return { valid: false, error: 'currentSteps (non-empty array) is required for patch mode' };
    if (!currentSteps.every((s: any) => s && typeof s.id === 'string')) return { valid: false, error: 'each currentStep needs a string id' };
    return {
      valid: true, mode,
      parsed: {
        currentSteps,
        change: change.slice(0, 600),
        startSnapshot: startSnapshot && typeof startSnapshot === 'object' ? startSnapshot : {},
        currentSnapshot,
        tone: tone ?? 'savage',
      },
    };
  }

  if (!Array.isArray(remainingSteps)) return { valid: false, error: 'remainingSteps (array) is required' };
  return {
    valid: true, mode,
    parsed: {
      completedSteps: Array.isArray(completedSteps) ? completedSteps : [],
      remainingSteps,
      change: change.slice(0, 600),
      startSnapshot: startSnapshot && typeof startSnapshot === 'object' ? startSnapshot : {},
      currentSnapshot,
      tone: tone ?? 'savage',
    },
  };
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

function sanitizePatchOutput(raw: any): any {
  const clone = JSON.parse(JSON.stringify(raw));
  const truncate = (s: any, max: number) => typeof s === 'string' && s.length > max ? s.slice(0, max) : s;
  const trimStep = (step: any) => ({
    ...step,
    week: truncate(step.week, 20),
    title: truncate(step.title, 80),
    description: truncate(step.description, 300),
    impact: truncate(step.impact, 200),
  });
  return {
    keep: Array.isArray(clone.keep) ? clone.keep.filter((x: any) => typeof x === 'string') : [],
    drop: Array.isArray(clone.drop) ? clone.drop.filter((x: any) => typeof x === 'string') : [],
    modify: Array.isArray(clone.modify) ? clone.modify.map(trimStep) : [],
    add: Array.isArray(clone.add) ? clone.add.map(trimStep) : [],
    overallMessage: truncate(clone.overallMessage, 400),
  };
}

async function callClaude(messages: Array<{ role: string; content: string }>, systemText: string, tool: any, attempt = 0): Promise<any> {
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
        system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5');
      console.warn('[revise-plan] Rate limited, retrying after', retryAfter, 's', `(attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callClaude(messages, systemText, tool, attempt + 1);
    }

    if (response.status >= 500) {
      console.warn(`[revise-plan] Server error ${response.status}, retrying... (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, 2000));
      return callClaude(messages, systemText, tool, attempt + 1);
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

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[revise-plan] Request timed out after ${UPSTREAM_TIMEOUT_MS}ms (attempt ${attempt + 1})`);
      if (attempt + 1 < MAX_RETRIES) return callClaude(messages, systemText, tool, attempt + 1);
      const error: any = new Error('Claude upstream timeout');
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

    const validation = validateRequest(body);
    if (!validation.valid) return jsonResponse({ error: validation.error, stage: 'parse_error' }, 400);

    await enforceRateLimit(req, 'revise-plan');
    await enforceEntitlement(req); // hard paywall (flagged off by default) — reject before the paid AI call

    if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'Claude API key not set', stage: 'config_error' }, 500);

    const messages = [{ role: 'user', content: JSON.stringify(validation.parsed) }];
    const isPatch = validation.mode === 'patch';

    const data = await callClaude(messages, isPatch ? PATCH_PROMPT : REVISE_PROMPT, isPatch ? revisePatchTool : generatePlanTool);
    const toolUse = data.content.find((c: any) => c.type === 'tool_use');
    if (!toolUse) {
      const error: any = new Error('No tool_use block in response');
      error.stage = 'tool_use_missing';
      throw error;
    }

    if (isPatch) {
      // Return the raw patch; the client/app applies it deterministically (preserving ids + completion).
      return jsonResponse({ ...sanitizePatchOutput(toolUse.input), _provider: 'claude', _mode: 'patch' });
    }
    const sanitized = sanitizePlanOutput(toolUse.input);
    return jsonResponse({ ...sanitized, _provider: 'claude' });
  } catch (error: any) {
    console.error('[revise-plan] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stage = error.stage || 'exception';
    const status = error.status || 500;
    const rawResponse = error.rawResponse?.slice(0, 500) || null;
    return jsonResponse({ error: `Plan revision failed: ${message}`, stage, rawResponse }, status);
  }
});
