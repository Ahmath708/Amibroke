# 3-Day Free Access — Enforcement Checklist

> **Status:** the trial/entitlement logic is **already built** (client + server), **flag-gated OFF**.
> This is the audit + a *validated flag-flip* to make it real — **not** new implementation. Companion
> to the onboarding work (a fresh user is always in-trial, so onboarding's starting-score call passes
> regardless of the flag).

## What already exists (don't rebuild)
- **Shared trial math:** `@shared/entitlement` — `getTrialStatus(user.created_at)`, `TRIAL_DURATION_DAYS = 3`.
  Anchor = the account's `created_at` → **no migration, no column**.
- **Server enforcement:** `supabase/functions/_shared/entitlement.ts` → `enforceEntitlement(req)`,
  already called by **`analyze`** and **`action-plan`** before the paid AI call (flag-gated).
- **Client gates:** `useSubscription` → `canUseApp` / `trialActive` / `trialDaysLeft` / `hasAccess`.
  The roast (`HomeScreen`) + re-score (`Dashboard`) check `canUseApp`; premium tools check `hasAccess`
  (which folds in `trialActive`).
- **Tests:** `src/services/__tests__/subscriptions.test.ts` covers the trial math.
- **Flags:** client `FEATURES.PAYWALL_ENFORCEMENT` (`EXPO_PUBLIC_PAYWALL_ENFORCEMENT`); a server-side
  flag inside `enforceEntitlement` (confirm the exact env var).

## 1 · Coverage audit — every paid action hits a gate
- [ ] **Roast** (`HomeScreen.handleAnalyze`) — `canUseApp` ✓ client + `analyze` `enforceEntitlement` ✓ server.
- [ ] **Re-score** — `Dashboard` banner ✓; the **notifications re-score** (`useRescore`) — confirm it gates too.
- [ ] **Onboarding starting score** — `analyze` `enforceEntitlement` ✓ server; fresh user is in-trial → passes (intended).
- [ ] **Action-plan generation** — `action-plan` `enforceEntitlement` ✓ server. Viewing an existing plan
  (`ActionPlanScreen`) doesn't self-gate — confirm it's only reachable through a gated entry (no side door).
- [ ] **Premium tools** (Tools, DebtPayoff, Scenario) — each checks `hasAccess`, not just the hub.
- [ ] **Other edge functions** (`generate-captions`, `revise-plan`) — confirm they enforce or are post-gate only.
- [ ] List any **view-only** screen that should be walled after expiry vs. intentionally readable.

## 2 · Trial-expiry UX
- [ ] Countdown nudge on day 2/3 ("X days of full access left") — pick the surface (Dashboard banner / notifications).
- [ ] The **hard wall**: on day-3 expiry with no plan, every gated tap → Paywall, consistently; copy matches the model.
- [ ] **No dead ends** — a gated tap always lands on the Paywall, never a blank/disabled state.

## 3 · Flip the flags (only after 1 + 2, behind validation)
- [ ] Server flag ON (the env var gating `enforceEntitlement`).
- [ ] Client `EXPO_PUBLIC_PAYWALL_ENFORCEMENT=true`.
- [ ] Keep them in **lockstep** (client gate + server enforce) so neither leaks.

## 4 · Validate at the boundary (real DB — the parked mocks-off pass)
**Highest-risk step** — a boundary/gate bug either locks out real users or gives the app away.
- [ ] Real account, `created_at` just **under** 3 days → full access everywhere.
- [ ] `created_at` just **over** 3 days → gated everywhere → Paywall.
- [ ] Confirm the **server** rejects (not just the client) — call a function directly past expiry.
- [ ] A RevenueCat paid plan **overrides** an expired trial (paid → access).

## 5 · Docs
- [ ] Fix **CLAUDE.md** — its monetization note says enforcement is "the remaining work / NOT yet
  implemented"; it's **built + flagged off**. (Handled in the same docs pass as the onboarding update.)

## Sequencing
Do **1 (coverage)** and **2 (UX)** anytime — cheap, no risk. Flip **3** only with the boundary
validation **4**, which rides the parked real-DB pass. **Onboarding ships independently** (new users
are in-trial regardless of the flag).
