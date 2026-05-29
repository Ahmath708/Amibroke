import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, jsonResponse, handleOptions } from '../_shared/cors.ts';
import { stripeFetch } from '../_shared/stripe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PRICE_ACTION_PLAN = Deno.env.get('STRIPE_PRICE_ID_ACTION_PLAN')!;
const PRICE_DEEP_DIVE = Deno.env.get('STRIPE_PRICE_ID_DEEP_DIVE')!;

serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { plan } = await req.json();
    if (plan !== 'action_plan' && plan !== 'deep_dive') return jsonResponse({ error: 'Invalid plan' }, 400);

    const priceId = plan === 'action_plan' ? PRICE_ACTION_PLAN : PRICE_DEEP_DIVE;
    if (!priceId) return jsonResponse({ error: `Price ID not configured for ${plan}` }, 500);

    let custId: string;

    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.stripe_customer_id) {
      custId = existing.stripe_customer_id;
    } else {
      const customer = await stripeFetch('/customers', {
        method: 'POST',
        body: new URLSearchParams({
          metadata: JSON.stringify({ user_id: user.id }),
        }),
      });
      custId = customer.id;
      await supabase.from('user_subscriptions').insert({
        user_id: user.id,
        stripe_customer_id: custId,
      });
    }

    const session = await stripeFetch('/checkout/sessions', {
      method: 'POST',
      body: new URLSearchParams({
        mode: 'subscription',
        customer: custId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': 'ambroke://billing/success',
        'cancel_url': 'ambroke://billing/cancel',
        'subscription_data[trial_period_days]': '7',
        payment_method_collection: 'if_required',
      }),
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error('create-checkout-session error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
