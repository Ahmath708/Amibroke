# Project Status — Am I Broke?

> **Read this first, every session.** It's the source of truth for *where we are right now*;
> `CLAUDE.md` is the source of truth for *how things are built*. When you finish meaningful work,
> append a one-line entry to the Session Log at the bottom. Keep this thin — link the living
> trackers below, don't duplicate them.

**Last updated:** 2026-06-10 · **Active branch:** `better-workflow` (off `redesign`)

---

## Sources of truth (living docs — read the relevant one before touching its area)

| Doc | Owns |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | How the repo is built — rules, structure, conventions, gotchas |
| [`docs/DECISIONS.md`](DECISIONS.md) | Decision & iteration log (why things are the way they are) |
| [`docs/design-doctrine.md`](design-doctrine.md) | All frontend work — brand, tokens, motion, the `/audit-screen` rubric |
| [`docs/roast-plan-rework.md`](roast-plan-rework.md) | Living tracker: roast/plan persistence rework (phased) |
| [`docs/demo-checklist.md`](demo-checklist.md) | Fresh-account end-to-end QA checklist |
| [`docs/unified-financial-model.md`](unified-financial-model.md) | The snapshot / analyses / check-ins model |
| [`docs/three-day-enforcement.md`](three-day-enforcement.md) | 3-day-access paywall enforcement plan |

## In flight

- **Workflow system (this branch).** Making fresh/cross-session work reliable: this status doc +
  an operating loop in `CLAUDE.md` + a `CLAUDE.md` staleness refresh. Remaining/optional: a Stop-hook
  auto-checkpoint and a skills-as-table upgrade (both unconfirmed).
- **Onboarding "Voice on Polish"** *(planned, not started).* Motion floor (PressableScale / staggered
  entrances / haptics, reduce-motion honored) + a neutral "cheeky host" voice that teases the roast
  without committing to the savage tone (tone is user-selectable later). Plan agreed; copy table +
  `OnboardingScreen.tsx` rework pending. Can't demo here (no Mac).
- **Roast / plan rework** — see [`docs/roast-plan-rework.md`](roast-plan-rework.md). Phases 1, 2, and the
  plan-UX overhaul are ✅ done; Phases 3 (re-roast model), 4 (plan-progress feedback), 5 (estimate
  labeling), 6 (UI papercuts) pending.
- **3-day-access enforcement** — built but flag-gated **off** (`FEATURES.PAYWALL_ENFORCEMENT`).
  Remaining: coverage audit + trial-expiry UX + a validated flag-flip. See the doc above.

## Known drift to verify (not yet acted on)

- **Onboarding debt step.** `CLAUDE.md` / commit history / `demo-checklist.md` describe onboarding
  collecting a **debt** bracket, but `src/screens/OnboardingScreen.tsx` on this branch still comments
  *"debt is NOT collected here — the first roast itemizes it"* (STEP_COUNT 5, step 4 = savings only).
  Reconcile code vs. docs before relying on either.

## Environment constraints (this machine)

- **Windows, no Mac** in this environment → can't build/run the iOS simulator or take screenshots.
  Type-check (`npx tsc --noEmit`) and `npm test` are the correctness signals here; device/visual
  verification happens in the Mac session.
- Paid-API discipline is `CLAUDE.md` rule #1 — never run `tools/eval/*`, `manual-test.ts`, or
  `test_anthropic.ts` without stating call count + cost and getting confirmation.

---

## Session log

_Newest first. One short entry per meaningful unit of work: what changed + any landmine learned._

### 2026-06-10 — workflow system + CLAUDE.md refresh (`better-workflow`)
- Pulled `redesign` to `519960c` (roast/plan rework, migration 00026 drops `analyses.action_plan`,
  new `RoastLoading`/`ToolSkeleton`, `ProcessingScreen` slimmed, analyze prompt reworked).
- Created this status doc as the read-first state index; added a "How to operate" loop + a Start-here
  pointer to `CLAUDE.md`; refreshed `CLAUDE.md` staleness (migrations → 00026, `active_plans` is the
  plan store, new components, `demo-app` skill).
- Landmine noted: `CLAUDE.md` drifts silently when feature branches land — hence the operating loop's
  "capture what you learn / append a Session Log entry" rule.
