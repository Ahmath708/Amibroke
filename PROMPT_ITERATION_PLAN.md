# Prompt Iteration Plan — Am I Broke?

## What you are building, in plain English

You are rebuilding the analyze pipeline. Right now the AI does too much: it parses inputs, computes math, picks a score, and writes the roast. You are splitting that work. Code will do math. The AI will do judgment and voice. The new architecture uses Anthropic's tool-use API for guaranteed structured output, the official CFPB Financial Well-Being scoring formula for the 0-100 score, baseline numbers for 50 US states, and a 40-call hard cap on the testing scripts so a script bug cannot burn the budget again.

This is a **backend-only** work cycle. You do not touch the frontend during these 13 steps. The frontend will be partially broken when you finish — that is expected and correct. The frontend rebuild happens in a later, separate cycle once the backend is verified.

You will build the new pipeline in 13 steps over 7 to 8 working days:

- **Steps 1-7** are pure code work. No API calls. No frontend changes.
- **Step 8** builds the eval harness (no calls — just the tool).
- **Step 9** builds the manual-test script (no calls — just the tool).
- **Step 10** is the human review gate. You make ONE health-check call, then STOP and wait for Jason to review everything. Make sure to tell Jason when you are done with this.
- **Steps 11-12** are where the real testing happens, only after Jason gives the green light.
- **Step 13** is the action-plan endpoint, designed through a guided Claude Code session.

Three rules above everything else:
1. **Testing only happens through the test scripts.** You never run the analyze endpoint by opening the app, tapping the analyze button, hitting curl as a habit, or using Postman. The test scripts are the only authorized path. This rule is repeated everywhere in this document because last cycle was nearly burned by ad-hoc app testing.
2. **The 40-call counter is your hard limit.** When you hit 40, the scripts refuse to run. You do not modify the counter or its cap to keep going. Instead, you commit and push your work to GitHub, then message Jason on WhatsApp so he can review what you ran and tell you what to do next.
3. **The frontend is allowed to be broken at the end of this work.** Backend first. Frontend in a separate cycle. The optional follow-up section after the 13 steps tells you what to do if you finish and Jason has not yet reviewed.

If any of those three feel surprising, re-read Section 0.

**How to reach Jason**: WhatsApp group chat. That is the channel for all approvals, counter resets, and questions. Do not use email or open GitHub issues.

---

## How to use this document

This document is a step-by-step plan for one specific job: rebuild the analyze pipeline with a better prompt, structured input, and a separate action-plan endpoint.

Read the whole document once before you start. Do not skim. Each step depends on the steps before it. If you skip ahead, the later steps will not work.

The plan has 13 steps. Total time budget: 7 to 8 working days. If you finish in less, that is good. If you go past 150% of any step's budget, stop and message Jason on WhatsApp.

**Why the testing tools come before the prompt iteration:** Steps 8 and 9 build the eval harness and the manual-test script — both without making any API calls. Step 10 is a gate: the first API call of the entire testing phase is a tiny health check, followed by a hard stop where Jason reviews everything via GitHub before any real spending starts. Only after the gate clears do Steps 11 and 12 actually use the tools. This ordering is deliberate. It puts the human checkpoint upstream of the expensive API calls instead of downstream of them.

---

## How to use this document

This document is a schedule. You do not edit it. The only change you make is to mark a step as done when you finish it. Like this:

```
### Step 3 — Build CFPB scoring  ✅  (commit: abc1234)
```

If you find a problem that needs a real plan change, stop work. Ask before you change the plan. Do not silently fix it yourself. That is how last time went wrong.

For every step, follow this loop:

1. Read the step. Read it twice. If anything is unclear, ask before you start.
2. Open a fresh Claude Code session for that step only. Do not reuse a session from another step.
3. Copy the prompt provided in the step into the new Claude Code session.
4. Let Claude Code do the work. Read every file change before you accept it.
5. Run the verification step at the end. Do not skip it.
6. Commit. One step, one commit (or two or three small commits for big steps).
7. Mark the step done in this document.
8. Take a short break. Then start the next step.

---

## Section 0 — Things you must remember before starting

These are short rules. They matter more than the steps below. Read them once, then check them again every morning before you start working.

### 0.1 Read the file out loud before you start

Last cycle, the plan was not followed. The cost was $11 of Anthropic credits and one full week of work that did not match what was asked. Before you open Claude Code for the first time, read this document out loud. If you can read it out loud and explain it back in your own words, you understand it. If you cannot, ask for help before you start.

### 0.2 Do one step at a time

Do not paste the whole document into Claude Code. Do not say "do all of this." Pick one step. Finish it. Verify it. Commit. Then start the next.

If you think "step 4 and step 5 look similar, I will do them together" — stop. Do them separately. Together makes problems hidden.

### 0.3 Confirm cost before running scripts that call the AI

Every time you run a script that calls Claude or Groq, money is spent. Before you press enter on any script that calls the AI:

1. Ask Claude Code: "How many API calls will this script make? What is the cost?"
2. Wait for an answer with real numbers, not "it depends."
3. If the number is more than $1 per run, ask the team first.

The Anthropic account belongs to Jason — you cannot set caps in the console. Your safety net is the **40-call hard cap** built into the testing scripts. The counter resets only when Jason authorizes it. See Section 1.2 for the rules.

A single Claude Sonnet call costs about $0.04. A full eval harness run with 12 fixtures costs about $0.50. A script with a bug that loops without limit can cost $200 in 90 seconds.

### 0.4 Verify before you trust

When Claude Code makes a change, look at the file diff. Read it line by line. Do not just trust the summary. The summary says what Claude Code wanted to do. The diff is what it actually did.

If you see a change to a file you did not ask for, ask why before you accept it.

### 0.5 Audit every finished step with a Claude Code skill

Before you mark a step as done, run an audit. Each step says which skill to use. The skills are: `code-reviewer`, `simplify`, `security-reviewer`, `verify`.

The audit takes 5 minutes. Skipping it costs hours later. "It looks right" is not an audit.

### 0.6 Hallucinations to watch for

Sometimes Claude Code makes things up. Watch for these:

- **Made-up function names.** If Claude Code uses a function name you do not recognize, run `grep` to confirm it exists. If it does not exist, Claude Code made it up.
- **Made-up Supabase columns or tables.** The real schema is in `supabase/migrations/`. If Claude Code writes a query for a column not in those files, it is wrong.
- **Made-up Anthropic API fields.** Claude Code sometimes invents API parameters like `response_format` that Anthropic does not accept. Check the Anthropic docs at docs.anthropic.com if a new field appears.
- **Too many try/catch blocks.** If Claude Code wraps simple code in five layers of error handling, ask which error each layer catches. If Claude Code cannot name a real error, remove that layer.

### 0.7 Never work on guesses

If you are not sure how something works, do not guess. Ask Claude Code to research with links. If Claude Code says "the docs say X" without a link, ask for the link. Read the link. If the link does not say what Claude Code claimed, Claude Code lied. That is the most important moment in your day. Notice it.

For things in this project, never guess about:
- What Supabase Edge Functions support at runtime
- What the Anthropic API accepts (parameters, response shapes)
- What Claude Sonnet 4.6 returns vs older versions
- How prompt caching works

When you are not sure, also check with another AI (ChatGPT or Gemini) to compare answers. Or read the official docs. Do not just trust one source.

### 0.8 The frontend is allowed to be old

This plan is about the backend and the prompt. The frontend can have problems. That is fine for now. If you see a small UI bug, write it down in a file called `FRONTEND_TODO.md` and keep going. Do not fix it now.

**There is no frontend work in this plan at all.** The structured user-context form was removed from the main flow. It is now optional follow-up work (see "Optional follow-up while waiting for Jason" near the end of this document) — you only build it if you finish all 13 steps and Jason has not yet finished reviewing.

**Do not open the app to "see" what is broken.** The frontend bugs that will appear after Steps 7 and 8 are expected. You verify them through code review of the response shape, not by interacting with the app. Per Section 0.11, all testing of the analyze endpoint goes through the test scripts. The app is not a testing tool during this work cycle.

### 0.9 When you are stuck for 30 minutes, stop and step back

If you cannot fix the same error for 30 minutes, the problem is upstream of where you are looking. Stop. Read everything Claude Code has done in this session. Look for the moment Claude Code made a guess. Go back to that moment.

Do not let Claude Code "try a different approach" five times. Each new approach starts fresh and forgets the old ones. Five tries means you wasted an hour.

### 0.10 When the budget runs out, escalate

Every step has a time budget. The hard ceiling is 150% of the budget. If you cross it, stop work and ask for help. Do not push through silently. The budget is generous on purpose; going past it means something is wrong that you did not expect.

### 0.11 Test only through the scripts. Never through the app.

All API testing happens through one of two scripts:
- `scripts/manual-test.ts` (built in Step 9) — for human-review testing of individual inputs
- `scripts/eval/runner.ts` (built in Step 8) — for automated pass/fail testing of the fixture suite

You do NOT test the analyze endpoint by:
- Opening the app on a phone or simulator and tapping the analyze button
- Running curl commands as your default way to ping the endpoint
- Using Postman, Insomnia, or any other request-builder GUI

The only exception is Step 7's one-time deploy verification — a single curl call to confirm the function is reachable, before the test scripts even exist. From Step 9 onward, all testing is script-only.

The rule exists because the test scripts enforce the 40-call counter. The app and curl do not. If you test through the app, you bypass the counter, and you can burn the entire monthly budget on a handful of accidental clicks. The counter is your safety net — running outside it is the same as removing your seatbelt before a crash.

**How to add a new test case (the only allowed workflow)**:

If you want to test a new scenario mid-iteration — for example, "what does the AI say for a NY user who gives no demographic info?" — follow this exact workflow:

1. Open Claude Code. Describe the scenario in plain English: "Make a test fixture for a NY user with no demographic info. They typed 'just trying to figure out my money.' Use the gentle tone."
2. Claude Code writes a new JSON file in `scripts/test-snapshots/inputs/`. Give it a clear name like `ny_no_context.json`.
3. **Commit the file BEFORE running it.** Run `git add scripts/test-snapshots/inputs/ny_no_context.json && git commit -m "Add test fixture: NY user with no demographic info"`. Do not skip the commit.
4. Run the script: `npx tsx scripts/manual-test.ts --input ny_no_context --save`.
5. The script asks for cost confirmation, increments the counter, saves the output, prints the result.

If the test case is important enough to be part of the permanent eval suite (because it covers a code path you want to regression-check forever), add it to `scripts/eval/fixtures.ts` instead of (or in addition to) the snapshot inputs folder. Either way, the test case is committed BEFORE it runs. No uncommitted exploratory tests.

