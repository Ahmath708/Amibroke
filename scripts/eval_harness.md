# Evaluation Harness

This harness is designed to verify the purchase tier fix and ensure the app remains type-safe.

## What it covers
- `src/services/purchases.ts` behavior for purchase tier retrieval and storage
- `src/screens/PaywallScreen.tsx` selection tracking and plan content rendering
- Full Jest suite execution
- TypeScript compile check excluding non-app Deno scripts

## Commands
- `npm run test:purchases` — runs the focused purchase service test file
- `npm test` — runs the full Jest suite
- `npx tsc --noEmit` — performs a TypeScript compile check

New endpoint:
- `supabase/functions/action-plan` returns a saved analysis action plan for a user by `userId` or optional `analysisId`
- client wrapper: `fetchActionPlan(userId, analysisId?)`

## Expected results
- `npm run test:purchases` passes with 6 tests
- `npm test` passes with all suites
- `npx tsc --noEmit` exits cleanly with no errors
