# Mock Content for Claude Design — "Am I Broke?" prototype

Paste-ready sample content for the prototype tabs. **Don't give Claude Design the raw `.ts`
fixtures** (imports/types/logic it can't use) — give it *this*. Every tab pulls from **one coherent
persona (Jason)** so the whole prototype tells a single consistent story instead of contradicting
itself (e.g. a "credit-card-interest" roast when he's card-free). All figures/copy are lifted from the
app's real fixtures (`src/__fixtures__/`), so the prototype previews the actual app.

## Score-band reference (the ring + label color, everywhere)

| Band | Score | Color |
|---|---|---|
| Cooked | 0–40 | alarm red `#FF4D6D` |
| Surviving | 41–60 | amber `#FFB020` |
| Stable | 61–80 | teal `#00C2A8` |
| Thriving | 81–100 | green `#00E676` |

---

## The user (greeting · profile · Home header)
- **Name:** Jason · **handle:** `@jason`
- **"Now" =** June 2026
- **Score: 80 → Stable (teal)** · mood 😎
- **Streak:** 3 months
- **Score trend:** +6 pts this month
- **Past roasts:** 5

## Current snapshot (Home "Financial Reality" + Financials tab)
- **Monthly income:** $5,000 — status *steady*
- **Monthly expenses:** $3,700
- **Monthly surplus:** +$1,300/mo (savings rate ~26%)
- **Liquid savings:** $2,600 — status *+$180, building* (~0.7 month of expenses)
- **Total debt:** $9,800 — status *last debt* — ONE debt: **Car Loan, $9,800 @ 7.9% APR** (min $310/mo)
- ⚠️ He is **card-free now** (paid off a 25% Capital One card mid-climb). Do NOT show credit-card debt
  in the "now" state — the only current debt is the car loan.

## Latest roast (Home roast card + the most-shown roast)
- **Score 80 · Stable (teal) · 😎**
- **Roast (the shareable jab):** "Bestie, who let you get responsible? Credit card in the ground, an
  emergency fund forming, and you actually saved this month. Respectfully — the algorithm fumbled
  serving a finance-roast app to someone winning this hard."
- **Summary:** "The card is gone, savings are real, and you're finally ahead of your bills instead of
  chasing them. The $9,800 car loan is the last boss — and at 7.9% it's very beatable. The next move is
  turning the freed-up card payment into a full emergency fund."
- **Insights:**
  - "You killed the Capital One card — that's roughly $87/mo in interest you no longer set on fire."
  - "Savings of $2,600 is a real buffer now: about three weeks of expenses, climbing toward a full month."
  - "With the card gone, the car loan at 7.9% is the only meaningful debt left — steady payments retire it."
- **Top problems:** "$9,800 car loan is the last debt standing — not urgent at 7.9%, but the final step
  to debt-free." · "Savings is building but still under a full month of expenses."
- **Positive behaviors:** "You paid off a 25% APR card — the single highest-return money move there is." ·
  "Spending is down and savings are automated. The hard part is genuinely behind you."
- **Top fix:** "Keep the old $326 card payment flowing into savings until you have one full month of
  expenses (~$3,700) parked, then split it between the buffer and the car loan."
- **Mentioned spending (breakdown):** Groceries $420 · Dining out $180 · Gas $160 · Car insurance $165

## "Up Next" (Home action card)
Show the next *incomplete* plan step (NOT an invented one): **"Hit a one-month emergency fund"** —
"Keep the auto-transfer running until savings reach one full month of expenses (~$3,700)."

## Past roasts (History list / "Past Roasts" — 5, newest first)
List rows show: date · score+band · the input snippet · a short headline. (Full roast shows on tap.)

| Date | Score | Band (color) | Input snippet | Headline |
|---|---|---|---|---|
| Jun 1 | 80 | Stable (teal) | "Down to one debt and actually saving now — how am I doing?" | Raise landed + card gone. Actually saving now. |
| May 24 | 71 | Stable (teal) | "Card is dead, just the car loan left. What do I do with the freed-up cash?" | Card-free. Now the surplus actually goes to savings. |
| May 10 | 61 | Stable (teal) | "Paid off most of the Capital One card. Buffer is finally forming." | Medical bill cleared, card under $1.5k. Buffer forming. |
| Apr 26 | 52 | Surviving (amber) | "Cut my subscriptions and threw the difference at my 25% card." | Cut two subscriptions, threw the difference at the card. |
| Apr 12 | 42 | Surviving (amber) | "Paycheck to paycheck with ~$4k on a credit card at 25%. Roast me." | Paycheck to paycheck, card maxed. |

(Jason's arc is 42 → 80, so the list shows Surviving + Stable. For Cooked/Thriving colors, the community
feed below has a 34 and an 85.)

## Check-ins (Check-In flow / journey timeline — 2, newest first)
- **May 20** · mood **5/5** 😎 · "Paid off the Capital One card 🎉" · score 66 · savings $1,700
- **May 3** · mood **3/5** 😬 · "Chipping at the card. Medical bill almost gone." · score 55 · savings $900

## Action plan (Update Plan / plan tab — 4 steps)
**Overall:** "The expensive debt is dead and you're saving — now the job is turning this momentum into a
real cushion and closing out the car loan. Steady beats heroic."

1. **Week 1 · Redirect the old card payment** *(savings)* — "Auto-transfer the freed-up ~$326/mo to
   savings on payday so it never touches checking." — ✅ **done**
2. **Weeks 2–4 · Hit a one-month emergency fund** *(savings)* — "Keep the auto-transfer running until
   savings reach ~$3,700." — **in progress (this is "Up Next")**
3. **Weeks 5–8 · Throw extra at the car loan** *(debt)* — "Split the $326: half to savings, half on top
   of the car-loan minimum."
4. **Weeks 9–12 · 30-day re-roast** *(mindset)* — "Run a fresh roast and compare to April. Lock in the
   habits that moved the score."

## Subscriptions (Financials tab — "Subscription audit")

A MANUAL list the user maintains. We have no bank/usage access — we only know what they tell us
(name, cost, cadence, category). The value is VISIBILITY: most people have never added their
subscriptions up. We show the running total and let the user audit/cut. We do NOT know — or claim to
know — what they "still use."

**Total: ~$89/mo · ~$1,068/yr across 7 subscriptions**

| Subscription | Cost | Cadence | Category |
|---|---|---|---|
| Spotify Premium | $11.99 | monthly | Music |
| Netflix | $15.49 | monthly | Streaming |
| Amazon Prime | $14.99 | monthly | Shopping |
| iCloud+ (200 GB) | $2.99 | monthly | Storage |
| DoorDash DashPass | $9.99 | monthly | Food delivery |
| Planet Fitness | $24.99 | monthly | Fitness |
| Max (HBO) | $99.99/yr (~$8.33/mo) | yearly | Streaming |

Notes for the view:
- **Headline = the total** ($/mo and $/yr). That's the whole point — surfacing a number the user has
  never tallied.
- **Monthly-equivalent** rolls non-monthly plans into the total (Max's $99.99/yr → ~$8.33/mo) so it's honest.
- **Cadence varies** — show the cadence + the $/mo equivalent.
- **"What to cut" is USER-driven, NOT app-detected.** No "last used / unused" flag — we can't observe
  usage. The user taps to remove a sub. An AI nudge may comment on the TOTAL it can see ("7 subs, $89/mo
  — watching all of them?"), but never implies we know when something was last used.
- Optional: a per-category breakdown (Streaming $X, Music $Y…), since category is user-entered.
- **Empty state:** "Add your first subscription."

## Community feed (Community tab — 9 posts, newest first)
Two are Jason's own (badge **"You"**). The feed spans all four bands — good for testing every ring/label
color. Each: handle · score+band · roast · reactions · time.

| Who | Score | Band | Roast | Reactions |
|---|---|---|---|---|
| **You** (@jason) | 80 | Stable | "Paid off the card, built an actual emergency fund, and the algorithm has nothing left to roast. Character development is real." | 🔥34 🫡19 😭3 · Jun 10 |
| **You** (@jason) | 61 | Stable | "Card's almost dead and I haven't DoorDashed in two weeks. Growth." | 🔥12 🫡4 · May 12 |
| @payday_phantom | 34 | Cooked | "Money comes in, money leaves, you never see it — like a ghost with a debit card. The overdraft fee is basically your roommate now." | 💀41 😭18 🔥6 · Jun 9 |
| @doordash_dynasty | 49 | Surviving | "You're not broke, you're just single-handedly funding a small delivery-driver empire. Cooking is free, bestie — it's been free this whole time." | 😭33 💀27 🤡12 · Jun 9 |
| @rentpoor_rachel | 45 | Surviving | "Half your money evaporates to rent and the other half to 'treat yourself' Tuesdays. Somehow it is always Tuesday." | 😭22 🔥9 · Jun 8 |
| @crypto_casualty | 41 | Surviving | "You took 'buy high, sell low' as a personal challenge and you are absolutely winning. The portfolio is a haunted house." | 💀29 🤡15 🔥7 · Jun 8 |
| @softlife_sam | 66 | Stable | "Genuinely not bad — a cushion is forming. Stop poking it with random 2am Amazon carts and you're golden." | 🔥19 😭4 · Jun 7 |
| @budget_baddie | 79 | Stable | "An actual emergency fund AND a paid-off card? Who hurt you into financial responsibility? Whoever it was, thank them." | 🔥38 🫡14 · Jun 7 |
| @saver_supreme | 85 | Thriving | "Okay, show-off. The only thing broke about you is the algorithm that served you this app. Respectfully — log off and go enjoy it." | 🫡27 🔥21 · Jun 6 |

## Share captions (share sheet — 3)
- "Went from 42 to 80 on Am I Broke? in three months — paid off the card, built a real cushion. aibroke.app"
- "Killed a 25% APR credit card and my score hit 80 💪 The glow-up is real. Am I Broke? — aibroke.app"
- "From 'paycheck to paycheck' to actually saving. 80/100 and climbing. Check yours at aibroke.app"

## Notifications center (computed nudges — show 1–2)
- "Your score may be out of date — re-score from your snapshot."
- "Monthly check-in is ready."

---

## Edge cases to stress-test layouts (use a few, deliberately)
- **All four band colors** — render them via the community feed (34 Cooked / 49 Surviving / 66 Stable /
  85 Thriving) to verify the ring + label color in each.
- **Longest roast** ≈ 240 chars (the latest roast is near the cap) — does the card wrap cleanly?
- **Empty / brand-new user:** 0 roasts → Home shows the onboarding starting estimate, "No roasts yet" in
  history, no trend line, no streak.
- **Big / zero numbers:** $0 income (unemployed), $50k+ debt, $0 savings → check number formatting and
  that a low score shows the **Cooked red**.

---

## Implementation notes (for the eventual RN port — NOT content for Claude Design)

Reminders for when we translate Claude Design's prototypes into the real app. These are *not* for the
Claude Design briefs — they're for us at port time.

- **Use a custom back button, never the native iOS one.** The native iOS / React-Navigation back button
  has a **long-press menu that lists the previous screens' titles** (press-and-hold → a back-history
  popup). That exposes our internal view names and reads as strange/unpolished. On every pushed screen
  (Subscriptions, Debts, etc.), supply a **custom `headerLeft` back control** — or set
  `headerBackButtonMenuEnabled: false` on the native-stack screen — so the long-press history menu never
  appears. Pairs with the "floating/pinned header" design decision on the money-list screens.
