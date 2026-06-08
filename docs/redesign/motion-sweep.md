# Motion Sweep #1 — hand-rolled `Animated` → motion system + reduce-motion

> **Goal:** every decorative animation honors **reduce-motion** (doctrine §5 hard requirement) and
> uses **motion tokens** instead of inline `ms`/bezier/friction literals. Where a standard pattern
> exists, use the **motion system** (`PressableScale`/`CountUp`/`entrances`). Tracking doc for a
> multi-session sweep — update status as files land.

## Two compliance levels (RN `Animated` vs Reanimated reality)

`theme/motion.ts` `Easings`/`Springs` are **Reanimated-shaped** (bezier / stiffness-damping) and
**can't** be used in RN `Animated`. So:

- **Tier A — full migration:** move to Reanimated + the motion system (`PressableScale`, `CountUp`,
  `entrances.ts`). Uses all tokens. Preferred where a pattern matches (tappables, count-ups,
  list/section entrances).
- **Tier B — compliant in place:** keep RN `Animated` for genuinely bespoke animation, but add
  **`useReducedMotion()`** (re-exported from `@/components/motion`; it's just a boolean) + **`Durations`**
  (plain numbers, usable in RN `Animated.timing`) + a **named RN `Easing`** (not an inline bezier).
  Used when a Reanimated rewrite isn't worth the ripple.

> **Why `useEntryAnimation` stays Tier B:** it has **15 consumers**, all rendering RN `Animated.View`.
> Migrating the hook to Reanimated forces all 15 to swap to Reanimated's `Animated.View` (many also
> use RN `Animated` locally → aliased dual imports). Not worth it. Making the hook reduce-motion-aware
> in place **cascades the entrance-a11y fix to all 15 screens from one file.** A full Reanimated
> entrance is a deferred, deliberate follow-up.

## Verification per file
`npx tsc --noEmit` · re-screenshot on the SE (motion frames) · **toggle Reduce Motion** (sim →
Settings → Accessibility → Motion) and confirm motion **snaps to final, info preserved, haptics
kept**. Commit per screen/group.

## Checklist

### Phase 0 — Pilot (proves the patterns)
| File | What | Plan | Status |
|---|---|---|---|
| `hooks/useEntryAnimation.ts` | shared entry (fade+slide), 500ms, **no reduce-motion** | Tier B: `useReducedMotion` snap + `Durations.slow` | ✅ done |
| `screens/HomeScreen.tsx` | mic pulse loop + suggestion input-fade (spring) | Tier B: reduce-motion gate + `Durations`; spring→timing | ✅ done |

> Pilot side-effect: once `useEntryAnimation` is reduce-motion-aware, **all 15 consumer screens'
> entrances become compliant** — the tail below then only needs its *local* `Animated` (if any).

### Phase 1 — Signature / high-visibility
| File | `Animated.*` | Plan | Status |
|---|---|---|---|
| `components/ScoreRing.tsx` | — | ✅ **already exemplary** — Reanimated, one shared value (arc+number lockstep), `useReducedMotion` snap-with-haptic, `Durations.reveal`/`Easings`/`Springs`, band-reactive landing, tabular-nums. The reference impl; no work. | ✅ done |
| `screens/ResultsScreen.tsx` | 2 | The reveal is ScoreRing (done). Gated the content `fadeIn` + disclosure `LayoutAnimation` on reduce-motion + tokenized the duration. | ✅ done |
| `screens/ProcessingScreen.tsx` | 23 | ✅ Tier B — spin / crossfade / pulse / success-spring / error-shake gated on reduce-motion (step labels + progress bar kept as info); magic ms pulled into a named `T` timing map. (Step icons are still Ionicons + retry buttons bare `TouchableOpacity` — out of motion scope; §6/§9 follow-ups.) | ✅ done |
| `screens/LandingScreen.tsx` | 10 | ✅ Tier B — entrance fade/slide + CTA pulse gated on reduce-motion + `Durations.slow`/`.reveal`; value-props already used `enterUp`. | ✅ done |
| `components/AnalyzingHero.tsx` | 4 | ✅ Tier B — the looping ring/sparkline/count-up demo now shows one fully-drawn static sample under reduce-motion (no sweep/cycle); `DRAW_MS`/`FADE_MS` → `Durations`. | ✅ done |

### Phase 2 — Shared components (high reuse)
| File | `Animated.*` | Plan | Status |
|---|---|---|---|
| `components/TypingPlaceholder.tsx` | 4 | Tier B — caret blink + typing now gated on reduce-motion (static first example, no caret blink). Blink ms kept (deliberately matched to the native iOS caret). | ✅ done |
| `components/Toast.tsx` | 4 | Tier B — slide/fade + reduce-motion | todo |
| `components/AuthBackground.tsx` | — | Tier B — ambient bg; reduce-motion + ensure not always-on-heavy | todo |
| `components/iOS/GlassSection.tsx` | 5 | Tier B | todo |
| `components/AnimatedProgressRing.tsx` | — | verify (uses motion system already) | todo |
| `components/Skeleton.tsx` | — | verify | todo |
| `components/Toggle.tsx` | — | verify | todo |
| `navigation/AppNavigator.tsx` | — | verify (IOSTabBar pill) | todo |

### Phase 3 — Tail (mostly `useEntryAnimation` consumers → auto-fixed by pilot)
Each: confirm the entrance is covered by the pilot, then fix any **local** `Animated` + reduce-motion.

`CommunityFeedScreen` · `CreatorDashboardScreen` · `DebtPayoffScreen` · `HistoryScreen` ·
`MonthlyCheckInScreen` · `ProfileScreen` · `ScenarioSimulatorScreen` · `SettingsScreen` ·
`ShareScreen` · `SubscriptionAuditScreen` · `ToolsScreen` · `PaywallScreen` · `LoginScreen` — todo

### Already on the system (reference, no action)
`NeonButton` · `SelectableChip` · `CheckinCard` · `PremiumCard` · `ProfileAvatarButton` ·
`DashboardScreen` · `NotificationsScreen` (use `PressableScale`/`CountUp`/`useReducedMotion`).
