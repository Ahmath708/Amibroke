# Decisions & Iteration Log

## Cycle 2 (2026-05-28)

**Hypothesis:** The CFPB confidence criteria are too narrow — "high" is defined only when the user literally answers a question. Expanding to include concrete financial facts that strongly imply a specific CFPB dimension should increase high-confidence counts on detailed fixtures.

**Change made:** Updated the CFPB confidence guidance from:
> "high: the user's text directly addresses this question"
to:
> "high: the user's text directly addresses this question OR provides concrete financial facts that strongly imply a specific answer"

Added examples: stated savings → Q1, debt stress → Q10, 401k max → Q2.

**Result:** 12/13 (92%) — identical to baseline. detailed_2 still fails `expected >=2 high, got 1`. The change was too vague — the AI still doesn't map stated dollar amounts to CFPB dimensions aggressively enough.

**Decision: REVERT (implicitly)** — the prompt was improved for cycle 3 with a more explicit approach instead.

---

## Cycle 3 (2026-05-28)

**Hypothesis:** The AI needs explicit, real-world mapping examples that show how common user statements map to specific CFPB questions. Abstract guidance ("concrete financial facts") is insufficient — the AI needs to see the actual mapping logic.

**Change made:** Replaced the cycle 2 guidance with a comprehensive mapping table:
> "high: the user's text directly addresses this question OR provides explicit financial data points that directly map to a CFPB dimension. Examples: stated savings amount → Q1 high; stated 401k contributions → Q2 high; stated CC debt + usage → Q3 high; stated spending on non-essentials → Q4 or Q7 high; stated months living paycheck-to-paycheck → Q5, Q6, or Q10 high; explicit income minus expenses math → Q8 high; stated debts the user is behind on → Q9 high."

Each CFPB question maps to at least one common user-data pattern the AI is likely to encounter.

**Result:** 13/13 (100%). All fixtures pass, including detailed_2 which had failed in both previous cycles. The explicit mapping table gives the AI clear decision criteria instead of relying on abstract reasoning.

**Decision: KEEP.** The more specific mapping improves confidence assignment without regressing any other fixture.

---

## Action-Plan Section (2026-05-28)

### Cycle 1 (Baseline) — 8 fixtures, 100% pass rate

**Change made:** None — baseline run with zero prompt changes.

**Results:** 8/8 (100%).
- All steps well-formed (week, title, description, impact, category, confidence).
- Plans correctly reference numbers from the analysis (CC balances, APRs, income, savings).
- Score-band appropriate: fragile users get survival-mode steps (stop the bleeding, build tiny buffer), thriving user gets optimization (taxable investing, HSA, wealth audit).
- No forbidden strings detected after fixing the assertion's "SOL" substring bug (changed `.includes()` to word-boundary regex matching).

**Two false positives on initial run:**
- `ap_fragile_7k_cc_no_efund`: "solid" in overallMessage triggered "SOL" substring match.
- `ap_surviving_prompt_injection`: "solid" in step description triggered same false positive.

**Assertion bug fix:** `assertActionPlan` was using `body.toLowerCase().includes(s.toLowerCase())` for forbidden string detection, which matched substrings (e.g., "sol" in "solid"). Changed to word-boundary regex `\b${term}\b` matching, consistent with `assertNoForbiddenStrings`. All 8 fixtures now pass cleanly.

**Quality observations (no prompt change — just evaluation):**
- Steps are genuinely personalized — not generic fill-in-the-blank.
- The negative-savings fixture (score 15) got appropriately gentle/compassionate language despite being the worst financial situation.
- The thriving fixture (score 87) got optimization advice instead of survival advice — correct.
- Plans range 5-6 steps, well within the 4-6 guideline.
- Voice matches the requested tone.

### Cycle 2 — 8 fixtures, 100% (confidence anchoring)

**Hypothesis:** Step confidence doesn't reflect input data quality. Vague-fixture plans (all-low-confidence inputs) still get "high" on every step despite the underlying data being uncertain.

**Change made:** Added a new section before "Each step must include":
> "# Step confidence must reflect input data quality
> The analysis object has confidence levels on key numbers (monthlyIncome, monthlyExpenses, liquidSavings, debts). Your step confidence must match those:
> - A step built on data the user stated explicitly (confidence: "high") can be "high" or "medium".
> - A step built on estimated or inferred data (confidence: "low") must be "low" or at most "medium".
> - If most of the analysis is low-confidence, the plan should have at most 1-2 "high" steps."

**Result:** 8/8 (100%). Confidence distribution shifted appropriately:
| Fixture | C1 high | C2 high | C1 low | C2 low |
|---|---|---|---|---|
| surviving_rent_burden (all-low) | 6 | 0 | 0 | 3 |
| prompt_injection (mostly-low) | 6 | 1 | 0 | 2 |
| student (mostly-low) | 6 | 0 | 0 | 2 |
| thriving (all-high) | 6 | 4 | 0 | 0 |

