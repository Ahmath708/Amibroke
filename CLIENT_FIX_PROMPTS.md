# Fix & Cleanup Prompts — branch `feature/action-plan`

Copy-paste prompts to fix the flaws and clean up the dead/duplicated code found in the audit. Open a fresh Claude Code session per prompt. Read the diff before accepting. Run `npx tsc --noEmit` after each. Commit per prompt.

**Part A (critical fixes) must be done in order — Prompt 0 → 1 → 2 — because each depends on the previous.** Part B (cleanup) can be done after, in any order, except where noted.

Almost everything here is **code-only — no API calls, no spending.** The one exception (Cleanup C) is flagged because it changes deployed function behavior.

---

# PART A — Critical fixes (in order)

## Prompt 0 — Make `@shared` resolvable by the Metro bundler (DO THIS BEFORE PROMPT 1)

**Why this is first:** The `shared/` folder is currently only usable by the edge function. The client has a `@shared/*` alias in `tsconfig.json` but **no `metro.config.js`**, so the React Native bundler cannot resolve `@shared` at build time. Any client import of `@shared/...` will **pass `npx tsc --noEmit` but crash at bundle time** with "Unable to resolve module." Prompt 1 imports the shared schema into the client, so this must be fixed first — otherwise Prompt 1 looks done (tsc passes) but the app won't build.

