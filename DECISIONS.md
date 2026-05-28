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

All three prompts merged into the live `system.txt`/`prompt.ts`. Ready for captions cycles (Section F).