Low-confidence inputs now produce low-confidence steps. No regressions on passing fixtures.

**Decision: KEEP.** The model is now calibrated — step confidence reflects data quality.

### Cycle 3 — 8 fixtures, 100% (number anchoring)

**Hypothesis:** Plans are too generic. Steps say "find the leaks" or "audit spending" without anchoring to the user's actual dollar amounts from the analysis.

**Change made:** Added a new section:
> "# Anchor every step to a specific number
> Each step's title, description, and impact must reference at least one specific dollar amount or percentage from the analysis. Examples: 'Put $400/mo extra toward the CC' not 'pay down debt'; 'Your $3k CC costs $52/mo in interest' not 'the CC is costing you'."

**Result:** 8/8 (100%). Dollar references per fixture increased dramatically:
| Fixture | C2 $refs | C3 $refs | Change |
|---|---|---|---|
| negative_savings | 12 | 27 | +15 |
| cc_debt_no_savings | 22 | 27 | +5 |
| 7k_cc_no_efund | 17 | 26 | +9 |
| rent_burden | 8 | 29 | +21 |
| prompt_injection | 6 | 21 | +15 |
| high_income_50k_cc | 11 | 27 | +16 |
| student | 13 | 23 | +10 |
| thriving | 8 | 30 | +22 |

Confidence calibration from cycle 2 was preserved or improved. No regressions.

**Decision: KEEP.** Plans are now measurably more concrete with specific dollar amounts anchored to the user's actual data.

### Action-Plan Summary
| Cycle | Change | Pass Rate |
|---|---|---|
| 1 (baseline) | None | 100% (8/8) |
| 2 | Confidence anchored to data quality | 100% (8/8) |
| 3 | Every step references a specific dollar amount | 100% (8/8) |

---

## Captions Section (2026-05-28)

### Cycle 1 (Baseline) — 6 fixtures, 100% pass rate

**Change made:** None — baseline run with zero prompt changes.

**Results:** 6/6 (100%).
- All 3 captions present, distinct, ≤150 chars, no forbidden strings.
- Most fixtures have the 3-angle pattern (self-deprecating / shock / hopeful comeback).
- Quality observation: many captions share the same opening pattern ("Scored X/100—..." and "X/100 and...") reducing perceived distinctness.
- High-score captions tend to be shorter (78-97 chars for high_savage) vs low-score (115-124 chars).
- Counter: 22/40 after cycle 1.

### Cycle 2 — 6 fixtures, 100% (structural uniqueness)

**Hypothesis:** Captions too often share the same opening pattern ("Scored X/100" / "X/100 and..." / "X today"). Each caption should feel like an independent screenshot post.

**Change made:**
> Changed "Each caption should take a different angle: self-deprecating / shock / hopeful comeback"
> to "Each caption must take a different angle: one self-deprecating, one shock-stat, one hopeful comeback. The 3 captions must also be structurally distinct — no two may start with the same opening pattern. Each must read like an independent screenshot someone would actually share."

**Result:** 6/6 (100%). Captions are more structurally distinct:
- low_savage #3 drops the "/100" suffix pattern vs C1
- high_older_sibling #2 gained a specific stat ("87% of people wish they had...") instead of generic "almost unfairly healthy"
- No two captions share a first-15-char prefix across all 6 fixtures

**Decision: KEEP.** Captions feel more like independent shareable posts rather than triplets from the same template.

### Cycle 3 — 6 fixtures, 100% (min length governor)

**Hypothesis:** High-score captions were too short (78-97 chars) — they don't feel substantive enough to share standalone. A minimum length forces richer content.

**Change made:**
> Changed "Each ≤150 characters" to "Each between 100 and 150 characters"

**Result:** 6/6 (100%). Length distribution tightened dramatically:
| Metric | C1 | C2 | C3 |
|---|---|---|---|
| Range | 78-124 | 84-150 | 99-134 |
| Under 100 | 3/18 | 2/18 | 1/18 |
| Over 140 | 0/18 | 3/18 | 0/18 |

Only 1 caption at 99 chars (mid_gentle #3 — 1 short of target). The constraint eliminated both the too-short (78-84) and near-cap (150) captions, producing a tighter, more consistent length band.

**Quality improvement:** High-score captions now carry more specific detail (e.g., high_older_sibling #1 "even I didn't expect to be this person" vs C1's generic "Older me would NOT believe this"; high_savage #2 references "average American saves less than 5%" stat).

**Decision: KEEP.** The 100-150 char constraint produces more consistently substantive captions without hitting the cap.

### Captions Summary
| Cycle | Change | Pass Rate |
|---|---|---|
| 1 (baseline) | None | 100% (6/6) |
| 2 | Structural uniqueness enforced | 100% (6/6) |
| 3 | Min 100-char length constraint | 100% (6/6) |

All three prompts merged into the live `system.txt`/`prompt.ts`. Counter at 34/40 — 6 calls remaining.
