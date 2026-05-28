# May 27 — Next Backend Steps (Part 1: build + harden + analyze testing)

**Prerequisite (Jason confirms separately):** the Part A client fixes in `CLIENT_FIX_PROMPTS.md` (Prompt 0 Metro → Prompt 1 claudeApi → Prompt 2 action-plan) must be done and committed **before** anything in this document.

**How the work is split, and why:** the action-plan and generate-captions **iteration runs**, plus the production **deploy**, are deliberately NOT in this file. They live in `528_NEXT_STEPS.md`, which Jason hands over **only after he reviews the analyze test results**. Last cycle a written "gate" was ignored; this time the gated work physically isn't in your hands until analyze is signed off.

This file (527) is the **build + analyze-test** half. It covers exactly four things:
1. Build the share-card caption generator.
2. Harden the backend: rate limiting on all 3 endpoints, Groq fallback parity, action-plan persistence.
3. Set up the test harness so it can run all three endpoints (analyze, action-plan, captions) and log raw output to files.
4. Run **3 iterations on the analyze endpoint ONLY**, with full documentation and raw output saved for Jason.

**Two things 527 does NOT do, on purpose:**
- It does not deploy anything to hosted Supabase. Everything here is tested against **locally-served** functions. The production deploy is the final step of 528 — deploying now would push action-plan/caption prompts that haven't been iterated yet.
- It does not run action-plan or caption iterations. When analyze's 3 cycles are committed and Jason has reviewed them, he gives you 528.

Conventions for every prompt (same across all endpoints):
- Fresh Claude Code session per prompt. Read the named files first — do not guess shapes.
- Prompts live in `prompts/system.txt`, loaded via `Deno.readTextFileSync` (file-based, cacheable).
- Endpoints use tool use, `cache_control: { type: 'ephemeral' }`, and shared Zod types in `shared/`.
- Run `npx tsc --noEmit` after each. Commit per step.
- Build steps make **no API calls** (free). Only Section C's runs (plus the two small smoke tests in A6 and B4) spend credits.

---

# SECTION A — Build & test the Share-Card Caption Generator

**What it is:** on first open of the Share screen, generate **3 distinct, short, share-ready captions** in one Claude call. Cache per analysis so it generates once. Temperature 0.8 (captions want variety, not reproducibility).

**Design (agreed):** endpoint `generate-captions`, input `{ score, scoreLabel, roast, tone }` → output `{ captions: [string,string,string] }` (exactly 3, ≤150 chars each); cache via nullable `share_captions JSONB` on `analyses`; write only on success; anonymous users get session-only captions; shared type `CaptionRequestSchema`/`CaptionResponseSchema`.

## Step A1 — Shared caption types

```
Add the caption request/response schemas to the shared folder. First read `shared/schemas.ts` and `shared/types.ts` to match existing style and the tone enum.

In `shared/schemas.ts` add:
- `CaptionRequestSchema = z.object({ score: z.number().min(0).max(100), scoreLabel: z.string(), roast: z.string(), tone: z.enum(['savage','gentle','therapist','older_sibling','finance_bro']) })`
- `CaptionResponseSchema = z.object({ captions: z.array(z.string().min(1).max(150)).length(3) })`

In `shared/types.ts` export inferred types `CaptionRequest` and `CaptionResponse`. Ensure `shared/index.ts` re-exports them.

Constraints: match existing naming; don't touch other schemas; run `npx tsc --noEmit`.
Show me the additions and the tsc result.
```

## Step A2 — Migration: cache column + UPDATE policy

This migration does two things: adds the caption cache column AND adds the missing `UPDATE` row-level-security policy. The `analyses` table currently has SELECT / INSERT / DELETE policies but **no UPDATE policy** — without one, the caption cache write (Step A4) and action-plan persistence (Step B3) are silently blocked by RLS, so captions/plans would regenerate and re-bill on every visit. Both features write to the `analyses` row, so one UPDATE policy covers both.

