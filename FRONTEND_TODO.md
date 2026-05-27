# Frontend TODO

## ResultsScreen.tsx — crash when no `spendingBreakdown` field
The new backend response no longer includes a `spendingBreakdown` field. The ResultsScreen code references this field and will crash or render blank when trying to display it. Needs to handle the missing field gracefully (conditional rendering or skip the panel).

## ResultsScreen.tsx — no UI for `mentionedSpending` panel
The backend now returns a `mentionedSpending` array with only user-stated categories. ResultsScreen has no UI to display this panel. Needs a new section below the summary that shows "What you mentioned spending" with category/amount rows.

## ResultsScreen.tsx — no UI for recommended budget panel
The backend returns baselines data but ResultsScreen doesn't render a "Where your money should go" panel showing the recommended allocation. This panel would use the baselines and derived metrics to show ideal spending percentages.

## ResultsScreen.tsx — new response shape fields not rendered
The response now includes `avgConfidence`, `scoreLabel`, and `scoreColor` fields. ResultsScreen should display these (confidence indicator, score band label with color). Currently only the raw score number is shown.

## ActionPlanScreen.tsx — does not call the new `/action-plan` endpoint
The old ActionPlanScreen expected an inline `actionPlan` field in the analyze response. The new backend removes this field — the action plan is now a separate endpoint. ActionPlanScreen needs to: (a) receive the analysis as navigation params, (b) call the `/action-plan` endpoint on mount, (c) show a loading state during fetch, (d) render the returned plan steps.

## HistoryScreen.tsx — inconsistent shapes for old vs. new analyses
Old saved analyses (pre-refactor) have a different response shape than new ones. HistoryScreen iterates over saved analyses and tries to render them uniformly. New fields (`cfpb_responses`, `mentionedSpending`, `avgConfidence`) won't exist on old records. Old fields (`actionPlan`, `spendingBreakdown`) won't exist on new records. Needs a migration or version-aware rendering.

## HomeScreen.tsx — `userContext` form not wired
The HomeScreen sends `AnalyzeRequest` to the backend, but has no UI for the structured `userContext` fields. Currently only sends defaults/unknowns. Needs the optional collapsible form (see optional follow-up section in PROMPT_ITERATION_PLAN.md).

## ProcessingScreen.tsx — may not pass `userContext` through
The ProcessingScreen receives navigation params and forwards them. May need to be updated to pass `userContext` from HomeScreen through to the API call.