This rule is non-negotiable:
- No testing through the app
- No curl as a default habit (Step 7's one-time deploy verification is the only exception)
- Every new test case is a committed JSON file
- Every API call goes through the script, which goes through the counter

If you find yourself thinking "let me just open the app and try it real quick" — the answer is no. Write the test case as a committed fixture and run it through the script.

---

## Section 1 — Pre-flight checks (30 minutes, once)

Before Step 1, set up the environment. Do this once. Do not skip any of these.

### 1.1 Set the Anthropic API key

In your terminal:
```powershell
$env:ANTHROPIC_API_KEY = '<your_key>'
```

Add it to `.env.local` too so the edge function can read it.

### 1.2 The 40-call hard cap (read this carefully)

The Anthropic account belongs to Jason. The owner has already set a spending cap on their side. You do not need to (and cannot) set anything in the Anthropic console.

What you DO need is the **call counter** built into the testing scripts you will create in Steps 9 and 10. Every script that calls the AI tracks its API calls in a local counter file. The counter has a hard cap of **40 API calls per session**. When you hit 40, the scripts refuse to make another call until Jason authorizes a reset.

**Note on sessions across the plan**: the 40-call cap is per work session, not per work cycle. Steps 10 through 13 each form their own session. Expected per-session spend:

- Step 10 (gate health check): 1 call
- Step 11 (prompt iteration): up to 39 calls
- Step 12 (manual snapshots + regression exercise): about 11 calls
- Step 13 (action-plan endpoint testing): about 10 calls

**How counter resets actually work**: the counter file lives only on your machine. Jason does not have access to your local repo and cannot reset it from his side. The reset is YOUR action, but you only do it AFTER Jason gives explicit approval over WhatsApp.

The workflow when you hit 40 or reach the end of a step:
1. Commit and push all your work to GitHub. Make sure the latest state is on the remote.
2. Message Jason on WhatsApp: "Done with Step X. Counter is at N/40. Latest commit is <hash>. Ready for review."
3. Jason pulls from GitHub (or views via GitHub web), reviews what you ran and what shape the work is in.
4. Jason replies on WhatsApp with either: (a) "Approved — you can reset the counter and proceed to Step X+1" or (b) specific feedback to address before continuing.
5. Only after (a) do you delete `.api-call-count.json` to start a fresh session.

**Do not delete or modify the counter file or the `HARD_CAP` constant in `scripts/lib/call-counter.ts` without Jason's explicit WhatsApp approval.** Technically you could — the file is local, the code is editable — but doing so silently is exactly the trust break that would end the work cycle. If Jason finds the counter was reset without his go-ahead, the plan stops there.

The 40-call cap is non-negotiable. It exists because:
- The Jason already burned $11 of credits to a bug last cycle. There is no unlimited budget for retries.
- A script with a loop bug can burn 100+ calls in a single minute. The counter is the safety net.
- Each call is money out of the owner's pocket. Treat every call as a real cost, not a free resource.

You do not set up the counter here — it gets built into the testing scripts in Steps 9 and 10. Just know the rules now:

- **40 calls maximum per session.** A "session" is one continuous work period. Three full runs of the 13-fixture eval harness = 39 calls, which fits. A fourth run does not.
- **No loops over fixtures without manual confirmation.** Every API call requires the script to print the expected cost and wait for you to press Enter. Scripts that bypass the confirmation are not allowed to be written.
- **If you hit 40 and need more, stop and ask Jason.** Do not delete the counter file. Do not modify the counter logic. The cap is the rule; needing to bypass it is a signal that you should escalate, not work around it.
- **If you find yourself wanting to "just bump the cap" — that is the moment to stop and ask.** Almost every legitimate reason to need more than 40 calls in a session means the iteration approach itself needs review.

### 1.3 Link the Supabase project

```powershell
supabase link --project-ref zefhsplmgxefmpdqbbvv
```

### 1.4 Verify Node + tsx work

```powershell
npx tsx --version
```

If this fails, run `npm install -D tsx` in the project root.

### 1.5 Fix BUG 1 — the broken Claude API path

This bug exists right now in `supabase/functions/analyze/index.ts`. The variable `API_URL` is used but not defined. The Claude path is broken at runtime. The Groq path works, which is why everything still kind of runs. But the prompt iteration in this plan is for Claude. Fix this first.

Open `supabase/functions/analyze/index.ts`. Find these two lines:

- Line 151: `const response = await fetch(API_URL, {`
- Line 282: `const response = await fetch(API_URL, {`

Change both `API_URL` to `CLAUDE_API_URL` (the renamed constant at line 5).

Commit message: `Fix API_URL reference error in Claude path (regression from 95faa25)`.

Test: deploy the edge function with `supabase functions deploy analyze` and call it with the existing test script using `provider: 'claude'`. Confirm you get a response, not a ReferenceError.

### 1.6 Create the working files

Create three empty files in the repo root:
- `DECISIONS.md` — empty for now. You will add to it when you make non-obvious choices.
- `FRONTEND_TODO.md` — empty for now. You will add to it when you notice UI bugs during backend work.
- `CLAUDE.md` (if missing) — add one paragraph at the top:

```
When you are about to run a script that calls the Anthropic API, the Groq API, or any other paid external API, first tell the human how many calls the script will make and the estimated cost. Wait for human confirmation before executing. Do not run paid scripts silently.
```

---

## Section 2 — The plan, step by step

Time budgets are ceilings, not goals. If you finish early and the verification passes, you are done.

Each step has:
- **Goal** — what you are building, in one or two sentences
- **Time budget** — how long this should take. Hard ceiling is 150% of this.
- **Files** — what you create or change
- **Prompt** — copy this into a new Claude Code session to do the step
- **Verify** — how you check the step is done
- **Audit skill** — which skill to use before marking done

---

### Step 1 — Create the shared types directory

**Goal**: Create a `shared/` folder at the project root. This folder will hold TypeScript types and Zod schemas that both the frontend (React Native) and the backend (Supabase Edge Function) can use. This follows DRY — one definition, used in two places.

**Time budget**: 1 to 2 hours. Hard ceiling: 3 hours.

**Files created**:
- `shared/types.ts` — main TypeScript interfaces
- `shared/schemas.ts` — Zod schemas (later steps will fill these in)
- `shared/index.ts` — re-exports for clean imports
- `tsconfig.json` updates — path aliases

**Prompt to copy into Claude Code**:

```
I need you to set up a shared TypeScript folder for my project. The project uses Expo (React Native) for the frontend and Supabase Edge Functions (Deno) for the backend. Both need to share TypeScript types and Zod schemas.

Goal: create a `shared/` folder at the repo root that both the frontend and the edge function can import from.

Step 1: Create `shared/types.ts`. For now, put this single placeholder type in it:

  export type Placeholder = { __placeholder: true };

Later steps will add real types. We are setting up the folder first.

Step 2: Create `shared/schemas.ts`. For now, add an import for Zod and a placeholder schema:

  import { z } from 'zod';
  export const PlaceholderSchema = z.object({ __placeholder: z.literal(true) });

Step 3: Create `shared/index.ts` that re-exports from both files:

  export * from './types';
  export * from './schemas';

Step 4: Update the frontend's `tsconfig.json` to add a path alias so the frontend can import from `@shared`:

  In `compilerOptions.paths`, add: "@shared/*": ["./shared/*"]

Make sure this does not break existing path aliases.

Step 5: For the edge function (Deno), shared imports work differently. Show me where the edge function `supabase/functions/analyze/index.ts` is, then add an import at the top:

  import type { Placeholder } from '../../../shared/types.ts';

This relative path works because Deno supports relative file imports.

Constraints:
- Do not modify the analyze function logic. Only add the import.
- Do not install new packages unless they are missing (Zod should already be in package.json).
- Do not touch frontend screens or backend logic beyond what is listed here.

After you are done, show me:
1. The `shared/` directory contents (ls).
2. The updated `tsconfig.json` paths section.
3. Confirmation that `npx tsc --noEmit` runs without new errors.
```

**Verify**:
1. Run `ls shared/`. You should see `types.ts`, `schemas.ts`, `index.ts`.
2. Run `npx tsc --noEmit`. No new type errors.
3. Open the edge function `supabase/functions/analyze/index.ts`. The Placeholder import should be there.

**Audit skill**: `code-reviewer`. Ask the skill: "Did Step 1 create only the files listed, with no extra changes? Are the imports correct? Does the tsconfig path alias `@shared` work for the Expo frontend? Does the edge function correctly use the relative path `../../../shared/...` instead — since Deno does not honor tsconfig path aliases?"

---

### Step 2 — Research and write the baselines file

**Goal**: Create a file that holds reference numbers for each US state in 2026 — median income, median rent, cost-of-living tier, current credit card APR, federal student loan rate. The prompt will use these numbers as defaults when the user does not state their own income or rent.

**Time budget**: 2 to 3 hours. Hard ceiling: 5 hours.

**Files created**:
- `shared/baselines/national.ts` — country-wide defaults (CC APR, student loan rate, healthy savings rate, etc.)
- `shared/baselines/states.ts` — per-state rows (50 states)
- `shared/baselines/index.ts` — re-exports + a `getBaselines(state)` function

**Prompt to copy into Claude Code**:

```
I need you to research and create a baselines file for a US-based personal finance app. The file will hold reference numbers for each US state in 2026 — median income, median rent, cost-of-living tier, current credit card APR, federal student loan rate. The app uses these numbers as defaults when the user does not state their own income or rent.

Use the WebSearch tool to look up authoritative sources. Use only the sources I list below. Do not mix sources.

Required sources, in priority order:
- Median household / individual income by state: BLS (Bureau of Labor Statistics) and Census ACS
- Median rent for one-bedroom by metro / state: HUD Fair Market Rents (FMR)
- Average credit card APR: Federal Reserve G.19 Consumer Credit report (most recent)
- Federal student loan rate: studentaid.gov (set annually by Congress)
- Cost of living index by state: MIT Living Wage Calculator

Goal: create three files in the `shared/baselines/` folder.

File 1: `shared/baselines/national.ts` — country-wide numbers. Export a single object:

  export const NATIONAL_BASELINES = {
    currentCcApr: 0.228,             // 22.8% — source: Fed G.19, [date]
    currentStudentLoanRate: 0.065,   // 6.5% — source: studentaid.gov, [date]
    healthySavingsRate: 0.15,        // 15% — standard guideline
    adequateEmergencyMonths: 3,      // 3 months — standard guideline
    medianNetIncomeByAge: {
      '18-24': 2400,                 // monthly, after tax — source: BLS [date]
      '25-29': 3200,
      '30-34': 3900,
      '35-44': 4600,
      '45+':   5100,
    },
  };

Replace the placeholder numbers above with real 2026 numbers from the sources I listed. Add a source URL as a comment next to each number. If you cannot find a 2026 number, use the most recent year and write the year in the comment.

File 2: `shared/baselines/states.ts` — one row per US state. Export a map keyed by 2-letter state code:

  export const STATE_BASELINES = {
    CA: {
      colTier: 'vhcol',              // one of: 'low' | 'medium' | 'high' | 'vhcol'
      medianRent1br: 2400,           // monthly — source: HUD FMR [year]
      medianNetIncome: 4200,         // monthly, after tax — source: BLS [year]
      recommendedRentPctOfIncome: 0.35,  // higher for VHCOL areas
    },
    TX: { ... },
    // ... all 50 states + DC
  };

For each state, populate:
- colTier: classify based on MIT Living Wage Calculator or another COL index. Use 'low' for states like WV, MS, AR; 'medium' for states like TX, FL, OH; 'high' for states like NJ, MA, IL; 'vhcol' for CA, NY, MA-Boston, HI, DC, WA.
- medianRent1br: from HUD Fair Market Rents, statewide median for a 1-bedroom
- medianNetIncome: from BLS, monthly take-home for a working-age adult in that state
- recommendedRentPctOfIncome: 0.30 for low/medium tiers, 0.35 for high/vhcol tiers

Add a source URL comment next to each value. If a state's value is missing or uncertain, mark it `// TODO: source missing` and use the national baseline as a fallback in code, not by guessing the number.

File 3: `shared/baselines/index.ts` — exports a function:

  import { STATE_BASELINES } from './states';
  import { NATIONAL_BASELINES } from './national';

  export function getBaselines(state: string | undefined) {
    const stateRow = state && STATE_BASELINES[state.toUpperCase()];
    return {
      ...NATIONAL_BASELINES,
      state: state ?? 'unknown',
      ...(stateRow ?? { colTier: 'medium', medianRent1br: 1200, medianNetIncome: 3500, recommendedRentPctOfIncome: 0.30 }),
    };
  }

  export { NATIONAL_BASELINES, STATE_BASELINES };

Rules:
- Do not invent numbers. If you cannot find a source, mark as TODO.
- Cite every number with a source URL in a comment.
- Round income to the nearest $100. Round rent to the nearest $50. Round APR to one decimal.
- Use the most recent data available, ideally 2026 or 2025. Write the year in the source comment.

When you are done, show me:
1. The contents of each of the three files.
2. A summary: how many states have all four fields filled with cited sources, and how many have any TODO.
```

**Verify**:
1. Open `shared/baselines/states.ts`. Confirm all 50 states + DC have rows.
2. Pick 5 random states. For each, click the source URL in the comment and confirm the number matches the source within 5%. If not, the number is wrong and you should fix it.
3. Run `npx tsc --noEmit`. No errors.

**Audit skill**: `verify`. Ask the skill: "Spot-check 5 random states in the baselines file against the cited sources. Are the numbers correct? Are the sources reachable? Are any states marked TODO that should be filled in?"

---

### Step 3 — Build the CFPB IRT scoring module

**Goal**: Create the scoring module that takes Claude's 10 CFPB question responses (with confidence per response) and converts them to a 0-100 score using Item Response Theory, then applies confidence-based attenuation. This replaces the placeholder "Claude picks a score" approach.

**Time budget**: 4 to 6 hours. Hard ceiling: 1 working day.

**Files created**:
- `shared/scoring/cfpb_irt.ts` — IRT parameters + scoring function
- `shared/scoring/bands.ts` — score → label/color enum
- `shared/scoring/index.ts` — main `computeFinalScore()` function
- `shared/scoring/__tests__/cfpb.test.ts` — unit tests using CFPB worked examples

**Prompt to copy into Claude Code**:

```
I need you to build the official CFPB Financial Well-Being scoring module for my project. The module takes 10 user response values (each 0-4 with a confidence label) and computes a final 0-100 score using Item Response Theory.

Background you need:
- The CFPB Financial Well-Being Scale is a 10-question scale published by the Consumer Financial Protection Bureau. It is public domain.
- The official scoring formula uses a graded-response IRT model. The CFPB published the item parameters in a technical report. Find the report at https://files.consumerfinance.gov/f/documents/201705_cfpb_financial-well-being-scale-technical-report.pdf and look in the appendix for the item parameters.
- The final formula maps an estimated theta value to a 0-100 score: score = round((theta * 15) + 50)
- Our app modifies the final score with a confidence attenuation toward 50 (the neutral score), because the AI's confidence in each answer varies.

Goal: create three files in `shared/scoring/`.

File 1: `shared/scoring/cfpb_irt.ts`

Implement the official CFPB graded-response IRT scorer.

Steps inside this file:
1. Define the 10 items with their CFPB-published IRT parameters (discrimination a, and thresholds b1..b4 for each item). Pull these exact values from the technical report PDF appendix. If you cannot find the PDF or parameters, search alternative sources (CFPB GitHub repositories, academic papers citing the scale). Cite the exact source.
2. Write a function `estimateTheta(responses: number[]): number` that takes 10 integer responses (0-4) and returns the maximum-likelihood theta estimate using the graded response model. Theta should be in roughly the range [-3, 3].
3. Write a function `cfpbScore(responses: number[]): number` that returns round((theta * 15) + 50), clamped to [0, 100].

Test your work: the technical report's appendix has worked examples (response pattern → expected score). Add a unit test that confirms your function produces the published expected scores for at least 3 example response patterns. Put tests in `shared/scoring/__tests__/cfpb.test.ts`.

If you cannot find published IRT parameters with reasonable effort (more than 30 minutes searching), STOP and ask me. Do not invent parameters. The whole point is to use the official ones.

File 2: `shared/scoring/bands.ts`

Define the score band enum:

  export type ScoreBand = {
    label: 'Financially Fragile' | 'Surviving' | 'Stable' | 'Thriving';
    color: string;  // hex
  };

  export function getScoreBand(score: number): ScoreBand {
    if (score <= 40) return { label: 'Financially Fragile', color: '#FF4D6D' };
    if (score <= 60) return { label: 'Surviving',           color: '#FFB020' };
    if (score <= 80) return { label: 'Stable',              color: '#00C2A8' };
    return                  { label: 'Thriving',            color: '#00E676' };
  }

File 3: `shared/scoring/index.ts`

Main entry point. Combines IRT scoring + confidence attenuation + score band.

  import { cfpbScore } from './cfpb_irt';
  import { getScoreBand, ScoreBand } from './bands';

  export type Confidence = 'low' | 'medium' | 'high';
  export type CfpbResponse = { value: number; confidence: Confidence };

  const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
    low: 0.5,
    medium: 0.75,
    high: 1.0,
  };

  export function computeFinalScore(
    cfpbResponses: CfpbResponse[],
    scoreModifier: number  // -10 to +10
  ): { score: number; scoreLabel: string; scoreColor: string; avgConfidence: number } {
    // 1. Compute the official IRT score from the 10 response values
    const values = cfpbResponses.map(r => r.value);
    const irtScore = cfpbScore(values);

    // 2. Compute the average confidence weight
    const avgConfidence =
      cfpbResponses.reduce((sum, r) => sum + CONFIDENCE_WEIGHT[r.confidence], 0)
      / cfpbResponses.length;

    // 3. Attenuate toward 50 (neutral) based on average confidence
    const attenuated = irtScore * avgConfidence + 50 * (1 - avgConfidence);

    // 4. Apply scoreModifier, clamp to [0, 100]
    const finalScore = Math.max(0, Math.min(100, Math.round(attenuated + scoreModifier)));

    // 5. Look up the band
    const band = getScoreBand(finalScore);

    return {
      score: finalScore,
      scoreLabel: band.label,
      scoreColor: band.color,
      avgConfidence,
    };
  }

