import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTrialStatus } from '../../../shared/entitlement.ts';

/**
 * Server-side hard-paywall gate — the real enforcement (client gating is
 * bypassable). Allows the request if the caller is inside their 3-day free-access
 * window OR holds an active paid plan; otherwise throws a 402.
 *
 * IMPORTANT:
 *  - Flagged OFF by default. Set the `PAYWALL_ENFORCEMENT=true` function secret to
 *    enable — and only once the RevenueCat → plan_entitlements mirror is reliably
 *    populated, since this gate reads that table (RevenueCat's customerInfo is the
 *    client-side source of truth and isn't queried here).
 *  - FAILS OPEN on any uncertainty (no token, missing env, lookup error) so a
 *    paying user is never wrongly blocked by an infra hiccup. It only BLOCKS when
 *    it positively determines "trial expired AND no active paid plan".
 *  - The 3-day window uses the account's server-set created_at via the SAME
 *    shared/entitlement.ts the app uses — one source of truth.
 */
export async function enforceEntitlement(req: Request): Promise<void> {
  if (Deno.env.get('PAYWALL_ENFORCEMENT') !== 'true') return;

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return; // anonymous/no token — can't determine → fail open

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[entitlement] missing SUPABASE_URL/SERVICE_ROLE_KEY — failing open');
    return;
  }
  const client = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) {
      console.warn('[entitlement] could not resolve user — failing open');
      return;
    }

    // 1) Inside the 3-day free-access window? (server-set created_at, not tamperable)
    if (getTrialStatus(user.created_at).active) return;

    // 2) Active paid plan? (RevenueCat → plan_entitlements mirror)
    const { data: sub, error: subErr } = await client
      .from('plan_entitlements')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (subErr) {
      console.warn('[entitlement] subscription lookup failed — failing open:', subErr.message);
      return;
    }
    const active = !!sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due');
    const hasPaid = active && (sub!.plan === 'action_plan' || sub!.plan === 'deep_dive');
    if (hasPaid) return;

    // Trial expired + no paid plan → block.
    const err: any = new Error('Your free access has ended. Subscribe to keep using Am I Broke?.');
    err.status = 402;
    err.stage = 'paywall';
    throw err;
  } catch (e: any) {
    if (e?.status === 402) throw e; // intentional block — propagate
    console.warn('[entitlement] unexpected error — failing open:', e?.message);
  }
}