```
Add a migration that (1) adds a nullable JSONB column `share_captions` to `analyses`, and (2) adds an UPDATE RLS policy so users can update their own analyses row.

First read `supabase/migrations/00001_initial.sql` to confirm the existing policy style (it uses `auth.uid() = user_id`), then list `supabase/migrations/` to find the highest-numbered migration and use the next sequential number.

New migration content:
  ALTER TABLE analyses ADD COLUMN IF NOT EXISTS share_captions JSONB;

  CREATE POLICY "Users can update own analyses"
    ON analyses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

Rules: JSONB not text (we store the array of 3 strings as real JSON, never a stringified string); column nullable, no default. The UPDATE policy must match the existing policies' style. Note that this same policy is what makes action-plan persistence (Step B3) work too.

Show me the migration file path + contents, and confirm: share_captions is JSONB + nullable, and the UPDATE policy keys on auth.uid() = user_id.
```

## Step A3 — The `generate-captions` edge function

```
Build a new Supabase Edge Function `generate-captions` returning exactly 3 short share captions. Mirror the `action-plan` function. First read `supabase/functions/action-plan/index.ts`, `tool.ts`, and `prompts/system.txt`.

Create:
1. `supabase/functions/generate-captions/prompts/system.txt` — persona: "Am I Broke?" caption writer. Produce exactly 3 DISTINCT TikTok/Twitter-native captions for a score card. Each ≤150 chars, screenshot-worthy, in the given tone, each a different angle (self-deprecating / shock / hopeful comeback). Hard rules: no named securities/crypto/tickers, no self-harm, no "I'm a licensed..." claims. Return ONLY the tool call. Include one worked example.
2. `supabase/functions/generate-captions/tool.ts` — export `submitCaptionsTool`, name `submit_captions`, input_schema `{ captions: array of exactly 3 strings, each maxLength 150 }`.
3. `supabase/functions/generate-captions/index.ts`:
   - Load system.txt via `Deno.readTextFileSync(new URL('./prompts/system.txt', import.meta.url))`.
   - SHARED CONTRACT (important — the response type is shared with the frontend, so it must NOT be redefined here): import the shared schemas/types via relative path, the SAME way analyze imports FinalAnalysis — `import { CaptionRequestSchema, CaptionResponseSchema } from '../../../shared/schemas.ts'` and `import type { CaptionResponse } from '../../../shared/types.ts'`. The edge function (producer) and the client (consumer, Step A4) must both reference these one definitions so the contract can't drift.
   - `validateRequest`: validate the body against the shared `CaptionRequestSchema` (score/scoreLabel/roast/tone) instead of hand-rolling field checks; on failure return 400 with stage 'parse_error', matching action-plan's error shape.
   - User message = `JSON.stringify({ score, scoreLabel, roast, tone })`.
   - Claude call: model `claude-sonnet-4-6`, `temperature: 0.8` (DELIBERATELY higher than analyze's 0.2 — captions want variety, reproducibility does not matter; add a comment saying so), `system` with `cache_control: ephemeral`, `tools: [submitCaptionsTool]`, `tool_choice: { type:'tool', name:'submit_captions' }`. Read `tool_use.input`.
   - Sanitize: truncate each caption to 150 chars; if >3 returned take first 3; if <3 throw a clear error (stage 'validation_error').
   - Validate the sanitized output with the shared `CaptionResponseSchema` BEFORE returning, so the function provably emits the shared shape; type that payload as the shared `CaptionResponse`.
   - Return `{ captions, _provider }` where `{ captions }` is the validated `CaptionResponse`. Reuse action-plan's CORS / jsonResponse / error-stage conventions.
   - REQUIRED Groq fallback: mirror action-plan's `callGroq` exactly (same model, same SYSTEM_PROMPT read from this function's system.txt, same provider selection via `body.provider === 'groq'`). This is not optional — all three endpoints must have a working Groq fallback (see Step B2).

Constraints: import the caption schemas/types from `../../../shared/` (do NOT redefine the caption shape locally — single source of truth); no API call during build; type-check.
Show me all three files, and confirm the function imports CaptionRequestSchema/CaptionResponseSchema from shared (not a local copy).
```

