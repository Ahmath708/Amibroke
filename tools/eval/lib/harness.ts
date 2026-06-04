import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const RESULTS_DIR = path.resolve(__dirname, '../results');
const SUMMARY_PATH = path.join(RESULTS_DIR, 'SUMMARY.md');

export type Fixture = {
  id: string;
  group: string;
  label: string;
  input: Record<string, unknown>;
};

export type AssertionResult = { pass: boolean; message: string };

export type RunConfig = {
  suite: string;
  endpointPath: string;
  fixtures: Fixture[];
  assertFixture: (responseBody: unknown, fixture: Fixture) => AssertionResult;
  extractScore?: (responseBody: unknown) => number | undefined;
};

export type PerFixtureResult = {
  id: string;
  pass: boolean;
  firstFailingAssertion: string | null;
  responseTimeMs: number;
  rawResponseBody: unknown;
};

export type RunResult = {
  cycle: number;
  suite: string;
  timestamp: string;
  promptHash: string;
  aggregate: {
    passed: number;
    failed: number;
    total: number;
    passRate: number;
    avgResponseTimeMs: number;
    totalApiCalls: number;
  };
  scoreStats?: {
    min: number;
    max: number;
    avg: number;
    variance: number;
  } | null;
  perFixture: PerFixtureResult[];
};

function getGitShortHash(suite: string): string {
  try {
    const result = require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    return result;
  } catch {
    return `${suite}-unknown`;
  }
}

function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
}

function formatTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeResultsFile(result: RunResult): string {
  const filename = `cycle_${result.cycle}_${result.suite}_${formatTimestamp()}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return filepath;
}

function appendSummary(result: RunResult): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const row = `| ${dateStr} | ${result.suite} | ${result.cycle} | ${result.promptHash} | ${(result.aggregate.passRate * 100).toFixed(0)}% | ${result.aggregate.passed}/${result.aggregate.total} | |\n`;

  if (!fs.existsSync(SUMMARY_PATH)) {
    fs.writeFileSync(SUMMARY_PATH, '# Eval Summary\n\n| Date | Suite | Cycle | Prompt Hash | Pass Rate | Passed/Total | Notes |\n|------|-------|-------|-------------|-----------|--------------|-------|\n');
  }
  fs.appendFileSync(SUMMARY_PATH, row);
}

export async function runSuite(config: RunConfig): Promise<void> {
  const args = process.argv.slice(2);

  let cycle = 1;
  let fixtureFilter: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cycle' && i + 1 < args.length) {
      cycle = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--fixture' && i + 1 < args.length) {
      fixtureFilter = args[i + 1];
      i++;
    } else if (args[i] === '--help') {
      console.log('Usage: npx tsx tools/eval/runner.<suite>.ts --cycle <n> --fixture <id|all>');
      console.log('');
      console.log('Options:');
      console.log('  --cycle <n>       Cycle number (default: 1)');
      console.log('  --fixture <id>    Run a single fixture by ID, or "all" for all');
      console.log('  --help            Show this help');
      process.exit(0);
    }
  }

  if (!fixtureFilter) {
    console.error('Missing --fixture argument (use "all" or a specific fixture id)');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
    process.exit(1);
  }

  const fixturesToRun = fixtureFilter === 'all'
    ? config.fixtures
    : config.fixtures.filter((f) => f.id === fixtureFilter);

  if (fixturesToRun.length === 0) {
    console.error(`No fixture found matching "${fixtureFilter}".`);
    console.error(`Available: ${config.fixtures.map((f) => f.id).join(', ')}`);
    process.exit(1);
  }

  const plannedCalls = fixturesToRun.length;
  const estimatedCost = (plannedCalls * 0.04).toFixed(2);

  console.log(`\n📋 Suite: ${config.suite} — ${fixturesToRun.length} fixture(s)`);
  console.log(`Endpoint: ${config.endpointPath}`);
  console.log(`Cycle: ${cycle}`);
  console.log(`About to make ${plannedCalls} LLM call(s). Estimated cost: ~$${estimatedCost}`);
  console.log(`\nPress Enter to continue or Ctrl-C to abort.`);

  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  console.log(`\nRunning ${fixturesToRun.length} fixture(s)...\n`);

  const endpointUrl = `${SUPABASE_URL}/functions/v1/${config.endpointPath}`;
  const perFixture: PerFixtureResult[] = [];
  let totalTime = 0;

  for (const fixture of fixturesToRun) {
    process.stdout.write(`  [${fixture.id}] ${fixture.label} ... `);

    const startTime = Date.now();
    let rawResponseBody: unknown;
    let httpOk = true;
    let httpStatus = 0;

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(fixture.input),
      });

      httpStatus = response.status;
      httpOk = response.ok;
      rawResponseBody = await response.json();
    } catch (err: any) {
      rawResponseBody = { error: `Network error: ${err.message}`, stage: 'network_error' };
      httpOk = false;
    }

    const responseTimeMs = Date.now() - startTime;

    let pass: boolean;
    let firstFailingAssertion: string | null = null;

    if (!httpOk) {
      pass = false;
      firstFailingAssertion = `HTTP ${httpStatus}: ${JSON.stringify(rawResponseBody)}`;
    } else {
      const result = config.assertFixture(rawResponseBody, fixture);
      pass = result.pass;
      if (!result.pass) firstFailingAssertion = result.message;
    }

    perFixture.push({ id: fixture.id, pass, firstFailingAssertion, responseTimeMs, rawResponseBody });
    totalTime += responseTimeMs;

    console.log(pass ? '✅' : '❌');
    if (!pass && firstFailingAssertion) {
      console.log(`     ${firstFailingAssertion}`);
    }
  }

  const passed = perFixture.filter((r) => r.pass).length;
  const failed = perFixture.filter((r) => !r.pass).length;
  const passRate = perFixture.length > 0 ? passed / perFixture.length : 0;
  const avgResponseTimeMs = perFixture.length > 0 ? totalTime / perFixture.length : 0;
  const totalApiCalls = perFixture.length;

  let scoreStats: RunResult['scoreStats'] = null;
  if (config.extractScore) {
    const scores = perFixture
      .map((r) => config.extractScore!(r.rawResponseBody))
      .filter((s): s is number => s !== undefined);
    if (scores.length >= 2) {
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = computeVariance(scores);
      scoreStats = { min, max, avg, variance };
    }
  }

  const promptHash = getGitShortHash(config.suite);

  const runResult: RunResult = {
    cycle,
    suite: config.suite,
    timestamp: new Date().toISOString(),
    promptHash,
    aggregate: { passed, failed, total: perFixture.length, passRate, avgResponseTimeMs, totalApiCalls },
    scoreStats,
    perFixture,
  };

  const resultsFile = writeResultsFile(runResult);
  appendSummary(runResult);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 Suite: ${config.suite}`);
  console.log(`   Cycle: ${cycle}`);
  console.log(`   Pass rate: ${(passRate * 100).toFixed(0)}% (${passed}/${perFixture.length})`);
  console.log(`   Avg response: ${Math.round(avgResponseTimeMs)}ms`);
  if (scoreStats) {
    console.log(`   Score range: ${scoreStats.min}–${scoreStats.max} (σ²=${scoreStats.variance.toFixed(1)})`);
  }
  console.log(`   Results: ${resultsFile}`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}
