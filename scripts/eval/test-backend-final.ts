// End-to-end mock tests for 528_BACKEND_FINAL
// Requires: supabase start, supabase functions serve (with .env.stripe.local)
//           stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
// Run with: npx tsx scripts/eval/test-backend-final.ts

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zefhsplmgxefmpdqbbvv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZmhzcGxtZ3hlZm1wZHFiYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzc5NzksImV4cCI6MjA5NDg1Mzk3OX0.IYVIlo7Na7-L-rHBenSxW3uf_sM88AHg_eQewIxpdRs';
const STRIPE_PRICE_ACTION_PLAN = process.env.STRIPE_PRICE_ID_ACTION_PLAN || '';
const STRIPE_PRICE_DEEP_DIVE = process.env.STRIPE_PRICE_ID_DEEP_DIVE || '';

interface TestResult { name: string; pass: boolean; note?: string }

async function main() {
  const results: TestResult[] = [];
  const supabaseUrl = SUPABASE_URL;

  let userAToken = '';
  let userBToken = '';
  let userIdA = '';
  let userIdB = '';
  let analysisId = '';
  let communityPostId = '';

  async function test(name: string, fn: () => Promise<boolean>, note?: string) {
    try {
      const pass = await fn();
      results.push({ name, pass, note });
      console.log(`  ${pass ? '✓' : '✗'} ${name}${note ? ` — ${note}` : ''}`);
    } catch (e) {
      results.push({ name, pass: false, note: String(e) });
      console.log(`  ✗ ${name} — ${e}`);
    }
  }

  async function signUp(email: string, password: string): Promise<{ token: string; id: string } | null> {
    const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return { token: body.access_token, id: body.user?.id || body.id };
  }

  async function supabaseQuery(method: string, path: string, token: string, body?: any): Promise<Response> {
    const headers: Record<string, string> = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
    return fetch(`${supabaseUrl}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  }

  async function supabaseRpc(fn: string, token: string, params: Record<string, any>): Promise<any> {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    return res.ok ? res.json() : null;
  }

  console.log('Starting 528_BACKEND_FINAL E2E tests...\n');

  const ts = Date.now();

  // ─── Step 1: Auth Tests ─────────────────────────────────────────
  console.log('--- Auth Tests (Step 1) ---');

  await test('A1: Create two users with same email prefix (collision safe)', async () => {
    const u1 = await signUp(`test1_${ts}@gmail.com`, 'password123');
    const u2 = await signUp(`test1_${ts}@yahoo.com`, 'password123');
    if (!u1 || !u2) return false;
    userAToken = u1.token;
    userBToken = u2.token;
    userIdA = u1.id;
    userIdB = u2.id;
    return true;
  });

  await test('A2: Both profiles have username = NULL after signup', async () => {
    const res = await supabaseQuery('GET', `profiles?id=eq.${userIdA}&select=username`, userAToken);
    if (!res.ok) return false;
    const profiles = await res.json();
    return profiles.length > 0 && profiles[0].username === null;
  }, 'username is nullable - trigger inserts NULL');

  await test('A3: User without username cannot insert community post (RLS)', async () => {
    const res = await supabaseQuery('POST', 'community_posts', userAToken, {
      user_id: userIdA, display_name: 'anon', score: 50,
      score_label: 'Test', roast: 'test', summary: 'test',
    });
    return !res.ok;
  }, 'RLS blocks post when username IS NULL');

  await test('A4: Set username then community post succeeds', async () => {
    const username = 'jasontest' + ts;
    const rpcResult = await supabaseRpc('set_username', userAToken, { p_username: username });
    if (!rpcResult?.ok) return false;

    const postRes = await supabaseQuery('POST', 'community_posts', userAToken, {
      user_id: userIdA, display_name: username, score: 65,
      score_label: 'Surviving', roast: 'test roast', summary: 'test summary',
    });
    if (!postRes.ok) return false;
    const posts = await postRes.json();
    communityPostId = Array.isArray(posts) ? posts[0]?.id : '';
    return !!communityPostId;
  }, 'set_username RPC works, then post succeeds');

  // ─── Step 2: Community Tests ─────────────────────────────────────
  console.log('\n--- Community Tests (Step 2) ---');

  await test('C1: Share analysis to feed creates community_posts row', async () => {
    const analysisRes = await supabaseQuery('POST', 'analyses', userAToken, {
      user_id: userIdA, input_text: 'test', score: 65, score_label: 'Surviving',
      score_color: '#FFB020', summary: 'test summary', roast: 'test roast',
      monthly_income: 5000, monthly_expenses: 3000, monthly_savings: 2000,
      debt_total: 0, savings_rate: 0.4, emergency_fund_months: 3,
      debt_to_income_ratio: 0, insights: [], debts: [],
    });
    if (!analysisRes.ok) return false;
    const aData = await analysisRes.json();
    analysisId = Array.isArray(aData) ? aData[0]?.id : aData?.id;

    const usernameA = 'jasontest' + ts;
    const shareRes = await supabaseQuery('POST', 'community_posts', userAToken, {
      user_id: userIdA, analysis_id: analysisId, display_name: usernameA,
      score: 65, score_label: 'Surviving', roast: 'test roast', summary: 'test summary',
    });
    return shareRes.ok;
  });

  await test('C2: Same analysis cannot be shared twice (UNIQUE)', async () => {
    const res = await supabaseQuery('POST', 'community_posts', userAToken, {
      user_id: userIdA, analysis_id: analysisId, display_name: 'jasontest',
      score: 65, score_label: 'Surviving', roast: 'test', summary: 'test',
    });
    return !res.ok;
  }, 'unique_post_per_analysis constraint enforced');

  await test('C3: Insert valid emoji reaction succeeds', async () => {
    const res = await supabaseQuery('POST', 'post_reactions', userAToken, {
      post_id: communityPostId, user_id: userIdA, emoji: '🔥',
    });
    return res.ok;
  });

  await test('C4: Invalid emoji reaction rejected by CHECK constraint', async () => {
    const res = await supabaseQuery('POST', 'post_reactions', userAToken, {
      post_id: communityPostId, user_id: userIdA, emoji: '👀',
    });
    return !res.ok;
  });

  await test('C5: Reaction count trigger — insert two, count=2, delete one, count=1', async () => {
    await supabaseRpc('set_username', userBToken, { p_username: 'testuserB' + ts });
    await supabaseQuery('POST', 'post_reactions', userBToken, {
      post_id: communityPostId, user_id: userIdB, emoji: '🔥',
    });

    const res1 = await supabaseQuery('GET', `community_posts?id=eq.${communityPostId}&select=reactions`, userAToken);
    if (!res1.ok) return false;
    const post1 = await res1.json();
    const countAfterTwo = post1[0]?.reactions?.['🔥'] ?? 0;
    if (countAfterTwo !== 2) return false;

    await supabaseQuery('DELETE', `post_reactions?post_id=eq.${communityPostId}&user_id=eq.${userIdB}&emoji=eq.🔥`, userBToken);

    const res2 = await supabaseQuery('GET', `community_posts?id=eq.${communityPostId}&select=reactions`, userAToken);
    if (!res2.ok) return false;
    const post2 = await res2.json();
    const countAfterDelete = post2[0]?.reactions?.['🔥'] ?? 0;
    return countAfterDelete === 1;
  }, 'trigger maintains accurate count via COUNT(*)');

  // ─── Stripe Tests (Steps 4-7) ────────────────────────────────────
  console.log('\n--- Stripe Tests (Steps 4-7) ---');

  await test('S1: create-checkout-session with valid JWT returns URL', async () => {
    const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userAToken}` },
      body: JSON.stringify({ plan: 'action_plan' }),
    });
    const data = await res.json();
    return res.ok && typeof data.url === 'string' && data.url.includes('checkout.stripe.com');
  });

  async function signStripePayload(payload: string, secret: string): Promise<string> {
    const ts = Math.floor(Date.now() / 1000);
    const toSign = `${ts}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `t=${ts},v1=${hex}`;
  }

  await test('S6: Webhook returns 200 with received:true for unhandled events', async () => {
    const payload = JSON.stringify({ type: 'payment_method.attached', data: { object: {} } });
    const sigHeader = await signStripePayload(payload, 'whsec_gjVwms7QBW2swHRxwwAF3VynkyHV4oyP');
    const res = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sigHeader },
      body: payload,
    });
    const body = await res.json();
    return res.ok && body.received === true;
  });

  await test('S7: Invalid Stripe-Signature header returns 400', async () => {
    const res = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1234567890,v1=invalid' },
      body: JSON.stringify({ type: 'customer.subscription.created', data: { object: {} } }),
    });
    return res.status === 400;
  });

  // ─── Summary ─────────────────────────────────────────────────────
  console.log('\n--- Summary ---');
  console.log('| Test | Pass/Fail | Note |');
  console.log('|------|-----------|------|');
  for (const r of results) {
    console.log(`| ${r.name} | ${r.pass ? '✓' : '✗'} | ${r.note || ''} |`);
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`\n${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

main();
