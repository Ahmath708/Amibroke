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
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // Authenticate the webhook caller.
  if (WEBHOOK_AUTH && req.headers.get('Authorization') !== WEBHOOK_AUTH) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();
    const event = body?.event;
    if (!event?.type) return jsonResponse({ error: 'No event' }, 400);

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
        status = 'paused';
        break;
      default:
        // TEST, TRANSFER, etc. — acknowledge without mutating state.
        return jsonResponse({ received: true, ignored: event.type });
    }

    const { error } = await supabase.from('user_subscriptions').upsert(
      {
        user_id: userId,
        plan: effectivePlan,
        status,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        trial_end: isTrial ? periodEnd : null,
        store,
        product_id: event.product_id ?? null,
        rc_entitlement: effectivePlan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('revenuecat-webhook upsert error:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('revenuecat-webhook error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
