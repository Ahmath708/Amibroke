import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, jsonResponse, handleOptions } from '../_shared/cors.ts';
import { stripeFetch } from '../_shared/stripe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) return jsonResponse({ error: 'No subscription found' }, 400);

    const portal = await stripeFetch('/billing_portal/sessions', {
      method: 'POST',
      body: new URLSearchParams({
        customer: sub.stripe_customer_id,
        return_url: 'ambroke://billing',
      }),
    });

    return jsonResponse({ url: portal.url });
  } catch (error) {
    console.error('create-portal-session error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