## Step A4 — Client: cache-or-generate captions

```
Wire the client to fetch-or-generate the 3 captions, cached per analysis. First read `src/services/claudeApi.ts` and `shared/schemas.ts` (CaptionRequestSchema, CaptionResponseSchema).

Import `CaptionResponse` and `CaptionResponseSchema` from the shared module via the `@shared` alias set up in CLIENT_FIX_PROMPTS Prompt 0 (the Metro fix) — these are the SAME definitions the generate-captions edge function uses, so producer and consumer can't drift. If the `@shared` import doesn't resolve, Prompt 0 hasn't been done yet — stop and do that first.

Add `fetchOrGenerateCaptions(analysis: FinalAnalysis, tone: RoastTone, analysisId?: string): Promise<CaptionResponse | null>`:
- analysisId provided (saved analysis): read `analyses.share_captions` for that row. Non-null → return it (CACHE HIT, no API call). Null → call `generate-captions` with `{ score, scoreLabel, roast, tone }`, validate with `CaptionResponseSchema`, and ON SUCCESS write the captions array into `analyses.share_captions` (JSONB array, NOT stringified). Return captions.
- analysisId absent (anonymous): call the endpoint, validate, return without persisting.
- CRITICAL: write only on success; on error leave it null and return null so the next visit retries.

Constraints: JSONB array never stringified; validate with shared schema; no client recomputation; `npx tsc --noEmit`.
Show me the new function and tsc result.
```

## Step A5 — ShareScreen wiring

```
Wire `src/screens/ShareScreen.tsx` to show 3 AI captions on first visit. First read ShareScreen.tsx — it receives `route.params.analysis`; check whether an analysisId is in scope.

On mount: call `fetchOrGenerateCaptions(analysis, <analysis tone>, analysisId if available)`. Show a small loading state in the captions section only (don't block the screen). Render the 3 captions as tap-to-copy options, matching existing styles (reuse Colors/Typography/Spacing, no new primitives, no animations). Generate at most once per mount (ref/flag guard). If it returns null, show a small "Couldn't generate — tap to retry" affordance, not a crash.

Constraints: only ShareScreen.tsx changes; `npx tsc --noEmit`.
Show me the diff and a short description of the captions UI.
```

## Step A6 — Test harnesses: shared eval lib + one runner per endpoint (SET UP all 3, RUN none yet)

Jason's call: the three endpoints have **different request shapes, response shapes, and assertions**, so one runner cannot honestly serve all three. Build a shared eval library for the machinery they all need, then a thin, **separate runner per endpoint**. This is setup only — it does not run iterations.

> **To be unmistakable about 527's scope:** A6 only *SETS UP* the testing foundation for all three endpoints — the shared lib, a runner per endpoint (analyze, action-plan, captions), and `assertActionPlan`/`assertCaptions` — plus the caption fixtures. It does **NOT** build the action-plan fixtures (those come from real analyze output in **528**) and it does **NOT** run action-plan or caption cycles. The ONLY endpoint actually exercised/iterated in 527 is **analyze** (Section C, 3 cycles). action-plan and captions are merely made *ready to test* here; their cycles live in 528.

