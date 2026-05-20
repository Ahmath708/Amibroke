import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const PRODUCTS: Record<string, { amount: number; description: string }> = {
  action_plan: { amount: 499, description: '90-Day Action Plan' },
  deep_dive: { amount: 999, description: 'Deep Dive Analysis' },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { userId, productId } = await req.json();

    if (!userId || !productId) {
      return jsonResponse({ error: 'userId and productId required' }, 400);
    }

    const product = PRODUCTS[productId];
    if (!product) {
      return jsonResponse({ error: 'Invalid product' }, 400);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(product.amount),
        currency: 'usd',
        description: product.description,
        metadata: JSON.stringify({ userId, productId }),
      }),
    });

    if (!stripeResponse.ok) {
      const error = await stripeResponse.text();
      return jsonResponse({ error: `Stripe error: ${error}` }, 500);
    }

    const paymentIntent = await stripeResponse.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('payments').insert({
      user_id: userId,
      product_id: productId,
      amount: product.amount / 100,
      currency: 'usd',
      status: 'pending',
      stripe_payment_intent_id: paymentIntent.id,
    });

    return jsonResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('create-payment-intent error:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
