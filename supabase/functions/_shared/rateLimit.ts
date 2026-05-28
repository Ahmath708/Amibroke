import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deriveBucketKey, isWithinLimit, shouldBypass, resolveLimits } from './rateLimitLogic.ts';

export async function enforceRateLimit(req: Request, endpoint: string): Promise<void> {
  if (shouldBypass(Deno.env.get('RATE_LIMIT_ENABLED'))) {
    return;
  }

  const { max, windowSeconds } = resolveLimits(
    Deno.env.get('RATE_LIMIT_MAX'),
    Deno.env.get('RATE_LIMIT_WINDOW_SECONDS'),
  );

  const forwardedFor = req.headers.get('x-forwarded-for');
  const bucketKey = deriveBucketKey(forwardedFor, endpoint);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[rateLimit] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — allowing request (fail open)');
    return;
  }

  const client = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data, error } = await client.rpc('check_rate_limit', {
      p_key: bucketKey,
      p_max: max,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      // Fail open — limiter hiccup should not take the app down
      console.warn('[rateLimit] RPC error, allowing request (fail open):', error.message);
      return;
    }

    const allowed = data === true || data === 1;
    if (!isWithinLimit(data ?? 0, max)) {
      const err: any = new Error('Rate limit exceeded');
      err.status = 429;
      err.stage = 'rate_limited';
      throw err;
    }
  } catch (err: any) {
    if (err.status === 429) throw err;
    console.warn('[rateLimit] Unexpected error, allowing request (fail open):', err.message);
  }
}