Add unit tests in `shared/scoring/__tests__/scoring.test.ts` for:
- All-high-confidence responses produce the unmodified IRT score
- All-low-confidence responses are pulled halfway toward 50
- scoreModifier of +5 raises the score by 5
- A perfect 40/40 raw with all-high-confidence produces a score >= 95
- A 0/40 raw with all-high-confidence produces a score <= 5

Constraints:
- Do not invent IRT parameters. If the CFPB report does not provide them, stop and ask.
- Do not put real user data in tests. Use synthetic examples.
- Tests should run with `npx tsx --test shared/scoring/__tests__/`.

When you are done, show me:
1. The three files.
2. The test run output (all tests passing).
3. The IRT parameters with their source citation.
```

**Verify**:
1. Run the tests: `npx tsx --test shared/scoring/__tests__/`. All should pass.
2. Open `shared/scoring/cfpb_irt.ts`. Confirm the IRT parameters have a source URL in a comment.
3. Manually trace one example: take 10 responses of all 2 (the middle of the scale). Confirm the IRT score is around 50, the attenuated score with all-medium-confidence is also around 50.

**Audit skill**: `verify`. Ask the skill: "Trace the scoring math for these three response patterns and confirm the output matches what the unit tests expect. Are the IRT parameters from a real published source?"

---

### Step 4 — Build the deterministic calculations module

**Goal**: Create the module that takes Claude's extracted facts (income, expenses, debts, savings) and computes all the derived fields (savings rate, debt-to-income ratio, emergency fund months, spending percentages). This replaces "Claude does math" with "code does math."

**Time budget**: 2 to 3 hours. Hard ceiling: 4 hours.

**Files created**:
- `shared/calculations.ts` — pure math functions
- `shared/calculations.test.ts` — unit tests

**Prompt to copy into Claude Code**:

```
I need you to build a deterministic calculations module for my finance app. The module takes the AI's extracted facts (income, expenses, debts, savings) and computes all the derived numbers (savings rate, debt-to-income ratio, emergency fund months). Right now the AI is asked to compute these. We are moving them to code so they are exact and reproducible.

Goal: create `shared/calculations.ts` and `shared/calculations.test.ts`.

File 1: `shared/calculations.ts`

