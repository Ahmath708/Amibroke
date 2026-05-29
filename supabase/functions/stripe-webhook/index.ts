import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET not set');

const PRICE_ACTION_PLAN = Deno.env.get('STRIPE_PRICE_ID_ACTION_PLAN')!;
const PRICE_DEEP_DIVE = Deno.env.get('STRIPE_PRICE_ID_DEEP_DIVE')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function verifySignature(payload: string, signatureHeader: string | null): Promise<boolean> {
  if (!STRIPE_WEBHOOK_SECRET || !signatureHeader) return false;

  const parts = signatureHeader.split(',');
  let timestamp = '';
  let sig = '';
  for (const p of parts) {
    const [k, v] = p.trim().split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1') sig = v;
  }
  if (!timestamp || !sig) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > 300) return false;

  const key = new TextEncoder().encode(STRIPE_WEBHOOK_SECRET);
  const data = new TextEncoder().encode(`${timestamp}.${payload}`);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expectedSig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const expectedHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, '0')).join('');

  return expectedHex === sig;
}

function mapPlanFromPrice(priceId: string): string | null {
  if (priceId === PRICE_ACTION_PLAN) return 'action_plan';
  if (priceId === PRICE_DEEP_DIVE) return 'deep_dive';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('Stripe-Signature');

    const valid = await verifySignature(rawBody, signature);
    if (!valid) return jsonResponse({ error: 'Invalid signature' }, 400);

    const event = JSON.parse(rawBody);
    const type = event.type;
    const sub = event.data?.object;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const priceId = sub?.items?.data?.[0]?.price?.id;
        const plan = mapPlanFromPrice(priceId);
        const stripeCustomerId = sub?.customer;
        const stripeSubId = sub?.id;
        const status = sub?.status;
        const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const cancelAtPeriodEnd = sub?.cancel_at_period_end ?? false;
        const trialEnd = sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;

        const { data: existing } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', stripeSubId)
          .maybeSingle();

        if (existing) {
          await supabase.from('user_subscriptions').update({
            plan, status, current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd, trial_end: trialEnd,
          }).eq('stripe_subscription_id', stripeSubId);
        } else {
          const { data: byCustomer } = await supabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', stripeCustomerId)
            .maybeSingle();

          if (byCustomer) {
            await supabase.from('user_subscriptions').update({
              stripe_subscription_id: stripeSubId, plan, status,
              current_period_end: currentPeriodEnd, cancel_at_period_end: cancelAtPeriodEnd,
              trial_end: trialEnd,
            }).eq('stripe_customer_id', stripeCustomerId);
          } else {
            const customerResp = await fetch(`https://api.stripe.com/v1/customers/${stripeCustomerId}`, {
              headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
            });
            if (customerResp.ok) {
              const customer = await customerResp.json();
              const userId = customer.metadata?.user_id;
              if (userId) {
                await supabase.from('user_subscriptions').insert({
                  user_id: userId,
                  stripe_customer_id: stripeCustomerId,
                  stripe_subscription_id: stripeSubId,
                  plan, status, current_period_end: currentPeriodEnd,
                  cancel_at_period_end: cancelAtPeriodEnd, trial_end: trialEnd,
                });
              }
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        await supabase.from('user_subscriptions').update({
          status: 'canceled', plan: null,
          current_period_end: sub?.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        }).eq('stripe_subscription_id', sub?.id);
        break;
      }

      case 'invoice.payment_succeeded': {
        const subId = sub?.subscription;
        if (subId) {
          await supabase.from('user_subscriptions').update({
            current_period_end: sub?.lines?.data?.[0]?.period?.end
              ? new Date(sub.lines.data[0].period.end * 1000).toISOString() : null,
          }).eq('stripe_subscription_id', subId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const subId = sub?.subscription;
        if (subId) {
          await supabase.from('user_subscriptions').update({ status: 'past_due' })
            .eq('stripe_subscription_id', subId);
        }
        break;
      }

      default:
        console.log('[stripe-webhook] Unhandled event type:', type);
        return jsonResponse({ received: true });
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('[stripe-webhook] Error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
