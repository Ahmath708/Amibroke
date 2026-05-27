# Decisions

## 2026-05-27 — CFPB IRT scoring with confidence attenuation vs. simple sum
Instead of asking Claude to produce a 0-100 score directly (the old approach), we use Claude only for the 10 CFPB question responses (0-4 each) and confidence labels. The server computes the official CFPB IRT score from the responses, then attenuates toward 50 based on average confidence. This gives a reproducible, mathematically grounded score that degrades gracefully when the AI has low signal.

## 2026-05-27 — Separate action-plan endpoint vs. inline plan
The old approach included a 90-day action plan inside the analyze response. This burned tokens on every analysis for users who never click "View Plan." Moving it to a separate endpoint (`/action-plan`) reduces analyze response size, latency, and cost by ~30%. The user's analysis is passed as input context when generating the plan.

## 2026-05-27 — File-based prompt loading for prompt caching
System prompts are loaded from `prompts/system.txt` via `Deno.readTextFileSync` at module load time instead of being embedded in TypeScript source. This enables Anthropic's prompt caching (`cache_control: { type: 'ephemeral' }`) because the prompt is an identical byte string across requests. Embedding in a TS template literal would produce the same string, but the file approach makes prompt editing and diffing easier without touching source code.

## 2026-05-27 — Manual request validation instead of Zod in edge function
The analyze endpoint validates requests with hand-written checks (`validateRequest`) instead of using Zod schemas directly. This is because Zod's `safeParse` error messages are verbose for API responses, and Supabase Edge Functions (Deno) have slower cold starts with large dependency trees. The Zod schemas in `shared/schemas.ts` serve as the source of truth for the shape; the manual validation strips down to only the fields and formats the handler actually uses.

## 2026-05-27 — Score band thresholds at 40/60/80
The four bands (Fragile 0-40, Surviving 41-60, Stable 61-80, Thriving 81-100) use thresholds aligned with the CFPB's own interpretive guidance. The CFPB national median is around 50, so 40-60 captures the middle half of the population. Below 40 is genuinely fragile (bottom quartile), above 80 is genuinely thriving.

## 2026-05-27 — Confidence weights 0.5/0.75/1.0 for low/medium/high
These weights were chosen empirically: full confidence (1.0) passes the IRT score through unchanged; medium (0.75) pulls the score 25% toward 50; low (0.5) pulls it 50% toward 50. This ensures that a user who gives vague input gets a score closer to the neutral baseline (50) rather than an extreme value based on weak signal. The weights are symmetric and simple — no complex attenuation curves.

## 2026-05-27 — Regression awareness exercise
Removed the "no specific securities" rule from system.txt to verify the eval harness catches the regression. It did — fixture `edge_compliance_injection` failed when the rule was missing, and passed again after restoring the rule. The manual snapshot outputs looked the same before and after, confirming that prompt injections are the main risk this rule catches, not normal user inputs. Takeaway: when changing the rules section of the prompt, ALWAYS re-run the compliance fixture before committing.