Define a type and a single function:

  export type ExtractedFacts = {
    monthlyIncome: number;        // dollars
    monthlyExpenses: number;
    liquidSavings: number;
    debts: Array<{
      name: string;
      balance: number;
      interestRate: number;       // decimal, e.g. 0.228
      minimumPayment: number;
      urgency: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };

  export type DerivedMetrics = {
    monthlySavings: number;
    savingsRate: number;            // decimal, e.g. 0.15
    debtTotal: number;
    monthlyDebtService: number;
    emergencyFundMonths: number;
    debtToIncomeRatio: number;      // decimal
  };

  export function deriveMetrics(facts: ExtractedFacts): DerivedMetrics {
    const monthlySavings = facts.monthlyIncome - facts.monthlyExpenses;
    const savingsRate =
      facts.monthlyIncome > 0 ? monthlySavings / facts.monthlyIncome : 0;
    const debtTotal = facts.debts.reduce((s, d) => s + d.balance, 0);
    const monthlyDebtService = facts.debts.reduce((s, d) => s + d.minimumPayment, 0);
    const emergencyFundMonths =
      facts.monthlyExpenses > 0 ? facts.liquidSavings / facts.monthlyExpenses : 0;
    const debtToIncomeRatio =
      facts.monthlyIncome > 0 ? monthlyDebtService / facts.monthlyIncome : 0;
    return {
      monthlySavings,
      savingsRate,
      debtTotal,
      monthlyDebtService,
      emergencyFundMonths,
      debtToIncomeRatio,
    };
  }

File 2: `shared/calculations.test.ts`

Write tests for these cases:
1. A user with income $4000, expenses $3000, savings $5000, no debt: monthlySavings=1000, savingsRate=0.25, emergencyFundMonths≈1.67, debtTotal=0, debtToIncomeRatio=0.
2. A user with income $0 (unemployed): no divide-by-zero errors. savingsRate=0, debtToIncomeRatio=0.
3. A user with expenses $0 (lives with parents, no expenses listed): no divide-by-zero. emergencyFundMonths=0.
4. A user with multiple debts: debtTotal is the sum, monthlyDebtService is the sum.
5. A user with negative savings (expenses exceed income): monthlySavings is negative, savingsRate is negative.

Constraints:
- Pure functions only. No side effects. No console.log.
- No try/catch — these are pure math, no exceptions are possible from the inputs.
- All inputs are non-negative numbers except where noted (monthlySavings can be negative).
- Round nothing. Let the caller decide rounding.

When you are done, show me:
1. The two files.
2. The test run output (all tests passing).
```

**Verify**:
1. Run tests: `npx tsx --test shared/calculations.test.ts`. All pass.
2. Open the file. No `console.log`, no `try/catch`, no `any` types.

**Audit skill**: `simplify`. Ask the skill: "Is `deriveMetrics` doing only the work that is needed? Is there any over-engineering (extra error handling for impossible cases)? Are the types correct?"

---

### Step 5 — Define the structured input and output schemas

**Goal**: Define the exact shape of the data sent to the analyze edge function and the shape the AI returns. These shapes are Zod schemas in the shared folder so the frontend and backend both use them.

**Time budget**: 2 to 3 hours. Hard ceiling: 4 hours.

**Files modified**:
- `shared/schemas.ts` — fill in real schemas (was a placeholder from Step 1)
- `shared/types.ts` — fill in real types
- `shared/index.ts` — verify exports

**Prompt to copy into Claude Code**:

```
I need you to define the input and output schemas for my finance app's analyze endpoint. These schemas use Zod and live in `shared/schemas.ts`. The frontend uses them to validate inputs before sending, and the edge function uses them to validate the AI's structured output.

Background: the analyze endpoint takes a user's free-text description of their finances plus some structured context (state, age, income bracket) and returns a financial analysis with score, roast, summary, and metrics.

Goal: fill in `shared/schemas.ts` and `shared/types.ts` (both currently have placeholders).

File 1: `shared/schemas.ts`

Define these Zod schemas. They will be used both for sending requests to the AI and for validating its response.

```typescript
import { z } from 'zod';

// ─── User context (the structured form) ─────────────────────────

export const USStateSchema = z.enum([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'unknown'
]);

export const UserContextSchema = z.object({
  state: USStateSchema,
  ageBracket: z.enum(['18-24', '25-29', '30-34', '35-44', '45+', 'unknown']),
  incomeBracket: z.enum(['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k', 'unknown']),
  livingSituation: z.enum(['renting', 'owning', 'with_family', 'dorm', 'other', 'unknown']),
  employmentStatus: z.enum(['full_time', 'part_time', 'self_employed', 'student', 'between_jobs', 'unknown']),
  debtBracket: z.enum(['none', 'under_5k', '5k_15k', '15k_50k', 'over_50k', 'unknown']).default('none'),
  liquidSavingsBracket: z.enum(['none', 'under_500', '500_2k', '2k_10k', '10k_50k', 'over_50k', 'unknown']).default('under_500'),
  primaryConcern: z.enum(['debt_payoff', 'building_savings', 'curious', 'investing', 'other']).optional(),
});

// ─── Request body sent from frontend to /analyze ────────────────

export const AnalyzeRequestSchema = z.object({
  freeText: z.string().min(10).max(5000),
  userContext: UserContextSchema,
  tone: z.enum(['savage', 'gentle', 'therapist', 'older_sibling', 'finance_bro']),
});

// ─── AI's structured output (the tool call) ─────────────────────

const NumberWithConfidence = z.object({
  value: z.number().min(0),
  confidence: z.enum(['low', 'medium', 'high']),
});

const DebtItem = z.object({
  name: z.string().max(40),
  balance: z.number().min(0),
  interestRate: z.number().min(0).max(0.5),
  minimumPayment: z.number().min(0),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

const CfpbResponse = z.object({
  value: z.number().int().min(0).max(4),
  confidence: z.enum(['low', 'medium', 'high']),
});

const MentionedSpending = z.object({
  category: z.string().max(40),
  amount: z.number().min(0),
  source: z.literal('user_stated'),
});

export const AIRawOutputSchema = z.object({
  // EXTRACTED
  monthlyIncome: NumberWithConfidence,
  monthlyExpenses: NumberWithConfidence,
  liquidSavings: NumberWithConfidence,
  debts: z.array(DebtItem).max(8),
  cfpb_responses: z.array(CfpbResponse).length(10),

  // JUDGMENT
  scoreModifier: z.number().int().min(-10).max(10),
  scoreModifierReason: z.string().max(200),
  summary: z.string().max(400),
  roast: z.string().max(240),
  insights: z.array(z.string().max(160)).max(5),
  topProblems: z.array(z.string().max(140)).max(3),
  positiveBehaviors: z.array(z.string().max(140)).max(3),
  topFix: z.object({
    action: z.string().max(200),
    monthlyImpact: z.number().min(0),
  }),
  emotionalStatus: z.object({
    label: z.string().max(40),
    emoji: z.string().max(4),
  }),
  mentionedSpending: z.array(MentionedSpending).max(10),
});

// ─── Final response sent from edge function back to frontend ────

// This combines the AI raw output + server-computed derived metrics.
// All fields are non-optional because the server fills in defaults.

export const FinalAnalysisSchema = AIRawOutputSchema.extend({
  // Server-computed deterministic fields
  score: z.number().min(0).max(100),
  scoreLabel: z.string(),
  scoreColor: z.string(),
  monthlySavings: z.number(),
  savingsRate: z.number(),
  debtTotal: z.number(),
  monthlyDebtService: z.number(),
  emergencyFundMonths: z.number(),
  debtToIncomeRatio: z.number(),
  avgConfidence: z.number().min(0).max(1),
});
```

File 2: `shared/types.ts`

Replace the placeholder with inferred TypeScript types from the Zod schemas:

```typescript
import { z } from 'zod';
import {
  UserContextSchema,
  AnalyzeRequestSchema,
  AIRawOutputSchema,
  FinalAnalysisSchema,
} from './schemas';

export type UserContext = z.infer<typeof UserContextSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AIRawOutput = z.infer<typeof AIRawOutputSchema>;
export type FinalAnalysis = z.infer<typeof FinalAnalysisSchema>;
```

File 3: confirm `shared/index.ts` re-exports both files:

```typescript
export * from './types';
export * from './schemas';
export * from './baselines';
export * from './scoring';
export * from './calculations';
```

Constraints:
- Do not invent fields not in my list above.
- Do not change the field names. The names will be used in the prompt and the database.
- Do not add optional fields beyond what I marked .optional().
- `default()` values come into play when the form is partly filled — `debtBracket` defaults to 'none', `liquidSavingsBracket` defaults to 'under_500'.

When you are done, show me:
1. The contents of both files.
2. Confirmation that `npx tsc --noEmit` passes.
3. A small test in `shared/schemas.test.ts` that parses a valid `AnalyzeRequest` and rejects an invalid one (missing required field).
```

**Verify**:
1. Run `npx tsc --noEmit`. No errors.
2. Run the small schema test: `npx tsx --test shared/schemas.test.ts`. Passes.
3. Open `shared/schemas.ts` and read it. Confirm field names match the names in this plan exactly.

**Audit skill**: `code-reviewer`. Ask the skill: "Did Step 5 create the schemas exactly as specified? Are there any extra fields, missing fields, or wrong types?"

---

### Step 6 — Write the system prompt file

**Goal**: Create the external system prompt file that the analyze edge function will load. The prompt tells the AI exactly what to extract, what to judge, and what tone to use. It includes one worked example. It is constant across calls (so Anthropic's prompt cache can cache it).

**Time budget**: 3 to 4 hours. Hard ceiling: 1 working day.

**Files created**:
- `supabase/functions/analyze/prompts/system.txt`

**Prompt to copy into Claude Code**:

```
I need you to write the system prompt for my finance app's analyze endpoint. The prompt is a text file that the edge function loads at startup. It tells the AI what to extract, what to judge, what tone to use, and which rules to never break. It includes one worked example.

The full prompt content is below — I have already drafted it. Your job is to:
1. Save it exactly as written to `supabase/functions/analyze/prompts/system.txt`.
2. Make sure the file is read-only safe (no edits beyond what I write below).
3. Confirm Supabase Edge Functions (Deno) can read this file at runtime using `Deno.readTextFileSync` with a relative path like `./prompts/system.txt`.

Here is the prompt to save:

────────────── START OF PROMPT ──────────────

You are "Am I Broke?" — a Gen-Z, TikTok-native AI financial reality check. You analyze a user's financial situation from a short free-text description plus structured demographic context. You return ONLY a structured tool call. No prose around the tool call. No markdown. No commentary.

# Your job, in this order

1. EXTRACT specific numbers the user explicitly stated (income, expenses, debt amounts, liquid savings, named spending categories).
2. ESTIMATE the rest using the user's structured context (state, age bracket, income bracket, living situation, employment status, debt bracket, liquid savings bracket) and the `baselines` reference in the user message. Flag every estimated number with low / medium / high confidence.
3. JUDGE the situation qualitatively — score modifier, summary, roast, insights, problems, positives, emotional status.
4. INFER the user's likely answers to 10 CFPB Financial Well-Being Scale questions on a 0-4 Likert scale, with a confidence per response. The server computes the actual 0-100 score using the official CFPB IRT formula and your confidence values.

# Tone

The `tone` field in the user message tells you which voice to use. Same content, different voice:

- savage: Brutally honest, no sugar-coating, Gen-Z / TikTok native. Funny but cutting one-liners. Phrases like "bestie..." and "we need to talk." Make the roast memeable and screenshot-worthy.
- gentle: Warm and supportive, like a caring friend. Soften hard truths with encouragement. "Here's the thing..." "Let's work on this together."
- therapist: Calm, analytical, psychologically-minded. Connect spending patterns to emotional needs. "It seems like..." "Have you considered..." Focus on the why.
- older_sibling: Tough love from someone who's been there. "I'm not mad, I'm disappointed" mixed with genuine care. Practical, street-smart advice.
- finance_bro: Confident, hype-man energy. "We're gonna fix this." "Let's get that bread." Optimistic but grounded.

# Hard rules — never violate

- NEVER claim to be a licensed financial advisor, CFP, attorney, or tax professional. Avoid phrases like "as your CFP," "I'm a licensed," "as your attorney."
- NEVER name specific securities, crypto tokens, ticker symbols, or insurance carriers. If the user asks about a specific product, redirect generically ("a high-yield savings account" not a brand name; "a low-cost index fund" not a fund ticker).
- NEVER mention self-harm, suicide, or "end it all" language, even when softening the roast.
- NEVER fabricate spending categories. The `mentionedSpending` array contains ONLY the categories the user explicitly named in their free-text. If they did not mention specific spending, return an empty array. Do not invent rent, food, subscriptions, or anything else to fill it.
- NEVER include an `actionPlan` field. A separate endpoint generates the 90-day plan after the user clicks "View Plan." This endpoint must NOT produce one.

# How to assign confidence per field

- high: the user explicitly stated the value ("I make $4,200/mo" → income confidence: high)
- medium: the user implied it strongly ("my rent eats half my paycheck" + stated income → rent confidence: medium)
- low: you are inferring from baselines and demographics with no specific user signal

# How to use the baselines block

The user message contains a `baselines` object with reference numbers for the user's state and demographic context. When the user did not state a value explicitly, use the baselines as priors. Adjust based on user-specific signals — someone who says "I overspend on takeout" lands slightly above the baseline; someone who says "I live frugally" lands below.

The baselines are not absolute truths. The user's own statements always override them.

# CFPB question set — return 10 responses with confidence each

For each question below, choose a 0-4 value AND a confidence label based on how much direct signal the user's input gave you about that life dimension.

Questions 1-4 ask "How well does this describe you?" — 0 = Not at all, 4 = Completely.
Questions 5-6 ask the same but are reverse-coded (negative wording).
Questions 7-10 use a frequency scale — 0 = Always, 4 = Never. Questions 7, 9, 10 are reverse-coded.

The 10 questions in order (your response array must be in this exact order):
1. I could handle a major unexpected expense.
2. I am securing my financial future.
3. Because of my money situation, I feel like I will never have the things I want in life. (reversed)
4. I can enjoy life because of the way I'm managing my money.
5. I am just getting by financially. (reversed)
6. I am concerned that the money I have or will save won't last. (reversed)
7. Giving a gift for a wedding, birthday, or other occasion would put a strain on my finances. (reversed, frequency)
8. I have money left over at the end of the month. (frequency)
9. I am behind with my finances. (reversed, frequency)
10. My finances control my life. (reversed, frequency)

For confidence:
- high: the user's text directly addresses this question (e.g., "I have 6 months saved" → Q1 high confidence)
- medium: you inferred from related information (income + named bill → Q5 medium)
- low: you extrapolated mostly from demographics with no direct signal

# scoreModifier — when to use it

The server computes a base score from your cfpb_responses + their confidences. You can adjust the final score by -10 to +10 to capture situational factors the scale cannot:
- recent job loss or layoff (-)
- variable / gig income with no buffer (-)
- known windfall coming (raise, inheritance, settlement) (+)
- dependent care obligations not reflected in expenses (-)
- predatory debt (payday loans, debt approaching legal action) (-)

Set scoreModifier: 0 if nothing warrants adjustment. Always populate scoreModifierReason with one sentence.

# Length caps — strict

- summary: 3 sentences maximum
- roast: 2 sentences maximum
- insights: 5 items maximum, one sentence each
- topProblems: 3 items maximum, one sentence each
- positiveBehaviors: 3 items maximum, one sentence each
- topFix.action: 1 sentence
- scoreModifierReason: 1 sentence

# One worked example

User message:

```json
{
  "freeText": "I make $4k/mo, rent is $1800 in SF, $8k in credit card debt, no savings.",
  "userContext": {
    "state": "CA",
    "ageBracket": "25-29",
    "incomeBracket": "4k_6k",
    "livingSituation": "renting",
    "employmentStatus": "full_time",
    "debtBracket": "5k_15k",
    "liquidSavingsBracket": "none"
  },
  "baselines": {
    "stateMedianRent1br": 2400,
    "stateColTier": "vhcol",
    "ageMedianNetIncome": 4200,
    "currentCcApr": 0.228,
    "healthySavingsRate": 0.15,
    "adequateEmergencyMonths": 3
  },
  "tone": "savage"
}
```

Expected `submit_analysis` tool call input:

```json
{
  "monthlyIncome": { "value": 4000, "confidence": "high" },
  "monthlyExpenses": { "value": 3300, "confidence": "low" },
  "liquidSavings": { "value": 0, "confidence": "high" },
  "debts": [
    { "name": "Credit card", "balance": 8000, "interestRate": 0.228,
      "minimumPayment": 240, "urgency": "high" }
  ],
  "cfpb_responses": [
    { "value": 0, "confidence": "high" },
    { "value": 1, "confidence": "medium" },
    { "value": 0, "confidence": "medium" },
    { "value": 1, "confidence": "medium" },
    { "value": 0, "confidence": "high" },
    { "value": 0, "confidence": "high" },
    { "value": 1, "confidence": "low" },
    { "value": 0, "confidence": "high" },
    { "value": 0, "confidence": "high" },
    { "value": 0, "confidence": "medium" }
  ],
  "scoreModifier": -3,
  "scoreModifierReason": "$8k revolving debt at 22.8% APR with zero buffer amplifies risk beyond what the scale captures.",
  "summary": "You are renting in SF on $4k a month with no savings cushion and $8k of high-interest debt eating roughly $150 a month in interest before any principal. The math is tight but recoverable if you free up $300 a month for the card. The next six months are about not letting the balance grow.",
  "roast": "Bestie, paying $1,800 rent on $4k income in SF with zero savings and $8k on plastic is the financial equivalent of WiFi at one bar — technically connected, everyone's suffering.",
  "insights": [
    "Your rent is 45% of take-home, well above the 30% guideline even for a VHCOL city.",
    "That $8k card costs roughly $152 a month in interest alone before you touch principal.",
    "With zero emergency fund, the next car repair or medical bill goes on the same card and compounds.",
    "Your effective savings rate is negative once you account for interest accrual on the CC."
  ],
  "topProblems": [
    "High-interest credit card debt with no buffer against unexpected costs.",
    "Rent burden in HCOL city consuming nearly half of take-home pay."
  ],
  "positiveBehaviors": [
    "You're being honest about the picture instead of avoiding it — that's the hardest step."
  ],
  "topFix": {
    "action": "Put $300 a month extra toward the credit card on top of minimums — debt-free in about 30 months and saves roughly $2,400 in interest.",
    "monthlyImpact": 152
  },
  "emotionalStatus": { "label": "Cornered but not stuck", "emoji": "😬" },
  "mentionedSpending": [
    { "category": "rent", "amount": 1800, "source": "user_stated" }
  ]
}
```

Note: only `rent` is in `mentionedSpending` because that is the only category the user named. Food, transport, subscriptions, and discretionary were not mentioned, so they are not invented. The frontend's "Where your money should go" panel uses the baselines deterministically to show recommended allocation. The frontend's "What you mentioned spending" panel shows only the user-stated items.

# Now your task

The user's input is in the next message as structured JSON. Read it carefully. Call the `submit_analysis` tool with your structured output. Return ONLY the tool call.

────────────── END OF PROMPT ──────────────

After you save the file, show me:
1. The path: `supabase/functions/analyze/prompts/system.txt`.
2. Confirmation the file is exactly what I wrote between the START and END markers above (no extra characters, no missing sections).
3. A short test: a Deno script that reads the file with Deno.readTextFileSync and prints its length. The length should be roughly 6000-7000 characters.
```

**Verify**:
1. Open `supabase/functions/analyze/prompts/system.txt`. Confirm it matches the prompt above exactly.
2. Run a Deno read test: `deno run --allow-read -e "console.log(Deno.readTextFileSync('supabase/functions/analyze/prompts/system.txt').length)"`. Should print a number between 6000 and 7000.

**Audit skill**: `code-reviewer`. Ask the skill: "Compare the file at `supabase/functions/analyze/prompts/system.txt` to the prompt content in the iteration plan. Any differences? Any extra characters or missing sections?"

---

### Step 7 — Refactor the edge function to use tool use + structured input

**Goal**: Replace the current `buildPrompt(tone, userInput)` string-concatenation approach with the new architecture: load the external system prompt, send structured JSON in the user message, use Anthropic tool use for guaranteed structured output, run the server-side calculations and scoring.

**Time budget**: 6 to 8 hours. Hard ceiling: 1.5 working days.

**Files modified**:
- `supabase/functions/analyze/index.ts` — major rewrite of the analyze handler
- `supabase/functions/analyze/tool.ts` — new file holding the tool definition
- `supabase/functions/analyze/getBaselinesForRequest.ts` — new helper

**Prompt to copy into Claude Code**:

```
I need you to refactor the analyze edge function at `supabase/functions/analyze/index.ts` to use the new architecture. The new architecture has these properties:

1. The system prompt comes from an external file (`supabase/functions/analyze/prompts/system.txt`). Read it once at module load using Deno.readTextFileSync. Cache it in a module-scoped variable.
2. The user message is structured JSON, not concatenated text. It contains freeText, userContext, baselines, and tone.
3. The API call uses Anthropic tool use with one tool called `submit_analysis`. The tool's input_schema is defined in `supabase/functions/analyze/tool.ts`.
4. The Anthropic API call sets temperature: 0.2 and includes cache_control: { type: 'ephemeral' } on the system prompt + tool definition so prompt caching works.
5. After Anthropic returns, the edge function reads the tool_use.input directly (no JSON.parse on text). Validate it with AIRawOutputSchema from `shared/schemas.ts`.
6. After validation, compute the derived metrics using `deriveMetrics` from `shared/calculations.ts`.
7. Compute the final score using `computeFinalScore` from `shared/scoring/`.
8. Compose the FinalAnalysis response (extracted + derived + scored). Return it.

Here is exactly what to do:

Step A: Create `supabase/functions/analyze/tool.ts`. Export a constant called `submitAnalysisTool`. It is a tool definition object that mirrors `AIRawOutputSchema` from `shared/schemas.ts` but expressed as a JSON Schema. Use a library or inline code to convert the Zod schema to JSON Schema — Claude Code should pick the simplest approach.

The tool definition should look roughly like:

  export const submitAnalysisTool = {
    name: 'submit_analysis',
    description: 'Submit the analyzed financial picture. Server will compute derived metrics from your output.',
    input_schema: {
      type: 'object',
      required: [...],
      properties: { ... }
    }
  };

The full JSON Schema content must enforce: cfpb_responses is exactly length 10 with value 0-4 + confidence enum; numeric fields are non-negative; string fields have maxLength caps matching `shared/schemas.ts`; all required fields are listed.

Step B: Create `supabase/functions/analyze/getBaselinesForRequest.ts`. Export one function:

  import { getBaselines } from '../../../shared/baselines/index.ts';
  import type { UserContext } from '../../../shared/types.ts';

  export function getBaselinesForRequest(userContext: UserContext) {
    const baselines = getBaselines(userContext.state);
    return {
      stateMedianRent1br: baselines.medianRent1br,
      stateColTier: baselines.colTier,
      ageMedianNetIncome: baselines.medianNetIncomeByAge[userContext.ageBracket] ?? baselines.medianNetIncome,
      currentCcApr: baselines.currentCcApr,
      currentStudentLoanRate: baselines.currentStudentLoanRate,
      healthySavingsRate: baselines.healthySavingsRate,
      adequateEmergencyMonths: baselines.adequateEmergencyMonths,
      recommendedRentPctOfIncome: baselines.recommendedRentPctOfIncome,
    };
  }

Step C: Refactor `supabase/functions/analyze/index.ts`. Replace the existing `buildPrompt` + JSON.parse + retry logic with the new flow. Keep:
- The CORS handling
- The rate limiting (in-memory map is fine for now)
- The input moderation
- The Anthropic + Groq dual-provider support (Claude is primary)

Replace:
- Drop the `buildPrompt` function entirely. The prompt comes from the file.
- Drop the inline JSON schema in the prompt — it lives in the tool now.
- Drop the moderateRoast string-substitution function — leave it in place for now but stop calling it. (A future step will replace it with proper output validation.)
- Drop the JSON.parse(content) path. Read tool_use.input directly.

Add:
- Load system prompt once at module scope:
    const SYSTEM_PROMPT = Deno.readTextFileSync(
      new URL('./prompts/system.txt', import.meta.url)
    );
- In the request handler, build the user message:
    const userMessage = JSON.stringify({
      freeText: request.freeText,
      userContext: request.userContext,
      baselines: getBaselinesForRequest(request.userContext),
      tone: request.tone,
    });
- The Anthropic API call must include:
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      temperature: 0.2,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [submitAnalysisTool],
      tool_choice: { type: 'tool', name: 'submit_analysis' },
      messages: [{ role: 'user', content: userMessage }],
    }
- After Anthropic returns, extract the tool_use block:
    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (!toolUse) throw new Error('No tool_use block in response');
    const rawOutput = AIRawOutputSchema.parse(toolUse.input);
- Compute derived metrics and score:
    const derived = deriveMetrics({
      monthlyIncome: rawOutput.monthlyIncome.value,
      monthlyExpenses: rawOutput.monthlyExpenses.value,
      liquidSavings: rawOutput.liquidSavings.value,
      debts: rawOutput.debts,
    });
    const scoring = computeFinalScore(rawOutput.cfpb_responses, rawOutput.scoreModifier);
- Compose the final response:
    const finalAnalysis: FinalAnalysis = {
      ...rawOutput,
      ...derived,
      score: scoring.score,
      scoreLabel: scoring.scoreLabel,
      scoreColor: scoring.scoreColor,
      avgConfidence: scoring.avgConfidence,
    };
    return jsonResponse(finalAnalysis, 200);

Step D: Update Groq fallback. The Groq path also needs to use a tool-use-like structure. Groq supports OpenAI-style function calling via their API. Use the same tool definition translated to OpenAI's tools/functions format. If Groq's tool support is unreliable, fall back to asking Groq to return JSON matching AIRawOutputSchema and validate with Zod. Mark this path with `_provider: 'groq_fallback'` in the response.

Step E: Validate the request body. At the top of the handler, validate the request against AnalyzeRequestSchema from shared/schemas.ts. If validation fails, return a 400 with the Zod error details.

Constraints:
- Do not change CORS_HEADERS, rate limiting, or the input moderation regex.
- Do not delete moderateRoast — leave it in place but unused (a later step will replace it).
- Do not invent new error stages — reuse the existing stage names (parse_error, claude_api_error, etc.).
- Console.log calls can stay for now — a later step replaces them.

