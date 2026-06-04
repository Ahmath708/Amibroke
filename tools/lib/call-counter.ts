// The 40-call session cap was a coworker-era guardrail and has been REMOVED. These remain as
// no-op shims so the paid scripts that import them keep working without code churn.
//
// Cost discipline is UNCHANGED and non-negotiable: ALWAYS tell the human the call count +
// estimated cost before running any LLM/paid script, and wait for confirmation (CLAUDE.md rule #1).
type CounterState = { count: number; startedAt: string; lastCallAt: string | null };

export function recordApiCall(reason: string): void {
  console.log(`📊 LLM call — ${reason}`);
}

export function getCounterState(): CounterState {
  return { count: 0, startedAt: new Date().toISOString(), lastCallAt: null };
}
