# Manual Test Instructions

## Purpose
Verify the paywall selection tracking and purchase tier defaults after the recent fix.

## Steps
1. Open the app and navigate to the paywall screen.
2. Confirm the product cards display their labels and prices from the product catalog:
   - `90-Day Action Plan` should show `$4.99`
   - `Deep Dive` should show `$9.99`
3. Toggle the selected plan and ensure the CTA updates to the chosen plan.
4. Complete the purchase flow for a signed-in user using the existing payment path.
5. Verify the app stores the selected premium tier and unlocks the correct feature access.
6. If no purchase tier is stored, confirm the app defaults to `free` access and does not unlock premium content.
7. Confirm the new action-plan endpoint exists at `supabase/functions/action-plan` and that it can retrieve a saved action plan for an existing analysis.

## Evaluation
- Run `npm run test:purchases` to validate the purchase service behavior.
- Run `npm test` to ensure the new action-plan service wrapper passes alongside existing tests.
- Confirm the paywall selection tracking updates when switching between plans.
