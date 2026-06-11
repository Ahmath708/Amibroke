// LLM-backed calls — the only "Claude" part of the old claudeApi kitchen sink.
// Each function invokes a Supabase edge function (analyze / action-plan /
// generate-captions) and validates the response against a shared Zod schema.
// Mocked in dev via @/config/ai so the frontend never burns API credits in QA.
import { FinalAnalysisSchema, ActionPlanResponseSchema, CaptionResponseSchema } from '@shared/schemas';
import { TABLES } from './tables';
import { FinalAnalysis, CaptionResponse, ActionPlanResponse, UserContext } from '@shared/types';
import { RoastTone } from '@/types';
import { USE_AI_MOCKS } from '@/config/ai';
import { getSupabase } from './supabaseClient';
import type { RevisionPatch, RevisionStep } from '@shared/planRevision';

export function isFinancialAnalysis(x: unknown): x is FinalAnalysis {
  return FinalAnalysisSchema.safeParse(x).success;
}

function cleanUserInput(input: string): string {
  return input
    .replace(/\blike\s+(\d+)\s*(k|grand|thousand)?/gi, (match, num, unit) => {
      if (unit?.toLowerCase() === 'k' || unit?.toLowerCase() === 'grand' || unit?.toLowerCase() === 'thousand') {
        return `${parseInt(num) * 1000}`;
      }
      return match;
    })
    .replace(/\bidk\b/gi, 'I don\'t know')
    .replace(/\bbroke\b/gi, 'little money')
    .replace(/\bprolly\b/gi, 'probably')
    .replace(/\bgonna\b/gi, 'going to')
    .replace(/\bwanna\b/gi, 'want to')
    .replace(/\bgotta\b/gi, 'have got to')
    .replace(/\bcuz\b/gi, 'because')
    .trim();
}

const DEFAULT_USER_CONTEXT: UserContext = {
  state: 'unknown',
  ageBracket: 'unknown',
  incomeBracket: 'unknown',
  livingSituation: 'unknown',
  employmentStatus: 'unknown',
  debtBracket: 'none',
  liquidSavingsBracket: 'under_500',
};

// analyze needs only the bracketed context — strip the raw `dob` the client carries for the form's date
// picker (data minimization: the exact birthday stays in financial_context, never rides to the LLM endpoint).
const stripDob = (c?: Partial<UserContext>) => { if (!c) return {}; const { dob: _dob, ...rest } = c as any; return rest; };