```
The repo has a `shared/` folder at the project root with TypeScript types and Zod schemas. The Deno edge function imports it fine via relative paths. But the React Native (Expo) client CANNOT import it: there is a `@shared/*` alias in tsconfig.json, but no metro.config.js, so the Metro bundler cannot resolve `@shared` at build time. Any client `import ... from '@shared/...'` passes `npx tsc --noEmit` but FAILS at bundle time with "Unable to resolve module". I need the client to be able to import from `@shared` at runtime.

Goal: make `@shared/*` resolve at BUNDLE time for the Expo/Metro client, without moving the shared/ folder.

Step A: Create `metro.config.js` at the repo root, extending Expo's default config (`const { getDefaultConfig } = require('expo/metro-config')`). Add the repo root to `config.watchFolders` so Metro watches the `shared/` folder (which sits outside the default project scope). Keep default `nodeModulesPaths` so node module resolution still works.

Step B: Add a `@shared` alias to `babel.config.js` using `babel-plugin-module-resolver` (install it as a dev dependency if it is missing). Map `@shared` → `./shared`. This is what makes the alias resolve at runtime; tsconfig `paths` alone do NOT affect Metro/Babel.

Step C: VERIFY BY ACTUALLY BUNDLING — and YOU run the bundle yourself with your terminal tool. Do not ask me to run it. tsc passing is NOT sufficient; that is the exact trap. Bundling is local and free — it makes no API calls, so there is no cost concern here.
- Temporarily add to `App.tsx`: `import { FinalAnalysisSchema } from '@shared/schemas';` and `console.log('shared resolved:', typeof FinalAnalysisSchema);`
- Run the bundle yourself: `npx expo export --platform android`. It is slow (1-2 minutes) and writes a `dist/` folder — that is expected. Let it finish.
- Read the output. PASS = it completes with NO "Unable to resolve module" / "Unable to resolve @shared" error. FAIL = any module-resolution error mentioning `@shared` or `shared/`.
- If it fails for an UNRELATED reason (a different module, a native/build issue not about @shared), say so explicitly — do not assume the @shared alias is the problem. Fix the unrelated issue or tell me; do not silently conclude @shared works without a clean bundle.
- After it bundles cleanly: REMOVE the temporary import/console.log from `App.tsx`, and DELETE the generated `dist/` folder (it is a build artifact — do not commit it).
- Paste the relevant lines of the bundle output to me as proof `@shared` resolved.

Constraints:
- Do NOT move the `shared/` folder. Keep it at the repo root.
- Do NOT break the existing `@/` alias for `src`.
- If `babel-plugin-module-resolver` causes trouble you cannot resolve in 30 minutes, STOP and tell me. The fallback is: use `import type` for shared TYPES only (Babel erases those, so Metro never resolves them) and skip importing shared runtime values into the client — but that changes Prompt 1, so check with me first.

When done, show me: the new metro.config.js, the babel.config.js change, any install command you ran, and the output of the bundle verification (must show NO resolution error).
```

---

## Prompt 1 — Migrate `claudeApi.ts` to the new backend contract

Fixes three flaws: wrong request shape (stale), client-side score override (added this cycle, conflicts with server CFPB score), and spendingBreakdown derivation (added this cycle, field no longer exists).

**NOTE — this migrates `claudeApi.ts` only.** The client still keeps duplicate type definitions in `src/types/index.ts` and `src/lib/validations.ts`, and other screens/hooks still consume them. Prompt 1 will compile green while those duplicates exist — that is the false-"done" trap. **Prompt 3 deletes the duplicates and finishes the single-sourcing; Prompt 1 is not the whole migration.**

```
The backend analyze pipeline was rebuilt: the edge function now takes a structured request `{ freeText, userContext, tone }`, uses Anthropic tool use, computes the CFPB score server-side, and returns a FinalAnalysis object. But the client `src/services/claudeApi.ts` was never migrated — it still sends the old `{ userInput }` shape AND it recomputes the score locally, throwing away the server's CFPB score. I need you to migrate the client to match the new backend.

First, read these files so you know the real shapes — do not guess:
- `src/services/claudeApi.ts` (the file you will edit)
- `shared/schemas.ts` (the source of truth: AnalyzeRequestSchema, FinalAnalysisSchema)
- `shared/types.ts` (AnalyzeRequest, UserContext, FinalAnalysis)

Then make these changes to `analyzeFinancialSituation` in `src/services/claudeApi.ts`:

1. CHANGE THE REQUEST SHAPE.
   - Add a parameter `userContext: Partial<UserContext> = {}` to the function signature.
   - Build the request body to match AnalyzeRequestSchema: `{ freeText, userContext, tone }`.
   - `freeText` is the user's text (you may keep the existing cleanUserInput() pass and send the cleaned text as freeText).
   - Fill any missing userContext fields with 'unknown' (and the bracket defaults from the schema: debtBracket 'none', liquidSavingsBracket 'under_500') so the body always validates against AnalyzeRequestSchema.
   - REMOVE `userInput` and `provider` from the body. The server picks the provider internally; the client no longer sends it.

2. DELETE THE CLIENT-SIDE SCORE RECOMPUTATION.
   - Remove the entire block that calls `calculateFinancialScore(...)` and overwrites `data.score`, `data.scoreLabel`, `data.scoreColor`.
   - The server already computes the official CFPB score and returns these fields. The client must TRUST them, not recompute. This block was added this cycle (commit f35df1d, "recompute score locally") from an older plan and it directly undoes the new server-side scoring.

3. DELETE THE CLIENT-SIDE spendingBreakdown DERIVATION.
   - Remove the entire block that derives/normalizes `data.spendingBreakdown` (percentage, status, color).
   - The new design removed `spendingBreakdown` entirely (replaced by `mentionedSpending` from the server). This block was added this cycle (commit 6e1a57a) from the older plan and references a field that no longer exists in the response.

4. UPDATE RESPONSE VALIDATION.
   - The response is now a FinalAnalysis (see shared/schemas.ts FinalAnalysisSchema), which has new fields like `mentionedSpending`, `avgConfidence`, `cfpb_responses`, and no `spendingBreakdown`.
   - Validate the response against the new shape from `shared/schemas.ts`, not the old `FinancialAnalysisSchema` in `src/lib/validations.ts`. If the old schema is still imported only for this, remove that import.

5. CLEAN UP DEAD IMPORTS.
   - After removing the two blocks, remove any now-unused imports (e.g., `calculateFinancialScore`, `SCORING_THRESHOLDS`, `SCORE_CONFIG`) if nothing else in the file uses them. Confirm with a grep before deleting.

Constraints:
- Do NOT change any UI screen (`src/screens/*`, `src/components/*`).
- Do NOT recompute, derive, or override anything the server already returns. The client's job is to send the request and pass the validated response through.
- Do NOT add new error handling beyond what is needed; keep the existing retry loop.
- Run `npx tsc --noEmit` and fix any type errors caused by the shape change.

When done, show me:
1. The full updated `analyzeFinancialSituation` function.
2. The list of imports you removed.
3. The `npx tsc --noEmit` output (must pass).
4. Confirmation that `data.score` is returned exactly as the server sent it — no client recomputation anywhere in the file.
```

---

## Prompt 2 — Fix the action-plan contract mismatch (request AND response)

**Already diagnosed.** The action-plan feature is broken end-to-end. The client and the endpoint disagree on both the request and the response. The endpoint is the correct side; the client is wrong.

**Request mismatch:** `fetchActionPlan` sends `{ userId, analysisId }`. The endpoint's `validateRequest` requires `{ analysis, tone }` (where `analysis` is an object with a numeric `.score`). So every client call is rejected with **400 "analysis is required."** The endpoint does NOT fetch the analysis from the DB by `analysisId` — it expects the full analysis object passed inline.

**Response mismatch:** The endpoint returns `{ overallMessage, steps: [...] }`. The client reads `data.actionPlan` — which doesn't exist — so it returns `[]`. The step shape also differs: the endpoint's `step.week` is a **string** and each step carries `category` + `confidence` (see `action-plan/tool.ts`), with 4–6 steps; the old client `ActionStep` expects `week: number` plus a `completed` flag and has no `confidence`.

**Root cause — UPDATED:** the shared schemas DO already exist — `ActionPlanRequestSchema`, `ActionPlanStepSchema`, and `ActionPlanResponseSchema` are in `shared/schemas.ts` and match the endpoint (including `category`, `confidence`, and `steps.min(4).max(6)`). The drift is that the CLIENT never adopted them. So this prompt is about making the client USE the existing shared schemas — NOT creating new ones.

Fix the client, keep the endpoint, add a shared type:

```
The action-plan client and endpoint have mismatched contracts on BOTH request and response. The endpoint is correct; the client is wrong. Fix the client and add a shared type so they can't drift again.

First read all of these so you know the real shapes — do not guess:
- `src/services/claudeApi.ts` → the `fetchActionPlan` function
- `supabase/functions/action-plan/index.ts` → `validateRequest` (what the endpoint expects) and the response it returns (`{ overallMessage, steps }`, sanitized)
- `supabase/functions/action-plan/tool.ts` → the exact output schema the endpoint produces
- `src/screens/ActionPlanScreen.tsx` → how the plan is currently consumed

Then:

1. Do NOT add a new schema — `ActionPlanResponseSchema`, `ActionPlanStepSchema`, and the inferred types `ActionPlanResponse`/`ActionPlanStep` already exist in `shared/schemas.ts` + `shared/types.ts`. Instead:
   - (a) VERIFY the existing `ActionPlanStepSchema` matches `action-plan/tool.ts` EXACTLY: `week` (string), `title`, `description`, `category` (enum savings/debt/income/mindset), `impact`, `confidence` (enum low/medium/high); `steps` min 4 max 6. If the Zod schema and the tool's `input_schema` disagree, reconcile them — they are two copies of ONE contract and must describe the same shape.
   - (b) Import `ActionPlanResponse` from shared into the client. Do NOT define a narrower local copy that drops `category`/`confidence`.

2. Rewrite `fetchActionPlan` in `src/services/claudeApi.ts`:
   - New signature: `fetchActionPlan(analysis: FinalAnalysis, tone: RoastTone, userContext?: Partial<UserContext>): Promise<ActionPlanResponse | null>`
   - Send body `{ analysis, tone, userContext: userContext ?? {} }` — NOT `{ userId, analysisId }`.
   - Read the response as `ActionPlanResponse` (it has `steps`, NOT `actionPlan`). Validate with `ActionPlanResponseSchema`. Return null on failure, not `[]`.

3. Update `src/screens/ActionPlanScreen.tsx` to consume the real shape:
   - It should pass the analysis object (already available on the results flow) and the tone into `fetchActionPlan`.
   - Render `steps` with the fields the endpoint actually returns: `week` (string), `title`, `description`, `category`, `impact`, `confidence`. These all come from the server.
   - `completed` is NOT a server field — it is client-only UI state. If the screen has step checkboxes, track `completed` in local component state / storage; do not expect it on the response or add it to the endpoint.

Constraints:
- Do NOT change the endpoint's request contract — the client adapts to the endpoint, not the reverse.
- Do NOT add a DB fetch to the endpoint — the analysis is passed inline by design.
- Run `npx tsc --noEmit` and fix type errors.
- This is code-only. No API calls.

When done, show me: which shared schema/types you imported (no new ones added), the rewritten `fetchActionPlan`, the ActionPlanScreen changes, and confirmation that the request body and response key now match the endpoint exactly.
```

---

## Prompt 3 — Single-source the client types on `shared/` (delete the duplicate definitions)

**Why this matters (the anti-regression + anti-false-claim step):** Prompts 1 and 2 migrate `claudeApi.ts` and `ActionPlanScreen`, but the client still keeps its OWN copies of the boundary types in `src/types/index.ts` (`FinancialAnalysis`, `ActionStep`, `RoastTone`) and a dead schema in `src/lib/validations.ts`. As long as those parallel definitions exist, two things stay broken: (1) the client can silently drift from `shared/` again, and (2) a migration can look "done" because `claudeApi.ts` compiles, while `useAnalysis.ts` / `HomeScreen.tsx` / `ScenarioSimulatorScreen.tsx` still feed on the stale shapes. This prompt removes the duplicates so `shared/` is the ONLY definition — and lets the compiler + bundler PROVE it. After this, a false "migrated" claim is structurally impossible: duplicates gone + tsc + bundle green = every consumer is on the shared shape.

```
Make `shared/` the single source of truth for the boundary types and delete the client's duplicate definitions. First read: `src/types/index.ts`, `shared/types.ts`, `shared/schemas.ts`, and these consumers — `src/hooks/useAnalysis.ts`, `src/screens/HomeScreen.tsx`, `src/screens/ScenarioSimulatorScreen.tsx`, `src/screens/ActionPlanScreen.tsx`, `src/services/claudeApi.ts`.

1. Add a single `Tone` type to shared: in `shared/types.ts`, `export type Tone = z.infer<typeof ToneSchema>;` (import ToneSchema from ./schemas). This becomes the one tone definition.

2. In `src/types/index.ts`, REPLACE the local definitions with aliases/re-exports of the shared types — do NOT keep parallel bodies:
   - `export type { FinalAnalysis as FinancialAnalysis } from '@shared/types';`
   - `export type { ActionPlanStep as ActionStep } from '@shared/types';`
   - `export type { Tone as RoastTone } from '@shared/types';`
   Keeping the old NAMES as aliases means call sites don't churn, but the SHAPE is now the shared one. Any other local type that references these (e.g. `AnalysisHistoryItem`) stays but now points at the shared shape.

3. Run `npx tsc --noEmit`. It WILL error wherever a screen/hook used a field the OLD shape had but the shared shape doesn't (e.g. `analysis.color` → `scoreColor`; `analysis.spendingBreakdown` → `mentionedSpending`; `step.week` number → string; `step.completed` → not a server field). Those errors ARE the migration checklist — fix each consumer to the real shared shape:
   - `useAnalysis.ts`, `HomeScreen.tsx`: align to FinalAnalysis / Tone field names.
   - `ScenarioSimulatorScreen.tsx`: this is the Decision-D file — KEEP its local `calculateFinancialScore` for the WHAT-IF projection, but for displaying the analysis RESULT use the server's `score` / `scoreLabel` / `scoreColor`, not a recomputed band.
   - `ActionPlanScreen.tsx`: already updated in Prompt 2 — just confirm it still compiles against the aliased `ActionStep`.

4. Delete `src/lib/validations.ts` (this absorbs Cleanup F): grep `src/` for `@/lib/validations` and `FinancialAnalysisSchema`; if nothing imports it after Prompts 1–3, delete the file.

DONE means ALL of: the local `FinancialAnalysis` / `ActionStep` / `RoastTone` BODIES are gone (only aliases remain), `src/lib/validations.ts` is deleted, AND both `npx tsc --noEmit` and a bundle (`npx expo export --platform android`, then delete the generated `dist/`) are green. Do NOT report this migrated until the bundle is clean — tsc alone is the trap (see Prompt 0).

Constraints: code-only, no API calls. Do NOT change `shared/` shapes or the endpoints. Aliases only — do not leave two real definitions of any boundary type.

When done, show me: the `src/types/index.ts` diff (proving the bodies are now aliases), the list of consumer files you fixed and the field renames you applied, the validations.ts deletion, and the tsc + bundle output.
```

---

## Process fix (not a prompt) — kill the old TODO.md

The root cause of the score-override and spendingBreakdown flaws: the old `TODO.md` and the new `PROMPT_ITERATION_PLAN.md` both exist, and the old one's "Step 4 / Step 5" got executed by mistake. **Delete or archive the old `TODO.md` so there is one plan, one source of truth.**

WhatsApp note to send:
> Two of the client bugs came from your old TODO.md (Step 4 score recompute, Step 5 spendingBreakdown) — they conflict with the new CFPB scoring. Please delete the old TODO.md so we only work from PROMPT_ITERATION_PLAN.md. Then do Prompt 0 → 1 → 2 from the fix doc (all code-only, no API calls).

---

# PART B — Cleanup (after Part A, any order except where noted)

## Cleanup A — Delete the two dead `prompt.ts` files

```
Two files are dead code: `supabase/functions/analyze/prompt.ts` and `supabase/functions/action-plan/prompt.ts`. Each is a deprecated TypeScript copy of a prompt that is now loaded from the matching `prompts/system.txt` file via Deno.readTextFileSync. Keeping a TS copy next to the live system.txt is a DRY hazard — the two can drift.

First confirm they are unused: grep the codebase for `from './prompt'` and `import` of these files in `supabase/functions/analyze/` and `supabase/functions/action-plan/`. Confirm zero imports.

Then delete both `prompt.ts` files. Do NOT delete the `prompts/system.txt` files — those are the live prompts. Run `npx tsc --noEmit` to confirm nothing broke. Show me the grep output and confirmation.
```

## Cleanup B — Delete the misleading eval/manual markdown docs

```
Two markdown files in scripts/ are misleading leftovers from an earlier commit: `scripts/eval_harness.md` and `scripts/manual_test.md`. They describe "verify the purchase tier fix" — which has nothing to do with the actual eval harness (`scripts/eval/runner.ts`) or manual-test script (`scripts/manual-test.ts`), both of which test the analyze endpoint.

Confirm the real scripts exist (`scripts/eval/runner.ts`, `scripts/eval/fixtures.ts`, `scripts/eval/assertions.ts`, `scripts/manual-test.ts`), then delete both `.md` files. They are not documentation of anything current. Show me the file listing before and after.
```

## Cleanup C — Extract duplicated edge-function boilerplate (DO LAST — changes deployed code)

**Do this only after the harness confirms both functions work.** It refactors working, deployed code and will require re-deploying and a re-test (1 health-check call), so it is not free and should not happen while the functions are still being validated.

```
The two edge functions `supabase/functions/analyze/index.ts` and `supabase/functions/action-plan/index.ts` duplicate the same plumbing: `callClaude`, `callGroq` (each with 429 + 5xx retry and exponential backoff), `CORS_HEADERS`, and `jsonResponse` — about 150 duplicated lines.

Extract the shared pieces into a new Deno module `supabase/functions/_shared/llm.ts` exporting:
- `CORS_HEADERS`
- `jsonResponse(body, status?, extraHeaders?)`
- A generic `callClaude({ systemPrompt, tool, messages })` and `callGroq({ systemPrompt, messages })` — parameterized so analyze and action-plan can pass their own prompt and tool.

Then update both index.ts files to import from `../_shared/llm.ts` and delete their local copies.

This is a behavior-preserving refactor. Do NOT change anything observable: same retry logic, same temperature (0.2), same cache_control, same error `stage` strings, same response shapes. After the change the two functions must behave identically to before.

Constraints:
- Deno relative imports only.
- Do NOT touch the prompts, tools, or schemas — only move the duplicated plumbing.
- Run a type check.

NOTE: this changes deployed function code. After it lands, re-deploy both functions and run ONE health-check call per function to confirm they still respond before trusting them.
```

## Cleanup D — Resolve the two competing scoring systems (DECISION, not a blind fix)

`src/screens/ScenarioSimulatorScreen.tsx` still uses the old `calculateFinancialScore` from `src/services/scoring.ts`, while the analyze flow uses the new CFPB scoring in `shared/scoring/`. A user's score in the simulator is computed by a different algorithm than their main analysis — the same finances can show two different numbers. But the CFPB score needs the 10 AI-inferred `cfpb_responses`, which the simulator (pure number what-ifs) does not have, so this is NOT a simple swap. Use this prompt to get options, then decide before editing:

```
Read `src/screens/ScenarioSimulatorScreen.tsx` and `src/services/scoring.ts` and `shared/scoring/index.ts`.

The app now has two scoring systems: the old `calculateFinancialScore` (used by the Scenario Simulator, computed from raw numbers) and the new CFPB scoring (used by the analyze flow, computed from 10 AI-inferred responses + confidence). They produce different numbers for the same finances. The CFPB scorer cannot run from raw numbers alone — it needs the cfpb_responses, which the simulator does not have.

Do NOT change code yet. Lay out the options for making the simulator consistent with the main score, with the trade-offs of each:
1. Have the simulator show a clearly-labeled DIFFERENT metric (e.g., "projected savings rate" or "monthly cash-flow change") instead of a competing 0-100 score.
2. Have the simulator call the analyze endpoint per scenario to get a real CFPB score (costs API calls per what-if — likely too expensive).
3. Keep both but rename the simulator's number so users don't expect it to match the analysis score.

Recommend the smallest option that removes the user-facing inconsistency. I will decide before any edits.
```

## Cleanup E — Soften the "IRT formula" overclaim

```
The prompt and README claim "official CFPB IRT formula", but the implementation uses the CFPB's published lookup table (see `shared/scoring/cfpb_irt.ts` comments — the IRT parameters were in an image-based PDF and could not be extracted). The lookup table IS the CFPB's recommended method, so the approach is fine; only the wording overclaims.

Change the wording in two places to "official CFPB scoring methodology (published lookup table)" instead of "official CFPB IRT formula":
- `supabase/functions/analyze/prompts/system.txt` (the line about how the server computes the score)
- `README.md` (every mention of "IRT formula" / "IRT-scored" / "IRT scorer")

Do NOT change the scoring code — it is correct. Only fix the wording.

NOTE: editing system.txt is a prompt change. It does not affect Claude's output (Claude only supplies the 10 responses regardless), but per our process, bundle this with the next eval-harness run to confirm no regression.
```

## Cleanup F — Remove the dead `src/lib/validations.ts` (AFTER Prompt 1)

**NOTE:** Prompt 3 now performs this deletion as its final step. Do Cleanup F standalone ONLY if you skipped Prompt 3.

```
After Prompt 1 switched `src/services/claudeApi.ts` to validate against `shared/schemas.ts`, the old `src/lib/validations.ts` (FinancialAnalysisSchema) is probably dead.

Grep the whole `src/` tree for any remaining imports of `@/lib/validations` or `FinancialAnalysisSchema`.
- If claudeApi.ts was the only consumer and Prompt 1 removed that import, delete `src/lib/validations.ts`.
- If anything else still imports it, do NOT delete — report what still uses it instead.

Run `npx tsc --noEmit` after. Show me the grep output and what you did.
```

---

# Order of operations

**Part A — do in order, before anything else (all code-only, no API calls):**
1. Delete old `TODO.md` (one source of truth).
2. **Prompt 0** — Metro/`@shared` resolution. Verify it BUNDLES (not just tsc). Commit.
3. **Prompt 1** — migrate `claudeApi.ts`. Verify tsc. Commit.
4. **Prompt 2** — fix action-plan contract; USE the existing shared schema (don't add one). Verify tsc. Commit.
5. **Prompt 3** — single-source client types on `shared/` (delete the duplicate `@/types` bodies + `validations.ts`). DONE = duplicates gone + tsc AND bundle green. Commit.

**Part B — cleanup, after Part A:**
6. **Cleanup A** — delete dead `prompt.ts` x2.
7. **Cleanup B** — delete misleading eval/manual `.md` docs.
8. **Cleanup E** — soften "IRT formula" wording (bundle with next harness run).
9. **Cleanup F** — remove dead `validations.ts` — ALREADY handled by Prompt 3; only needed standalone if Prompt 3 was skipped.
10. **Cleanup D** — decide the two-scoring-systems question (report options first); the consumer fix itself lands in Prompt 3.
11. **Cleanup C** — extract edge boilerplate — **LAST**, only after the harness confirms the functions work; requires re-deploy + re-test.

**Already correct — no prompt needed:**
- The analyze Groq call already pulls its prompt from `analyze/prompts/system.txt` (uses `SYSTEM_PROMPT`). No change required.

**Anti-drift principle (why Prompt 3 exists):** a migration is "done" only when the duplicate definition is DELETED and `tsc` + a bundle are green — not when an import is added. While two definitions of a boundary type coexist, the client can silently drift from `shared/` and a "done" claim can be false. Prompt 3 enforces this for the type layer.

Everything in Part A and Cleanup A/B/E/F is code-only and free. Cleanup C is the only one that re-touches deployed code.
