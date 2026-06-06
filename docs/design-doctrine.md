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

## 9. The gate (run before shipping any UI)

1. One accent only? Semantics used semantically? No reintroduced decorative neon? (§1)
2. All spacing/radius/type/color/motion from **tokens**, nothing hardcoded? (§2–5)
3. Tappables use `PressableScale`; numbers `CountUp`; entrances from the system; **reduce-motion
   honored**? (§5)
4. Icons Heroicons (or a documented exception)? Consistent sizes? (§6)
5. Reused existing primitives instead of bespoke UI? (§7)
6. Run the §0 table as pass/fail — and confirm at least one **positive identity anchor** (a branded,
   ownable element) is present, not just "nothing generic."
7. `npx tsc --noEmit` clean; re-screenshot on the SE (multiple frames for motion/overflow).