export async function analyzeFinancialSituation(
  userInput: string,
  tone: RoastTone = 'savage',
  signal?: AbortSignal,
  retries = 2,
  userContext?: Partial<UserContext>,
): Promise<FinalAnalysis> {
  if (USE_AI_MOCKS) {
    const { SAMPLE_ANALYSIS } = require('../__fixtures__/sampleAnalysis');
    await new Promise((r) => setTimeout(r, 600));
    return SAMPLE_ANALYSIS;
  }
  console.log('[analyze] Starting analysis', { userInputLength: userInput.length, tone });
  const cleaned = cleanUserInput(userInput);
  console.log('[analyze] Cleaned input:', cleaned.substring(0, 100) + (cleaned.length > 100 ? '...' : ''));
  const client = getSupabase();
  if (!client) {
    console.error('[analyze] FATAL: supabase client not available. EXPO_PUBLIC_SUPABASE_URL set?', !!process.env.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_ANON_KEY set?', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    throw new Error('Backend not configured. Check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log('[analyze] Invoking analyze function, attempt:', attempt + 1);
      const { data, error } = await client.functions.invoke('analyze', {
        body: {
          freeText: cleaned,
          tone,
          userContext: { ...DEFAULT_USER_CONTEXT, ...stripDob(userContext) },
        },
        signal,
      });

      if (error) {
        console.error('[analyze] invoke error — message:', error.message);

        let stage = 'unknown';
        let detail = error.message;

        try {
          const errData = error.context ? await (error.context as any).json() : null;
          if (errData) {
            console.error('[analyze] Error detail:', JSON.stringify(errData));
            stage = errData.stage || stage;
            detail = errData.error || errData.message || detail;
          }
        } catch {
          const ctx = error.context as any;
          if (ctx?.stage) stage = ctx.stage;
          if (ctx?.rawResponse) detail = ctx.rawResponse.slice(0, 300);
        }

        lastError = new Error(`Analysis failed at stage "${stage}": ${detail}`);
        if (attempt < retries) {
          console.log(`[analyze] Retrying in ${attempt + 1}s...`);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      console.log('[analyze] Received data from edge function, validating...');
      if (!isFinancialAnalysis(data)) {
        const issues = FinalAnalysisSchema.safeParse(data).error?.issues ?? [];
        console.error('[analyze] type validation FAILED — errors:', JSON.stringify(issues));
        console.error('[analyze] type validation FAILED — received shape:', JSON.stringify(data).slice(0, 600));
        lastError = new Error(`Analysis returned unexpected data format: ${issues.map(i => i.path.join('.') + ': ' + i.message).join('; ')}`);
        if (attempt < retries) {
          console.log(`[analyze] Retrying after validation failure...`);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }

      console.log('[analyze] Analysis successful, returning data');
      return data as FinalAnalysis;
    } catch (e) {
      console.error('[analyze] Caught exception in attempt', attempt + 1, ':', e);
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[analyze] Request aborted');
        throw e;
      }
      lastError = e instanceof Error ? e : new Error('Unknown error');
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  console.error('[analyze] All retries exhausted, throwing last error:', lastError);
  throw lastError || new Error('Analysis failed after retries');
}

export { analyzeFinancialSituation as analyzeFinances };

// Dedupe concurrent action-plan requests for the same analysis so repeated taps
// (or two screens opening at once) don't both call the paid LLM and double-write.
const actionPlanInFlight = new Map<string, Promise<ActionPlanResponse | null>>();

export function fetchOrGenerateActionPlan(
  analysis: FinalAnalysis,
  tone: RoastTone,
  analysisId?: string,
): Promise<ActionPlanResponse | null> {
  if (!analysisId) return runActionPlan(analysis, tone);
  const existing = actionPlanInFlight.get(analysisId);
  if (existing) return existing;
  const p = runActionPlan(analysis, tone).finally(() => actionPlanInFlight.delete(analysisId));
  actionPlanInFlight.set(analysisId, p);
  return p;
}

// Active Plan revision (Phase 2) — ask revise-plan for a PATCH against the current
// steps. The deterministic apply (shared/planRevision.applyPatch) runs in the service
// that calls this. Mocked in dev so the flow runs on the sim without burning credits.
export async function revisePlanPatch(
  currentSteps: RevisionStep[],
  change: string,
  startSnapshot: Record<string, number>,
  currentSnapshot: Record<string, number>,
  tone: RoastTone,
): Promise<RevisionPatch | null> {
  if (USE_AI_MOCKS) {
    await new Promise((r) => setTimeout(r, 500));
    // No-op patch: keep every step, change nothing. The flow just re-syncs the plan to
    // the latest numbers (status → "up to date"); real Claude does genuine revisions.
    return { keep: currentSteps.map((s) => s.id), drop: [], modify: [], add: [], overallMessage: '' };
  }
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke('revise-plan', {
      body: { currentSteps, change, startSnapshot, currentSnapshot, tone, mode: 'patch' },
    });
    if (error) { console.error('[ai] revisePlanPatch error:', error); return null; }
    if (!data || !Array.isArray(data.keep) || !Array.isArray(data.add) || typeof data.overallMessage !== 'string') {
      console.warn('[ai] revisePlanPatch malformed response');
      return null;
    }
    return data as RevisionPatch;
  } catch (e) {
    console.error('[ai] revisePlanPatch exception:', e);
    return null;
  }
}

async function runActionPlan(
  analysis: FinalAnalysis,
  tone: RoastTone,
): Promise<ActionPlanResponse | null> {
  if (USE_AI_MOCKS) {
    const { SAMPLE_ACTION_PLAN } = require('../__fixtures__/sampleAnalysis');
    await new Promise((r) => setTimeout(r, 600));
    return SAMPLE_ACTION_PLAN;
  }
  const client = getSupabase();
  if (!client) return null;

  try {
    // No analyses.action_plan cache — the plan lives in active_plans once committed (the post-commit
    // cache; callers check getActivePlan before generating). A pre-commit preview re-generates if
    // re-opened, which is fine + rare; in-flight dedupe (fetchOrGenerateActionPlan) covers concurrent.
    const { data, error } = await client.functions.invoke('action-plan', {
      body: { analysis, tone },
    });

    if (error) {
      console.error('[ai] fetchOrGenerateActionPlan error:', error);
      return null;
    }

    const parsed = ActionPlanResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('[ai] fetchOrGenerateActionPlan malformed response');
      return null;
    }

    return parsed.data;
  } catch (e) {
    console.error('[ai] fetchOrGenerateActionPlan exception:', e);
    return null;
  }
}

export async function fetchOrGenerateCaptions(
  analysis: FinalAnalysis,
  tone: RoastTone,
  analysisId?: string,
): Promise<CaptionResponse | null> {
  if (USE_AI_MOCKS) {
    const { SAMPLE_CAPTIONS } = require('../__fixtures__/sampleAnalysis');
    await new Promise((r) => setTimeout(r, 600));
    return SAMPLE_CAPTIONS;
  }
  const client = getSupabase();
  if (!client) return null;

  try {
    if (analysisId) {
      const { data: row } = await client
        .from(TABLES.analyses)
        .select('share_captions')
        .eq('id', analysisId)
        .single();

      if (row?.share_captions) {
        const parsed = CaptionResponseSchema.safeParse(row.share_captions);
        if (parsed.success) return parsed.data;
      }
    }

    const { data, error } = await client.functions.invoke('generate-captions', {
      body: {
        score: analysis.score,
        scoreLabel: analysis.scoreLabel,
        roast: analysis.roast,
        tone,
      },
    });

    if (error) {
      console.warn('[captions] invoke error:', error);
      return null;
    }

    const parsed = CaptionResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('[captions] invalid response shape:', parsed.error.issues);
      return null;
    }

    if (analysisId) {
      await client
        .from(TABLES.analyses)
        .update({ share_captions: parsed.data })
        .eq('id', analysisId);
    }

    return parsed.data;
  } catch (e) {
    console.warn('[captions] failed:', e);
    return null;
  }
}

// Short personalized monthly check-in reflection (unified financial model §7). Haiku, server-side.
// Non-fatal — null on any failure so the check-in falls back to a deterministic template.
export async function checkinReflection(input: {
  mood: string;
  note?: string;
  delta?: Record<string, number> | string | null;
  planStatus?: string;
  tone: RoastTone;
}): Promise<string | null> {
  if (USE_AI_MOCKS) {
    await new Promise((r) => setTimeout(r, 400));
    return "Real talk — you showed up this month, and that's the streak that actually matters. Keep chipping away.";
  }
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.functions.invoke('checkin-reflection', { body: input });
    if (error) { console.warn('[ai] checkinReflection error:', error); return null; }
    const reflection = (data as { reflection?: unknown })?.reflection;
    return typeof reflection === 'string' ? reflection : null;
  } catch (e) {
    console.warn('[ai] checkinReflection exception:', e);
    return null;
  }
}