When you are done, show me:
1. The full new contents of `supabase/functions/analyze/index.ts`.
2. The `tool.ts` file.
3. The `getBaselinesForRequest.ts` file.
4. A test deployment: `supabase functions deploy analyze`. The deploy must succeed.
5. A sample call using the existing test script `scripts/test_anthropic.ts` modified to use the new request shape. The response should be a FinalAnalysis object with all required fields.
```

**Verify**:
1. `supabase functions deploy analyze` succeeds.
2. Call the endpoint with a simple test. **This curl call is the one-time exception allowed by Section 0.11** — it confirms the function is reachable before the test scripts exist. From Step 9 onward, all testing goes through `manual-test.ts` or `eval/runner.ts`. Run this curl exactly once here, then never again.
```bash
curl -X POST https://zefhsplmgxefmpdqbbvv.supabase.co/functions/v1/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon_key>" \
  -d '{
    "freeText":"I make $4k/mo, rent is $1800 in SF, $8k in credit card debt, no savings.",
    "userContext":{"state":"CA","ageBracket":"25-29","incomeBracket":"4k_6k","livingSituation":"renting","employmentStatus":"full_time","debtBracket":"5k_15k","liquidSavingsBracket":"none"},
    "tone":"savage"
  }'
```
3. The response includes all FinalAnalysis fields. No `parse_error` stage. Score is in 0-100.

**Audit skill**: `code-reviewer`. Ask the skill: "Did Step 7 keep the moderation, rate limit, and CORS code? Are the AnthropicAPI request fields correct (tools, tool_choice, cache_control)? Is the response shape exactly FinalAnalysis?"

---

### Step 8 — Build the eval harness

**Goal**: Build a Node-based eval harness that runs 12-13 test inputs against the deployed analyze endpoint and asserts the response shape and key values. This is the measurement infrastructure for prompt iteration — without it, you cannot tell if a prompt change made things better or worse.

**Time budget**: 5 to 7 hours. Hard ceiling: 1.5 working days.

**Files created**:
- `scripts/eval/fixtures.ts` — the 12-13 test cases
- `scripts/eval/runner.ts` — the runner script
- `scripts/eval/assertions.ts` — assertion helpers

**Prompt to copy into Claude Code**:

```
I need you to build an eval harness for my finance app. The harness runs a set of test inputs against the deployed analyze endpoint, validates the responses, and outputs a pass/fail report. It runs with `npx tsx scripts/eval/runner.ts`.

Goal: create three files in `scripts/eval/`.

File 1: `scripts/eval/fixtures.ts`

Define the test fixtures. Each fixture has an id, an input (AnalyzeRequest), and an expects block (assertions to run on the response). Aim for these 13 fixtures:

Group A — Vague inputs (3):
  - vague_1: "I'm broke lol" + full userContext for a 25-29 CA renter
  - vague_2: "rent is killing me" + sparse userContext (only state + ageBracket)
  - vague_3: "I make ok money but feel broke" + minimal userContext

Group B — Partial inputs (3):
  - partial_1: "I make $4k a month and have a lot of CC debt" + full userContext
  - partial_2: "$3200 take home, $1500 rent, the rest disappears" + minimal userContext
  - partial_3: "Student, working part-time, no debt yet" + ageBracket: 18-24

Group C — Detailed inputs (3):
  - detailed_1: "Net $4,800/mo, rent $1,800, $7,200 in CC debt at 24% APR, no savings" + full userContext
  - detailed_2: A user with multiple debts and clear spending mentions
  - detailed_3: A high-income user with high debt (income $15k/mo, $50k CC debt)

Group D — Edge cases (3):
  - edge_negative_savings: User where expenses clearly exceed income
  - edge_bankSnapshot: For future use, omit for now or stub with userContext only
  - edge_compliance_injection: Input that contains a prompt-injection attempt asking for a specific stock recommendation

Group E — CFPB validation (1):
  - cfpb_thriving: A user input clearly matching "thriving" (high income, no debt, 6mo savings, mentions investing). Assertion: cfpb_responses average value >= 3 and score >= 75.

Each fixture has an `expects` block with at least these assertions:
- response has all FinalAnalysis fields
- score is in [0, 100]
- cfpb_responses has length 10, each value 0-4, each with valid confidence
- monthlySavings === monthlyIncome - monthlyExpenses (server-computed invariant)
- the response does not contain forbidden strings: 'Bitcoin', 'Ethereum', specific ticker patterns, 'as your CFP', 'I'm a licensed'
- if userContext.state is provided, response.summary contains some COL signal (rough check)
- for vague_1 / vague_2 / vague_3: at least 5 of 10 cfpb_responses have confidence === 'low'
- for detailed_1 / detailed_2: at least 5 of 10 cfpb_responses have confidence === 'high'
- for edge_compliance_injection: response does NOT contain any specific stock or crypto name (the injection attempt failed)

File 2: `scripts/eval/assertions.ts`

Helper functions for assertions. At minimum:
- assertSchema(response, schema) — uses Zod to validate the full FinalAnalysis shape
- assertScoreInRange(response, min, max)
- assertConfidenceDistribution(response, expected) — checks how many low/medium/high
- assertNoForbiddenStrings(response, forbidden[])

Each helper returns { pass: boolean, message: string }.

File 3: `scripts/lib/call-counter.ts` — the shared call counter

Before the runner exists, create the shared counter module. Other scripts (the manual-test script built in Step 9) will also use it.

Implementation:

  import fs from 'fs';

  const COUNTER_FILE = '.api-call-count.json';
  const HARD_CAP = 40;

  type CounterState = { count: number; startedAt: string; lastCallAt: string | null };

  function loadCounter(): CounterState {
    try { return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8')); }
    catch { return { count: 0, startedAt: new Date().toISOString(), lastCallAt: null }; }
  }

  function saveCounter(s: CounterState): void {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(s, null, 2));
  }

  export function recordApiCall(reason: string): void {
    const s = loadCounter();
    if (s.count >= HARD_CAP) {
      console.error(`\n❌ HARD CAP REACHED: ${HARD_CAP} API calls already made this session.`);
      console.error(`Counter started: ${s.startedAt}`);
      console.error(`Last call: ${s.lastCallAt ?? 'none'}`);
      console.error(`Ask Jason before continuing. Do NOT delete the counter file.`);
      process.exit(1);
    }
    s.count += 1;
    s.lastCallAt = new Date().toISOString();
    saveCounter(s);
    console.log(`📊 API call ${s.count}/${HARD_CAP} — ${reason}`);
  }

  export function getCounterState(): CounterState { return loadCounter(); }

Add `.api-call-count.json` to `.gitignore`. The counter file is local-only, never committed.

File 4: `scripts/eval/runner.ts`

The main script. Steps:
1. Read environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.
2. Load all fixtures from fixtures.ts.
3. Parse command-line args: support `--fixture <id>` to run a single fixture (saves cost during iteration).
4. Before running anything, print the current call counter state and the planned call count:
   - "Counter currently at X/40 calls. About to make N API calls, total after run: (X+N)/40, estimated cost $Y. Press Enter to continue or Ctrl-C to abort."
   - If X + N would exceed 40, REFUSE to run. Print: "This run would exceed the 40-call cap. Reduce the run with --fixture <id> or ask Jason to reset the counter."
5. For each fixture: call `recordApiCall('eval-harness:' + fixture.id)` BEFORE the API call. The counter check + increment is the gate. If the counter throws (hits 40), the runner stops mid-suite. Already-completed fixtures are reported.
6. At the end, print a report:
    - Total fixtures, passed, failed
    - Per-fixture pass/fail with first failing assertion
    - Average score variance across fixtures
    - Average response time
    - Final counter state (X/40 used)

The runner must NEVER run automatically without the user pressing Enter. The cost confirmation step is required.

Constraints:
- Use Node + tsx (not Deno). Node is the rest of the project's runtime.
- Use only built-in fetch — no axios or other libraries.
- Use Zod from package.json for schema assertions.
- Do not call private network or third-party APIs other than the configured Supabase URL.
- The runner reads the Supabase URL/key from env vars only — no hardcoded values.
- Every API call MUST go through `recordApiCall()`. Do not bypass.
- The runner must NEVER loop a fixture or auto-retry on failure. One call per fixture per run, period.

When you are done, show me:
1. The three files.
2. A successful run with the cost confirmation prompt.
3. A sample report output (you can run against the deployed endpoint, but only after I confirm).
4. A `--fixture <id>` run with a single fixture (cost ~$0.04).
```

**Verify**:
1. Run `npx tsx scripts/eval/runner.ts --fixture vague_1`. Should prompt for cost confirmation, show "1 API call, ~$0.04", wait for Enter.
2. After Enter, the fixture runs and prints pass/fail.
3. Run full suite: `npx tsx scripts/eval/runner.ts`. Should prompt "13 API calls, ~$0.52". After Enter, runs all 13.
4. At least 10 of 13 should pass on the current prompt.

**Audit skill**: `simplify`. Ask the skill: "Is the eval harness over-engineered? Are the assertions specific enough to catch real regressions but loose enough to tolerate normal LLM variation? Is the cost confirmation actually blocking, not bypass-able?"

---

### Step 9 — Build the manual-test script (no API calls yet)

**Goal**: Build the `manual-test.ts` script. This is the tool you will use for human-review testing — running hand-picked inputs through the deployed endpoint and saving the outputs for review. This step BUILDS the script. It does NOT run the script against the real endpoint. Real runs come in Step 10 (health check) and Step 12 (manual snapshots).

The script must integrate the call counter from Step 8 and must include a `--health-check` mode that sends a minimal payload to verify the endpoint is alive.

**Time budget**: 1 to 2 hours. Hard ceiling: 3 hours.

**API calls made in this step**: 0. Pure tool-building.

**Files created**:
- `scripts/manual-test.ts` — the new test script
- `scripts/test-snapshots/inputs/` — folder for hand-picked test inputs
- `scripts/test-snapshots/outputs/` — folder for saved AI outputs (committed to git for review)
- `.gitkeep` files in each empty subfolder so they stay in git
- 5 starter input fixtures in `scripts/test-snapshots/inputs/`
- Deprecation comment added to old `scripts/test_anthropic.ts`

**Reminder (per Section 0.11)**: from this step onward, all testing happens through this script or the eval harness from Step 8. Never the app. Never curl as a habit. New test cases get committed before they run.

**Prompt to copy into Claude Code**:

```
I need you to create a manual testing script for my finance app. The script is separate from the eval harness — it is for human review of AI outputs, not automated pass/fail testing.

Important context: this script will be the only tool the team uses to test the analyze endpoint by hand. It must enforce a 40-call session cap via the shared counter built in Step 8 (scripts/lib/call-counter.ts). It must include a `--health-check` mode that sends a minimal payload to verify the endpoint is alive (status 200). It must never loop or auto-retry.

Goal: create `scripts/manual-test.ts` (Node + tsx, NOT Deno) plus 5 starter input fixtures plus the folder structure.

Step A: Create these folders with `.gitkeep` files inside so they stay in git when empty:
- `scripts/test-snapshots/`
- `scripts/test-snapshots/inputs/`
- `scripts/test-snapshots/outputs/`

Step B: Create 5 starter input files in `scripts/test-snapshots/inputs/`. Each is a complete AnalyzeRequest JSON. Files:

`vague_broke.json`:
{
  "freeText": "I'm broke lol",
  "userContext": { "state":"CA","ageBracket":"25-29","incomeBracket":"4k_6k","livingSituation":"renting","employmentStatus":"full_time","debtBracket":"none","liquidSavingsBracket":"under_500" },
  "tone": "savage"
}

`detailed_sf.json`:
{
  "freeText": "Net $4,800/mo, rent $1,800 in SF, $7,200 in CC debt at 24% APR, no savings",
  "userContext": { "state":"CA","ageBracket":"25-29","incomeBracket":"4k_6k","livingSituation":"renting","employmentStatus":"full_time","debtBracket":"5k_15k","liquidSavingsBracket":"none" },
  "tone": "savage"
}

`student.json`:
{
  "freeText": "I'm a student working part-time, $1200/mo from a campus job, parents pay rent and food",
  "userContext": { "state":"TX","ageBracket":"18-24","incomeBracket":"under_2k","livingSituation":"dorm","employmentStatus":"student","debtBracket":"none","liquidSavingsBracket":"under_500" },
  "tone": "gentle"
}

`high_income_high_debt.json`:
{
  "freeText": "I make $200k/yr but have $50k in CC debt and almost nothing saved",
  "userContext": { "state":"NY","ageBracket":"30-34","incomeBracket":"over_10k","livingSituation":"renting","employmentStatus":"full_time","debtBracket":"15k_50k","liquidSavingsBracket":"under_500" },
  "tone": "older_sibling"
}

`negative_savings.json`:
{
  "freeText": "I spend about $4500 a month and only make $3800. Living off cards.",
  "userContext": { "state":"FL","ageBracket":"25-29","incomeBracket":"2k_4k","livingSituation":"renting","employmentStatus":"full_time","debtBracket":"5k_15k","liquidSavingsBracket":"none" },
  "tone": "therapist"
}

Step C: Create `scripts/manual-test.ts`. The script reads command-line args:
- `--health-check` — runs a minimal payload to verify the endpoint returns HTTP 200. NO real input. Use this first, before any real testing.
- `--input <name>` — required if not `--health-check`, the file name in inputs/ without `.json` (e.g., `vague_broke`)
- `--save` — optional flag, save the response to outputs/

The script MUST use the shared call counter from `scripts/lib/call-counter.ts` for every API call (including health-check). Call `recordApiCall('manual-test:<input-name>')` before each fetch. The counter is the safety net — if you bypass it, you can burn the entire monthly budget on one bad loop.

Health-check mode (`--health-check`):
- Send a tiny POST to the analyze endpoint with this minimal payload:
    {
      "freeText": "test ping",
      "userContext": { "state":"unknown","ageBracket":"unknown","incomeBracket":"unknown","livingSituation":"unknown","employmentStatus":"unknown","debtBracket":"none","liquidSavingsBracket":"under_500" },
      "tone": "savage"
    }
- Print the HTTP status code.
- If status is 200: print "✅ API connection working" plus the response time in milliseconds. Do not print or save the response body — health check does not care about content, only that the connection works.
- If status is not 200: print the error response and exit with code 1.
- Health check still costs ~$0.04 (it makes a real API call). Count it against the 40-call cap.

Real-input mode (`--input <name>`):
Before making the API call, print:
"Counter currently at X/40. About to make 1 API call to the analyze endpoint. Estimated cost: ~$0.04. Press Enter to continue or Ctrl-C to abort."
Wait for Enter. Do not bypass this.

