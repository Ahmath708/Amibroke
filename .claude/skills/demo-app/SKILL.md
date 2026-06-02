# Demo App — record a product walkthrough

Record a polished **~90s** screen recording of "Am I Broke?" on the iPhone SE simulator, from a
signed-out cold start (native + in-app splash) all the way through the product: auth (with the
legal pages), the AI roast + Results, history, community, a live Deep Dive upgrade, and the
premium tools. Invoked as `/demo-app`.

The output is `/tmp/sim-rec-demo.mp4` (+ frames in `/tmp/sim-rec-demo/`).

## Owner defaults (decided — don't re-ask each run)

1. **Device:** iPhone SE (3rd gen) simulator, already booted. Build/launch with `npm run ios:sim`
   if it isn't installed (NOT `expo run:ios` — broken under Xcode 26 + SDK 55).
2. **One continuous take** via `tools/sim-record.sh`. Pacing is "soak it in, but not too long" —
   generous dwell on hero beats (splash, Results), brisk on the rest.
3. **AI mocks are ON** (dev). The Results beat **intentionally** submits one analysis — with mocks
   that's free, instant, and deterministic. Never make a real/paid call, and don't submit more than
   the one intended roast.
4. **Google sign-up auto-resolves** the simulator's remembered Google account (owner-verified). If
   the account sheet doesn't auto-dismiss, locate + tap it live (`idb ui describe-all`).
5. **The Deep Dive upgrade uses the RevenueCat Test Store** ("Test valid purchase") — dev only,
   no real money. It may not persist across cold restarts; that's fine for the take.
6. **Iterate.** A clean single take rarely happens first try — record, review extracted frames,
   adjust sleeps/targets, re-run. Don't ship a janky take.

## Tooling

- Recorder: `tools/sim-record.sh <label> <seconds> [cold-launch-bundle-id] [fps]` →
  `/tmp/sim-rec-<label>.mp4` + `/tmp/sim-rec-<label>/frame-NNN.png` (frame N ≈ N/fps seconds).
- Driving the sim: **idb** at `~/.idb-venv/bin/idb`. SE is **375×667 pt**. Do **NOT** set
  `IDB_COMPANION`. Read coordinates with `idb ui describe-all --udid <udid> --json` — don't guess.
  Taps: `idb ui tap X Y`. Swipes: `idb ui swipe --duration <s> X1 Y1 X2 Y2` (swipe up = scroll down).
- Bundle id: `com.aibroke.app`.

## Phase 0 — Pre-flight (NOT recorded)

1. Confirm a booted SE sim: `xcrun simctl list devices booted`.
2. Launch the app and check auth state. **If signed in → sign out** (Profile → Settings → Sign
   Out). The take must start signed OUT.
3. Leave the app terminated — `sim-record.sh` cold-launches from springboard, so the native splash
   is captured. (`xcrun simctl terminate booted com.aibroke.app` if needed.)

## Phase 1 — Calibrate (NOT recorded)

A continuous take can't pause to compute coordinates, so pre-capture them. Walk the flow once
(signed-out screens first, then sign in and walk the signed-in screens) and record each target's
(x,y) from `idb ui describe-all`. Build the ordered tap/scroll list below. Targets that only exist
mid-flow (Google account sheet, Test Store sheet, Paywall plan card) get located **live** during
the record pass — budget a beat for them.

Stable anchors worth caching: the tab bar (~y=643: Home ~x=63, Tools ~x=188, Community ~x=312 on a
3-tab bar — confirm), the Dashboard "New roast" button, the Premium card, the Profile avatar
(Dashboard header).

## Phase 2 — Record (one take)

Reset to Phase 0 end-state (signed out, killed), then:

```bash
tools/sim-record.sh demo 100 com.aibroke.app 12    # ~100s @12fps, cold-launches from springboard
```

Immediately drive the timed sequence (sleeps are starting points — tune on review). Hold ~1s of
stillness on each screen before interacting so the viewer registers it.

### The flow (beats · target · ~dwell)

1. **Splash → Landing** — native splash → in-app `SplashScreen` → **Landing** (signed out). Hold
   **~8s** so `AnalyzingHero` cycles a few score-band variations (red→green sparkline draws).
2. **Sign In** — tap **"Sign In"** (Landing) → Login. Pause ~0.6s.
   - Tap the **Terms of Service** link (in the agreement row) → slow-scroll the page ~2s → back.
   - Tap the **Privacy Policy** link → slow-scroll ~2s → back.
3. **Sign Up + Google** — tap the **"Sign Up"** segment → pause ~0.6s → tap **"Sign Up with
   Google"** → wait ~2s for the account to auto-resolve → lands on **Dashboard** (Home tab).
4. **Dashboard + Paywall** — hold ~1s → smooth-scroll to the bottom (~3s) → scroll back up → tap the
   **Premium card** → **Paywall** (modal) → smooth-scroll the whole paywall (~5s) → **close** (X).
5. **New Roast → Results (hero)** — tap **"New roast"** → **Analyze** screen. Scroll; tap **"+ Add
   Financial Context"** → scroll the info form ~3s → close. Then **run a roast**: tap a suggestion
   chip (or type) to fill the input → tap **"Analyze Finances"** → **Processing** animation →
   **Results**. Dwell + slow-scroll Results (~6s): score ring, roast, key metrics, debts. → back to
   Dashboard.
6. **History** — tap a **History** link on the Dashboard → show History (~3s).
7. **Community** — tap the **Community** tab → slow-scroll the roast feed (~4s).
8. **Profile → upgrade to Deep Dive** — tap the **avatar** (Dashboard header) → **Profile** (shows
   **Free Plan**, ~1.5s) → tap **"Your Plan"** (free → Paywall) → select **Deep Dive** → **Start
   Free Trial** → on the **Test Store** sheet tap **"Test valid purchase"** → back → Profile now
   shows **Deep Dive** (hold ~2s on the change).
9. **Tools (unlocked)** — tap the **Tools** tab → the premium tools grid now shows everything
   unlocked (no lock badges) (~3s).
10. **Wind down** — return to the **Home/Dashboard** tab, hold ~1.5s, recording ends.

Total ≈ 90s of motion inside the ~100s window (buffer at the tail).

## Phase 3 — Review + iterate

- Read key frames from `/tmp/sim-rec-demo/` (frame N ≈ N/12 s). Confirm each beat landed, the
  Google + Test Store sheets resolved, nothing is clipped, and scrolls are smooth (not jumpy).
- If a beat is off (mistimed sheet, scroll too fast, missed tap), reset to Phase 0 and re-record
  with adjusted sleeps/targets. The `.mp4` is the deliverable; frames are for QA.

## Guardrails

- Start signed OUT every run (Phase 0) or the splash→Landing→auth beats won't happen.
- Submit the analyze flow exactly **once** (step 5). Mocks make it free, but keep it to one roast.
- The upgrade is **Test Store** only (dev). Don't run this against a production build.
- If Google or the Test Store sheet stalls, pause and resolve it live before continuing — a frozen
  beat ruins the take.
