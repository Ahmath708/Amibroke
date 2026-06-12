# Demo Prep — mock cohesion + UI polish

> Planning doc for the demo-recording pass. Companion to `post-onboarding-audit-2026-06-11.md`.
> **Status:** A (mocks) in progress — `src/__fixtures__/demoPersona.ts` drafted; awaiting **arc sign-off**
> before rewiring the mock sites. B/C/D queued. Money-trend chart (Finances) shipped.

When recording the demo the data on screen has to be cohesive, so the headline work is **A** (mocks).
B–D are polish that show up on camera.

---

## A. Mock rebuild — one persona, one timeline  *(the big one)*

**Finding (inventory ⇒ ~2/10 cohesion).** The demo data is really **two incompatible people** stitched
together:
- *Every roast you tap* returns the same baseline (`getMockAnalysisById` ignores the id): Apr 12, **score
  55, $16.5k debt** (card+car+medical), $1.2k savings.
- *Dashboard/snapshot:* Jun 1, **score 80, $9.8k debt** ("student loan"), $2.6k savings.
- *Active plan:* thinks debt is **$7.2k / score 37**, `source_analysis_id: 'mock-1'` → a roast that doesn't exist.

Will show on camera: tap your score-80 roast → see score-55 data; captions say "$4.2k credit card"; check-in
goals chase a card the snapshot says is paid off.

**Root cause:** every mock was hand-authored in its own file, so they drifted.
**Direction:** define the arc **once** (`demoPersona.ts`) and **derive every mock from it** — history,
`getMockAnalysisById`, check-ins, money-trend, snapshot, plan, captions.

### The arc — "Jason's glow-up", Apr → Jun 2026
Same **named debts, paid down** (not "credit card" → mystery "student loan"). Card + medical → $0, car loan
$11.5k → $9.8k. Debt/savings/score/spend all monotonic.

| Date | Kind | Score | Income | Spend | Savings | Debt (itemized) |
|---|---|---|---|---|---|---|
| Apr 12 | roast | 42 | $4.8k | $4.1k | $200 | $16.5k — card 4.2k@25%, car 11.5k@7.9%, medical 0.8k |
| Apr 26 | roast | 52 | $4.8k | $3.95k | $700 | $15.3k — card 3.3k, car 11.2k, medical 0.8k |
| May 3 | check-in | 55 | — | $3.9k | $900 | $14.0k — "chipping at the card" |
| May 10 | roast | 61 | $4.8k | $3.88k | $1.2k | $12.3k — card 1.5k, car 10.8k |
| May 20 | check-in | 66 | — | $3.85k | $1.7k | $10.4k — "paid off the Capital One card 🎉" |
| May 24 | roast | 71 | $4.8k | $3.8k | $2.0k | $10.1k — car only |
| Jun 1 | roast | 80 | $5.0k | $3.7k | $2.6k | $9.8k — car only ("raise + card gone") |

Endpoint (Jun 1) === the existing `MOCK_SNAPSHOT` and the money-trend "now" → everything lines up.

### Actionables (after arc sign-off)
1. ✅ `demoPersona.ts` — the timeline + helpers (`debtTotal`, `personaRoasts/Checkins/Latest`, `personaMoneyEvents`).
2. `getMockAnalysisById(id)` → return **that roast's** analysis (synthesize from the matching point).
3. `MOCK_HISTORY` → derive from `personaRoasts()` (score + date + figures).
4. `MOCK_CHECKINS` → derive from `personaCheckins()`.
5. `services/moneyTrend.ts` `MOCK_EVENTS/NOW` → `personaMoneyEvents()` (dates now line up with roasts).
6. `MOCK_SNAPSHOT` → `personaLatest()`.
7. `mockPlan` → start_metrics = Apr-12 point, `source_analysis_id: 'mock-1'` (now real), steps = card-payoff plan.
8. `SAMPLE_CAPTIONS` + check-in goals → current state (score 80, car-loan-only).
9. **Community:** keep the feed random, but add **1–2 posts by Jason w/ reactions** + wire the **owner's view**
   of his own post (need to confirm how own-posts render).

---

