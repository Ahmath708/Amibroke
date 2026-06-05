#!/bin/bash
set -euo pipefail

PROJECT_REF="zefhsplmgxefmpdqbbvv"
FUNCTIONS=("analyze" "action-plan" "generate-captions" "checkin-reflection" "create-payment-intent" "confirm-purchase" "verify-purchase")

echo "=== Deploying all Supabase Edge Functions ==="

for fn in "${FUNCTIONS[@]}"; do
  echo "→ Deploying $fn..."
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  echo "✓ $fn deployed"
done

echo "=== Running migrations ==="
npx supabase migration up --linked

echo "=== All done ==="
