# Roast / Plan persistence rework + estimate + UI fixes — build order

Living tracker. Surfaced by a real (mocks-off) demo pass.

## Locked decisions (the contract)
- **View = read-only** — tapping any past roast writes nothing.
- **Re-roast = a NEW `analyses` row (insert), never an overwrite**; only the **most-recent** roast is
  eligible, only when **roast-input data changed**, **offered (user-confirmed), never auto**.
- **Plan = one per user in `active_plans`**; data change → **revise (keep progress), never regenerate**;
  **decision A** (generating = your active plan; `start_metrics` snapshots at generate).
- **`analyses.action_plan` dropped** — plan content lives only in `active_plans`.
- **Check-off feedback = progress + copy + check-in nudge** (never mutate the snapshot from estimates).
- **Estimate** = labeled unmistakably, persists, replaced by the first real roast.
- **Stale = any roast-input change** (`snapshot.updatedAt` > latest roast `created_at`), not just check-ins.
- **Plain-language insights** — analyze prompt drops finance jargon/acronyms (VHCOL/DTI…), keeps the
  cost-of-living personalization but says it plainly.

## Phases

### Phase 1 — Read-only view *(urgent, isolated)* — **✅ done** (`2ee170c`)
`ResultsScreen` gates both mount effects (`saveAnalysis` + `updateSnapshotFromAnalysis`) on "new roast
only". History entry points pass the saved `analysisId` → skip; a new roast from `Processing` has none →
persists. Kills the duplicate row + the snapshot clobber.

### Phase 2 — `action_plan` → `active_plans` consolidation (+ trim list GET) — **✅ done** (`54612d8`)
`runActionPlan` no longer caches in `analyses.action_plan`; the active plan IS the cache. `HISTORY_COLUMNS`
drops the heavy JSONB; `has_action_plan` derives from `active_plans.source_analysis_id`. Migration 00026
drops the column (push when convenient). NEEDS `db push`.

### Plan-UX overhaul (supersedes Phase 2's preview/commit; folds in Phase 3 update + Phase 4 done-anim) — **✅ done**
Decision changed to **Create → straight to an active plan** (no preview/commit). Fixes:
- **Open stall killed** — `ToolsScreen` navigates instantly (no blocking generation). `ActionPlanScreen`
  fetches the active plan; **no plan → "Create my plan" CTA** → generation runs on tap behind a shared
  **"Building your plan…"** loading view (reused for Refresh).
- **Stale → Refresh** — status flips to "Your plan may be out of date" + a **Refresh Plan** button →
  loading view → revised plan (keeps completed steps).
- **Done feedback** — "Mark this done" shows a **confirmation beat** (haptic + "✓ Nice — done!") before
  the card collapses; `LayoutAnimation` animates the reflow + the focal-card swap.
- Still TODO here: a richer in-place check animation + the milestone check-in nudge (Phase 4 tail).

### Phase 3 — Re-roast model *(depends on Phase 1)*
Widen staleness to a shared helper (`snapshot.updatedAt` > latest roast `created_at`); the recent roast,
when stale → **offer** a re-roast → `buildRescoreInput` → `analyze` → `saveAnalysis` (**new row**). Never
updates the old row, never `startPlan`s.

### Phase 4 — Plan-progress feedback + check-in bridge *(independent)*
Animate `planProgress` on check-off (ring/bar + count-up + haptic); copy ("checking off tracks your plan;
your score updates when you check in"); milestone check-in nudge. No snapshot mutation. (Projected score
deferred until impacts are structured.)

### Phase 5 — Estimate logic (3 bullets) *(independent)*
Label the 0-roast Dashboard score as an **Estimate** (ScoreRing badge); verify `snapshot.score`
persistence; first roast replaces it (already via the roast merge).

### Phase 6 — UI papercuts *(independent)*
Password validation → inline (not Apple alert); Tools "No analysis yet" gate → custom in-app; "subscriptions"
→ Title Case in the breakdown; Subscription Audit transition → opaque background immediately; **plain-language
insights** prompt tweak in `analyze/prompt.ts` (+ re-deploy).

## Sequencing
1 → 2 → 3 in order (1 stops damage; 2 is the data-model base; 3 needs both). 4/5/6 independent — interleave.
Phase 2's migration needs `db push` + a hosted-DB verify. Build with mocks ON; validate Phases 1–3 mocks-off.
tsc + jest + SE build per phase; commit per phase.
