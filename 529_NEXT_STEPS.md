# May 27 — Next Steps (Part 3: frontend — surface the backend data)

The backend rebuild produces **far more structured data than the current UI shows**. `FinalAnalysis` now carries the server `score`/`scoreLabel`/`scoreColor`, six derived metrics, per-field + overall confidence, a structured `debts[]`, `mentionedSpending[]`, and several insight arrays; the action plan returns `overallMessage` + steps with `category`/`confidence`; captions and action plans are persisted per analysis. The frontend was built against the OLD shape and surfaces only a fraction of this. This doc wires each screen to display the real backend data.

## Prerequisites (must be true before FE1)

1. **CLIENT_FIX_PROMPTS Prompt 0 (Metro/@shared) and Prompt 3 (single-sourced types) are done and committed** — screens can import `@shared` and bind to `FinalAnalysis`/`ActionPlanResponse`/`Tone`. (Verified on `master`.) ⚠️ Two leftover client fixes from CLIENT_FIX → 527 (the `fetchActionPlan` band-aid wrapper, the userContext defaults in `claudeApi.ts`) are folded in as **Step FE0 below and must be done first**, before any data-surfacing work.
2. **528_BACKEND_FINAL is committed** — the backend baseline includes auth hardening (`set_username` RPC, nullable `profiles.username`, community-post username gate), community hardening (UNIQUE on `analysis_id`, emoji whitelist, trigger-based reaction counts), Stripe Subscriptions (`user_subscriptions` table, `stripe-webhook`, `create-checkout-session`, `create-portal-session`), rate-limiter Jest tests, and the mock-test suite. The service-layer functions this doc surfaces (`analyzeFinances`, `fetchOrGenerateActionPlan`, `fetchOrGenerateCaptions`) all exist from 527's earlier work.

**This doc is pure presentation** — it does not depend on prompt quality, only on the data shapes, which are already frozen.

## Conventions (every step)

- Fresh Claude Code session per prompt. **Read the named screen first** — match the existing design system (`Colors`/`Typography`/`Spacing`/existing components). No new dependencies, no new design primitives, no animations unless the screen already has them.
- **No API calls — every step here is free.** The data already arrives from the services; you are only displaying it. Verify by rendering with the stub fixture (FE2), not by calling the API. The coworker never triggers a paid API call from the app.
- Use the server's values as-is — never recompute `score`/`scoreLabel`/`scoreColor` or re-derive metrics on the client.
- Run `npx tsc --noEmit` AND a bundle (`npx expo export --platform android`, then delete `dist/`) after each step. Commit per step.
  - **Why Android when we ship iOS?** This app deploys to **iOS only**. The Android export is NOT a deploy — it's just a free, Windows-runnable smoke test that catches module-resolution (`@shared`) and type errors, which are platform-agnostic. The real iOS build + on-device testing is Jason's, on the Mac. Don't read "android" as a second target.

## Responsive / iOS SE-first rules (apply to EVERY screen step)

These screens must work on the **smallest target first — iPhone SE (375pt wide, short, no notch)** — and scale up. The coworker builds and verifies on Android/bundle; Jason does the real iOS device pass afterward (see `531_NEXT_STEPS.md`). There is no SE device in the coworker's loop, so the layout must be responsive **by construction** — it can't be fixed on SE after the fact.

- **No fixed pixel dimensions for layout.** Use flex, percentages, `gap`, `flexWrap`. Never hardcode container widths/heights that assume a screen size. (Icons/avatars may have fixed sizes; layout containers may not.)
- **Long content scrolls.** ResultsScreen, ActionPlanScreen, and the History detail will be tall — wrap their content in a `ScrollView`/`FlatList` with padded `contentContainerStyle`. Assume it must fit a short SE screen by scrolling, not by shrinking.
- **Text wraps or truncates — never overflows.** Long strings (summary, roast, step descriptions, debt names) wrap or use `numberOfLines` + ellipsis. The FE2 stub must include a near-max-length string so this is actually exercised.
- **Safe areas.** Respect top/bottom insets using the SafeAreaView/insets pattern the app ALREADY uses (read another screen first; do not add a new lib).
- **Touch targets ≥ 44×44pt** for anything tappable (caption copy, retry, step checkboxes).
- **No notch/Dynamic Island magic numbers** — the SE has neither. Use insets, not hardcoded offsets.
- Sanity-check narrow width on Android/web at a 375pt viewport; Jason does the true SE Simulator + 14 Pro device check in 531.

These are constraints, not features — near-zero added time if applied while building, but a full redo if bolted on later.

---

## Step BR — Working-branch reset (DO FIRST, before Step FE0)

We're consolidating to master-only to prevent the regression we hit before (off-script work landed on `develop`, master inherited it). All work in this doc happens **directly on master**. Do this before reading the rest of the doc.

