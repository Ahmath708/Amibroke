# Design Doctrine — Am I Broke?

> **Standing reference for ALL frontend work** — creating, modifying, deleting, or rearranging
> components, screens, styles, or motion. Read this before touching UI and grade your work against
> it. It's the "rules"; the [research brief](./redesign/research-brief.md) is the "why." The
> `/audit-screen` skill grades screens against this doctrine.

---

## 0. North star

The app should feel **ALIVE** — premium, choreographed, tactile, branded, trustworthy — and never
**vibe-coded** (generic, static, "AI-slop purple-gradient-on-dark"). Every UI change is judged on
both axes: does it work, and does it carry the brand.

| Vibe-coded tell (avoid) | Alive equivalent (do) |
|---|---|
| Three+ accents, no conviction | **One** signature accent, used sparingly |
| Content just appears | Choreographed entrances, count-ups, reveals |
| No touch feedback | Spring press + haptics on every interaction |
| Gradients behind everything | One committed background; gradients **earned** |
| System-default / mixed icons | One committed icon family with consistent usage |
| Text walls | Bento hierarchy: one hero element + supporting cards |

Restraint counts too: **flair must be earned.** Hero moments get motion; utility screens
(Settings, legal, FAQ) stay calm. Animating everything is its own vibe-coded smell.

---

## 1. Brand — disciplined neon (DECIDED)

- **One signature accent.** Use the `accent*` family — `Colors.accent` (tint), `Colors.accentSolid`
  (solid/CTA/caret), `Colors.accentContainer` (tinted fill). Default magenta; swappable via
  `EXPO_PUBLIC_NEON_ACCENT` and `palettes/accents.ts`. **Never** the legacy `primary*` aliases.
- **Semantics are semantic-only, never decorative.** `success` `#39FF14`, `warning` `#FF6B00`,
  `danger` `#ff453a`, `info`/`secondary` `#9fb6c2` (neutral blue) — only for their meaning, never as
  a second/third "fun" accent. The old neon cyan/hot-pink/green decorative roles are demoted; don't
  reintroduce them.
- **Dark, not black.** `background` `#19101c` (pure `#000` causes halation under light text). Keep.
- **Gradients are earned.** Reserve `gradientPrimary` for the score ring / hero moments. No gradient
  as a default screen background.
- **Oversized numerals** for the score (the payoff) + **`fontVariant: ['tabular-nums']`** on every
  number that animates or updates, so digits don't jitter.
- **Keep** the type pairing (SpaceGrotesk headings + Inter body).
- **Accent-agnostic components.** Never hardcode the accent hue — always the `accent*` tokens — so
  the `EXPO_PUBLIC_NEON_ACCENT` swap and the future **warm pole** (Phase 5) both work unchanged.
