# May 27 — Next Backend Steps (Part 2: downstream testing)

This file covers the **action-plan and generate-captions iteration cycles** built on top of 527. Deployment to hosted Supabase is delivered separately in `529_NEXT_STEPS.md` after these iterations are committed.

## Why this is a separate file

The split is:

- **527** = build the caption generator, harden the backend (rate limiting, Groq parity, action-plan persistence), set up the test harness for all three suites, and run **3 analyze iterations only**.
- **528 (this file)** = run the iteration cycles for **action-plan first, then generate-captions** using the *real* analyze outputs as their inputs.
- **529** = deploy the backend (functions + migrations) to hosted Supabase.

## Prerequisites (all must be true before Step 0)

1. Everything in 527 is committed and pushed: caption generator built, backend hardened, the eval harness split into a shared lib + one runner per endpoint (`runner.analyze.ts` / `runner.action-plan.ts` / `runner.captions.ts`) with file logging + raw output, analyze's 3 cycles done.
2. `supabase functions serve` runs locally, `SUPABASE_URL` / `SUPABASE_ANON_KEY` are set, and `RATE_LIMIT_ENABLED=false` for local serve (so the limiter doesn't throttle your cycles). **You never call the API from the app — only through the eval runner against the locally-served functions.**
3. The 40-call counter is at a known value. If it isn't near zero, commit + push + message Jason for a reset before a 13-case cycle.

Conventions (identical to 527):
- Fresh Claude Code session per prompt. Read the named files first — don't guess shapes.
- Prompts live in each function's `prompts/system.txt`, loaded via `Deno.readTextFileSync`.
- One prompt change per cycle. Document before you change. Commit per step.
- Build/fixture steps make **no API calls** (free). Only the cycle runs spend credits.

---

# STEP 0 — Consolidate the prompt source-of-truth (DO FIRST, before D1)

527 left the three edge functions in a two-sources-for-one-contract state: each `index.ts` imports `SYSTEM_PROMPT` from a local `prompt.ts`, but each function also has a `prompts/system.txt` that nothing reads at runtime. The analyze prompt iterated during 527 Section C lives in `prompt.ts`; `system.txt` is already stale. Before any further iteration (Sections E and F edit prompts every cycle), restore the file-based design — single source, clean diffs, the design the eval methodology assumes. Code-only, no API calls.

```
The three edge functions (analyze, action-plan, generate-captions) currently import SYSTEM_PROMPT from a local prompt.ts file, but each function also has a prompts/system.txt that nothing reads. Two sources, one contract — they WILL drift. Restore the file-based design: load each function's prompt from its prompts/system.txt via Deno.readTextFileSync, and delete the prompt.ts files.

ORDER MATTERS — the LIVE prompt is currently in prompt.ts (it was iterated during 527 Section C). If you switch the runtime to system.txt WITHOUT syncing first, you silently revert iteration wins. So:

For each of the three functions (analyze, action-plan, generate-captions):
1. Read prompt.ts (this is the LIVE prompt that's actually being sent to Claude/Groq) and prompts/system.txt (likely stale).
2. If they differ in content, OVERWRITE prompts/system.txt with the live content from prompt.ts so system.txt becomes the canonical version. Preserve every word — this content is what gets sent to the model.
3. In index.ts:
   - Remove: `import { SYSTEM_PROMPT } from './prompt.ts';`
   - Add (after the other imports, before any function body):
     ```ts
     const SYSTEM_PROMPT = Deno.readTextFileSync(
       new URL('./prompts/system.txt', import.meta.url),
     );
     if (!SYSTEM_PROMPT || SYSTEM_PROMPT.length < 100) {
       throw new Error('system.txt missing or truncated');
     }
     ```
   - Grep the file for any remaining reference to `./prompt` — should be zero.
4. Delete the file `prompt.ts`.

Sanity checks (no paid API calls):
- For each function, SYSTEM_PROMPT must still be used in the same two places: the Claude `system:` block (with `cache_control: ephemeral`) and the Groq `messages:` system content. Both must still type-check after the change.
- Run `npx tsc --noEmit` (Deno-specific remote imports may not fully type-check, but the wiring should be clean).
- With `supabase functions serve` running locally, observe the startup logs — each function loads system.txt at module init via Deno.readTextFileSync, so if the file path is wrong the function fails to load and the throw appears in the logs. This is a STARTUP smoke test, NOT an endpoint invocation. Do NOT invoke the endpoint; the load happens when serve initializes the function.

Constraints:
- Code-only refactor. NO Claude or Groq calls. The prompt content must not change as a side effect — `system.txt` after this step must literally match what `prompt.ts` contained.
- Apply the same change identically to all three functions.

Show me, per function:
- A diff of `prompts/system.txt` (the live content you copied in from prompt.ts, if it differed).
- The `index.ts` import diff (deletion of the prompt.ts import, addition of the Deno.readTextFileSync block).
- Confirmation that prompt.ts is deleted (file no longer exists).
- The local-serve startup result (loaded cleanly per function, or the throw message if anything was off).
```

---

# SECTION D — Build downstream fixtures from REAL analyze outputs

Action-plan and captions both consume the *output* of analyze. We do not hand-invent their inputs — we feed them the actual analyses analyze produced, so we're testing the real pipeline.

**Use this specific file as the source: `scripts/eval/results/cycle_3_analyze_2026-05-28T03-36-25-379Z.json`** — that is the v1.0 finalized analyze prompt's output (cycle 3, hypothesis 2 KEPT, 13/13 pass; the explicit CFPB→data mapping table change is what shipped). Two 527 runs hit 100%, but only this one was produced by the finalized prompt — the other was a baseline rerun with the OLD prompt that happened to hit 100% from variance. Do NOT use any other cycle file, even if it also shows 100%; the fixtures must reflect what production analyze will actually emit.

## Step D1 — Build `fixtures.action-plan.ts` from real analyses

```
Build the action-plan eval fixtures from REAL analyze outputs (not hand-made data). First read:
- `scripts/eval/results/cycle_3_analyze_2026-05-28T03-36-25-379Z.json` — THIS specific file. It is the v1.0 finalized analyze prompt's output (cycle 3, hypothesis 2 KEPT, 13/13 pass). Do NOT pick a different 100% run — the other one was produced by the pre-hypothesis prompt and is not the v1.0 contract. Each fixture entry has a full raw response.
- supabase/functions/action-plan/index.ts  — validateRequest needs `{ analysis (object containing a numeric `score`), tone }` and optionally `userContext`.
- scripts/eval/fixtures.analyze.ts  — match the Fixture type style.
- scripts/eval/assertions.ts.

Do this:
1. From the chosen analyze results file, pick a representative batch of analyses (aim for 6–10, hard cap 13) spanning all four score bands (Fragile 0–40, Surviving 41–60, Stable 61–80, Thriving 81–100) plus at least one negative-savings / high-debt case. Use the ACTUAL analysis objects from the raw responses — do not edit the numbers.
2. Create `scripts/eval/fixtures.action-plan.ts`. Each fixture: `{ id, group, label, input: { analysis: <the real analysis object>, tone, userContext? }, expects: {...} }`. Vary the tone across fixtures.
3. Assertions: `assertActionPlan` already exists from 527 A6 (overallMessage non-empty ≤400; steps non-empty array; each step has week/title/description/impact non-empty; no forbidden strings — Bitcoin, Ethereum, SOL, tickers, "as your CFP", "I'm a licensed", self-harm terms; plan consistent with the score band). Reuse it; extend it only if the real data exposes a gap. The runner `scripts/eval/runner.action-plan.ts` already exists from 527 — once this fixtures file is in place it will stop erroring and run.

Constraints: real data only; no API call in this step; `npx tsc --noEmit`.
Show me the new fixtures file (with a note on which analyze fixture each row came from), the new assertion, and the tsc result.
```

## Step D2 — Refine the caption fixtures with real analyze outputs

A6 created caption fixtures with plausible-but-synthetic `{ score, scoreLabel, roast }`. Now replace them with real values so the caption tests run on genuine analyze output.

```
Replace the synthetic values in the caption fixtures with REAL analyze outputs. First read scripts/eval/fixtures.captions.ts and the v1.0 analyze results file: `scripts/eval/results/cycle_3_analyze_2026-05-28T03-36-25-379Z.json` (the SAME file used in D1 — cycle 3, hypothesis 2 KEPT, 13/13 pass; do not substitute a different 100% run, see Section D intro).

For each caption fixture, set `score`, `scoreLabel`, and `roast` to values taken from a real analysis in that results file (keep the spread across low/mid/high scores and keep the tone variety). Keep the existing assertions (exactly 3 captions; each ≤150 chars; non-empty; the 3 are distinct; no forbidden strings). Keep 5–8 fixtures.

Constraints: real data only; no API call; `npx tsc --noEmit`.
Show me the updated fixtures with a note on which analysis each row came from.
```

---

# SECTION E — action-plan: 3 iterations (run FIRST)

Same methodology as 527's C0. **3 iterations, ≤13 cases. Cycle 1 = baseline (no prompt change). Cycles 2 and 3 = one documented hypothesis each.** Every run logs a `cycle_<n>_action-plan_*.json` with raw output per fixture + a `SUMMARY.md` row. The DECISIONS.md note is the human-readable record.

**Counter math:** one cycle = (number of action-plan fixtures) calls. 3 cycles of ~10 fixtures = ~30 calls — fits one 40-call session. If you also did the captions runs in the same session you'd blow the cap, so **finish action-plan, commit + push + message Jason for a reset, then do captions.**

## Step E1 — action-plan cycle 1 (baseline)

```
Run the action-plan eval as a BASELINE. Confirm `supabase functions serve` is running, SUPABASE_URL/ANON_KEY are set, and RATE_LIMIT_ENABLED=false. Confirm the call count and cost before running.

Run: `npx tsx scripts/eval/runner.action-plan.ts --cycle 1 --fixture all`

Baseline — do NOT change the prompt. After it finishes, read the results file in scripts/eval/results/ (including the raw plans) and write a findings note in DECISIONS.md: pass rate, which fixtures failed + first failing assertion, and quality concerns in the raw output even on passing rows (generic steps, steps that contradict the score band, off-tone voice, fabricated numbers, repeated boilerplate across different users). Fill the SUMMARY.md note. Commit the results file + DECISIONS.md note.
```

## Step E2 — action-plan cycles 2 and 3 (run once per cycle, n = 2 then 3)

```
We are improving the action-plan prompt with ONE hypothesis this cycle.

1. Read the previous cycle's action-plan results file (the raw plans, not just pass/fail) and supabase/functions/action-plan/prompts/system.txt.
2. Pick ONE specific, testable hypothesis for a single prompt change that should improve plan quality (e.g. "tie step count to score band", "force each step to reference a number from the analysis", "tighten the voice for tone X"). Write the hypothesis + which fixtures you expect to change in the DECISIONS.md note BEFORE you edit.
3. Make that ONE change to system.txt. Nothing else.
4. Re-run the locally-served function: `npx tsx scripts/eval/runner.action-plan.ts --cycle <n> --fixture all` (confirm cost first).
5. Compare to the previous cycle. Write a DECISIONS.md note: hypothesis, exact change, reasoning, pass-rate delta, ANY regression on previously-passing fixtures (check the raw plans), keep-or-revert decision. If it regressed more than it helped, revert and say so.
6. Update SUMMARY.md. Commit the results file + the prompt change (or revert) + the DECISIONS.md note.
```

## 🔒 Checkpoint between E and F

After action-plan's 3 cycles: commit + push everything. You have very likely hit or neared the 40-call cap. **Message Jason on WhatsApp** with the action-plan SUMMARY trend and ask for a counter reset before starting captions. Do not start Section F until the counter is reset.

---

# SECTION F — generate-captions: 3 iterations (run SECOND)

Same methodology. **3 iterations, 5–8 caption fixtures. Cycle 1 = baseline. Cycles 2 and 3 = one documented hypothesis each.** Captions run at temperature 0.8, so exact reproducibility is NOT expected — judge on the qualities the assertions check (3 distinct, ≤150 chars, on-tone, safe) and on whether the captions are actually share-worthy in the raw output.

**Counter math:** 5–8 fixtures × 3 cycles = 15–24 calls — fits one fresh 40-call session.

## Step F1 — captions cycle 1 (baseline)

```
Run the captions eval as a BASELINE. Confirm `supabase functions serve` is running, SUPABASE_URL/ANON_KEY are set, and RATE_LIMIT_ENABLED=false. Confirm count + cost first.

Run: `npx tsx scripts/eval/runner.captions.ts --cycle 1 --fixture all`

Baseline — do NOT change the prompt. Read the results file (the actual caption text in the raw output) and write a DECISIONS.md note: pass rate, failures + first failing assertion, and quality judgment on the raw captions (are the 3 genuinely distinct angles? on-tone? actually screenshot-worthy, or generic? any near-misses on the 150-char limit or safety rules?). Fill SUMMARY.md. Commit results file + DECISIONS.md note.

Note: because temperature is 0.8, captions vary run to run — that's expected. Judge quality, not reproducibility.
```

## Step F2 — captions cycles 2 and 3 (run once per cycle, n = 2 then 3)

```
We are improving the captions prompt with ONE hypothesis this cycle.

1. Read the previous cycle's captions results file (the raw caption text) and supabase/functions/generate-captions/prompts/system.txt.
2. Pick ONE specific, testable hypothesis for a single prompt change (e.g. "force the 3 captions onto 3 named angles: self-deprecating / shock-stat / hopeful-comeback", "make tone X punchier", "add a length governor so captions land 80–140 chars not right at 150"). Write the hypothesis + which fixtures you expect to change in the DECISIONS.md note BEFORE you edit.
3. Make that ONE change to system.txt. Nothing else.
4. Re-run: `npx tsx scripts/eval/runner.captions.ts --cycle <n> --fixture all` (confirm cost first).
5. Compare to the previous cycle. DECISIONS.md note: hypothesis, exact change, reasoning, pass-rate delta, regressions (read the raw captions — at temp 0.8 distinguish a real regression from normal variation), keep-or-revert. Revert if it hurt more than it helped.
6. Update SUMMARY.md. Commit results file + prompt change (or revert) + DECISIONS.md note.
```

## 🔒 STOP — end of 528

After captions' 3 cycles: commit + push everything (results files, SUMMARY.md, DECISIONS.md notes). Message Jason on WhatsApp with both SUMMARY trends (action-plan and captions) and the final pass rates. **Then stop.** Deployment is a separate doc (`529_NEXT_STEPS.md`).

---

# Order of operations (528)

**Step 0 — prompt source-of-truth fix (free, code-only):**
0. Sync `system.txt` with the live `prompt.ts` content per function → switch all 3 functions to load via `Deno.readTextFileSync` → delete `prompt.ts`.

**Section D — build downstream fixtures (free):**
1. D1 action-plan fixtures from real analyses → D2 refine caption fixtures with real values.

**Section E — action-plan testing (spends credits, local serve):**
2. E1 baseline → E2 cycle 2 hypothesis → E2 cycle 3 hypothesis (~30 calls).
3. 🔒 Commit, push, message Jason, get counter reset.

**Section F — captions testing (spends credits, local serve):**
4. F1 baseline → F2 cycle 2 hypothesis → F2 cycle 3 hypothesis (15–24 calls).
5. 🔒 STOP. Commit, push, message Jason with both trends. Deployment is delivered separately in `529_NEXT_STEPS.md`.

All build/fixture steps are code-only and free. All iteration testing runs against locally-served endpoints, logs raw output to `scripts/eval/results/`, and respects the 40-call cap. Action-plan and captions are tested on the real outputs of the analyze endpoint, not hand-made inputs.
