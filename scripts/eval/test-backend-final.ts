// End-to-end mock tests for 528_BACKEND_FINAL
// Requires: supabase start, supabase functions serve, stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
// Run with: npx tsx scripts/eval/test-backend-final.ts

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjQ4Mzg3Mjc5Njd9.ogSzGXaRruLrzYbT7DBnzJ8GgI8nPwY1hMhY0oY0oY0';
const STRIPE_PRICE_ACTION_PLAN = process.env.STRIPE_PRICE_ID_ACTION_PLAN || '';
const STRIPE_PRICE_DEEP_DIVE = process.env.STRIPE_PRICE_ID_DEEP_DIVE || '';

interface TestResult { name: string; pass: boolean; note?: string }

async function main() {
  const results: TestResult[] = [];
  const supabaseUrl = SUPABASE_URL;

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

  console.log('Starting 528_BACKEND_FINAL E2E tests...\n');

  // Auth tests (Step 1)
  console.log('\n--- Auth Tests (Step 1) ---');

  await test('A1: Create two users with same email prefix (collision safe)',
    async () => {
      const res1 = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: 'test1@gmail.com', password: 'password123' }),
      });
      const res2 = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: 'test1@yahoo.com', password: 'password123' }),
      });
      return res1.ok && res2.ok;
    });

  await test('A2: Both profiles should have username = NULL after signup',
    async () => {
      // Query profiles via the API
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=username`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (!res.ok) return false;
      const profiles = await res.json();
      return profiles.every((p: any) => p.username === null);
    }, 'username is nullable after signup trigger fix');

  await test('A3: User without username cannot insert community post (RLS gate)',
    async () => {
      const res = await fetch(`${supabaseUrl}/rest/v1/community_posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001', display_name: 'anon',
          score: 50, score_label: 'Test', roast: 'test', summary: 'test' }),
      });
      return !res.ok; // Should be rejected
    });

  // Stripe tests (Steps 4-7) - basic sanity
  console.log('\n--- Stripe Tests (Steps 4-7) ---');

  await test('S6: Webhook returns 200 with received:true for unhandled events',
    async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment_method.attached', data: { object: {} } }),
      });
      const body = await res.json();
      return res.ok && body.received === true;
    });

  await test('S7: Invalid Stripe-Signature header returns 400',
    async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'invalid' },
        body: JSON.stringify({ type: 'customer.subscription.created', data: { object: {} } }),
      });
      return res.status === 400;
    });

  // Community tests (Step 2)
  console.log('\n--- Community Tests (Step 2) ---');

  await test('C4: Emoji whitelist check — invalid emoji rejected',
    async () => {
      const res = await fetch(`${supabaseUrl}/rest/v1/post_reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ post_id: '00000000-0000-0000-0000-000000000001',
          user_id: '00000000-0000-0000-0000-000000000001', emoji: '👀' }),
      });
      return !res.ok; // Should be rejected by CHECK constraint
    });

  // Summary
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