```
Three parts: (1) extract a shared eval library, (2) create one runner per endpoint, (3) add fixtures + assertions. First read `scripts/eval/runner.ts`, `scripts/eval/fixtures.ts`, `scripts/eval/assertions.ts`, and `scripts/lib/call-counter.ts`.

Part 1 — Shared eval library `scripts/eval/lib/harness.ts`:
Extract everything the three runners share into one `runSuite(config)` function, where `config = { suite: string, endpointPath: string, fixtures, assertFixture, extractScore? }`. It must:
- parse `--cycle <n>` and `--fixture <id|all>`;
- fire the Enter-to-confirm cost prompt before any call, and enforce the 40-call cap via the existing call-counter (`recordApiCall` per fixture);
- POST each fixture's input to the LOCALLY-SERVED endpoint (read SUPABASE_URL / SUPABASE_ANON_KEY) and capture the FULL raw response body;
- run `assertFixture(rawResponse, fixture)` → pass/fail + first failing assertion;
- write `scripts/eval/results/cycle_<n>_<suite>_<ISO-timestamp>.json` with, for the run: cycle, suite, timestamp, git short-hash of that suite's `system.txt`, aggregate pass rate, avg response time, total API calls, and score-variance stats ONLY if `extractScore` is provided; and PER FIXTURE: id, pass/fail, first failing assertion, and the full **raw response body** (mandatory — so Jason reads the actual AI output, not just pass/fail);
- create/append `scripts/eval/results/SUMMARY.md` — one row per run: date, suite, cycle, prompt hash, pass rate, blank `note` column.

Part 2 — One runner per endpoint (thin wrappers over runSuite):
- `scripts/eval/runner.analyze.ts` — refactor the current `runner.ts` into this: imports `fixtures.analyze.ts` + `assertAnalyze`, passes `extractScore` (analyze has scores), suite 'analyze', endpoint 'analyze'. Replace the old `runner.ts`.
- `scripts/eval/runner.captions.ts` — imports `fixtures.captions.ts` + `assertCaptions`, suite 'captions', endpoint 'generate-captions', no `extractScore`.
- `scripts/eval/runner.action-plan.ts` — imports `fixtures.action-plan.ts` + `assertActionPlan`, suite 'action-plan', endpoint 'action-plan'. The fixtures file does NOT exist yet (it's built in 528) — the runner must FAIL CLEANLY with a clear message ("action-plan fixtures not built yet — see 528") if the file is missing or empty, never crash with a stack trace.

Part 3 — Fixtures + assertions:
- Rename `scripts/eval/fixtures.ts` → `scripts/eval/fixtures.analyze.ts` (keep exports).
- Create `scripts/eval/fixtures.captions.ts` with 5-8 fixtures. Each input `{ score, scoreLabel, roast, tone }` spanning low/mid/high scores and different tones.
- In `scripts/eval/assertions.ts`, keep `assertAnalyze` and ADD two functions: `assertCaptions` (exactly 3 captions; each ≤150 chars; each non-empty; the 3 distinct; no forbidden strings — Bitcoin, tickers, "as your CFP", self-harm terms) and `assertActionPlan` (overallMessage non-empty ≤400; steps a non-empty array; each step has week/title/description/impact non-empty; no forbidden strings; plan consistent with the score band). Defining `assertActionPlan` now means 528 only has to build its fixtures.

Constraints: Node + tsx; do NOT run any harness in this step; `npx tsc --noEmit`.
Show me the shared lib, the three runner files, the renamed + new fixtures, the two new assertions, and confirm no API call was made.
```

**Smoke test (one of two small A/B-section API calls, ~$0.04):** with `supabase functions serve` running locally and SUPABASE_URL/ANON_KEY set:

```
Run ONE caption fixture as a smoke test through the captions runner: `npx tsx scripts/eval/runner.captions.ts --cycle 0 --fixture <first-fixture-id>`. Confirm the cost prompt fires, it returns exactly 3 distinct captions ≤150 chars, and a results file with the raw response is written to scripts/eval/results/. Show me the results file. This is cycle 0 (smoke), not a real iteration.
```

---

# SECTION B — Backend hardening (rate limiting, Groq parity, action-plan persistence)

These are cross-cutting backend tasks. All are code-only/free except the one tiny rate-limit smoke test (B4). Do them after the caption generator is built so all three endpoints exist before you wrap them.

## Step B1 — Rate limiting for all 3 endpoints

