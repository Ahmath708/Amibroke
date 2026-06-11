import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, handleOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Shared secret configured as the Authorization header on the RevenueCat webhook.
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');

// RevenueCat entitlement ids → our plan tiers. Deep Dive supersedes Action Plan.
function planFromEntitlements(ids: string[] | undefined): 'action_plan' | 'deep_dive' | null {
  if (!ids) return null;
  if (ids.includes('deep_dive')) return 'deep_dive';
  if (ids.includes('action_plan')) return 'action_plan';
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== 'POST') return jsonResponse({ error: { code: 'method_not_allowed', message: 'Method not allowed.' } }, 405);

  // Authenticate the webhook caller. Fail CLOSED: if the shared secret isn't
  // configured, reject everything rather than running an open billing webhook.
  if (!WEBHOOK_AUTH) {
    console.error('REVENUECAT_WEBHOOK_AUTH is not set — refusing all webhook requests.');
    return jsonResponse({ error: { code: 'not_configured', message: 'Webhook not configured.' } }, 503);
  }
  if (req.headers.get('Authorization') !== WEBHOOK_AUTH) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'Unauthorized.' } }, 401);
  }

  try {
    const body = await req.json();
    const event = body?.event;
    if (!event?.type) return jsonResponse({ error: { code: 'no_event', message: 'No event in payload.' } }, 400);

    const userId: string = event.app_user_id;
    // Skip anonymous RevenueCat ids ($RCAnonymousID:...) — not a Supabase user.
    if (!userId || !UUID_RE.test(userId)) {
      return jsonResponse({ received: true, skipped: 'non-user app_user_id' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const plan = planFromEntitlements(event.entitlement_ids);
    const isTrial = event.period_type === 'TRIAL';
    const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
    const store = event.store === 'PLAY_STORE' ? 'play_store' : 'app_store';

    // Defaults for an active/renewing subscription.
    let status: string = isTrial ? 'trialing' : 'active';
    let cancelAtPeriodEnd = false;
    let effectivePlan: 'action_plan' | 'deep_dive' | null = plan;

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE':
        break; // keep active/trialing defaults
      case 'CANCELLATION':
        // Auto-renew turned off; access continues until expiration.
        status = isTrial ? 'trialing' : 'active';
        cancelAtPeriodEnd = true;
        break;
      case 'EXPIRATION':
        status = 'canceled';
        effectivePlan = null;
        break;
      case 'BILLING_ISSUE':
        status = 'past_due';
        break;
      case 'SUBSCRIPTION_PAUSED':
        status = 'canceled'; // no active access; 'paused' isn't in the plan_entitlements status CHECK
        break;
      default:
        // TEST, TRANSFER, etc. — acknowledge without mutating state.
        return jsonResponse({ received: true, ignored: event.type });
    }

    const { error } = await supabase.from('plan_entitlements').upsert(
      {
        user_id: userId,
        plan: effectivePlan,
        status,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        store,
        product_id: event.product_id ?? null,
        rc_entitlement: effectivePlan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('revenuecat-webhook upsert error:', error.message);
      return jsonResponse({ error: { code: 'upsert_failed', message: 'Failed to record subscription event.' } }, 500);
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('revenuecat-webhook error:', error);
    return jsonResponse({ error: { code: 'internal_error', message: 'Internal error.' } }, 500);
  }
});
