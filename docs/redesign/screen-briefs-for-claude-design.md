# Claude Design Briefs — Am I Broke? app screens

Screen-by-screen briefs for the **main app** redesign in Claude Design (the post-onboarding
screens). Onboarding already shipped as its own `Onboarding.html` flow; these go into the **app
prototype** (the one with the five-tab bar: **Home · Tools · Roast · Community · Profile**).

> **How to use this doc.** For each screen, paste **three things** into Claude Design:
> 1. the **Shared preamble** below (once per session is fine),
> 2. the **mock content** for the data — [`mock-content-for-claude-design.md`](./mock-content-for-claude-design.md),
> 3. the **one screen brief** you're building.
>
> Build them in the **recommended order** (next section) so each screen reuses templates the
> earlier ones established.

---

## Shared preamble (read before every screen)

You are building the **main screens of an existing app prototype** — reuse everything you've
already established; don't restyle the finished tabs.

- **Reuse your established design language.** Same palette, type pairing, spacing rhythm, card
  style, motion, and iconography you built for the onboarding flow and the Home/Tools/Roast tabs.
  **Don't hardcode new colors** — your palette already looks great; pull from it.
- **The one fixed-color rule: score bands.** A score always renders in its band color, and the
  band label pill matches it. These four are semantic and must stay exact (see the *Score-band
  reference* table in the mock-content doc): **Cooked = red · Surviving = amber · Stable = teal ·
  Thriving = green**. Everything else uses your accent + neutrals.
- **The score ring is the signature element.** Reuse your established score-ring (oversized numeral
  + `/100` inside a colored arc). A mini version (~44px, no `/100`) appears in lists.
- **Reuse, don't reinvent:** the score ring, the elevated **list-group** (rows hairline-separated
  inside one rounded card), the **segmented control**, the **pill badge**, the **glass card**, the
  primary **button**, the **section label** (small uppercase caption above a group). If two screens
  need the same shape, make it the same component.
- **Chrome by screen type.** **Tab screens** (Community, Profile, History) lead with a large screen
  title and a **notification bell** top-right. **Pushed screens** (Results, Plan, Check-In, Paywall,
  Share) get a back or close affordance, no tab bar.
- **Every data view designs four states:** loading = **skeleton/shimmer** (not a spinner), **empty**
  (emoji + title + one line), **error** (message + retry), and the happy path. Clamp long AI/user
  text so cards never blow out.
- **Motion is earned.** Staggered section entrances (40–80ms), spring + haptic press on every
  tappable, count-up on numbers that land. **Hero moments get drama; utility screens stay calm.**
  The **score reveal on Results is *the* moment** — don't replicate its drama anywhere else.
- **Voice:** Gen-Z, cheeky, supportive-savage; sentence case for labels/body, Title Case only for
  buttons; emoji are intentional accents. Pull exact copy/numbers from the mock-content doc — one
  coherent persona (Jason) runs through every screen, so the prototype tells one story.
- **Honesty cue:** figures are "based on what you told me," never bank-synced — keep that framing
  where snapshot numbers show.

Each brief below gives: **what it is · what it reuses · layout (top→bottom) · the unique content ·
states & motion · guardrails.** I only describe what's *unique* to each screen — the shared chrome,
footer button, and palette above are assumed.

---

## Recommended build order

Templates cascade, so build in this order:

1. **Roast Me (composer)** — the entry to the core loop; mostly self-contained (input card, suggestion + tone chips).
2. **Results** — establishes the score hero, the roast card, and the elevated metric-list group; its score-reveal flows straight out of the Roast Me loader.
3. **Share** — reuses the score + roast on an exportable card.
4. **Community** — reuses the mini ring + band pill in a feed.
5. **History (Trend)** — reuses the mini ring + rows + a trend chart.
6. **90-Day Plan** — introduces the progress ring + step cards.
7. **Check-In** — reuses money inputs + introduces the mood/streak/reward flow.
8. **Paywall** — plan cards + comparison table.
9. **Profile** — the calm account hub (least motion, most rows).

---

## 1. Roast Me (composer)