**Why:** the live endpoints call a paid Anthropic API with `Access-Control-Allow-Origin: *`. analyze ALREADY has an in-memory `Map`-based limiter (20 req/60s/IP) — but in-memory state is per-isolate on Supabase's ephemeral/distributed edge runtime, so it resets on cold start and isn't shared across instances. It's near-useless protection, and action-plan/captions have none at all. We **replace** it with ONE Postgres-backed fixed-window limiter shared across all three endpoints, keyed by client IP, bypassed locally so the eval harness (which fires 13 rapid calls per cycle) is never throttled.

```
Add IP-based rate limiting to all three edge functions via a shared utility and a Postgres limiter, REPLACING analyze's existing in-memory limiter. First read supabase/functions/analyze/index.ts, supabase/functions/action-plan/index.ts, and (the just-built) supabase/functions/generate-captions/index.ts to see the request flow and where the Claude call happens.

IMPORTANT — analyze cleanup: analyze currently has an in-memory limiter (`rateLimitStore` Map, `checkRateLimit`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`, `getClientIP`) and its call site. DELETE all of that and route analyze through the shared `enforceRateLimit` instead. The shared util derives the client IP itself, so analyze's `getClientIP` can go too. Do NOT leave two limiters in analyze.

Part 1 — Migration (next sequential number in supabase/migrations/):
  CREATE TABLE IF NOT EXISTS api_rate_limits (
    bucket_key   text        NOT NULL,
    window_start timestamptz NOT NULL,
    request_count int         NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket_key, window_start)
  );

  CREATE OR REPLACE FUNCTION check_rate_limit(p_key text, p_max int, p_window_seconds int)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
    v_count  int;
  BEGIN
    -- self-prune: drop this key's stale windows so the table doesn't grow per key
    DELETE FROM api_rate_limits WHERE bucket_key = p_key AND window_start < v_window;
    INSERT INTO api_rate_limits (bucket_key, window_start, request_count)
    VALUES (p_key, v_window, 1)
    ON CONFLICT (bucket_key, window_start)
    DO UPDATE SET request_count = api_rate_limits.request_count + 1
    RETURNING request_count INTO v_count;
    RETURN v_count <= p_max;   -- true = allowed, false = over limit
  END;
  $$;

  -- sweeps rows for keys that went dormant (the per-key prune above only fires when a key is hit again)
  CREATE OR REPLACE FUNCTION cleanup_rate_limits()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  AS $$
    DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 day';
  $$;

  -- Schedule the sweep IF pg_cron is available; otherwise this is a no-op and the per-key prune
  -- above keeps the table bounded for active traffic. (Safe to skip if pg_cron isn't enabled.)
  -- select cron.schedule('cleanup-rate-limits', '0 3 * * *', 'select cleanup_rate_limits()');

Part 2 — Shared util `supabase/functions/_shared/rateLimit.ts`:
- Export `async function enforceRateLimit(req: Request, endpoint: string): Promise<void>` that THROWS an error with `.status = 429` and `.stage = 'rate_limited'` when over the limit.
- Bypass entirely when `Deno.env.get('RATE_LIMIT_ENABLED') === 'false'` (this is how local serve / the eval harness avoids being throttled). Default behavior (env unset or any other value) = enabled.
- Derive the key from the client IP: `req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'`. Bucket key = `${endpoint}:${ip}`.
- Limits from env with sane defaults: `RATE_LIMIT_MAX` (default 30) and `RATE_LIMIT_WINDOW_SECONDS` (default 3600) → 30 requests/hour/IP/endpoint. (analyze's old in-memory limit was 20/60s; the new default is 30/hour — confirm the final production numbers with Jason at deploy. They're env-tunable, so adjusting needs no code change.)
- Call the RPC with a SERVICE-ROLE supabase client (createClient from esm.sh @supabase/supabase-js@2, using SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, which are auto-injected in deployed functions). Call `.rpc('check_rate_limit', { p_key, p_max, p_window_seconds })`.
- FAIL OPEN: if the RPC itself errors (limiter outage), log a clear warning and ALLOW the request — do not take the app down because the limiter hiccuped. (Add a comment noting Jason can switch to fail-closed if abuse becomes a problem.)
- TESTABILITY: put the pure, side-effect-free logic in a SEPARATE file `supabase/functions/_shared/rateLimitLogic.ts` that imports nothing from Deno or esm.sh, exporting `deriveBucketKey(forwardedFor: string | null, endpoint: string)`, `isWithinLimit(count: number, max: number)`, `shouldBypass(enabledEnv: string | undefined)`, and `resolveLimits(maxEnv, windowEnv)` (defaults 30 / 3600). `rateLimit.ts` imports these and only does the IO (Deno.env reads + the service-role RPC call). This split lets Jest unit-test the logic without Deno globals — those tests are written in 528 Step G1.

Part 3 — Wire it in: in each of the 3 functions, call `await enforceRateLimit(req, '<endpoint-name>')` AFTER request validation but BEFORE the Claude/Groq call, so a 429 costs $0 in API spend. Map the thrown 429 into the existing error-stage response shape (status 429, stage 'rate_limited').

Constraints: shared util in _shared; no API call in this step; `npx tsc --noEmit` (note tsc may not type-check Deno remote imports — at minimum confirm the TS in _shared and the wiring compiles logically). Do NOT run the functions yet.
Show me the migration, the _shared/rateLimit.ts util, and the 3 wiring diffs.
```

## Step B2 — Groq fallback parity audit

```
Confirm all three endpoints have a WORKING Groq fallback (not just present code). First read the callGroq path in supabase/functions/analyze/index.ts, supabase/functions/action-plan/index.ts, and supabase/functions/generate-captions/index.ts.

Verify for each: (a) the Groq path reads the SAME system prompt from that function's prompts/system.txt (not a hardcoded string), (b) provider is selected the same way (`body.provider === 'groq'`), (c) the Groq response is parsed into the same output shape the Claude path returns, (d) errors carry a stage. If generate-captions is missing any of these, fix it to match action-plan. If analyze or action-plan drift from each other, note it.

Constraints: no API call; `npx tsc --noEmit`.
Show me a short per-endpoint checklist (✓/✗ for a–d) and any fixes you made.
```

## Step B3 — Action-plan persistence (save API calls + enable history)

**Why:** today every view of an action plan re-calls the API. We persist the generated plan to the existing `analyses.action_plan` JSONB column (mirrors caption caching from A4), so re-views cost $0 and history screens can read the stored plan. Relies on the UPDATE RLS policy added in A2.

```
Add client-side persistence for action plans, mirroring fetchOrGenerateCaptions. First read src/services/claudeApi.ts (find the existing action-plan invoke and fetchOrGenerateCaptions) and confirm the `analyses` table has an `action_plan JSONB` column (it does, default '[]').

Add `fetchOrGenerateActionPlan(analysis: FinalAnalysis, tone: RoastTone, analysisId?: string): Promise<ActionPlan | null>`:
- analysisId provided: read `analyses.action_plan` for that row. If it is a non-empty plan object (has overallMessage + a non-empty steps array) → return it (CACHE HIT, no API call). If it is null or the empty-array default `[]` or an empty object → call the `action-plan` endpoint with `{ analysis, tone }`, validate the response, and ON SUCCESS write the full `{ overallMessage, steps }` object into `analyses.action_plan` (real JSONB, never stringified). Return it.
- analysisId absent (anonymous): call the endpoint, validate, return without persisting.
- write only on success; on error leave the column unchanged and return null.

Then update the caller (wherever the action plan screen currently invokes action-plan) to use this function. History viewing needs no extra backend work — the analyses SELECT policy already returns action_plan, so a history screen just reads the persisted object.

Constraints: JSONB object never stringified; treat '[]'/null/empty-object as "not generated"; no client recomputation; `npx tsc --noEmit`.
Show me the new function, the caller change, and the tsc result.
```

## Step B4 — Rate-limit smoke test (cheap)

```
Verify the rate limiter works, as cheaply as possible. Two checks:

1. FREE check (no API): with the DB migrated locally, call the RPC directly three times with a tiny limit, e.g. via psql or a one-off script: `select check_rate_limit('test:1.2.3.4', 2, 3600);` three times. Confirm it returns true, true, false (allowed, allowed, blocked). This proves the limiter logic with zero API spend.

2. OPTIONAL endpoint check (~$0.04, confirm cost first): with `supabase functions serve` running and `RATE_LIMIT_ENABLED` NOT set to false and `RATE_LIMIT_MAX=1`, hit the analyze endpoint twice from the same IP. The first returns a normal result (1 paid call); the second returns HTTP 429 with stage 'rate_limited' and makes NO API call. Then set RATE_LIMIT_ENABLED=false again for the Section C testing so cycles aren't throttled.

Show me the RPC results (true/true/false) and, if you ran check 2, the 429 response body. Confirm RATE_LIMIT_ENABLED=false is restored before any Section C run.
```

## Step B5 — Upstream call safety (retry ceiling + fetch timeout)

**Why:** today `callClaude`/`callGroq` retry on 429 and 5xx by **recursing with no maximum**, and the `fetch` has **no timeout**. A persistently rate-limited or hung upstream means the edge function recurses or hangs until the platform kills it — wasted time and a runaway risk. This is code-only and makes no API calls.

```
Make the upstream Claude/Groq calls bounded and time-limited in all three edge functions. First read the callClaude and callGroq retry blocks in supabase/functions/analyze/index.ts and supabase/functions/action-plan/index.ts (and generate-captions/index.ts, which mirrors action-plan).

For each callClaude and callGroq:
1. Add a max-retry ceiling. Thread an attempt counter (or accept `attempt = 0` param) through the recursive retries; stop after 3 total attempts and throw a clear error (`.stage = 'upstream_unavailable'`, status 503) instead of recursing forever. This applies to BOTH the 429 path and the 5xx path.
2. Add a fetch timeout via AbortController: abort the request after ~30s (a constant, e.g. UPSTREAM_TIMEOUT_MS = 30000) and treat an abort as a retryable failure (subject to the same 3-attempt ceiling), then throw `.stage = 'upstream_timeout'` (status 504) if it never succeeds.
3. Keep the existing retry-after honoring for 429 and the backoff for 5xx — just bound them.

Keep the changes minimal and identical in shape across the three functions. Map the new stages into the existing error-stage response shape.

Constraints: no API call in this step; `npx tsc --noEmit`. Do NOT run the functions.
Show me the updated callClaude/callGroq for one function and confirm the same change was applied to all three.
```

---

# SECTION C — Analyze testing: 3 iterations ONLY (with documentation + raw output)

**Run iterations on the analyze endpoint only. Do not touch action-plan or captions iterations here — those are in 528.** Make sure `RATE_LIMIT_ENABLED=false` for local serve so the limiter doesn't throttle your cycles.

## C0 — Methodology (also used by 528 later)

- **3 iterations, at most 13 test cases per iteration.**
- **Iteration 1 = baseline.** Run the current prompt unchanged, log it, change nothing. Reference point. NOTE: If you already ran the 13 test cases with eval harness before and Claude remembers, use that data as the baseline instead. This first iteration will be a hypothesis iteration for improving the prompt.
- **Iterations 2 and 3 = one hypothesis each.** Before each: write the hypothesis in `DECISIONS.md` (what you expect to improve + which fixtures should change). Change ONE thing in `system.txt`. Re-run. Compare to the previous cycle's results file. Document outcome.
- Every run logs via the runner: a `cycle_<n>_analyze_*.json` (with raw output per fixture) + a row in `SUMMARY.md`.
- **Documentation is mandatory and is what Jason evaluates.** For each cycle, Claude writes into `DECISIONS.md`: the hypothesis, the exact change made, the reasoning, the pass-rate delta vs. the previous cycle, any regression on previously-passing fixtures, and a keep/revert decision. The runner logs the numbers + raw output; the DECISIONS.md note is the human-readable story.
- **Counter math:** one full 13-case cycle = 13 calls; 3 cycles = 39 (fits one 40-call session, no room for ad-hoc single-fixture runs). If you need single-fixture spot-checks, commit + push + message Jason for a reset.

## C1 — Analyze cycle 1 (baseline)

```
Run the analyze eval harness as a BASELINE. Confirm `supabase functions serve` is running locally, SUPABASE_URL/ANON_KEY are set, and RATE_LIMIT_ENABLED=false. Confirm the call count and cost before running.

Run: `npx tsx scripts/eval/runner.analyze.ts --cycle 1 --fixture all`

This is the baseline — do NOT change the prompt. After it finishes, read the results file in scripts/eval/results/ (including the raw responses) and write a findings note in DECISIONS.md: pass rate, which fixtures failed + first failing assertion each, and any quality concerns you notice in the raw outputs (even passing ones — e.g., bland roast, off-tone, fabricated numbers). Fill the SUMMARY.md note. Commit the results file + the DECISIONS.md note.
```

## C1 — Analyze cycles 2 and 3 (run this once per cycle, n = 2 then 3)

```
We are improving the analyze prompt with ONE hypothesis this cycle.

1. Read the previous cycle's results file in scripts/eval/results/ (look at the raw outputs, not just pass/fail) and the current `supabase/functions/analyze/prompts/system.txt`.
2. Propose ONE specific, testable hypothesis for a single prompt change that should improve output quality. State it plainly and say which fixtures you expect to change and how. WAIT for Jason's OK before editing.
3. After approval: make that ONE change to system.txt. Nothing else.
4. Re-run the locally-served function and: `npx tsx scripts/eval/runner.analyze.ts --cycle <n> --fixture all` (confirm cost first).
5. Compare the new results file to the previous cycle. Write a findings note in DECISIONS.md: the hypothesis, the exact change, the reasoning, pass-rate delta, ANY regression on previously-passing fixtures (check the raw outputs), and a keep-or-revert decision. If it regressed more than it helped, revert and say so.
6. Update SUMMARY.md. Commit the results file + the prompt change (or revert) + the DECISIONS.md note.
```

## 🔒 STOP — end of 527

After analyze's 3 cycles: commit + push everything (results files, SUMMARY.md, DECISIONS.md notes). Message Jason on WhatsApp with the SUMMARY.md trend and final pass rate. **Then stop.** Do not build or run action-plan/caption iterations, and do not deploy to production — that work is in `528_NEXT_STEPS.md`, which Jason gives you only after he reviews the analyze results. If analyze isn't good enough after 3 cycles, Jason decides the next move (more cycles or a prompt rethink) before anything downstream.

---

# Order of operations (527)

**Section A — build the caption generator (free except the A6 smoke test):**
1. A1 types → A2 migration (+UPDATE policy) → A3 endpoint → A4 client → A5 ShareScreen → A6 shared eval lib + 3 separate runners + fixtures/assertions → A6 smoke test (1 call via runner.captions.ts).

**Section B — backend hardening (free except the optional B4 endpoint check):**
2. B1 rate limiting (replaces analyze's in-memory limiter; table self-prunes) → B2 Groq parity audit → B3 action-plan persistence → B4 rate-limit smoke (free RPC check; optional ~1 paid call) → B5 upstream call safety (retry ceiling + fetch timeout, free). Restore RATE_LIMIT_ENABLED=false after B4.

**Section C — analyze testing (spends credits, local serve):**
3. C1 cycle 1 baseline → cycle 2 hypothesis → cycle 3 hypothesis (≤39 calls, documentation + raw output each).
4. 🔒 STOP. Commit, push, message Jason. Wait for 528.

All build steps are code-only and free. All testing runs against locally-served endpoints, logs raw output to `scripts/eval/results/`, and respects the 40-call cap. **No production deploy happens in 527 — that is the final step of 528.**