```
We're consolidating all branches to master to prevent regression. Before any other work in this doc, do this cleanup.

1. FIRST, ASK me: "Which branch are you currently on?" Wait for my answer before proceeding.

   - If I say "master" (and `git branch --show-current` confirms `master`): proceed to step 2.
   - If I say anything else (develop, feature/action-plan, copilot/..., a feature branch you spun up, anything): make me run `git checkout master && git pull origin master` first, then confirm with `git branch --show-current` that we're now on master, then proceed to step 2.

2. Delete the three stale branches that exist on the remote. None has any work that master doesn't already have — all three have been audited and confirmed dead:
   - `develop` — was an ancestor of master, zero unique commits.
   - `feature/action-plan` — was an ancestor of master, zero unique commits.
   - `copilot/vscode-mpnlvblr-bsng` — old VS Code Copilot Workspace checkpoint; its one unique commit was superseded by master's later work.

   Run:

       git branch -d develop
       git branch -d feature/action-plan
       git branch -D copilot/vscode-mpnlvblr-bsng
       git push origin --delete develop
       git push origin --delete feature/action-plan
       git push origin --delete copilot/vscode-mpnlvblr-bsng

   Notes you may need:
   - Lowercase `-d` is the safety net — it refuses to delete a branch with un-merged commits. develop and feature/action-plan are ancestors of master, so `-d` succeeds. If it ever refuses, STOP and tell me — that means there's unexpected un-merged work and we need to look.
   - The copilot branch is NOT an ancestor — it has one un-merged checkpoint commit that was superseded by master's later work. Use uppercase `-D` to force-delete locally. Audit confirmed this is safe.
   - If `git branch -d/-D` says "not a branch" for any of them (e.g., you don't have `copilot/...` checked out locally), that's fine — skip the local delete for that one. The remote `git push origin --delete` still works.

3. DO NOT create a new branch. From here on, every step in this doc (FE0 → FE12) lands DIRECTLY on master. If you ever feel you need a temporary branch for a specific change you want PR-reviewed, make it short-lived off master (e.g. `git checkout -b fix-x master`), merge it back to master immediately when done, and delete it. No parallel long-running branches under any circumstance.

Constraints: git operations only; no code edits; no API calls.

Show me: which branch I started on (your initial question answered), the output of all six delete commands (errors included if any), and `git branch -a` after the cleanup — confirming only `master` and the usual remote refs remain.
```

---

## Step FE0 — Finish the client contract fixes (DO FIRST, before any screen work)

Four prereqs to handle before any data-surfacing work — three client-side cleanups (FE0a/b/c) plus one backend prompt-source-of-truth fix (FE0d) bundled here so all pre-screen-work cleanup happens together:

- **FE0a — a dangerous band-aid in `claudeApi.ts`.** Prompt 2's contract fix was effectively done by 527 B3: `fetchOrGenerateActionPlan(analysis, tone, analysisId?)` exists with the correct `{ analysis, tone }` body, and `ResultsScreen` was updated to use it. BUT the old `fetchActionPlan(userId, analysisId)` was kept as a "thin wrapper" that hardcodes `'savage'` and casts `{} as any` for the analysis — worse than the original bug, since any future caller that uses the old signature now sends garbage to the endpoint. **Delete it.**
- **FE0b — analyze still 400s on the empty-form path.** The userContext form on `HomeScreen` was wired (commit `4290ed4`, B#5 from the coworker's earlier work), so users who interact with the form work fine. But the form is OPTIONAL: if the user skips it, `HomeScreen.tsx:117` passes `undefined`, `ProcessingScreen` forwards it, and `claudeApi.ts:69` defaults to `{}` — which the analyze endpoint's `validateRequest` rejects with 400 before reaching Claude. **Fill the defaults in `claudeApi.ts` so the empty-form path is also schema-valid.**
- **FE0c — username pickoff screen.** 528_BACKEND_FINAL Step 1 makes `profiles.username` nullable on signup and gates community-feed posting on username being set (via RLS). The app needs a screen that prompts new users to choose a username and calls the `set_username` RPC. Build it now so it's in place before any community-feed-adjacent screen work later. **Wire the screen + the post-signup routing.**
- **FE0d — backend prompt regression (only backend item in this doc).** While work was on the `develop` branch, the three `prompt.ts` files got re-added and the index.ts files switched back to importing from them; master inherited the regression. On master today: `prompt.ts` is the live source, `prompts/system.txt` is a dead orphan, `cache_control: { type: 'ephemeral' }` was dropped from all three Claude system blocks (silently ~90% extra Anthropic spend per call), AND the Step 0 typo fix (`finalAnalysis` → `analysis`) landed on the dead orphan so Claude is still reading the wrong field name. **Restore single-source from `system.txt`, restore `cache_control`, re-apply the typo fix on the canonical file, delete `prompt.ts`.** Backend cleanup that has to happen before any screen work is meaningful.

(A separate backend leftover — deleting the dead `supabase/functions/_shared/*` modules — is handled outside this doc.)

**Done is NOT "tsc passes."** Especially for FE0b, a wrong body is still well-typed; trace the body against the endpoint's `validateRequest` by hand. (No API call needed to verify; if one is made, the 400 happens before any Claude call, so it's free.)

### FE0a — Delete the `fetchActionPlan` band-aid wrapper

```
527 B3 introduced `fetchOrGenerateActionPlan(analysis, tone, analysisId?)` with the correct `{ analysis, tone }` body, and `src/screens/ResultsScreen.tsx` was updated to use it — so the Prompt 2 contract bug is functionally fixed. BUT the old `fetchActionPlan` was kept in `src/services/claudeApi.ts` as a "thin wrapper" that calls `fetchOrGenerateActionPlan({} as any, 'savage', analysisId)`. That is worse than the original bug: it casts an empty object as the analysis, hardcodes the tone, and any future caller that uses the old signature gets garbage data sent to the endpoint. Remove it cleanly.

1. Grep `src/` for any caller of `fetchActionPlan` whose match is NOT inside the longer `fetchOrGenerateActionPlan` name (use a word-boundary pattern like `\bfetchActionPlan\b`). Expected result: zero hits beyond the definition itself.
2. If any caller still uses the old signature, migrate it to `fetchOrGenerateActionPlan(analysis, tone, analysisId?)` first — never leave a call to the old function.
3. Delete the exported `fetchActionPlan` function (and the `// Thin wrapper for backward compat — callers should use fetchOrGenerateActionPlan` comment above it) from `src/services/claudeApi.ts`.

Verify: `npx tsc --noEmit` + bundle are green, and a second grep of `src/` returns ZERO references to `fetchActionPlan` (only `fetchOrGenerateActionPlan` should remain). Show me the diff and the before/after grep output.
```

### FE0b — Fill the analyze userContext defaults

```
`analyzeFinancialSituation` in `src/services/claudeApi.ts` sends `userContext: userContext ?? {}`. An empty `{}` fails the analyze endpoint's `validateRequest` (it requires `state`, `ageBracket`, `incomeBracket`, `livingSituation`, `employmentStatus`, …), so calls from the empty-form path return HTTP 400 before Claude is reached. (Note: the userContext form on `HomeScreen` is already wired — users who fill any field are fine; we're closing the empty-form hole.) First read `shared/schemas.ts` (`UserContextSchema`) and `supabase/functions/analyze/index.ts` (`validateRequest`).

