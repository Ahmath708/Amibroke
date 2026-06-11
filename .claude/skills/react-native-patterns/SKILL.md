---
name: react-native-patterns
description: React Native + Expo patterns and pitfalls for this iOS-first app (Expo SDK 55, RN 0.83, React Navigation v7, Reanimated v4, jest-expo). Covers navigation lifecycle, Animated-vs-Reanimated and the native-driver desync, the screen-visibility trap, Expo/Metro gotchas, FlatList perf, keyboard handling, and testing. Use when writing or reviewing RN components/hooks/navigation/animations, or debugging RN-specific bugs — blank screens on tab switch, navigation lifecycle, native modules, keyboard covering inputs. This is NOT web React: ignore server/client components, Suspense data-fetching, Next.js, React Testing Library/MSW/Vitest, and CSS.
---

# React Native Patterns — Am I Broke? (Expo SDK 55 · RN 0.83 · iOS-first)

Hard-won patterns for **React Native**, not web React. Before trusting a "React" instinct, check it against the RN reality below — most web advice (SSR, Suspense data-fetching, bundle-splitting, RTL/MSW, CSS, the DOM) does **not** apply here.

## When to use
- Writing/reviewing any `src/screens/*` or `src/components/*` (RN views + hooks).
- Anything touching **navigation** (`@react-navigation/*`), **animation** (`Animated`, `react-native-reanimated`), **lists** (`FlatList`), or the **keyboard**.
- Debugging RN-only symptoms: a screen renders **blank**, a tab "won't load," the keyboard covers an input, a native module crashes, a test can't import a native dep.

---

## 1. React Navigation: screens are NOT always mounted

The biggest source of RN-only bugs here. Unlike a web route, a navigator screen's lifecycle is **independent of React mount**:
- Tabs can **mount lazily** and **detach / freeze / unmount on blur** (depends on `detachInactiveScreens` / `freezeOnBlur` / `lazy`). **Observed in this app:** revisiting a tab **re-mounts it from scratch** — a tab you "already opened" is not guaranteed to still be mounted.
- `useEffect(fn, [])` runs once **per mount** — but a screen can mount while **not focused** (lazy tab), so its effects fire off-screen at an unreliable time.
- `useFocusEffect` runs on every focus/blur — use it for "refresh when the user lands here" (reload data, re-read prefs). See `CommunityFeedScreen` (reloads the feed on focus) and `RoastComposerScreen` (re-reads tone/context on focus).

**Rules**
- Never assume a screen persists between visits. Don't stash "already did X on mount" across focuses.
- Effects that must run *when the screen is visible* → `useFocusEffect`, not `useEffect([])`.
- A screen's **resting render must be correct before any effect runs** (see §3).

## 2. Animation: `Animated` vs `Reanimated`, and the native-driver trap

Two systems coexist:
- **RN `Animated`** — older, JS-defined. With `useNativeDriver: true` the value is handed to native and runs off the JS thread.
- **`react-native-reanimated` v4** — the app's primary lib; UI-thread, and its **layout animations** (`entering`/`exiting`, e.g. `FadeInDown`) are **navigation-lifecycle-aware**.

**The native-driver desync (a real bug this app hit):** a native-driver `opacity`/`transform` animation lives *outside* React's render tree. When React Navigation **detaches and re-attaches** a screen's native view, the fresh native view does **not** get the animated value re-applied — so the JS `Animated.Value` reads `1.0` while the screen is **visually blank**. Re-running the animation `1→1` is a no-op and does **not** fix it (proven via logging in `useEntryAnimation`).

**Rules**
- For **entrance/exit tied to navigation**, prefer **Reanimated `entering`/`exiting`** over hand-rolled `Animated` on the screen container.
- If you must use `Animated`, **don't `useNativeDriver: true` on a value that gates a whole screen's visibility** across navigation — it desyncs on re-attach.
- **One animated value = one source of truth.** Don't drive the same value from both `useEffect` (mount) *and* `useFocusEffect` (focus) — they interrupt each other and race.

## 3. Never gate a screen's visibility on an animation completing

