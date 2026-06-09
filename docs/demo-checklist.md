# Fresh-account demo checklist

End-to-end QA for a brand-new account. Pair with the DB reset (below) + a deliberate mocks choice.

## ⚠️ Decide mocks first — it changes *what* you're testing
- **Mocks ON** (`USE_AI_MOCKS = __DEV__ && true`, default): safe, **no paid calls**, but the roast/score
  are the **SAMPLE fixture** and the snapshot is an **in-memory store** (resets on reload) — a UI/UX
  walkthrough, not real persistence.
- **Mocks OFF** (`&& false`, rule #1 — **paid**): **real LLM + real DB**. The only way to truly test the
  starting-score, persistence, and the snapshot sharpening. For a real fresh demo, you want this — and
  the DB reset matters. Confirm migrations are pushed remotely (snapshot 00022, ctx 00015, etc.).

## DB reset (Supabase SQL editor — needs elevated access this repo's env doesn't have)
```sql
do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = 'REPLACE_ME@example.com';
  if uid is null then raise notice 'no such user'; return; end if;
  delete from public.post_reactions     where user_id = uid
     or post_id in (select id from public.community_posts where user_id = uid);
  delete from public.community_posts     where user_id = uid;
  delete from public.check_ins           where user_id = uid;
  delete from public.active_plans        where user_id = uid;
  delete from public.financial_snapshots where user_id = uid;
  delete from public.analyses            where user_id = uid;
  delete from public.subscriptions       where user_id = uid;
  update public.profiles set
    onboarded = false, first_name = null, last_name = null,
    ctx_state = null, ctx_income_bracket = null, ctx_age_bracket = null,
    ctx_living_situation = null, ctx_employment_status = null,
    ctx_debt_bracket = null, ctx_liquid_savings_bracket = null, monthly_income = null
  where id = uid;
end $$;
```
*(Drop any line whose column/table errors as missing — that migration isn't pushed. A brand-new email needs only the deletes, not the profiles update.)*

## Checklist

### 0 · Setup
- [ ] Mocks ON vs OFF decided (real demo → OFF). · [ ] DB reset run (or new email). · [ ] Migrations pushed (if OFF).

### 1 · Auth / signup
- [ ] Email+password signup → username availability (try a taken one) → onboarding.
- [ ] Google / Apple OAuth signup → onboarding. · [ ] Bad password/email → correct error copy.

### 2 · Onboarding v2
- [ ] Intro ("Before we roast you… the basics.") + 3 benefit rows + "Let's do this."
- [ ] Step 1 name → Step 2 personalizes ("Nice to meet you, {name}.").
- [ ] Progress: "Step N of 5 · each answer sharpens your score"; steps glide in.
- [ ] Step 5 "The damage" collects debt + savings (both required).
- [ ] Cheeky copy reads welcoming, not mean; Back works each step.
- [ ] Ready gate → Calculate my starting score → thinking → ScoreRing reveal (count-up + haptic) + band reaction → "See the real roast →" (no dead end).
- [ ] (mocks OFF) Score reflects inputs (high debt + low savings → low band).

### 3 · Dashboard (first-run)
- [ ] Shows your starting score (calm glow), not `?/100`.
- [ ] "Your Finances" card shows income/debt/savings (with `~` estimated markers). · [ ] Greeting + bell.

### 4 · Nav (5 tabs)
- [ ] Home · Tools · Roast · Community · Profile; pill slides, icons brighten.
- [ ] Roast tab = composer with "Roast Me" header + bell; behaves like a real tab. · [ ] Content clears the floating bar.

### 5 · First roast
- [ ] Tone chips = Heroicons; animated placeholder + caret match the input; chips/voice/Clear work.
- [ ] Submit → Processing → Results with the score reveal.
- [ ] (mocks OFF) Snapshot sharpens — estimated debt line replaced by what you typed (check Dashboard after).

### 6 · Results
- [ ] Score ring + band, roast, breakdown (expand/read-more), share. · [ ] Plan/paywall CTA.

### 7 · Action Plan
- [ ] Card: chevron disclosure (payoff visible, how-to expands), bigger week pill, no category dot.
- [ ] This Week (minimized when a future card opens) + single Up Next section.

### 8 · Tools · Community · Profile
- [ ] Subscription audit: add a sub → weighs into re-roast/plan (approach A).
- [ ] Debt Payoff reads the snapshot; Scenario = "Coming Soon."
- [ ] Community: share a roast, react.
- [ ] Profile → Edit Profile: names/username save; OAuth → locked "Managed by {provider}" card; email/pw users get fields behind the current-password gate.

### 9 · Notifications · Check-in · Stale-state
- [ ] Bell → Notifications center; nudges route; dot when pending.
- [ ] Monthly check-in → reward (delta + streak + reflection).
- [ ] Score-stale (check-in after a roast) → Dashboard banner → re-score from snapshot (no re-typing).

### 10 · Motion / accessibility
- [ ] Reduce Motion ON (Settings → Accessibility) → re-walk: motion snaps, haptics stay, info present (onboarding entrance, score reveal, analyzing hero, tab pill).
- [ ] Large Dynamic Type — note anything that breaks (known gap).

### 11 · Edge cases
- [ ] Onboarding score fails/timeout (mocks OFF, kill wifi mid-Calculate) → graceful fallback, no dead end.
- [ ] Empty states (no analyses/subs/check-ins) render cleanly.