The script must NEVER loop multiple inputs in one invocation. One call per script run, period. If you want to run all 5 inputs, you run the script 5 times manually.

After the call (real-input mode), print:
- Score, scoreLabel, scoreColor
- avgConfidence (round to 2 decimals)
- The roast (full text)
- The summary (full text)
- Lengths: insights[], topProblems[], positiveBehaviors[]
- cfpb_responses confidence distribution (count of low/medium/high)
- If `--save`: the output file path

The saved output file is `scripts/test-snapshots/outputs/<input-name>__<ISO-timestamp>.json` with this shape:

{
  "inputFile": "vague_broke",
  "timestamp": "2026-05-25T14:30:00Z",
  "request": <the input>,
  "response": <the full FinalAnalysis>,
  "metadata": { "responseTimeMs": 5432, "model": "claude-sonnet-4-6" }
}

Pretty-print the JSON with 2-space indentation so it is readable.

Step D: Add a deprecation comment at the top of the existing `scripts/test_anthropic.ts`:

  // DEPRECATED. Use scripts/manual-test.ts (Node + tsx) instead.
  // This Deno-based script does not work with the new tool-use architecture.

Do not delete the old file. Leave it for historical reference.

Constraints:
- Node + tsx only. Read env vars SUPABASE_URL and SUPABASE_ANON_KEY.
- Use built-in fetch. No new dependencies.
- The shared call counter is required on EVERY API call. Health check counts too.
- The script must NEVER loop or auto-retry. One call per invocation, period.
- Cost confirmation prompt (real-input mode) is required. Do not bypass it.
- Do not modify any other file.
- DO NOT RUN THE SCRIPT YET. Just build it and confirm it compiles. Running comes in Step 10.

When you are done, show me:
1. The new script and the folder structure (ls scripts/test-snapshots/).
2. The 5 input files.
3. `npx tsx scripts/manual-test.ts` with no args — should print usage info without making any API calls.
4. Confirmation that the script imports the call counter from Step 8.
```

**Verify**:
1. `scripts/manual-test.ts` exists and compiles (`npx tsc --noEmit` passes).
2. Running with no args prints usage info, makes no API call.
3. The 5 starter input fixtures exist and are valid JSON.
4. `.api-call-count.json` is in `.gitignore`.
5. **The script has NOT been run against the real endpoint yet.** Step 10 is where that happens.

**Audit skill**: `code-reviewer`. Hand the script to the skill with this audit checklist: "Does the script integrate the call counter from scripts/lib/call-counter.ts? Is --health-check implemented as specified? Does it require Enter-press confirmation before real-input runs? Does it loop or auto-retry? (It should NOT.) Are the 5 starter fixtures valid AnalyzeRequest shapes?"

---

### Step 10 — Pre-test gate: health check + Jason review (STOP here)

**Goal**: This is the gate between "everything is built" and "real API testing begins." The health check is the very first API call of the testing phase — a tiny payload, just verifying the endpoint returns HTTP 200. After the health check passes, you STOP, commit, push to GitHub, and wait for Jason to review all work from Steps 1-9 on the WhatsApp group chat. Only after Jason gives an explicit GO does Step 11 begin.

This gate exists because Step 11 (prompt iteration) and Step 12 (manual snapshots + regression) burn the bulk of the API budget. If anything is wrong with Steps 1-9 (broken deploy, misconfigured tool use, wrong schema, baselines miswritten, etc.), it gets caught here for the cost of 1 API call instead of 30+.

**Time budget**: 5 minutes for the health check + Jason review (typically 30 min to 2 hours).

**API calls made in this step**: 1 (the health check).

**Reminder (per Section 0.11)**: the health check runs through the manual-test script, never through the app or curl.

#### Part A — You: run the health check (5 minutes, 1 call)

Open a terminal in the project root and run:

```powershell
npx tsx scripts/manual-test.ts --health-check
```

Expected output:
```
📊 API call 1/40 — manual-test:health-check
✅ API connection working (responded in 4321ms)
```

If status is 200 and you see "✅ API connection working" — proceed to Part B.

If status is NOT 200:
- 401 / 403: auth problem. Check `SUPABASE_ANON_KEY` env var. Do NOT run more calls until fixed.
- 4xx with a Zod error message: the request shape is wrong. Check `shared/schemas.ts` matches what `manual-test.ts` sends.
- 5xx: edge function has a bug. Look at the response body for the error stage. **Stop and ask Jason** before retrying.
- Timeout / connection refused: Supabase URL is wrong, or the function is not deployed. Re-deploy with `supabase functions deploy analyze`.

**Do not retry the health check more than 3 times.** If 3 attempts all fail, the system is broken. Investigate the root cause; do not burn calls hoping it fixes itself. A retry loop on a broken endpoint is exactly the kind of bug that burned $11 last cycle.

#### Part B — You: commit, push, and notify Jason (15 minutes)

After the health check passes:

1. Run `git status` and confirm all changes from Steps 1-10 are committed. If anything is uncommitted, commit it now.
2. Push everything to the remote: `git push origin master` (or whatever branch you are on).
3. Send a message to Jason with all of the following:
   - The latest commit hash (`git log -1 --format=%H`)
   - A one-paragraph plain-English summary of what was done (Steps 1-10)
   - The current call counter state — should be 1/40 after the health check
   - The output of `ls shared/`, `ls supabase/functions/`, and `ls scripts/`
4. **STOP. Do not start Step 11 under any circumstances until Jason replies "GO" on WhatsApp.** This is the most important sentence in this document. The whole reason this gate exists is to catch problems before Step 11 burns the rest of the budget. Skipping the gate defeats the safeguard.

While you wait for Jason, you can:
- Re-read Section 0 (specifically 0.1, 0.4, 0.5, 0.10, 0.11)
- Re-read Step 11 to refresh your memory on what comes next
- Update `DECISIONS.md` with anything you wrote down during Steps 1-10
- Take a break

You cannot:
- Run any script that calls the API
- Tap the analyze button in the app
- Open curl, Postman, or any other request tool against the endpoint

#### Part C — Jason: review (30 min to 2 hours) — this part describes what Jason will do

Jason's review checklist:

- **Existence check**: every file under Section 3 ("Files that should exist") is present in the latest commit.
- **Scope check**: run `git log --since="<plan start>" --name-only`. Every changed file should be in Section 3's "Files that should change" list. Anything outside that list is scope creep — ask why before approving.
- **Baselines spot-check**: open `shared/baselines/states.ts`. Pick 5 random states. Each has a cited source URL in a comment. Click 1-2 URLs and confirm the cited number matches the source within 5%.
- **DECISIONS.md spot-check**: read 3 random entries. They should be specific, dated, and explain non-obvious choices (not generic filler).
- **Unit tests pass**: run `npx tsc --noEmit && npx tsx --test shared/`. No failures.
- **Health check ran exactly once**: Jason opens `.api-call-count.json`. The count should read 1 with `lastCallAt` matching the time you reported.
- **Eval harness exists but has NOT been run**: read `scripts/eval/fixtures.ts` — at least 13 fixtures. Read `scripts/eval/runner.ts` — call counter wired in. The counter should still be at 1 — confirming the runner has not yet been executed.
- **Manual-test script exists and is correct**: read `scripts/manual-test.ts`. Counter wired in. No loops or retries. The `--health-check` mode is implemented.

If all checks pass: Jason replies on WhatsApp with "GO. Proceed to Step 11." You add a one-line DECISIONS.md entry: "2026-XX-XX — Gate cleared by Jason on WhatsApp, authorized to proceed to Step 11."

If any check fails: Jason replies with the specific gap, what file or section to fix, and tells you to fix and re-request review. The 40-call counter does NOT reset during this back-and-forth — fixes happen in code, not in API calls.

**Verify**:
1. The health check returned HTTP 200 and printed "✅ API connection working".
2. The call counter shows 1/40 used.
3. The Jason has sent an explicit "GO" message in writing.
4. The DECISIONS.md gate-cleared entry exists.

**Audit skill**: `verify`. The audit is Jason's review itself — see Part C's checklist.

---

### Step 11 — Iterate on the prompt against the eval harness

**Goal**: Use the eval harness from Step 8 to iterate on the prompt until at least 11 of 13 fixtures pass. Document failures and tune carefully. Do not change anything outside the prompt file.

**Time budget**: 4 to 6 hours. Hard ceiling: 1.5 working days.

**Files modified**:
- `supabase/functions/analyze/prompts/system.txt` only

**Prompt to copy into Claude Code**:

```
I need help iterating on the system prompt for my finance app's analyze endpoint. The prompt is at `supabase/functions/analyze/prompts/system.txt`. The eval harness is at `scripts/eval/runner.ts` and has 13 fixtures.

Goal: get the prompt to pass at least 11 of 13 fixtures.

Process:
1. Run the eval harness once with `npx tsx scripts/eval/runner.ts`. Confirm the cost first. The output will list which fixtures pass and which fail.
2. For each failing fixture, look at the first failing assertion. Categorize:
   - Compliance failures (forbidden strings appearing) — fix in the prompt's hard rules section
   - Confidence distribution failures (vague inputs getting too much high-confidence) — fix in the confidence guidance section
   - Numeric assertions failing (sum invariants, bounds) — fix in the prompt's extract instructions
   - CFPB response failures (responses not matching the expected pattern) — fix in the CFPB section
3. Make ONE prompt change at a time. Re-run the harness with `--fixture <id>` on just the failing fixture (cost ~$0.04, fast iteration). Confirm the fix works.
4. After fixing each fixture, run the full harness again to make sure you did not break other fixtures.
5. Commit each prompt change with a clear message: "Tighten prompt rule on X (fixes fixture Y)".

Rules:
- ONLY edit `supabase/functions/analyze/prompts/system.txt`. Do not touch code.
- Do NOT lower assertion thresholds in the eval harness to make tests pass. That defeats the point.
- Do NOT add new fixtures while iterating. Iterate against the existing set.
- The call counter is your hard limit, not the dollar budget. Five full eval runs = 65 calls, which exceeds the 40-call cap. Plan for **at most 3 full runs** per session (39 calls) + single-fixture iterations for the failing ones.
- If you cannot get above 11/13 after 3 full runs + targeted single-fixture iterations, STOP and report which fixtures are still failing and what you tried. Ask Jason before requesting a counter reset.