**What it is.** The **entry to the core loop** — where the user types (or speaks) their money
situation, picks a roast voice, and taps to get roasted. It serves as both the **Roast tab** (a
dwell tab with its own large title) and the pushed **"New Roast"** route. The whole app flows from
here: **Roast Me → a brief "roasting…" loader → Results.** A screen with personality, but the input
and CTA must stay dead obvious.

**Reuses.** The inset **glass card** for the input, the **selectable-chip** pattern (same selected
state as the onboarding Setup chips) for tone, accent-tinted **pill chips** for suggestions, the
section label, the primary button, the notification bell.

**Layout (top → bottom).**
1. **Header (tab only):** large title **"Roast Me"** + notification bell. Subtitle:
   *"Describe your finances. Get roasted by AI. Fix your life."*
2. **Input card** (inset): a tall multiline field with an **animated typing placeholder** that
   cycles real example confessions when empty; a footer with a **char counter** (x / 4000), a
   **Clear** action (only when there's text), and a **mic** button for voice input.
3. **Honesty cue:** a sparkle icon + *"I only know what you tell me — the realer the input, the
   sharper the roast."* (the no-bank-sync expectation).
4. **Primary CTA:** **"Roast My Finances"** (disabled until there's input) + a small hint
   *"Powered by Claude · Results in seconds."*
5. **Suggestions:** a horizontally-scrolling row of tappable **example chips** with a right-edge
   fade hinting there's more. Tapping one fills the input.
6. **Roast Tone:** a wrap of **selectable chips** — **Savage · Gentle · Therapist · Big Sibling ·
   Finance Bro** (each an icon + label). The pick is sticky (it's the user's saved voice).

**Unique content.** Placeholder examples + suggestion chips are short, Gen-Z "broke confessions"
(placeholders like *"I make 5k/month but somehow I'm still broke…"*, *"My DoorDash budget is bigger
than my savings account…"*; chips like *"I have $2k in credit card debt"*, *"My subscriptions are
out of control"*, *"I'm living paycheck to paycheck"*). The five tones above (default **Savage**).
For a filled-in example, use Jason's latest input from the mock doc (*"Down to one debt and actually
saving now — how am I doing?"*).

**States & motion.** The **typing placeholder** types/erases example lines on a loop while the field
is empty and unfocused, and **stops the instant the user focuses or types** (it must share the
input's exact font metrics so there's no jump on hand-off). Tapping a suggestion chip **fades +
rises** the new text into the field. The **mic pulses** while listening (and shows a stop icon). The
CTA is disabled until there's input. On submit, hand off to a short branded **"roasting…" loader**
that flows straight into the **Results score-reveal** — design those two as one continuous moment.

**Guardrails.** Keep it to **one obvious action** (type → Roast My Finances) — don't clutter the
first screen of the loop. The tone chips reuse the selectable-chip selected state (accent border +
faint tint) so they match onboarding. Don't paywall the composer visually in the default state
(enforcement is flag-gated off) — a hard-paywalled user is simply routed to the Paywall on submit.

---

## 2. Results

**What it is.** The payoff screen shown right after a roast finishes (and when re-opening a past
roast). The whole app builds to this — it must feel like a *reveal*, then let the depth unfold on
demand. Pushed screen.

**Reuses.** Score ring (full size), pill badge, glass cards, the elevated list-group (you'll build
it here and reuse it on every later screen), section labels.

**Layout (top → bottom).**
1. **Score hero.** The score ring (score + `/100` inside, band color) on the left; beside it the
   **band pill** (e.g. "Stable") and a small **"Data Confidence" badge** (low/medium/high).
2. **Roast card.** A `ROAST` label, then the shareable jab in **oversized, tight headline type**,
   inside a card with a faint accent-tinted wash. This is the personality — give it real presence.
3. **#1 Thing To Fix.** A single highlighted card: the one action + a green
   "Est. monthly improvement: $X" line.
4. **Primary action + quick actions.** A full-width **"View 90-Day Action Plan"** button, then a
   row of icon+label quick actions: **Share · Post · Track · PDF**.
5. **"See the full breakdown" toggle** (collapsed by default). Lead with the hit; tuck the homework
   behind one tap. Expanded, it reveals, in order: **The Breakdown** (summary paragraph) ·
   **Key Metrics** (list-group) · **Emotional Status** (emoji + label) · **What You're Doing Right**
   (green checks) · **Biggest Problems** (red ✗) · **Debts** · **What You Mentioned Spending** ·
   **Recommended Budget (50/30/20)** · **Key Insights** (arrow bullets).
6. A one-line **disclaimer** footer ("estimates based on what you told us; not financial advice").

**Unique content.** Everything from **"Latest roast"** + **"Current snapshot"** in the mock doc:
score **80 / Stable / 😎**, the roast, the summary, the three insights, top problems, positive
behaviors, the top fix, and mentioned spending (Groceries $420 · Dining $180 · Gas $160 · Car
insurance $165). Key Metrics come from the snapshot (income $5,000 · expenses $3,700 · liquid
savings $2,600 · monthly savings +$1,300 · total debt $9,800 · savings rate ~26%). **Debts = one
row only: Car Loan $9,800 @ 7.9%.** Recommended Budget contrasts current vs the 50/30/20 target.

**States & motion.** **THE signature moment:** on open, the score **counts up 0 → 80** while the
ring **arc fills in lockstep**, landing on a haptic + a small settle. Sections stagger in beneath
it. Also design the **gated-CTA two states**: unlocked → "View 90-Day Action Plan"; locked →
**"Unlock 90-Day Action Plan — $4.99"**. The Debts card likewise has an unlocked "View Debt Payoff
Plan" vs a locked "Upgrade to Deep Dive" row.

**Guardrails.** Don't show credit-card debt — Jason is card-free now, the only debt is the car
loan. Hide any metric that's N/A rather than printing "N/A". Don't let the breakdown read as a
homework packet — the collapsed default is the point.

---

## 3. Share

**What it is.** Turn a result into a **shareable image card** for Stories/feeds. Pushed from the
Results "Share" action. The card *is* the export — the roast lives on it, so the image stands alone.

**Reuses.** The score + band pill from Results, rendered onto a self-contained card; the segmented
control; icon+label action tiles.

**Layout (top → bottom).**
1. A small header: **"Share Result"**.
2. **Format toggle** (segmented): **Story 9:16** · **Post 4:5**.
3. **The share card** (the hero — what gets exported). On a deep branded gradient: the **@handle**,
   the **big score + band label** in the band color, the **date** (e.g. "Jun 2026"), the **roast
   quote** (capped to ~2 sentences for Story, 1 for Post), the **emotional status** (emoji + label),
   and a **brand domain footer** (`aibroke.app`). Story is the taller 9:16 frame; Post is 4:5.
4. **Actions row:** **Share** (opens the OS share sheet) · **Save** (→ Photos) · **Copy Link**.
5. A one-line hint: "Share opens the system sheet — post anywhere, or save the image. The roast
   lives on the card."

**Unique content.** Use Jason's latest result: **@jason · 80 · Stable (teal) · Jun 2026**, the
roast (first 1–2 sentences), mood 😎. The three caption strings in the mock doc's **"Share
captions"** are for the OS sheet, not printed on the card.

**States & motion.** **Save** and **Copy Link** confirm **inline** by morphing the tile to **"Saved"
/ "Copied"** (no toast, no alert). **Share** has no success state — the sheet itself is the
feedback. Switching format re-renders the card into the new aspect ratio without clipping.

**Guardrails.** The card must **never crop** the score or roast in either frame — cap the roast by
sentence, not characters. Don't put real income/debt on a public card (score + roast + mood only).

---

## 4. Community

**What it is.** A public feed of **anonymous roasts + scores** from other users — social proof and
"everyone's a little broke" reassurance. A tab.

**Reuses.** Mini score ring (~44px), band pill, the segmented control, list/feed cards, the
notification bell, a floating action button.

**Layout (top → bottom).**
1. **Header:** large title **"Community"** + notification bell. Subtitle: *"Everyone's a little
   broke. Anonymous roasts and scores from people figuring it out too."*
2. **Segmented control:** **Trending · Recent · Lowest.**
3. **Feed of post cards.** Each card: a **mini score ring** + **@handle** (+ a small **"You"** pill
   on your own posts) + **band pill** + **time-ago**; below, the **roast quote** (italic, clamped
   to ~6 lines); then a **reactions row** — emoji+count chips where the user's own reactions are
   highlighted, plus a **"＋ React"** button that opens an inline emoji picker.
4. A floating **"Share"** button (bottom-right) → opens a sheet to post/unpost your own roasts.

**Unique content.** The **nine posts** in the mock doc's **"Community feed"** (two are Jason's, with
the "You" pill). Reaction emoji set: **🔥 🫡 😭 💀 🤡**. The feed deliberately spans **all four
bands** — render 34 (Cooked red), 49 (Surviving amber), 66 (Stable teal), 85 (Thriving green) so
every ring/pill color is visible.

**States & motion.** Skeleton = ~4 card placeholders. Empty = **"🌱 No posts yet — be the first to
share your roast."** Tapping a reaction animates the chip (a quick zoom) and bumps the count
instantly. Cards stagger in on load.

**Guardrails.** These are *static, already-known* scores — the rings do **not** do the Results
count-up reveal; they just render. Reaction taps feel instant (optimistic), never block on a
network round-trip.

---

## 5. History (Trend)

**What it is.** The user's **progress home** — a score-over-time chart, headline stats, and the full
list of past roasts. Reached from the Dashboard's Trend/Roasts tiles.

**Reuses.** Mini score ring + band pill in rows, the elevated list-group, section labels; a banded
line chart.

**Layout (top → bottom).**
1. **Banded score-trend chart** — score on the Y axis over time, with the four band ranges as faint
   horizontal color zones behind the line so a rising line visibly climbs from red → teal.
2. **Stats card** — three cells: **Roasts · Avg · Best**.
3. **"Past Roasts"** list. Each row: **date · score + band pill · the input snippet · a short
   headline**, and a **delta** vs the previous roast (e.g. ▲ +9). Tapping a row opens that roast's
   Results.

**Unique content.** The **five rows** in the mock doc's **"Past roasts"** (Jason's 42 → 80 arc).
Stats: **5 roasts · avg 61 · best 80.** The chart plots those five scores oldest→newest.

**States & motion.** Skeleton = a chart block + a stats block + 3 row placeholders. Empty =
**"📋 No roasts yet — run your first roast to start tracking your glow-up."** The chart needs ≥2
points to draw (with one roast, show stats + the single row, no line). Rows stagger in.

**Guardrails.** Make each chart point / bar tappable with a ≥44pt hit area (→ that roast). The
band zones use the fixed band colors; the line uses your accent.

---

## 6. 90-Day Plan

**What it is.** A personalized, trackable **90-day action plan** (paid). Two big states: **no plan
yet → create one**, and **an active plan** you work through week by week. Pushed screen.

**Reuses.** A **progress ring** (same ring shape as the score ring, but a neutral/accent progress
arc, not band-colored), the week **pill badge**, glass cards, the list-group, section labels.

**Layout — no plan yet.** A single card: **"Your 90-day action plan"** + one line ("a personalized,
step-by-step plan to move your score — tracked the moment you create it") + a **"Create my plan"**
button.

**Layout — active plan (top → bottom).**
1. **Hero:** a **progress ring (% of steps done)** beside **"Day X of 90"**, **"N of M steps done"**,
   a nudge *"Finish the plan, watch your score climb."*, and a **delta line** (↓ $X debt · ↑ $X
   saved) when there's progress.
2. **Status strip:** either **"✓ Your plan is up to date"** or a stale banner **"Your plan may be
   out of date → Refresh Plan"**.
3. A check-in **bridge nudge:** *"Made progress? Check in with your real numbers to move your score
   →"*.
4. **"The Big Picture"** card — the plan's overall message.
5. **"This Week"** — the **focal step**: a card with a **week pill**, the step title, a **"→ impact"**
   line (always visible — it's the hook), an expandable **description**, and a **"Mark this done"**
   button.
6. **"Up Next"** — future steps as **compact rows** (open circle + title + week). Tapping a row
   expands it into a focal card in place; tapping the circle completes it.
7. **"Done"** — completed steps as struck-through rows with a filled check.
8. A quiet **"Restart plan"** link.

**Unique content.** The **four steps** in the mock doc's **"Action plan"** + the overall message.
Step 1 is **done**; step 2 ("Hit a one-month emergency fund") is the **This Week** focal step;
steps 3–4 are **Up Next**. Hero: ~Day 30, 1 of 4 done.

**States & motion.** Creating or refreshing shows a **full-screen "building your plan" loader**
(a looping, on-brand animation), then lands on the active plan. Marking a step done plays a haptic
+ a checkmark that pops, *then* the row slides to Done. The progress ring fills **calmly** —
**do not** borrow the Results score-reveal drama.

**Guardrails.** Checking steps tracks the plan; the **score** only moves at a check-in — keep that
distinction in the copy (hence the bridge nudge). Also design the **locked entry** (a non-subscriber
arriving here sees a preview + an unlock bar, not the live tracker).

---

## 7. Check-In

**What it is.** The **monthly ritual** — a soft, emotional moment to log how money feels + refresh a
few real numbers, rewarded with a streak and an AI "coach's note". Pushed screen. It moves through
**setup → check-in → reward**.

**Reuses.** The **money-input pattern** from the onboarding money screens (labeled rows with a `$`
prefix), the pick-row + check-circle from onboarding Setup, the list-group, the streak chip,
section labels, glass cards.

**Layout — setup mode.** Title **"What do you want to track?"** + one line; then a list of
**trackable metrics + debts** as pick rows (check-circle + label + **"Now: $X"** baseline + an
optional **"Goal" target input**). A **"Start tracking →"** button.

**Layout — check-in mode (top → bottom).**
1. Title **"{Month} {Year} Check-In"** + a **🔥 streak chip** + a soft **"Next check-in in Nd"**
   nudge.
2. **"How's money feeling this month?"** — a row of **five mood emojis** (😭 😟 😐 🙂 🤑); the
   selected one highlights and shows its label; below it an optional **note** text area.
3. **"Update what's changed"** — prefilled **money inputs** (income, expenses, savings balance, and
   one row per tracked debt), seeded from last month.
4. **"Your Progress"** — per-goal rows: **label · baseline → arrow → current**, where the arrow is
   **green up / red down / a muted bar for no change**.
5. A **"Complete check-in"** button + a quiet **"Edit what I track"** link.

**Layout — reward mode.** A big **🔥/✅** emoji, **"{N}-month streak!"** (or "Check-in logged"),
a line **"Since last time, you {paid down $X / saved $Y}."**, an **AI reflection card** (a short,
on-voice coach's note), then **"See your updated plan"** + **"Get a fresh AI re-score 🚀"** + a
**"Done"** link.

**Unique content.** Use the mock doc's **"Check-ins"** (the May 20 entry: mood 🤑/on-fire, note
"Paid off the Capital One card 🎉", savings up). Baselines/current figures come from the snapshot
(income $5,000 · expenses $3,700 · savings $2,600 · car loan $9,800).

**States & motion.** The **reward screen is the emotional payoff** — let it land (the streak emoji
gets a little life, the reflection card eases in). Mood tap = haptic + highlight. Progress arrows
animate to their value.

**Guardrails.** Never a hard gate — the screen is always reachable; the streak/nudge motivates, it
doesn't lock. Re-score is paywalled: show **"Get a fresh AI re-score 🚀"** for subscribers vs
**"💎 Unlock an AI re-score"** for free users.

---

## 8. Paywall

**What it is.** The **conversion screen** — sells the two paid plans after the user has seen their
score. Presented as a tall sheet (close button + grabber). After a 3-day free access there's **no
permanent free tier**, and the copy is honest about that.

**Reuses.** A gradient hero icon, the section labels, **two plan cards**, a **comparison table**,
preview cards, the primary button.

**Layout (top → bottom).**
1. A grabber handle + a **close (✕)** top-right.
2. **Hero:** a gradient **sparkles** icon, headline **"Your financial wake-up call is ready."**, sub
   *"You've seen the score. Now get the exact roadmap to fix it — before another paycheck
   disappears."*, and a small **"Cancel anytime · Auto-renews monthly"** line with a green dot.
3. **"3 days free, then choose a plan"** box — honest about the limit (no permanent free tier).
4. **"What You Unlock"** — preview cards: **90-Day Action Plan · Debt Payoff · Scenario Simulator
   (SOON badge)** — each an icon + name + one-line pitch, with a **"Peek →"** affordance when
   previewable.
5. **"Choose Your Plan"** — two cards side by side: **Action Plan (~$4.99/mo)** and **Deep Dive
   (~$9.99/mo)**, Deep Dive **featured** with a **"BEST VALUE"** badge. The selected card highlights.
6. **"What's Included"** — a **comparison table**: feature rows × **Action Plan / Deep Dive**
   columns, with **✓ / — / "Soon"** marks; the selected plan's column header highlights.
7. A small **summary line** of the selected plan + a full-width **"Unlock {plan}"** button.
8. **"Restore Purchases"** link + small **legal** fine print (auto-renews monthly, charged to Apple
   ID, cancel in App Store settings).

**Unique content.** Plans + prices above. Feature rows: AI Roast & Health Score · 90-Day Action
Plan · Monthly Check-In · Subscription Audit · Prioritized Fix List (all both tiers); Scenario
Simulator (— / Soon); Debt Payoff & Downloadable PDF (Deep Dive only). Default the selection to
**Deep Dive**.

**States & motion.** Design the **owned-plan** states too: the owned tier's card shows a **"CURRENT"**
badge and the button reads **"Current Plan" (disabled)**; owning Action Plan while viewing Deep Dive
reads **"Upgrade to Deep Dive."** Keep motion restrained — this is a focused decision, not a
fireworks moment.

**Guardrails.** No "Free" column in the table — it's a hard paywall after the 3 days. Don't invent
prices; use ~$4.99 / ~$9.99. Don't oversell "Soon" features as available.

---

## 9. Profile

**What it is.** The **account hub** — identity up top, then *all* settings inline (Cash App model:
there is no separate Settings screen). A tab. This is a **calm utility screen** — minimal motion,
clean rows.

**Reuses.** An avatar **hero card with a soft accent glow**, the **tier pill**, the elevated
list-group with **icon + label + (detail) + chevron/toggle/pill** rows, the toggle control, the
notification bell.

**Layout (top → bottom).**
1. Large title **"Your Profile"**.
2. **Hero card** (soft diagonal accent glow): a **gradient avatar circle** (tap to change photo),
   the **full name** (e.g. "Jason L"), the **@handle** beneath it, a **tier pill** (Free / Action
   Plan / Deep Dive), and an **edit-profile pencil** button in the corner.
3. **Grouped settings** (each group = a labeled list-group):
   - **Account:** Financial Context · Plans & Features · *Manage Subscription* (only when subscribed,
     with an external-link glyph).
   - **Notifications:** Push Notifications (toggle) · Check-In Reminder (toggle, detail "On your
     check-in date each month").
   - **Security:** Face ID / Touch ID (toggle, detail "Require unlock to open the app").
   - **App:** Roast Voice (row, detail = current voice e.g. "Savage") · Haptic Feedback (toggle).
   - **Support:** Help & FAQ · Privacy Policy · Terms of Service · Rate Am I Broke?.
   - **Danger Zone:** Clear Roast History · Delete Account (both in the danger color).
4. A **"Sign Out"** button (danger-outline) + a centered **version** footer.

**Unique content.** Persona **Jason L · @jason**. Show a **tier pill** — default it to **Deep Dive**
so the "Manage Subscription" row appears (and it matches a user who's winning). Use bare white icons
per group row.

**States & motion.** Avatar upload shows a spinner over the avatar, then a small "Profile picture
updated" confirmation. Otherwise this screen is deliberately still — rows, not animations.

**Guardrails.** Destructive rows (Clear History, Delete Account, Sign Out) always **confirm first**.
Toggles reflect real state. Keep it calm — **no decorative motion** here; the doctrine reserves
flair for hero screens, and this isn't one.

---

## Cross-screen consistency checklist

Before calling the set done, verify across all eight:

- One score-ring component, one band-pill, one list-group, one segmented control — not eight
  look-alikes.
- The four band colors are identical everywhere and only ever mean the band.
- Only **Results** does the count-up score reveal; every other ring is static.
- The **Roast Me** submit-loader flows continuously into the Results score-reveal — one moment, not two.
- Tab screens share the title + bell header; pushed screens share the back/close pattern.
- Gated CTAs show both their locked and unlocked variants somewhere in the set.
- Every list has a designed skeleton, empty, and error state.
