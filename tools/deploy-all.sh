#!/bin/bash
set -euo pipefail

PROJECT_REF="zefhsplmgxefmpdqbbvv"
# The live LLM/edge functions (the Stripe-era create-payment-intent/confirm/verify were ghosts —
# the app uses RevenueCat). revenuecat-webhook needs its RC webhook secret set to do anything.
FUNCTIONS=("analyze" "action-plan" "generate-captions" "checkin-reflection" "revise-plan" "revenuecat-webhook")

echo "=== Deploying all Supabase Edge Functions ==="

for fn in "${FUNCTIONS[@]}"; do
  echo "→ Deploying $fn..."
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  echo "✓ $fn deployed"
done

echo "=== Running migrations ==="
npx supabase migration up --linked

echo "=== All done ==="