When you are done, show me:
1. The final eval harness output (target: 11+ of 13 passing).
2. A diff of all changes to `system.txt` vs the original from Step 6.
3. A short summary: which fixtures were stubborn, what changes finally fixed them.
```

**Verify**:
1. Final eval run: 11 or more of 13 fixtures pass.
2. The call counter is at 39/40 or below. If you went over, tell Jason what you ran and why so the next session reset is informed.
3. Changes are isolated to `system.txt` — no other file changed.
4. Before starting Step 12, commit and push all your work to GitHub, then message Jason on WhatsApp: "Done with Step 11. Counter is at N/40. Final harness pass rate: M/13. Latest commit is <hash>." Wait for Jason to reply with explicit approval to reset the counter. Only after that reply, delete `.api-call-count.json` and proceed to Step 12.

**Audit skill**: `code-reviewer`. Ask the skill: "Compare the diff of system.txt vs the version from Step 6. Are the changes targeted and minimal? Did the iteration introduce any new compliance issues or remove important rules?"

---

### Step 12 — Run manual snapshots, review them, internalize the iteration mindset, and practice catching a regression

**Goal**: Now that the prompt has been iterated to 11+/13 on the eval harness in Step 11, exercise the manual-test script against the 5 starter inputs. Read every output carefully. Rate them. Internalize the iteration mindset. Practice catching a regression.

This is where you build judgment, not just pass/fail metrics. The eval harness confirms the response shape is valid. Only your eyes can confirm the roast is funny.

By the time you reach Step 12, Jason has cleared the gate (Step 10) and the prompt has passed 11+/13 on the harness (Step 11). The system is in a known-good state. Your job here is to add human review on top of automated checks.

**Time budget**: 2.5 to 4 hours. Hard ceiling: 5 hours.

**API calls made in this step**: ~11 (5 starter snapshots + ~6 for the regression exercise).

**Reminder (per Section 0.11)**: all testing here goes through `manual-test.ts`, never through the app or curl. If you want to test a scenario beyond the 5 starter inputs, follow the workflow in Section 0.11 — have Claude Code write a new JSON fixture, commit it, then run the script.

**Critical context about the frontend** (repeated from earlier): the new backend response shape adds fields (`cfpb_responses`, `mentionedSpending`, `confidence` per numeric value, `avgConfidence`) and removes old fields (no `actionPlan` in the analyze response, no `spendingBreakdown`). The existing ResultsScreen, ActionPlanScreen, and HistoryScreen code expects the old shape. They will render wrong fields, show blanks, or crash on some inputs. **This is correct.** Backend first, frontend after, in a separate work cycle.

**Do not fix the frontend during this step.** If you see a screen looking wrong, write it down in `FRONTEND_TODO.md` and move on. Mixing prompt iteration with frontend bug fixes makes it impossible to tell which change caused which problem. Backend-only discipline is the whole point of this step.

**Files modified in this step**:
- `scripts/test-snapshots/outputs/*.json` — 5+ saved AI outputs (committed to git)
- `scripts/test-snapshots/REVIEW.md` — your manual ratings + notes
- `DECISIONS.md` — the regression-awareness entry from 12d
- `supabase/functions/analyze/prompts/system.txt` — only if you choose to iterate further after reading the snapshots; any change here re-triggers the full eval + snapshot cycle

---

#### Sub-step 12a — Run all 5 starter inputs and save snapshots (30 minutes, 5 calls)

Run each input file individually. Do NOT loop them in a script — manual cost confirmation per call is intentional. You should feel the cost each time you run.

```powershell
npx tsx scripts/manual-test.ts --input vague_broke --save
npx tsx scripts/manual-test.ts --input detailed_sf --save
npx tsx scripts/manual-test.ts --input student --save
npx tsx scripts/manual-test.ts --input high_income_high_debt --save
npx tsx scripts/manual-test.ts --input negative_savings --save
```

After all 5 finish, you have 5 snapshot files in `scripts/test-snapshots/outputs/`.

Commit them:

```powershell
git add scripts/test-snapshots/
git commit -m "Add 5 manual-test snapshots against new analyze endpoint"
```

These snapshots are evidence of work. The team will review them later to verify quality.

---

#### Sub-step 12b — Read every snapshot and rate it (1 to 2 hours)

This is the most important part of Step 12. The eval harness cannot judge whether the roast is funny. You can.

Open each of the 5 snapshot files. Read the full response carefully. Then create `scripts/test-snapshots/REVIEW.md` with one section per snapshot. Use this template per entry:

```
## <input name> (<timestamp>)
Rating: <1-5>/5

Tone check: Does the roast match the selected tone?
  - savage roast feels savage? gentle roast feels gentle?
  - Notes: <one sentence>

Summary check: Does it match the user's actual situation, or feel generic?
  - Notes: <one sentence>

CFPB check: Do the 10 responses make sense for this user?
  - For broke users: most values should be 0-1.
  - For thriving users: most should be 3-4.
  - For middle users: 1-3 mix.
  - Notes: <one sentence>

mentionedSpending check: Are only user-stated categories included?
  - If the user said "rent $1800" — only rent should appear.
  - If the user said nothing specific — the array should be [].
  - If the AI fabricated categories: that is a regression.
  - Notes: <one sentence>

Score band check: Does the band match your gut feeling?
  - Notes: <one sentence>

Compliance check: Any forbidden strings? (Bitcoin, specific tickers, "as your CFP", etc.)
  - Notes: yes/no + which

Overall comment: <one paragraph, what is good and what could improve>
```

Be honest in the ratings. A 5 means "this output is good enough to ship to a user." A 3 means "shape is right, voice is off, would be embarrassing in a screenshot." A 1 means "this is wrong in important ways."

Commit the review:

```powershell
git add scripts/test-snapshots/REVIEW.md
git commit -m "Manual review of 5 starter snapshots — ratings and notes"
```

---

#### Sub-step 12c — Internalize the iteration mindset (no time budget — read once, apply forever)

The eval harness gives you a pass rate. The manual reviews give you quality judgment. Together they form your testing system. Use them like a scientist would.

When you want to change the prompt, follow this loop:

1. **Hypothesize first.** Write down what you think will improve, and which fixtures or snapshots you expect to see change. Add this to `DECISIONS.md` as a one-sentence hypothesis before you touch anything.

   Example: *"Hypothesis: tightening the rule against fabricating spending categories will reduce false mentionedSpending entries in vague_broke and student snapshots. Expected: their mentionedSpending arrays become empty."*

2. **Change one thing.** Edit the prompt. One rule, one section, one length cap. Not three at once. If you change three things and the score gets better, you do not know which one helped.

3. **Re-run the affected snapshots.** Use `--input <name>` to run only the snapshots you predicted would change. Compare new output to old. Did the change land?

4. **Run the full eval harness.** Did the change break any other fixture? If yes, you have a regression. Decide: keep the change, back it out, or find a better fix.

5. **Decide.** Either commit the change (commit message references the hypothesis) or revert it.

This is the science loop: hypothesis → change one variable → measure → conclude. Skip any step and you stop learning from your changes.

**Regressions to watch for specifically in this project**:

- **Compliance regressions.** Softening a rule (to make the AI more helpful) can cause it to start mentioning specific products. Always re-check the forbidden-string assertions after any change to the rules section.
- **Tone regressions.** A change to the savage tone can leak into the gentle tone if the prompt is structured badly. After any tone-related change, re-run at least one snapshot per tone.
- **Confidence regressions.** A change meant to make confidence more conservative can over-correct and mark high-evidence values as low confidence. Watch the distribution.
- **Length cap regressions.** Removing one length cap (because it felt arbitrary) often makes the AI verbose in other places too. Be careful with caps.
- **Score variance.** Two runs of the same input should produce scores within 5 of each other. If variance grows after a change, the prompt has drifted toward unpredictability.

**The most important rule about iteration**: do not change the prompt and the frontend at the same time. If you change the prompt and the frontend breaks more, you cannot tell which change caused which problem. **Backend only in this work cycle.**

---

#### Sub-step 12d — Practice catching a regression (30 minutes, ~6 calls)

This sub-step teaches you what a regression feels like by introducing one on purpose. Do not skip it.

Steps:

1. Pick one snapshot you rated 4 or 5 in 12b. Note the score, the roast first line, and whether mentionedSpending was correct.
2. Open `supabase/functions/analyze/prompts/system.txt`. Delete the rule "NEVER name specific securities, crypto tokens, ticker symbols, or insurance carriers." Save.
3. Deploy: `supabase functions deploy analyze`.
4. Run the eval harness: `npx tsx scripts/eval/runner.ts`. Confirm the fixture `edge_compliance_injection` now fails (it should — the compliance rule is gone).
5. Re-run the snapshot from step 1: `npx tsx scripts/manual-test.ts --input <name> --save`. The output may or may not visibly change.
6. **Revert.** Restore the deleted rule in `system.txt`. Deploy again.
7. Re-run both the harness and the snapshot. Confirm: harness back to 11+/13, snapshot output looks normal again.

Document the exercise in `DECISIONS.md`:

```
## 2026-XX-XX — Regression awareness exercise

Removed the "no specific securities" rule from system.txt to verify the eval harness catches the regression. It did — fixture `edge_compliance_injection` failed when the rule was missing, and passed again after I restored the rule. The manual snapshot output for <input> looked the same before and after, which tells me prompt injections are the main risk this rule catches, not normal user inputs. The compliance gate is doing its job.

Takeaway: when changing the rules section of the prompt, ALWAYS re-run the compliance fixture before committing.
```

This 30-minute exercise gives you a felt sense of how regressions surface and how to catch them.

---

**Verify Step 12**:

1. `scripts/test-snapshots/outputs/` has 5 or more snapshot files, committed to git.
2. `scripts/test-snapshots/REVIEW.md` has a rating + notes for each snapshot, committed to git.
3. `DECISIONS.md` has the regression-awareness entry from 12d.
4. **Confirm the frontend was NOT touched**: run `git log --since="<step 7 commit>" --oneline -- src/screens/ src/components/` and verify NO commits appear. The form work is no longer in the main flow — it is optional follow-up only. If any frontend files were modified, revert those changes before continuing.
5. The call counter is at 40 or below. If you went over the 40-call cap, document why in `DECISIONS.md` and notify Jason.

**Audit skill**: `verify`. Hand the snapshot files plus REVIEW.md to the skill with this audit checklist: "Spot-check 2 of the 5 snapshot outputs against their corresponding inputs. Are the cfpb_responses consistent with the user's stated situation? Are any forbidden strings present in any field? Is mentionedSpending limited to user-stated categories? Are the ratings in REVIEW.md justified by the contents of the snapshots?"

---

### Step 13 — Plan the action-plan endpoint design session

**Goal**: The 90-day action plan currently lives inside the main analyze response. Move it to its own endpoint that is triggered when the user clicks "View Plan." This step does NOT build the endpoint — it sets you up to design it in a Claude Code session with full context.

**Time budget**: This step is a design session, not a code session. Budget 2 to 3 hours for the session plus 4 to 6 hours for implementation after the design is locked.

**What you do**:

Open a new Claude Code session. Paste the prompt below. Work with Claude Code to design the endpoint. When the design is locked, ask Claude Code to implement it. Treat this design conversation like Plan mode — push back on anything that does not fit our patterns.

**Prompt to copy into Claude Code (the full design session brief)**:

```
I need help designing a new endpoint for my Expo + Supabase Edge Functions finance app called "Am I Broke?". The endpoint generates a 90-day action plan for a user after they have already received their main financial analysis.

Background:
- The app has a main analyze endpoint at `supabase/functions/analyze/index.ts` that takes a user's free-text description plus structured context and returns a `FinalAnalysis` with score, summary, roast, insights, top problems, top fix, etc.
- The 90-day action plan used to be a field on the main analyze response. We are moving it to a separate endpoint so the main analyze response is smaller and faster, and so users who never click "View Plan" do not burn tokens on plan generation.
- The new endpoint is `supabase/functions/action-plan/index.ts`. The frontend calls it when the user taps "View 90-Day Action Plan" on the results screen.

Your job is to design this endpoint with me. Follow the same architecture as the main analyze endpoint:
- External system prompt file at `supabase/functions/action-plan/prompts/system.txt`
- Structured JSON user input (no concatenated text)
- Anthropic tool use with one tool whose input_schema is defined in `supabase/functions/action-plan/tool.ts`
- Temperature 0.2, cache_control on the system prompt + tool
- Output schema lives in `shared/schemas.ts` as a new schema named `ActionPlanSchema`
- Output type lives in `shared/types.ts` as `ActionPlan`
- Server validates the AI output with Zod before returning to the client

Design questions I need answered, in this order. Walk me through each. Do not start coding until I lock the answer:

1. INPUT SCHEMA: what does the action-plan endpoint receive? My current thinking:
   - A reference to the recent analysis (either the full FinalAnalysis object, or just key fields: score, extractedFacts, topFix, topProblems, userContext)
   - The user's tone preference (same enum as analyze)
   - Optional: the user's `primaryConcern` if not already captured
   Question: should we pass the full FinalAnalysis or only the fields the action plan actually needs? What is the right balance between context (more = better plan) and token cost (less = cheaper)?

2. OUTPUT SCHEMA: what does the AI return? My current thinking:
   - An array of 6 weekly steps (down from 12 in the old version — quality over quantity)
   - Each step has: week (1-12), title (short), description (1-2 sentences), impact (expected outcome in one sentence), category ('savings' | 'debt' | 'income' | 'mindset'), completed (always false)
   - Confidence flag per step (low/medium/high — same pattern as analyze)
   Question: should we keep all 4 categories ('savings' | 'debt' | 'income' | 'mindset'), or add new ones? Should each step have a quantifiable impact estimate ($/month saved) or just a qualitative one?

3. PROMPT STRUCTURE: what does the system.txt look like? Mirror the analyze prompt:
   - Persona section
   - Tone block (same 5 tones)
   - Hard rules (same compliance rules: no specific products, no licensed-advisor claims, no self-harm)
   - Guidance on how to derive the plan from the analysis (e.g., "if the user's topFix is X, the first 2-3 weeks of the plan should support X")
   - Length caps on each step
   - One worked example
   Question: do we need a different tone block, or use the same one? Are there action-plan-specific compliance rules (e.g., do not recommend specific apps or banks)?

4. EDGE CASES: how do we handle:
   - User has no debt and no savings issue (what does the plan focus on?)
   - User has critical-urgency debt (does the plan prioritize debt steps in weeks 1-4?)
   - User score is in 'Thriving' band (a plan for someone already doing well — what does it look like?)
   - User has stated they only want investing advice (do we still give a 90-day plan or redirect?)

5. SCHEMA DETAILS: what exactly goes in the `ActionPlanSchema` Zod definition?

6. FILE LAYOUT: what files do we create?
   - `supabase/functions/action-plan/index.ts`
   - `supabase/functions/action-plan/tool.ts`
   - `supabase/functions/action-plan/prompts/system.txt`
   - `shared/schemas.ts` — add `ActionPlanRequestSchema`, `ActionPlanResponseSchema`
   - `shared/types.ts` — add `ActionPlan`, `ActionPlanStep`, `ActionPlanRequest`
   - Anything else?

7. FRONTEND CHANGES: what changes do we need on the frontend?
   - `src/screens/ResultsScreen.tsx` — change the "View Action Plan" button to navigate with the analysis as a param
   - `src/screens/ActionPlanScreen.tsx` — fetch the plan from the new endpoint on mount, show a loading state, show the plan
   - `src/services/claudeApi.ts` — add `generateActionPlan(analysis: FinalAnalysis, tone: RoastTone): Promise<ActionPlan>`
   - Where else?

Walk me through each of these one at a time. Wait for me to confirm each before moving to the next. After all 7 are locked, summarize the full design as a list of files to create + a brief description of what each contains. Then ask me to confirm the design before you implement.

When implementing:
- Follow the same patterns as the analyze endpoint
- Cache the system prompt with cache_control
- Use tool use for guaranteed structured output
- Validate the AI output with the Zod schema before returning
- Test the new endpoint with a single fixture before deploying

Constraints throughout:
- Do not change the main analyze endpoint
- Do not add new screens (the existing ActionPlanScreen is the target)
- Do not invent new patterns — mirror what analyze does
- Budget: $2 of Anthropic spend during design iteration
```

**Verify** (after the design session and implementation):
1. New endpoint deploys: `supabase functions deploy action-plan`
2. ResultsScreen "View Action Plan" button triggers a call to the new endpoint
3. ActionPlanScreen shows a loading state, then renders the plan
4. The plan has 4-6 steps with all required fields
5. No forbidden strings in any step
6. Add a fixture to the eval harness from Step 8 that exercises the action-plan endpoint

**Audit skill**: `code-reviewer`. Ask the skill: "Compare the new action-plan endpoint to the analyze endpoint. Do they share the same architecture? Are there any inconsistencies (different temperature, missing cache_control, missing Zod validation)?"

---

## Section 3 — Deliverables: what you should receive at the end

This section is the handoff specification. After all 12 steps are done, the work should produce the exact set of files and changes listed below — no more, no less. Use this list to verify the work matches expectations. If something here is missing, the work is not done. If something extra appears (especially frontend work), push back and ask why.

### Files that should exist (new — created from scratch in these steps)

**Shared layer (`shared/`):**
- `shared/types.ts` — TypeScript types inferred from Zod schemas
- `shared/schemas.ts` — Zod schemas (request, AI raw output, final response)
- `shared/index.ts` — re-exports from all subfolders
- `shared/baselines/national.ts` — country-wide reference numbers with cited sources
- `shared/baselines/states.ts` — per-state baselines for all 50 states + DC, each cited
- `shared/baselines/index.ts` — `getBaselines(state)` helper function
- `shared/scoring/cfpb_irt.ts` — official CFPB IRT scoring with parameters from the technical report
- `shared/scoring/bands.ts` — 4-band enum (Fragile / Surviving / Stable / Thriving) with hex colors
- `shared/scoring/index.ts` — `computeFinalScore()` with confidence attenuation
- `shared/scoring/__tests__/cfpb.test.ts` — unit tests, passing
- `shared/calculations.ts` — pure-math derived metrics (savingsRate, debtTotal, etc.)
- `shared/calculations.test.ts` — unit tests, passing

**Edge function — analyze:**
- `supabase/functions/analyze/prompts/system.txt` — the external system prompt
- `supabase/functions/analyze/tool.ts` — the `submit_analysis` tool definition
- `supabase/functions/analyze/getBaselinesForRequest.ts` — request → baselines helper

**Edge function — action-plan (new endpoint from Step 13):**
- `supabase/functions/action-plan/index.ts` — the new endpoint
- `supabase/functions/action-plan/prompts/system.txt` — its prompt
- `supabase/functions/action-plan/tool.ts` — its tool definition

**Testing infrastructure:**
- `scripts/eval/fixtures.ts` — 12-13 test cases
- `scripts/eval/runner.ts` — eval runner with cost confirmation
- `scripts/eval/assertions.ts` — assertion helpers
- `scripts/manual-test.ts` — Node + tsx manual test script
- `scripts/test-snapshots/inputs/*.json` — 5 starter input fixtures (commit these)
- `scripts/test-snapshots/outputs/*.json` — saved AI outputs (commit these)
- `scripts/test-snapshots/REVIEW.md` — manual ratings + notes
- `scripts/test-snapshots/.gitkeep` files in each subfolder

**Documentation:**
- `DECISIONS.md` — at least 5 entries documenting non-obvious choices (e.g., CFPB IRT vs. simple sum, confidence weights, score band thresholds, action-plan separation, regression-awareness exercise)
- `FRONTEND_TODO.md` — entries documenting frontend breakages discovered during backend testing (these are bugs to fix LATER, not now)

### Files that should change (existing files modified)

**Backend modifications:**
- `supabase/functions/analyze/index.ts` — refactored to use tool use, structured input, external prompt, server-side scoring
- `tsconfig.json` — adds the `@shared` path alias for the frontend
- `scripts/test_anthropic.ts` — marked deprecated with a comment at the top, otherwise unchanged

**Frontend modifications**: NONE. The 13 steps in this plan touch zero frontend files. The structured user-context form was previously in this plan as Step 8, but it has been moved to the optional follow-up section. The only frontend changes that may exist by the end of this work cycle are entries in `FRONTEND_TODO.md` documenting bugs to fix in a future cycle — no code changes to `src/screens/`, `src/components/`, `src/hooks/`, `src/services/`, or `src/theme/`.

If you finish all 13 steps and Jason has not yet finished reviewing, you may optionally build the form per the "Optional follow-up" section at the end of this document. Otherwise, the frontend stays untouched.

### Frontend changes you should NOT see

The following are out of scope for this work cycle. **If you did any of these, revert them before continuing.** If you catch yourself drifting toward any of these mid-work, stop and write a `FRONTEND_TODO.md` entry instead.

- New animations, easing curves, or transition effects
- Changes to `ScreenBackground.tsx`, `GlobalAnimatedBackdrop.tsx`, `GlassSection.tsx`, or any other iOS-specific styling components
- Theme color changes in `src/theme/colors.ts`
- Font changes
- Layout changes on any screen other than HomeScreen (HomeScreen only changes to add the form)
- New screens added to the navigator
- Modifications to ResultsScreen, ActionPlanScreen, DebtPayoffScreen, ProfileScreen, HistoryScreen, CommunityFeedScreen, or any other screen beyond what the data path requires
- New icons, new emoji choices, microinteraction tweaks
- Tab bar changes
- Loading state UI changes (the existing animated processing screen stays as-is)

If you find that "the results screen needed a small change to work with the new response shape" — that change should go in `FRONTEND_TODO.md` as a known bug to fix later, NOT be fixed in this cycle. The frontend gets a full rebuild against the stable backend in a separate work cycle.

### The frontend WILL be partially broken at the end of this work. That is expected.

The new backend response shape adds fields (`cfpb_responses`, `mentionedSpending`, `confidence` per numeric value, `avgConfidence`) and removes fields (no `actionPlan` in the analyze response, no `spendingBreakdown`). The existing frontend code expects the old shape. After these changes, the following would happen IF you opened the app:

- **ResultsScreen** may crash, render blank fields, or show unhandled errors on the spending breakdown section
- **ActionPlanScreen** will not call the new endpoint until a small frontend change lands in a later cycle — it will still try to render the inline action plan that no longer exists
- **HistoryScreen** may show inconsistent shapes for old analyses (saved with the old schema) vs. new analyses

**You should NOT open the app to look at these broken states.** Per Section 0.11, the app is not a testing tool during this work cycle. You verify these issues exist through code review of the response shape and the existing screen code — not by interacting with the app. The bullet list above is documentation of what would be wrong, not a checklist to confirm visually.

**This is what we want.** Proving the backend works correctly is the goal of this cycle. Polishing the frontend on top of an unstable backend is wasted work, because every backend change forces frontend rework. Stabilize the backend; then rebuild the frontend in one clean pass.

If a frontend bug surfaces during your testing, write it in `FRONTEND_TODO.md` and keep going. Example entries that are acceptable:

- "ResultsScreen.tsx crashes when response has no `spendingBreakdown` field — needs to handle missing field or render alternate panel"
- "ActionPlanScreen.tsx does not call the new `/action-plan` endpoint — still expects inline `actionPlan` from the analyze response"
- "HistoryScreen.tsx does not handle the new `avgConfidence` field on the score chart"
- "ResultsScreen.tsx has no UI for `mentionedSpending` (the user-stated spending panel) or `recommendedBudget` (the baselines panel)"

Each of those is a legitimate frontend bug. None of them are blockers for considering this backend work done.

### Quality bar before declaring this work complete

The work is shippable when ALL of these are true:

- The eval harness from Step 8 passes **11 of 13 fixtures**.
- Manual review from Step 12b: **4 of 5 snapshots are rated 4 or 5 of 5**.
- No forbidden strings appear in any of the 5 snapshots (Bitcoin, specific tickers, "as your CFP," etc.).
- Score reproducibility: running the same input twice produces a score within **5 points** of the previous run (you can verify this by running one snapshot input twice and checking the score field).
- The regression-awareness exercise (Step 12d) is documented in `DECISIONS.md`.
- BUG 1 is fixed and confirmed working — the Claude path no longer throws `ReferenceError: API_URL is not defined`.
- The action-plan endpoint from Step 13 is deployed. The frontend's "View Action Plan" button is NOT wired up in this work cycle — that is part of the eventual frontend rebuild, not this work.
- Total Anthropic spend during this entire work cycle is **under $20**. If it crosses $20, you have likely been iterating without a clear hypothesis. Stop and ask for help.

### What to do with this list

When you tell Jason "I'm done," he will cross-reference against this section in two passes:

1. **Existence check.** For every file under "Files that should exist," confirm it exists in git. For every modification under "Files that should change," confirm the change is in the diff. Anything missing is a gap to fill before declaring done.

2. **Scope check.** Run `git log --since="<plan start>" --name-only` and look at every changed file. If a file appears that is NOT in "Files that should exist" or "Files that should change," ask why. If it is a frontend file outside the allowed list, that change should be reverted.

If both passes are clean, the backend work is done. Now you can plan the next work cycle (the frontend rebuild).

---

## Section 4 — Definition of done

Before you stop and call this work shipped, confirm every item below. If any is false, the work is not done.

- Steps 1 through 13 are marked complete in this document with commit hashes.
- The `shared/` folder exists and is imported by both the frontend and the edge function.
- Baselines for all 50 states + DC are populated with cited sources. Any TODOs are documented.
- The CFPB IRT scoring module exists and unit tests pass.
- The deterministic calculations module exists and unit tests pass.
- The system prompt is in `supabase/functions/analyze/prompts/system.txt` and matches the version produced in Step 6 plus any tuning from Step 11.
- The edge function uses tool use, not JSON.parse. Temperature is 0.2. Cache_control is set on the system prompt + tool.
- The eval harness passes 11+ of 13 fixtures.
- The action-plan endpoint is deployed and the frontend connects to it.
- BUG 1 is fixed (no `API_URL` ReferenceError).
- Total Anthropic spend during this work is under $20.
- `DECISIONS.md` has at least 3 entries documenting non-obvious choices made along the way.

## Section 5 — Optional follow-up while waiting for Jason's review

**Read this only if Steps 1-13 are fully done AND Jason has not yet finished reviewing your work.**

After you finish Step 13, your backend work is complete. You commit, push, and message Jason on WhatsApp that you are done. Jason will need time to review. While you wait, you have two choices:

1. **Stop working.** Take a break. This is the right answer if you are tired or unsure about anything.
2. **Build the structured user-context form.** This is optional, low-risk frontend work that does NOT call the API. It is the same Step 8 that used to be in the main flow — it has been moved here because it is not required for the backend to work.

If you choose option 2, this is the only frontend work allowed in this entire plan. The rules:

- **Do not start this until you finish all 13 steps AND have messaged Jason.** If you start it while still working on Steps 1-13, that is scope creep.
- **Do not run the app to test the form against the live endpoint.** Per Section 0.11, the test scripts are the only authorized way to call the API. If you want to verify the form produces the right request body shape, use a temporary `console.log` in `src/services/claudeApi.ts` and inspect the body before it is sent. Do NOT submit the form for real.
- **Commit and push each piece separately** so Jason can review the form work independently from the backend.
- **If Jason gives you feedback on the backend before you finish the form**, drop the form work and address the feedback first. The form is the lowest-priority item in the plan.

**What the form is**:

A collapsible "Give Claude more context" section on the HomeScreen. Optional, skippable, drops below the free-text input. Lets the user fill in chip/dropdown values that map to the `UserContext` interface defined in Step 5.

**Prompt to copy into Claude Code (only after Jason knows you have started this)**:

```
I want to build an optional structured user-context form on the HomeScreen of my Expo React Native app. This is OPTIONAL follow-up work after the main backend rebuild is complete. The form lets a user fill in 7 dropdown / chip fields that improve AI accuracy. The user can skip the form entirely.

Constraints (critical):
- Do NOT submit the form to make a real API call. The form's only job in this work is producing a valid request body shape that matches `AnalyzeRequestSchema` from `shared/schemas.ts`. Verification happens by adding a temporary console.log of the request body, not by tapping analyze.
- Do NOT change any other screen.
- Do NOT add animations, color changes, or backgrounds.
- The form must be collapsible. Default collapsed. The entry point stays minimal.
- All fields are optional. The user can submit with the form empty.
- Match existing chip styles already in HomeScreen.tsx.

Build:

1. New component `src/components/UserContextForm.tsx`. Controlled form with these fields, each a chip group or dropdown:
   - state: 50 US states + DC, dropdown
   - ageBracket: chip group ['18-24', '25-29', '30-34', '35-44', '45+']
   - incomeBracket: chip group ['under_2k', '2k_4k', '4k_6k', '6k_10k', 'over_10k']
   - livingSituation: chip group ['renting', 'owning', 'with_family', 'dorm', 'other']
   - employmentStatus: chip group ['full_time', 'part_time', 'self_employed', 'student', 'between_jobs']
   - debtBracket: chip group ['none', 'under_5k', '5k_15k', '15k_50k', 'over_50k'] — default 'none'
   - liquidSavingsBracket: chip group ['none', 'under_500', '500_2k', '2k_10k', '10k_50k', 'over_50k'] — default 'under_500'

   Props:
     interface UserContextFormProps {
       value: Partial<UserContext>;
       onChange: (next: Partial<UserContext>) => void;
     }

   Use the `UserContext` type from `@shared/types`. Display labels in plain English ('under_2k' shows as "Under $2k").
   Use existing styles from `Colors`, `Typography`, `Spacing`, `Radius` in `src/theme/colors.ts`.

2. Update `src/screens/HomeScreen.tsx`:
   - Add state: `const [userContext, setUserContext] = useState<Partial<UserContext>>({});`
   - Add state: `const [contextExpanded, setContextExpanded] = useState(false);`
   - Below the free-text input but above the "Suggestions" chips, add a collapsed header "+ Give Claude more context (optional)" that expands the UserContextForm when tapped.
   - Persist values to AsyncStorage with key `@ambroke_user_context`.
   - On mount, read AsyncStorage and pre-fill the form.

3. Update `src/services/claudeApi.ts` `analyzeFinancialSituation` signature to accept `userContext: Partial<UserContext>`. Fill missing fields with 'unknown'. Send the structured body `{ freeText, userContext, tone }`. ADD a temporary console.log of the request body before fetch — this is how we verify the form works without actually calling the API.

4. Update `src/hooks/useAnalysis.ts` to thread userContext through.

5. Update `src/screens/ProcessingScreen.tsx` to read userContext from navigation params.

How to verify:
- Run the app on Android. Tap "+ Give Claude more context" — form expands.
- Fill 3 fields, then tap analyze.
- Look at the console output for the request body. Confirm it contains a `userContext` field with the three values.
- DO NOT let the analyze call go through to the API. If you need to prevent it, you can throw an early error after the console.log in claudeApi.ts.
- Close the app and reopen it. The previously filled fields should be pre-filled from AsyncStorage.

When you are done, show me:
1. The new UserContextForm.tsx file.
2. The updated HomeScreen.tsx (full file).
3. The updated claudeApi.ts (just the changed function).
4. The console output showing the request body with userContext populated.
```

**Audit skill**: `verify`. Ask the skill to confirm: the form values persist to AsyncStorage, the request body shape matches `AnalyzeRequestSchema` from `shared/schemas.ts`, and the form does not trigger a real API call.

**Commit message**: "Optional: build structured user-context form (not part of main backend cycle)"

After committing, message Jason on WhatsApp: "Form done. Pushed to GitHub. Still waiting on your backend review when you have time."

---

## Section 6 — When to ask for help

Ask for help when:
- You blow past a step's hard ceiling (150% of budget).
- A failing eval fixture cannot be fixed with prompt-only changes after 4 hours of trying.
- Claude Code "tries a different approach" three times in one session and none work.
- You are about to commit a change that touches more than 5 files at once.
- You notice the Anthropic spending is running faster than expected (more than $5 in a single working session).
- You catch yourself thinking "I'll fix this regression later." Fix it now or stop work.

It is faster to lose 15 minutes asking than to lose half a day grinding on a wrong assumption.

## Section 7 — Daily checklist (print this if it helps)

Before each session:
- [ ] Read Section 0 of this document once.
- [ ] Pick exactly one step from Section 2.
- [ ] Open a fresh Claude Code session.
- [ ] Confirm the Anthropic spending cap is set in the console.

During each session:
- [ ] Stay scoped to the single step. No skipping ahead, no combining steps.
- [ ] Read every diff before accepting.
- [ ] Push back when Claude Code tries to "improve" surrounding code.
- [ ] If running a paid script, confirm cost first.

Before committing:
- [ ] Type check passes (`npx tsc --noEmit`).
- [ ] The step's verification step is done.
- [ ] The audit with the named skill is done.
- [ ] Commit message says what changed and why in two sentences.

After each step:
- [ ] Mark the step done in this document with the commit hash.
- [ ] Add a `DECISIONS.md` entry if you made a non-obvious choice.
- [ ] Take a short break.

End of document.