Fix:
- Build a `DEFAULT_USER_CONTEXT` with every `UserContextSchema` field set to `'unknown'`, except `debtBracket: 'none'` and `liquidSavingsBracket: 'under_500'`.
- Send `userContext: { ...DEFAULT_USER_CONTEXT, ...(userContext ?? {}) }` so the body is always schema-valid even when the UI passes nothing.
- Type the parameter as `Partial<UserContext>` (import from `@shared/types`), not `Record<string, unknown>`.

Verify: `npx tsc --noEmit`, and confirm that analyze called with NO `userContext` still produces a body that satisfies `AnalyzeRequestSchema`. Show me the change.
```

### FE0c — Username pickoff screen

After 528_BACKEND_FINAL Step 1, new accounts have `profiles.username = NULL` until they pick one. Posting to the community feed is gated at the RLS layer until they do. Build the screen that prompts them to choose a username and apply it via the `set_username` RPC.

```
Build a `UsernameSetupScreen` that runs once per account after first signup. It calls the `set_username` RPC delivered in 528_BACKEND_FINAL Step 1 to apply the choice.

First read:
- `src/screens/HomeScreen.tsx` (to see how the app currently routes after signup; look for a session/auth bootstrap pattern)
- `src/types/index.ts` (the profile type — verify `username` is typed as `string | null` after Prompt 3's aliasing; if not, fix the local type)
- `src/services/claudeApi.ts` (for the supabase client pattern — you'll call `client.rpc('set_username', { p_username })`)
- App.tsx or any top-level auth/session hook (the routing entry point)

Contract from 528_BACKEND_FINAL Step 1's `set_username` RPC:
- Input: `{ p_username: string }`
- Success: `{ ok: true, username: '<saved>' }`
- Failure: `{ ok: false, error: 'not_authenticated' | 'invalid_length' | 'invalid_charset' | 'taken' }`
- Server rules: 3–24 chars, lowercase a–z + 0–9 + underscore only, must be unique (case-insensitive — RPC lowercases before saving).

Build:
1. New screen `src/screens/UsernameSetupScreen.tsx`:
   - Single text input + a character counter (3/24).
   - Real-time client-side validation matching the RPC's rules (length 3–24, charset `^[a-z0-9_]+$`); show inline error as user types; disable Submit until valid.
   - Submit calls `client.rpc('set_username', { p_username: value })`.
   - Dispatch on response:
     - `ok: true` → success haptic (the app already uses expo-haptics elsewhere), navigate to Home (`navigation.replace('MainTabs')` or whatever the post-auth root is — read the existing nav to match).
     - `error: 'taken'` → "That username is taken — try another."
     - `error: 'invalid_length' | 'invalid_charset'` → re-display the matching client-side message (server shouldn't see these if client validation is right; defensive).
     - `error: 'not_authenticated'` → log out and route to Login (something's wrong with the session).
   - Match the design system (Colors / Typography / Spacing). No new design primitives, no animations beyond what the app already uses.
   - Responsive per the SE-first rules at the top of this doc.

2. Routing — display this screen automatically when the signed-in user's `profiles.username` is null:
   - Read the existing auth/session bootstrap (App.tsx or the auth context/hook).
   - On session restore / sign-in, fetch the profile (`profiles.select('username').eq('id', user.id).single()`).
   - If `username` is null → route to UsernameSetupScreen as a blocking step before MainTabs/Home.
   - If `username` is non-null → continue to the existing post-auth route.

3. Add a `UsernameSetup: undefined` entry to `RootStackParamList` in `src/types/index.ts`.

4. Defense in depth: any community-feed entry point (e.g. `CommunityFeedScreen.tsx` if it exists) should check `profile.username` first and route to UsernameSetupScreen if null — never let the user attempt a post and have RLS reject it silently. The RLS gate is the real enforcement; this is just UX.

Constraints: new screen file + minimal routing/auth-bootstrap changes; design system; SE-first responsive; no new dependencies; `npx tsc --noEmit` + bundle (`npx expo export --platform android`, delete `dist/`).
Show me: the new UsernameSetupScreen, the auth-bootstrap routing diff, the navigation type entry, any CommunityFeedScreen guard added, and the tsc + bundle result.
```

### FE0d — Restore the prompt source-of-truth (delete `prompt.ts`, read `system.txt`, restore `cache_control`)

```
Fix the prompt source-of-truth regression on master. The three `prompt.ts` files exist and are the live source (each function's `index.ts` imports from them), while `prompts/system.txt` is a dead orphan. Three real problems result: (1) two sources for one contract will drift; (2) `cache_control: { type: 'ephemeral' }` is missing from all three Claude system blocks (silently ~90% extra input-token spend per call); (3) the typo fix (`finalAnalysis` → `analysis`) was applied to `system.txt` while the live `prompt.ts` still says `finalAnalysis`, so Claude is reading the wrong field name on every action-plan call. Closing the regression fixes all three at once.

For EACH of the three functions (analyze, action-plan, generate-captions):

1. Read `prompt.ts` and `prompts/system.txt` for the function. If their content differs, OVERWRITE `system.txt` with `prompt.ts`'s content — `prompt.ts` is the post-regression live source and contains any iteration changes the coworker made on master. `system.txt` becomes the canonical version.

2. After the overwrite, apply the `finalAnalysis` → `analysis` fix in `supabase/functions/action-plan/prompts/system.txt` (both the prose AND the example JSON block) — the original Step 0 fix was on `system.txt` and would have been clobbered by step 1. Grep `action-plan/prompts/system.txt` for `finalAnalysis` to confirm zero remaining matches.

3. In `index.ts`, replace:
   ```ts
   import { X_PROMPT } from './prompt.ts';
   const SYSTEM_PROMPT = X_PROMPT;
   if (!SYSTEM_PROMPT || SYSTEM_PROMPT.length < 100) {
     throw new Error('prompt.ts missing or truncated');
   }
   ```
   (or whatever the equivalent block is — read it first) with:
   ```ts
   const SYSTEM_PROMPT = Deno.readTextFileSync(
     new URL('./prompts/system.txt', import.meta.url),
   );
   if (!SYSTEM_PROMPT || SYSTEM_PROMPT.length < 100) {
     throw new Error('system.txt missing or truncated');
   }
   ```

4. In the same `index.ts`, restore `cache_control: { type: 'ephemeral' }` on the Claude `system` block. Change:
   ```ts
   system: [{ type: 'text', text: SYSTEM_PROMPT }],
   ```
   to:
   ```ts
   system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
   ```
   Apply identically across all three functions. (Groq's `messages:` system content stays as-is — that path doesn't use Anthropic's cache_control.)

5. Grep the function directory for any remaining reference to `./prompt` (anything not `./prompts/`) — should be zero.

6. Delete `supabase/functions/<function>/prompt.ts`.

Sanity checks (no paid API calls):
- For each function, confirm `SYSTEM_PROMPT` is still used in both the Claude `system:` block (now with `cache_control`) and the Groq `messages:` system content.
- `npx tsc --noEmit` (Deno-specific remote imports may not fully type-check; goal is no errors in your edits).
- With `supabase functions serve` running locally, observe the startup logs — each function loads `system.txt` at module init via `Deno.readTextFileSync`, so if the path is wrong the function fails to load and the throw appears in the logs. STARTUP smoke test, NOT an endpoint invocation. Do NOT invoke the endpoints.
- Re-deploy each function to hosted Supabase so production picks up the fix: `supabase functions deploy analyze`, `supabase functions deploy action-plan`, `supabase functions deploy generate-captions`. File resolution behaves the same in deployed functions.

Constraints: code/text refactor only; prompt content must not change as a side effect beyond the documented `finalAnalysis` → `analysis` fix on action-plan; apply identically across all three functions; do not skip the cache_control restoration — it is the silent cost regression.

Show me, per function:
- A diff of `prompts/system.txt` (the live content copied in from `prompt.ts`, plus the `finalAnalysis` → `analysis` change for action-plan).
- The `index.ts` diff (deleted import, added `Deno.readTextFileSync` block, restored `cache_control` on the system block).
- Confirmation that `prompt.ts` is deleted.
- The local-serve startup result.
- The hosted deploy confirmation.
- The grep confirming zero remaining `finalAnalysis` in `action-plan/prompts/system.txt`.
```

---

## Step FE1 — Field-coverage map (read-only, do this first)

You can't "show all the data" until you know what's missing. This step produces a checklist; it changes no code.

```
Produce a field-coverage map for the analyze + action-plan data. Do NOT edit anything. First read: `shared/schemas.ts` (FinalAnalysisSchema, AIRawOutputSchema, ActionPlanResponseSchema), `src/screens/ResultsScreen.tsx`, `src/screens/ActionPlanScreen.tsx`, `src/screens/ShareScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/DebtPayoffScreen.tsx`.

Build a markdown table with one row per FinalAnalysis field (score, scoreLabel, scoreColor, monthlyIncome/Expenses/liquidSavings {value,confidence}, debts[], cfpb_responses, scoreModifier, scoreModifierReason, summary, roast, insights, topProblems, positiveBehaviors, topFix, emotionalStatus, mentionedSpending, monthlySavings, savingsRate, debtTotal, monthlyDebtService, emergencyFundMonths, debtToIncomeRatio, avgConfidence) plus the ActionPlanResponse fields (overallMessage, steps[].week/title/description/category/impact/confidence). For each: which screen (if any) currently displays it, and a suggested disposition — SHOW (user-facing), OPTIONAL (nice-to-have / expandable detail), or INTERNAL (used for scoring, not shown, e.g. cfpb_responses).

Output the table and a short list of the biggest gaps (data the backend returns that NO screen currently shows). Do not edit code. I (Jason) will confirm the SHOW/OPTIONAL/INTERNAL calls before you build the screens.
```

> After FE1, Jason confirms the disposition column. The per-screen steps below assume sensible defaults; adjust to Jason's map.

## Step FE2 — Stub fixture for no-spend preview

So every screen below can be previewed in the app WITHOUT calling the paid API.

```
Create a stub fixture so screens can be rendered without an API call. First read `shared/schemas.ts` (FinalAnalysisSchema, ActionPlanResponseSchema).

Create `src/__fixtures__/sampleAnalysis.ts` exporting:
- `SAMPLE_ANALYSIS: FinalAnalysis` — a realistic mid-band case (e.g. score ~55 "Surviving"): some debts, a mix of low/medium/high confidence on the income/expense/savings fields, a non-empty mentionedSpending, insights/topProblems/positiveBehaviors populated, a topFix, an emotionalStatus. It MUST satisfy FinalAnalysisSchema — import the schema and `FinalAnalysisSchema.parse(SAMPLE_ANALYSIS)` at module load so an invalid stub fails loudly.
- `SAMPLE_ACTION_PLAN: ActionPlanResponse` — overallMessage + 4 steps spanning categories (savings/debt/income/mindset) with varied confidence. Validate it against ActionPlanResponseSchema the same way.

If real analyze outputs already exist in `scripts/eval/results/`, you may lift one as the basis instead of hand-writing it.

Constraints: code-only, no API call; `npx tsc --noEmit`. This fixture is for dev preview only — never import it into production screens (only into a temporary dev wiring you revert).
Show me the fixture and confirm both .parse() calls pass.
```

## Step FE3 — ResultsScreen: surface the full analysis

This is the biggest screen. The backend now returns the score band, six derived metrics, structured debts, mentioned spending, and several insight arrays — most of which the old screen never showed.

```
Wire `src/screens/ResultsScreen.tsx` to display the full FinalAnalysis from the backend. First read ResultsScreen.tsx (see what it already renders and which fields it reads) and `shared/schemas.ts` (FinalAnalysisSchema). Use the FE1 map for what to SHOW.

Display, using the SERVER's values (never recompute):
- Score header: the gauge/number using `score`, the band name `scoreLabel`, and `scoreColor` for the band color. `emotionalStatus.emoji` + `emotionalStatus.label` near it.
- `summary` (the headline read) and `roast` (the spicy line), in the existing text styles.
- Derived metrics block: `savingsRate`, `monthlySavings`, `emergencyFundMonths`, `debtToIncomeRatio`, `debtTotal`, `monthlyDebtService` — labeled, formatted (%, months, $). Reuse any existing stat/metric component.
- `topFix` (action + monthlyImpact) as a highlighted "biggest win" callout.
- Lists: `topProblems`, `positiveBehaviors`, `insights` — each as a labeled list, hide a list if empty.
- `mentionedSpending[]` (category + amount) as a small "what you mentioned" list, only if non-empty.
- `debts[]` summary (name, balance, urgency) — or, if DebtPayoffScreen (FE6) owns the detailed debt view, just a count/total here with a link.

Confidence: do NOT build the confidence UI here — that's FE4. Leave hooks (e.g. a placeholder) where per-field confidence and `avgConfidence` will attach.

Preview with the FE2 stub: temporarily render ResultsScreen with `SAMPLE_ANALYSIS`, run the app, eyeball it, then revert the temporary wiring.

Constraints: only ResultsScreen.tsx (+ existing shared components); match the design system; no recomputation; `npx tsc --noEmit` + bundle.
Show me the diff, a description of the new layout, and the tsc + bundle result.
```

## Step FE4 — Confidence indicator (reusable) + apply on Results

The backend attaches `confidence` (low/medium/high) to every estimated number and an overall `avgConfidence`. Users must see when a figure was ESTIMATED from vague input vs stated — this is core to trusting the score.

```
Add a small reusable confidence indicator and apply it on ResultsScreen. First read `src/screens/ResultsScreen.tsx` and the existing component/style files (Colors/Typography) to match the look.

1. Create a small `ConfidenceBadge` component (in the existing components folder) that takes `confidence: 'low' | 'medium' | 'high'` and renders a subtle, non-alarming indicator (e.g. a dot + "estimated" for low, nothing or a faint check for high). Keep it tiny and consistent with the design system. No new deps.
2. On ResultsScreen, attach it to the income/expenses/savings figures (each has its own `confidence`) and show an overall "Confidence: X%" derived from `avgConfidence` (e.g. near the score) so the user knows how much was inferred. For low overall confidence, show a one-line "based on limited info — add detail for a sharper read" hint.

Preview with the FE2 stub (it has mixed-confidence fields). Revert temporary wiring after.

Constraints: ConfidenceBadge + ResultsScreen only; design-system styles; `npx tsc --noEmit` + bundle.
Show me the component, the ResultsScreen changes, and the tsc + bundle result.
```

## Step FE5 — ActionPlanScreen: overallMessage + full steps

Prompt 2 fixed the contract; this makes the screen show everything the plan returns, backed by the persistence from 527 B3 (instant re-views).

```
Wire `src/screens/ActionPlanScreen.tsx` to show the full action plan and use the persistence layer. First read ActionPlanScreen.tsx, `src/services/claudeApi.ts` (fetchOrGenerateActionPlan from 527 B3), and `shared/schemas.ts` (ActionPlanResponseSchema).

- Load the plan via `fetchOrGenerateActionPlan(analysis, tone, analysisId?)` so a saved plan returns instantly (no spinner/no API) and an unsaved one generates once. Show a loading state only while generating.
- Render `overallMessage` as the intro/summary.
- Render each step: `week` (string label), `title`, `description`, an `impact` callout, a `category` badge (savings/debt/income/mindset — give each a subtle color/icon from the design system), and the step's `confidence` via the FE4 ConfidenceBadge.
- `completed` is client-only: if the screen has step checkboxes, keep that state local (component state / storage); it is not part of the server response.
- If the plan fetch returns null, show a small retry affordance, not a crash.

Preview with the FE2 SAMPLE_ACTION_PLAN. Revert temporary wiring after.

Constraints: ActionPlanScreen.tsx only (+ existing components, the FE4 badge); design system; `npx tsc --noEmit` + bundle.
Show me the diff and the tsc + bundle result.
```

## Step FE6 — DebtPayoffScreen: consume the structured `debts[]`

The analysis now returns real structured debts (name, balance, interestRate, minimumPayment, urgency) — exactly what a payoff view needs.

```
Wire `src/screens/DebtPayoffScreen.tsx` to use the structured `debts[]` from the analysis. First read DebtPayoffScreen.tsx (see where it currently gets debt data) and `shared/schemas.ts` (the DebtItem shape inside AIRawOutputSchema: name, balance, interestRate, minimumPayment, urgency).

- Source the debts from the analysis's `debts[]` rather than any old manual/placeholder source.
- For each debt show: name, balance, interestRate (as a %), minimumPayment, and an `urgency` indicator (low/medium/high/critical → escalating color from the design system).
- If the screen offers a payoff strategy (avalanche/snowball), order/annotate by interestRate or balance accordingly — keep any existing strategy logic, just feed it the real debts.
- Handle the empty case (no debts) gracefully.

Preview with the FE2 stub (give SAMPLE_ANALYSIS at least two debts). Revert temporary wiring after.

Constraints: DebtPayoffScreen.tsx only (+ existing components); design system; no recomputation of analysis fields; `npx tsc --noEmit` + bundle.
Show me the diff and the tsc + bundle result.
```

## Step FE7 — HistoryScreen: show persisted analyses, plans, and captions

Persistence (A4 captions, B3 action plans) means past analyses now carry their plan and captions. The history detail should read them — no API.

```
Wire `src/screens/HistoryScreen.tsx` to show persisted analysis data. First read HistoryScreen.tsx and `src/services/claudeApi.ts` (how analyses are listed/read; note the `analyses` row now has `action_plan` and `share_captions` columns).

- List: each past analysis with its `score`, `scoreLabel` (use `scoreColor` for the band color), date, and `emotionalStatus.emoji`.
- Detail (tapping an item): show the stored analysis (reuse the ResultsScreen pieces where practical), and if `action_plan` is non-empty show the saved plan, and if `share_captions` is non-empty show the saved captions — all READS, no API calls (the data is already on the row; the SELECT RLS policy returns it).
- Empty states for users with no history.

Preview with the FE2 stub as a fake history row. Revert temporary wiring after.

Constraints: HistoryScreen.tsx (+ existing components) only; reads only, no API; design system; `npx tsc --noEmit` + bundle.
Show me the diff and the tsc + bundle result.
```

## Step FE8 — ShareScreen: verify captions + score card (light)

The captions UI was built in 527 A5. This step just confirms it surfaces the data correctly and the score card uses the server band.

```
Verify `src/screens/ShareScreen.tsx` surfaces the backend data. First read ShareScreen.tsx and confirm the 527 A5 caption wiring (fetchOrGenerateCaptions) is present.

- Confirm the 3 captions render as tap-to-copy and use the cache-or-generate path (no duplicate generation per mount).
- Confirm the shareable score card uses the server `score` / `scoreLabel` / `scoreColor` (not a recomputed band), and shows `emotionalStatus`.
- Fix only gaps; do not rebuild the captions logic.

Preview with the FE2 stub. Revert temporary wiring after.

Constraints: ShareScreen.tsx only; design system; `npx tsc --noEmit` + bundle.
Show me what (if anything) you changed and the tsc + bundle result.
```

## Step FE9 — ScenarioSimulatorScreen: align the display (Decision D)

This screen is the subject of CLIENT_FIX_PROMPTS Cleanup D. Do NOT re-decide it here.

```
Read `src/screens/ScenarioSimulatorScreen.tsx`, `src/services/scoring.ts`, and CLIENT_FIX_PROMPTS Cleanup D. Apply ONLY the decision Jason already made in Cleanup D:
- Keep `calculateFinancialScore` for the WHAT-IF projection (the simulator has no cfpb_responses, so it cannot run the real CFPB scorer).
- For displaying the user's ACTUAL analysis result, use the server's `score` / `scoreLabel` / `scoreColor` — do not show a competing recomputed band as if it were the official score.
- Label the simulator's number per Cleanup D's chosen option so users don't expect it to match the analysis score.

If Cleanup D has not been decided yet, STOP and ask Jason — do not guess.

Constraints: ScenarioSimulatorScreen.tsx only (+ scoring.ts if the label changes there); `npx tsc --noEmit` + bundle.
Show me the diff and the tsc + bundle result.
```

## Step FE10 — Subscription wiring (Stripe Checkout + Customer Portal + entitlement source)

528_BACKEND_FINAL shipped three Stripe edge functions (`create-checkout-session`, `create-portal-session`, `stripe-webhook`) and the `user_subscriptions` table — but the frontend still routes through the AsyncStorage-based tier check in `src/services/purchases.ts`, which is client-side and bypassable. This step replaces that with a server-side `user_subscriptions` lookup, wires `PaymentScreen` / `PaywallScreen` to the real Stripe endpoints, and handles the return deep links.

```
Wire the frontend to the Stripe Subscriptions backend from 528_BACKEND_FINAL. Three concerns in this step:
(A) replace the AsyncStorage-based tier check with a server-side `user_subscriptions` lookup,
(B) wire `PaymentScreen` / `PaywallScreen` to call `create-checkout-session` and `create-portal-session` and open the returned URLs in the in-app browser,
(C) handle the Stripe return deep links (`ambroke://billing/success` / `cancel`) so the app refreshes the subscription state after a checkout / portal session.

First read these so you see the current state:
- `src/services/purchases.ts` — the AsyncStorage-based tier system being deleted.
- `src/screens/PaymentScreen.tsx` — the coworker partially modified this in `bf365c7`; check current state.
- `src/screens/PaywallScreen.tsx`.
- `src/services/claudeApi.ts` — for the supabase client pattern.
- `supabase/functions/create-checkout-session/index.ts` — body `{ plan: 'action_plan' | 'deep_dive' }`, returns `{ url }`, requires Authorization Bearer header.
- `supabase/functions/create-portal-session/index.ts` — same auth pattern, returns `{ url }`.
- `supabase/migrations/00012_user_subscriptions.sql` — source-of-truth shape (plan, status, current_period_end, cancel_at_period_end, trial_end). SELECT-own RLS allows the client to read its own row.
- `app.json` (or `app.config.*`) — current URL scheme.
- `DECISIONS.md` — the subscription product spec from 528_BACKEND_FINAL Step 3 (trial length, refund policy, plan-change behavior).
- All current callers of the old tier system — grep `src/` for `getPurchaseTier`, `usePremium`, `hasAccessTo`, `isPremium`, `@/services/purchases`, `@/services/stripe`, `@/hooks/usePremium`.

Build:

1. New service `src/services/subscriptions.ts`:
   - `type UserSubscription = { plan: 'action_plan' | 'deep_dive' | null; status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused' | null; current_period_end: string | null; cancel_at_period_end: boolean; trial_end: string | null; }`
   - `getUserSubscription(userId: string): Promise<UserSubscription | null>` — selects from `user_subscriptions` with `.eq('user_id', userId).maybeSingle()`. Returns the row or `null` (null is fine — means the user has never started a checkout).
   - `hasAccessTo(sub: UserSubscription | null, required: 'action_plan' | 'deep_dive'): boolean`:
     - false if `sub` is null, or `sub.status` is null, or `sub.status` not in `['active', 'trialing']`.
     - true if `sub.plan === 'deep_dive'` (deep_dive includes action_plan access).
     - true if `sub.plan === 'action_plan'` AND `required === 'action_plan'`.
     - false otherwise.
   - `isPremium(sub: UserSubscription | null): boolean` — true if status is `'active'` or `'trialing'` AND plan is non-null.

2. New hook `src/hooks/useSubscription.ts`:
   - Returns `{ subscription, loading, refetch }`.
   - Loads on mount via `getUserSubscription(currentUser.id)`.
   - Re-fetches when the current user changes.
   - Re-fetches on app foreground via `AppState.addEventListener('change', s => { if (s === 'active') refetch(); })` so the app picks up webhook-driven changes within a foreground cycle.
   - Exposes `refetch()` for manual refresh after a checkout / portal close.
   - (Supabase Realtime push on `user_subscriptions` row updates is a v1.1 nice-to-have; foreground polling + manual refetch is sufficient for v1.0.)

3. Migrate consumers of the old AsyncStorage tier system:
   - Replace each call site with the new hook + helpers. Inside a screen: `const { subscription } = useSubscription(); const canAccess = hasAccessTo(subscription, 'action_plan');`.
   - Once nothing imports from `src/services/purchases.ts` or `src/hooks/usePremium.ts`, **delete both files**. They're the leftover AsyncStorage-tier system — fully replaced.

4. PaymentScreen / PaywallScreen wiring:
   - Show two plan options: "Action Plan — $4.99/mo" and "Deep Dive — $9.99/mo" with trial messaging per `DECISIONS.md`.
   - On tap, invoke the edge function with the user's access token:
     ```ts
     const { data: { session } } = await supabase.auth.getSession();
     const { data, error } = await supabase.functions.invoke('create-checkout-session', {
       body: { plan },
       headers: { Authorization: `Bearer ${session?.access_token}` },
     });
     ```
   - On `{ url }`, `await WebBrowser.openBrowserAsync(url)` (`expo-web-browser`). The await resolves when the user dismisses the browser — at that point call `refetch()` so the UI picks up any new state from the webhook.
   - If the user already has an active subscription, hide the "Subscribe" buttons and show their current plan instead (`useSubscription` makes this trivial).

5. "Manage Subscription" button:
   - Add to `SettingsScreen.tsx` or `ProfileScreen.tsx` (read both and pick the natural home — likely Settings).
   - Visible only when `subscription` is non-null with `status` in `['active', 'trialing', 'past_due']`.
   - On tap, invoke `create-portal-session` (same auth header pattern), open the returned `url` via `WebBrowser.openBrowserAsync`, and `refetch()` on dismiss.

6. Deep link handling:
   - Confirm `app.json` (or `app.config.*`) has `expo.scheme: 'ambroke'`. If missing, add it. If present and different, reconcile so it matches the `success_url` / `cancel_url` / `return_url` configured in the create-checkout-session and create-portal-session functions.
   - Use `expo-linking` to listen for incoming URLs at the app root (`App.tsx` or a top-level effect):
     ```ts
     const sub = Linking.addEventListener('url', ({ url }) => {
       const parsed = Linking.parse(url);
       if (parsed.hostname === 'billing' && parsed.path === '/success') { /* refetch + navigate to confirmation or MainTabs */ }
       else if (parsed.hostname === 'billing' && parsed.path === '/cancel') { /* navigate back to Paywall */ }
     });
     ```
     Also call `Linking.getInitialURL()` once on mount to catch cold-start deep links.

Constraints: new service + hook files; edits to PaymentScreen / PaywallScreen / Settings (or Profile) + app config + a top-level deep-link listener; design system; SE-first responsive per this doc's rules; no new deps (`expo-web-browser`, `expo-linking`, `@supabase/supabase-js` are already in package.json); `npx tsc --noEmit` + bundle.

Verify:
- `npx tsc --noEmit` clean.
- Bundle (`npx expo export --platform android`, delete `dist/`) succeeds.
- Grep `src/` for any remaining `getPurchaseTier`, `usePremium`, `@/services/purchases`, `@/services/stripe`, `@/hooks/usePremium` — must be zero.
- `src/services/purchases.ts` and `src/hooks/usePremium.ts` both deleted.

Show me:
- The new `src/services/subscriptions.ts` + `src/hooks/useSubscription.ts`.
- The PaymentScreen / PaywallScreen / Settings (or Profile) diffs.
- The `app.json` (or `app.config.*`) URL scheme change.
- The top-level deep-link listener code.
- The grep confirming zero remaining old-tier-system references.
- Confirmation that the two old files are deleted.
- tsc + bundle results.
```

---

## Step FE11 — Dev-mode AI mocks (GATED: only after one real flow is confirmed)

Once the full flow has been proven to work end-to-end ONE time, stop spending on it. This step makes the app, **in dev mode only**, return canned responses for all three AI calls — so further building/QA of the navigation flow (submit → results → action plan → share) costs $0. Production always calls the real endpoints.

**This step itself is free. It is GATED on a single confirmed real flow** — do not mock a flow you haven't verified, or you'll cache broken behavior as "working."

```
We want DEV-ONLY mocks for the three AI calls so we stop spending API credits while building/QA-ing the frontend flow. Production must be unaffected.

FIRST — GATE. Ask me (the coworker) this and WAIT for my answer; do not write any code yet:
"Has ONE full real flow been run and confirmed error-free — i.e. a single real analyze call, then its action plan, then its captions, all returning valid data with no errors (in the app, or via the harness, with Jason's cost OK)?"
- If I answer NO / not yet: STOP. Tell me to coordinate that one real flow with Jason first (it is the only sanctioned real spend here, ~3 calls) and to come back and confirm before mocking. Do NOT implement mocks against an unverified flow.
- If I answer YES: proceed.

THEN implement (dev-only, consistent mocks):
1. Extend `src/__fixtures__/sampleAnalysis.ts`: add `SAMPLE_CAPTIONS: CaptionResponse` whose 3 captions are consistent with SAMPLE_ANALYSIS (derive them from its `score` / `scoreLabel` / `roast`). Now all three fixtures describe ONE analysis — SAMPLE_ANALYSIS → SAMPLE_ACTION_PLAN → SAMPLE_CAPTIONS line up. Validate it with `CaptionResponseSchema` at load.
2. Add a single mock flag in config (e.g. `src/config/ai.ts`): `export const USE_AI_MOCKS = __DEV__ && true;` with a comment: "flip to false to make REAL calls in dev; production ignores this — __DEV__ is false in release builds, so mocks NEVER ship."
3. In `src/services/claudeApi.ts`, at the TOP of each of the three service functions (analyze, fetchOrGenerateActionPlan, fetchOrGenerateCaptions), add `if (USE_AI_MOCKS) { /* return the matching mock */ }` BEFORE any network call. To keep test fixtures OUT of the production bundle, load them with a dynamic `await import('../__fixtures__/sampleAnalysis')` inside that guarded branch. Optionally `await` a short delay (~600ms) so loading states still render.
4. The three mocks MUST be the consistent set from step 1, so a mocked flow looks like one coherent user (the same analysis flowing into its plan and captions).

Hard guarantees:
- `__DEV__` is PART of the flag, so a release/production build NEVER returns a mock — reason through the flag and state this to me in writing.
- The mock is the DEFAULT in dev (so we don't accidentally spend); flipping the flag to false is the deliberate way to hit the real endpoints when needed.

Constraints: code-only, no API call in THIS step; `npx tsc --noEmit` + bundle.
Show me: the SAMPLE_CAPTIONS addition, the config flag, the three guarded early-returns, and your written confirmation that production cannot mock (because of `__DEV__`).
```

## Step FE12 — Final verification (no spend)

```
Final check that the frontend surfaces the backend data and still builds. Do NOT call the API.

1. Run `npx tsc --noEmit` — must be clean.
2. Run a bundle: `npx expo export --platform android`, confirm it completes with no resolution/type errors, then delete the generated `dist/`.
3. Using the FE2 stub (SAMPLE_ANALYSIS / SAMPLE_ACTION_PLAN), temporarily preview ResultsScreen, ActionPlanScreen, DebtPayoffScreen, HistoryScreen, ShareScreen and confirm each renders the new fields. Revert all temporary preview wiring.
4. Grep the screens for any leftover references to removed/old fields (e.g. `spendingBreakdown`, `data.actionPlan`, `step.completed` coming from the server, client score recomputation).

Show me: the clean tsc output, the bundle result, a short per-screen note on what new data each now shows, and confirmation that all temporary stub wiring was reverted.
```

---

# Order of operations (529)

All steps are frontend-only and **free** (no API calls). Verify each with tsc + bundle.

0. **BR** working-branch reset — confirm we're on master, delete the three stale branches (`develop`, `feature/action-plan`, `copilot/vscode-mpnlvblr-bsng`), do NOT create new branches; all subsequent work lands directly on master.
1. **FE0** pre-screen-work cleanup (FE0a delete the `fetchActionPlan` band-aid wrapper + FE0b fill analyze userContext defaults + FE0c username pickoff screen wired to 528_BACKEND_FINAL's `set_username` RPC + FE0d restore prompt source-of-truth: delete `prompt.ts`, read `system.txt`, restore `cache_control: ephemeral`, re-apply the `finalAnalysis`→`analysis` fix on the canonical file) — the data-surfacing steps depend on the analyze call actually returning, the old footgun being gone, authed users having a username, and the live prompt actually being the one being iterated.
2. **FE1** field-coverage map (read-only) → Jason confirms SHOW/OPTIONAL/INTERNAL.
3. **FE2** stub fixture (enables no-spend preview of everything below).
4. **FE3** ResultsScreen → **FE4** Confidence indicator → **FE5** ActionPlanScreen → **FE6** DebtPayoffScreen → **FE7** HistoryScreen → **FE8** ShareScreen verify → **FE9** ScenarioSimulator (Decision D).
5. **FE10** subscription wiring — `user_subscriptions` server-side entitlement source, PaymentScreen/PaywallScreen call `create-checkout-session`, "Manage Subscription" calls `create-portal-session`, deep-link returns refresh state; delete the old `purchases.ts` + `usePremium.ts` AsyncStorage tier system.
6. **FE11** dev-mode AI mocks — GATED on ONE confirmed real end-to-end flow; after this, all further flow work is free.
7. **FE12** final verification (tsc + bundle + stub render walk-through).

**Prereqs recap:** CLIENT_FIX_PROMPTS Prompt 0 + Prompt 3 are done; the leftover client contract fixes are **FE0 here (do first)**. 528_BACKEND_FINAL is committed and provides the caption / action-plan-persistence service functions used by FE5/FE7/FE8 plus the auth / community / subscription backend FE0c builds on. This doc is presentation only — no backend dependencies remain.

**The only spend in this doc** is the single real end-to-end flow that gates FE11 (one analyze → its plan → its captions, cost-confirmed with Jason). After FE11's dev mocks land, all further flow building/QA is free. Everything else (FE1–FE10, FE12) is presentation/verification with no API calls. (FE10's subscription work runs entirely in Stripe test mode — no real charges.) Note: FE3–FE9 already preview off the static FE2 stub for free; FE11's mocks are what make the *live navigation flow* (submit → results → plan → share) runnable in dev without spending.