- **Imagery/illustration**, when added, is committed + branded (the brief's surprise-delight model),
  never generic stock to "fill space." We have none today — white space beats stock.

---

## 2. Color usage

- **Text:** `textPrimary` `#eeddee` for anything important; `textSecondary` `#a897ab` for support;
  `textTertiary` `#8a7b8d` and `textMuted` `#7a6b7c` only for fine-print (both pass AA-large but are
  low-emphasis — never a primary label/body/placeholder).
- **Surfaces:** `surface` / `surfaceElevated` for cards; borders use `glassBorderLight` (0.14, reads)
  — `glassBorder` (0.08) is barely visible, fine-print only.
- **No hardcoded hex / rgba** in components. Tokens only (`@/theme/colors`).

---

## 3. Spacing & rhythm

- **Scale (use ONLY these — no arbitrary px):** `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24`;
  touch rows `rowHeight 44 · rowHeightLg 56`.
- **Standard screen horizontal inset = `xl` (20).** Keep card padding consistent within a screen
  (default `lg` 16). Vertical rhythm between sections should be consistent and on-scale.
- **Radius:** tokens only — `xs 4 · sm 8 · md 10 · lg 14 · xl 16 · xxl 20 · pill 999`. `pill` for
  chips/badges, `lg`/`xl` for cards.
- Align elements to a consistent grid; no one-off insets that break the rhythm.

---

## 4. Typography

- **Fonts:** `Typography.fonts.heading` (SpaceGrotesk_700Bold) for titles; `body` / `bodyMed` /
  `bodySemi` (Inter) for everything else.
- **Scale:** `screenTitle 36 · title1 28 · title3 20 · body 17 · callout 16 · subhead 15 ·
  footnote 13 · caption1 12 · caption2 11`. Pick from the scale; don't invent sizes.
- `numberOfLines` on anything that can overflow (prevents jumpy wraps). `tabular-nums` on numerics.

---

## 5. Motion — make it feel alive (Reanimated 4, UI-thread)

- **Tokens only — no inline `ms` or bezier literals.** `Durations` (`instant 80 · fast 180 ·
  normal 350 · slow 600 · crawl 1000 · reveal 1500`), `Easings` (`smooth` ease-out for entrances/
  count-ups · `sharp` in-out · `bounce` playful · `linear`), `Springs` (`snappy · gentle · bouncy ·
  instant · release`) — from `@/theme/motion`.
- **Use the motion system, don't hand-roll `Animated`:**
  - Every tappable → `components/motion/PressableScale` (spring press + haptic + reduce-motion),
    not bare `TouchableOpacity`.
  - Animated/updating numbers → `components/motion/CountUp`.
  - List/section entrances → the staggered entrances in `components/motion/entrances.ts`
    (40–80ms stagger, each 200–350ms, ease-out).
- **Catalog of "alive" patterns** (apply where they fit, per brief Part 2): spring press + haptics;
  staggered entrance; number count-up; skeleton → content morph; scroll-driven reveals.
- **Reduce-motion is a HARD requirement.** Gate decorative motion behind Reanimated
  `useReducedMotion()`: snap to the final state, **keep the haptic**, drop travel/parallax/overshoot,
  and never let motion be the only channel for information. (The motion components already honor it —
  match that pattern in anything new.)
- **Signature moment — the score reveal** (Results): count-up `0→score` (ease-out, `reveal` duration)
  with the `ScoreRing` arc filling in lockstep, landing on a medium/heavy haptic + a small spring
  settle. This is *the* moment — don't dilute it; don't replicate its drama elsewhere.

---

## 6. Icons — Heroicons-first

- **`react-native-heroicons` is the committed family.** Outline (`/outline`) for default; solid
  (`/solid`) for active/selected/emphasis. Keep sizes to a small set (**16 / 18 / 20 / 24**) and
  color from tokens.
- **Ionicons (`@expo/vector-icons`) only as a last resort** — when Heroicons genuinely has no
  suitable equivalent. Heroicons' set is large, so this should be **rare**; when you do it, leave a
  one-line comment saying why. Existing Ionicons usages are tech debt to migrate.

---

## 7. Reuse — don't reinvent (CLAUDE.md reuse rules)

- **Use the primitives:** `ScoreRing`, `GlassCard`, `NeonButton`, `AppTextInput` (branded
  `accentSolid` caret), `ScreenBackground`, `PressableScale`, `CountUp`, `SectionLabel`, `Toggle`,
  `StaleBadge`, `NotificationBell`, `EmptyState`, `LoadingState`. Grep before building a new one.
- **Score band label + color** come from `getScoreBand` (`@shared/scoring/bands`) — never re-encode
  the 40/60/80 cutoffs or band hex.
- **Data access via services only** (no `supabase.from()` in screens); all LLM/edge calls via
  `services/ai.ts`.
- Anything duplicated ≥ 3× (logic, JSX, or a literal) gets extracted.

---

## 8. Hierarchy & UX

- **Bento layout:** one hero element + supporting cards. Avoid text walls; lead the eye to the
  primary action/value first.
- **Touch targets ≥ 44pt.** Every data view has explicit **loading / empty / error** states.
- Keep the **"based on what you told me" honesty cue** where relevant (no-Plaid, builds trust
  without overclaiming).

---

## 9. Interaction & feedback

- **Feedback channel:** transient success/confirmation → `components/Toast`; blocking errors or
  destructive confirms → `Alert`; field validation → **inline** (not an Alert). Alert is overused
  today — prefer Toast for success.
- **States:** every button/input carries disabled + loading + pressed states (`NeonButton` loading,
  `PressableScale` press). Disabled = lowered opacity, no haptic.
- **Destructive actions** (sign out, delete account, clear data) always confirm first (Alert,
  destructive style) — never one-tap.
- **Surface choice:** quick focused task / picker / confirm → **bottom sheet**; a full sub-context →
  **push**. Don't push a one-field edit; don't sheet a whole flow.
- **Keyboard:** forms use keyboard avoidance + `keyboardShouldPersistTaps="handled"`; the active
  field stays visible; tap-outside dismisses.

## 10. Content & data

- **Money & numbers** always go through `@/utils/format.ts` — consistent currency, decimals,
  large-number abbreviation, and **negative/debt** styling. Never ad-hoc `` `$${n}` ``.
- **Degenerate data:** design the zero / single / very-large / negative / **null-or-"unknown"**
  (snapshot estimates) cases, not just the happy path. Clamp long AI/user text with `numberOfLines`.
- **Async:** **skeleton/shimmer, not a spinner** (brief Part 3); always an explicit empty state and
  an error state with a retry path.
- **Microcopy:** on-brand voice but clear (errors say what to do next); **sentence case** for
  labels/body, Title Case only for true buttons; emoji are intentional accents, not filler.

## 11. Accessibility & environment

- **Dynamic Type:** don't fight it — allow scaling where layout permits, cap with
  `maxFontSizeMultiplier` only where it would break, sanity-check at XL sizes. (Unhandled today.)
- **VoiceOver:** interactive + informative elements get `accessibilityLabel`/`Role`; **icon-only
  buttons (bell, mic, chevrons) must be labeled**; purely decorative bits hidden from a11y.
- **Safe area + chrome:** honor `useSafeAreaInsets`; content **clears the floating tab bar**
  (`+ TAB_BAR_HEIGHT` bottom padding); status bar is light content on the dark field.
- (Keyboard → §9; contrast → §2; reduce-motion → §5.)

## 12. Performance (premium = 60fps)

- Long/unbounded lists → `FlatList` (virtualized), never `.map` inside a `ScrollView`.
- No always-on heavy animation (battery/thermals); ambient motion stays cheap and slow.
- Memoize expensive renders; avoid redundant per-focus refetches (cache or lift shared reads).

## 13. The gate (run before shipping any UI)

> This checklist **is** the `/audit-screen` rubric — each item maps to a section. Change a rule in
> its section; the audit grades the new version automatically.

1. One accent, accent-agnostic? Semantics semantic-only? No decorative neon? (§1)
2. All spacing/radius/type/color/motion from **tokens**, nothing hardcoded? (§2–5)
3. Tappables `PressableScale`; numbers `CountUp` + `format.ts`; entrances from the system;
   **reduce-motion honored**? (§5, §10)
4. Icons Heroicons (or a documented exception), consistent sizes? (§6)
5. Reused existing primitives instead of bespoke UI? (§7)
6. Right feedback channel (Toast/Alert/inline)? Destructive actions confirmed? Right surface
   (sheet vs push)? Keyboard handled? (§9)
7. Degenerate-data + empty/error/skeleton states designed, not just the happy path? (§10)
8. VoiceOver labels (esp. icon-only), Dynamic Type sane, safe-area + tab-bar clearance? (§11)
9. Long lists virtualized; no always-on heavy motion? (§12)
10. §0 table passes — and at least one **positive identity anchor** (branded, ownable) is present.
11. `npx tsc --noEmit` clean; re-screenshot on the SE (multiple frames for motion/overflow).

---

## Deferred (named, not yet enforced)

Strategic bets from the [brief](./redesign/research-brief.md), captured so they don't get lost —
not rules yet: an **imagery/illustration system**, a **reacting mascot** (Rive), and a **living
Skia background**. When any ships it follows §1; until then, don't approximate them with generic
stock or always-on gradients.