## B. Trend screen — enrich it (don't demote it)

**Finding:** "Trend" (Dashboard tile → route `History` → `TrendScreen`) renders **only** `HistoryChart`
(granularity filter + bar graph). No stats, no list, no milestones. Confirmed empty.

**Direction:** populate it; keep the Dashboard peek tile. The app's pitch is "watch your glow-up", so a real
**Journey** screen is on-brand + a demo highlight (42 → 80). Add under the graph:
- **Headline stats:** current · all-time best · "+38 since April" · band.
- **Journey list:** each roast as a row (date, score, band pill, tap → result) — the missing "past scores" list.
- **Milestones** (optional): "First roast", "Reached Solid", "Best yet 🎉".

(It's the *score* trend — distinct from the new Finances *money* trend; no overlap.)

---

## C. Empty / "coming soon" states — standardize + kill the dead-end

**Finding:** ScenarioSimulator's coming-soon *is* centered, but its **tool row is fully clickable** — tapping
"Soon" dead-ends into it. Empty states are authored separately (Trend "📋 No roasts yet" vs Scenario
"🔮 Coming Soon") so they don't match.

**Actionables:**
1. **Make the Scenario row non-clickable** (dim, keep the "Soon" pill, drop onPress). Don't let people tap an unbuilt feature.
2. Shared **`<EmptyState>`** component (icon + title + body, always vertically centered) → Trend-empty, Scenario, future blanks.
3. Leave the screen in nav as an unreachable stub (consistent with "rebuilt later").

---

## D. The roast flame — make it ours, not Tinder's

**Finding:** Heroicons `FireIcon` in 6 spots; the rounded Heroicons flame ≈ Tinder's. Brand-defining one is the
**Roast tab icon** (`TAB_ICONS` in AppNavigator) — on screen every frame. Others are contextual (avalanche =
aggressive, streak = "on a roll", savage tone, onboarding bloom). No shared constant — it's copy-pasted across 6 files.

**Direction:** a custom shared `RoastIcon` so it's not-Tinder, still "fire = roast", and centralized.
**Mock these 4 on the sim before committing:**
1. **Custom angular flame** — sharper/edgier than the rounded Heroicon (safe, on-brand).
2. **Apple-emoji-style flame (🔥)** — match the iOS fire-emoji silhouette (warm, familiar, more detailed than Heroicons).
3. **Restyled solid flame** — Heroicons solid variant, tuned weight/fill.
4. **🌶️ chili pepper** — bolder pivot off fire entirely; very Gen-Z, unmistakably not-Tinder.

**Actionables:** build `components/RoastIcon.tsx`; point the **brand** spots at it (Roast tab, savage tone,
onboarding bloom, landing value-prop); leave the **contextual** flames (avalanche, streak) as Heroicons.

---

## Design decisions — Finances tab

### Change colors → **keep green/red (semantic)**  *(no change)*
We *do* have red-for-bad: the "Your Money" net row goes red when spend > income; the Money-trend delta goes
red when a metric worsens. **Keep it.** The color *is* the good/bad judgment (functional, not decorative), and
it matches the Dashboard's green "↑ 8 since last". The chart **line stays accent-pink** (brand leads); only the
delta/net **text** carries the semantic — so it stays disciplined. Pink-generic is a one-token swap if we change our minds.

### Section headers → **merge Tools into one card**  *(recommended, pending build)*
Inconsistency: the money sections are cards with **internal** uppercase labels (YOUR MONEY / WHERE YOUR MONEY
GOES / MONEY TREND); **Tools** is an **external** `SectionLabel` above 3 separate row-cards. Merge into a single
**TOOLS** card (internal label + 3 rows with hairline dividers) → the whole tab becomes a uniform stack of
internal-label cards, tighter and grouped. (Alt: accept it as "single-block sections vs a labeled list" — valid,
but less consistent.)

---

## Suggested order (for the demo)
1. **A — mocks** (nothing else matters if numbers contradict on camera).
2. **D — roast icon** (every frame via the tab bar; quick win).
3. **B — trend screen** (dead screen → highlight).
4. **C — scenario / empty states** (remove dead-end, polish).
