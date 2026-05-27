import { FIXTURES, type Fixture } from './fixtures';
import {
  assertFinalAnalysisShape,
  assertScoreInRange,
  assertCfpbResponses,
  assertSavingsInvariant,
  assertNoForbiddenStrings,
  assertConfidenceDistribution,
} from './assertions';
import { recordApiCall, getCounterState } from '../lib/call-counter';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

function usage(): void {
  console.log('Usage: npx tsx scripts/eval/runner.ts [--fixture <id>]');
  console.log('');
  console.log('Options:');
  console.log('  --fixture <id>   Run a single fixture by ID (e.g. vague_1)');
  console.log('  --help           Show this help');
  process.exit(0);
}

async function runFixture(fixture: Fixture): Promise<{ pass: boolean; message: string; responseTimeMs: number }> {
  const startTime = Date.now();

  recordApiCall(`eval-harness:${fixture.id}`);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(fixture.input),
  });

  const responseTimeMs = Date.now() - startTime;
  const body = await response.json();

  if (!response.ok) {
    return { pass: false, message: `HTTP ${response.status}: ${JSON.stringify(body)}`, responseTimeMs };
  }

  // Run assertions
  const { expects } = fixture;

  const schemaCheck = assertFinalAnalysisShape(body);
  if (!schemaCheck.pass) return { pass: false, message: schemaCheck.message, responseTimeMs };

  const scoreCheck = assertScoreInRange(body, expects.scoreMin ?? 0, expects.scoreMax ?? 100);
  if (!scoreCheck.pass) return { pass: false, message: scoreCheck.message, responseTimeMs };

  const cfpbCheck = assertCfpbResponses(body);
  if (!cfpbCheck.pass) return { pass: false, message: cfpbCheck.message, responseTimeMs };

  const savingsCheck = assertSavingsInvariant(body);
  if (!savingsCheck.pass) return { pass: false, message: savingsCheck.message, responseTimeMs };

  if (expects.forbiddenStrings && expects.forbiddenStrings.length > 0) {
    const forbiddenCheck = assertNoForbiddenStrings(body, expects.forbiddenStrings);
    if (!forbiddenCheck.pass) return { pass: false, message: forbiddenCheck.message, responseTimeMs };
  }

  if (expects.minHighConfidence !== undefined) {
    const distCheck = assertConfidenceDistribution(body, { high: expects.minHighConfidence });
    if (!distCheck.pass) return { pass: false, message: distCheck.message, responseTimeMs };
  }

  return {
    pass: true,
    message: `✅ All assertions passed (${responseTimeMs}ms)`,
    responseTimeMs,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length === 0) {
    usage();
    return;
  }

  let fixtureFilter: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fixture' && i + 1 < args.length) {
      fixtureFilter = args[i + 1];
      i++;
    }
  }

  if (!fixtureFilter) {
    console.error('Missing --fixture argument. Run with --help for usage.');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
    console.error('Set them in your .env.local or export them in your shell.');
    process.exit(1);
  }

  const fixturesToRun = fixtureFilter === 'all'
    ? FIXTURES
    : FIXTURES.filter((f) => f.id === fixtureFilter);

  if (fixturesToRun.length === 0) {
    console.error(`No fixture found matching "${fixtureFilter}".`);
    console.error(`Available fixtures: ${FIXTURES.map((f) => f.id).join(', ')}`);
    process.exit(1);
  }

  const counter = getCounterState();
  const plannedCalls = fixturesToRun.length;
  const estimatedCost = (plannedCalls * 0.04).toFixed(2);

  console.log(`\n📋 Eval Harness — ${fixturesToRun.length} fixture(s)`);
  console.log(`Counter currently at ${counter.count}/${40} calls.`);
  console.log(`About to make ${plannedCalls} API call(s), total after run: ${counter.count + plannedCalls}/${40}.`);
  console.log(`Estimated cost: ~$${estimatedCost}`);
  console.log(`\nPress Enter to continue or Ctrl-C to abort.`);

  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  if (counter.count + plannedCalls > 40) {
    console.error(`\n❌ This run would exceed the 40-call cap.`);
    console.error(`Reduce the run with --fixture <id> or ask Jason to reset the counter.`);
    process.exit(1);
  }

  console.log(`\nRunning ${fixturesToRun.length} fixture(s)...\n`);

  const results: Array<{ id: string; pass: boolean; message: string; responseTimeMs: number }> = [];
  let totalTime = 0;

  for (const fixture of fixturesToRun) {
    process.stdout.write(`  [${fixture.id}] ${fixture.label} ... `);
    const result = await runFixture(fixture);
    results.push({ id: fixture.id, ...result });
    totalTime += result.responseTimeMs;
    console.log(result.pass ? '✅' : '❌');
  }

  // Report
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const avgTime = totalTime / results.length;
  const finalCounter = getCounterState();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log(`Average response time: ${Math.round(avgTime)}ms`);
  console.log(`Final counter state: ${finalCounter.count}/${40} used`);
  console.log('');

  for (const result of results) {
    const icon = result.pass ? '✅' : '❌';
    console.log(`  ${icon} [${result.id}] ${result.message}`);
  }

  console.log(`\n${'═'.repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