If a screen starts at `opacity: 0` and relies on an animation to reach `1`, **any** interruption — fast navigation, a dropped frame, a detach/re-mount — strands it **blank**. The resting state must be **visible**.
- Treat entrance animations as **additive polish**: worst case = "no fade," never "invisible."
- Start visible and animate a *non-gating* property (a small `translateY`), or use Reanimated `entering` (which can't strand the view).

## 4. Expo / Metro gotchas

- **Edge-function prompts must be static TS imports**, never a runtime `.txt` read — the eszip deploy only bundles statically-imported modules, so `Deno.readTextFileSync(new URL('./x.txt', …))` crashes the worker on boot (`WORKER_ERROR`). (CLAUDE.md Gotchas.)
- **Dev build, not Expo Go:** built via `expo run:ios`. Start Metro with `npx expo start --dev-client`.
- **`npm run ios:e` = full native build** (slow; only for native changes — new Pod, app config, anything under `ios/`). For JS/TS edits use **`npm start` + Fast Refresh**. Force a fresh JS bundle without a native rebuild via `xcrun simctl terminate booted com.aibroke.app && xcrun simctl launch booted com.aibroke.app`.
- **Capturing Metro logs to a file:** Node block-buffers stdout to a non-TTY, so `npm start > log` (and `| tee log`) capture almost nothing. Wrap Metro in a PTY: `tail -f /dev/null | script -q /tmp/metro.log npx expo start --dev-client` (the `tail` holds stdin open so it doesn't stop on EOF; the PTY makes Node flush line-by-line). App `console.log`s then appear as `LOG …` lines.
- **AI mocks ON in dev** (`USE_AI_MOCKS = __DEV__ && true`, `src/config/ai.ts`) so QA never burns API credits — the `analyze`/plan/captions/reflection calls return fixtures. Flip to `&& false` only to exercise the real backend; never commit it off.

## 5. Lists & scrolling

- **`FlatList`/`SectionList`** for anything that can grow — never `.map()` inside a `ScrollView` (renders everything → jank). Stable `keyExtractor` + `renderItem`; `getItemLayout` for fixed-height rows.
- `keyboardShouldPersistTaps="handled"` on scroll views containing inputs, so a tap isn't eaten by keyboard dismissal.

## 6. Keyboard

- `KeyboardAvoidingView` is finicky on iOS. The reliable fix is a `ScrollView` with **`automaticallyAdjustKeyboardInsets`** + `keyboardDismissMode="interactive"` — **not** `behavior="padding"`, which can crop content below the focused field (see the `LoginScreen` fix).
- The Simulator **suppresses the software keyboard** until you uncheck **I/O → Keyboard → Connect Hardware Keyboard** (⇧⌘K) — so keyboard-avoidance "looks fine" until you do.

## 7. Testing (jest-expo — NOT RTL/MSW/Vitest)

- Runner: **jest** with the `jest-expo` preset; **`@testing-library/react-native`** for component/hook tests. **No** React Testing Library (web), MSW, Vitest, or axe.
- **Mock native modules** in unit tests (`react-native-purchases`, async-storage, …) — pattern in `src/services/__tests__/purchases.test.ts`. IAP/native flows can't run in CI without a device build.
- `npx tsc --noEmit` is the fastest correctness signal — run it after every change.

## 8. Styling

- `StyleSheet.create` only — **no CSS, className, or styled-components**. Theme tokens from `@/theme/colors` (`Colors`/`Typography`/`Spacing`/`Radius`) + `@/theme/motion` (`Durations`/`Easings`/`Springs`). No hardcoded colors/spacing/durations.
- Reuse the design primitives — `PressableScale`, `Toggle`, `ScoreRing`, `GlassCard`, `components/motion/*` — don't re-roll `TouchableOpacity`/`Switch`/SVG rings (CLAUDE.md Reuse rules).

---

## Common RN bug → first suspect
- **Blank screen on tab switch** → native-driver opacity/transform on the screen container + React Navigation detach/re-mount; the JS value is `1.0` but the native view is blank. Fix: Reanimated `entering`, or don't gate visibility on a native-driven animation. (§1–§3)
- **Tab "loads blank/empty" intermittently** → effect logic assuming the screen stayed mounted; move to `useFocusEffect`, and make the resting render correct. (§1, §3)
- **Keyboard covers the submit button** → `KeyboardAvoidingView behavior="padding"`; switch to `automaticallyAdjustKeyboardInsets`. (§6)
- **Edge function 500s right after deploy** → a runtime `.txt` prompt read; make it a static import. (§4)
- **Test can't import a native dep** → mock the native module. (§7)
- **Metro logs empty when piped to a file** → Node stdout buffering; wrap in a `script` PTY. (§4)
