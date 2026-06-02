import fs from 'fs';
import path from 'path';
import { recordApiCall, getCounterState } from './lib/call-counter';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const INPUTS_DIR = path.resolve(__dirname, 'test-snapshots/inputs');
const OUTPUTS_DIR = path.resolve(__dirname, 'test-snapshots/outputs');

function usage(): void {
  console.log('Usage: npx tsx tools/manual-test.ts <options>');
  console.log('');
  console.log('Options:');
  console.log('  --health-check              Ping the endpoint (1 API call)');
  console.log('  --input <name>              Input file name (without .json)');
  console.log('  --save                      Save response to test-snapshots/outputs/');
  console.log('  --help                      Show this help');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx tools/manual-test.ts --health-check');
  console.log('  npx tsx tools/manual-test.ts --input vague_broke --save');
  process.exit(0);
}

function readInput(name: string): any {
  const filePath = path.join(INPUTS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Input file not found: ${filePath}`);
    console.error(`Available inputs: ${fs.readdirSync(INPUTS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).join(', ')}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function healthCheck(): Promise<void> {
  console.log('\n🧪 Health check — verifying endpoint is reachable...\n');

  recordApiCall('manual-test:health-check');

  const payload = {
      freeText: 'test ping for health check',
    userContext: {
      state: 'unknown', ageBracket: 'unknown', incomeBracket: 'unknown',
      livingSituation: 'unknown', employmentStatus: 'unknown',
      debtBracket: 'none', liquidSavingsBracket: 'under_500',
    },
    tone: 'savage',
  };

  const start = Date.now();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const elapsed = Date.now() - start;

  if (response.status === 200) {
    console.log(`✅ API connection working (responded in ${elapsed}ms)`);
  } else {
    const body = await response.text().catch(() => '');
    console.error(`❌ Health check failed: HTTP ${response.status}`);
    console.error(body.slice(0, 500));
    process.exit(1);
  }
}

async function runInput(name: string, save: boolean): Promise<void> {
  const input = readInput(name);

  const counter = getCounterState();
  console.log(`\n📋 Manual test — ${name}`);
  console.log(`Counter currently at ${counter.count}/${40}.`);
  console.log(`About to make 1 API call to the analyze endpoint. Estimated cost: ~$0.04.`);
  console.log(`Press Enter to continue or Ctrl-C to abort.`);

  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  recordApiCall(`manual-test:${name}`);

  const start = Date.now();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(input),
  });
  const elapsed = Date.now() - start;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`\n❌ API error: HTTP ${response.status}`);
    console.error(body.slice(0, 1000));
    process.exit(1);
  }

  const body = await response.json();

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Response received in ${elapsed}ms`);
  console.log('─'.repeat(50));
  console.log(`Score:       ${body.score} (${body.scoreLabel}) [${body.scoreColor}]`);
  console.log(`Confidence:  ${(body.avgConfidence ?? 0).toFixed(2)}`);
  console.log('');
  console.log(`🔥 Roast:`);
  console.log(`   ${body.roast ?? '(none)'}`);
  console.log('');
  console.log(`📝 Summary:`);
  console.log(`   ${body.summary ?? '(none)'}`);
  console.log('');
  console.log(`Fields: insights=${body.insights?.length ?? 0}, topProblems=${body.topProblems?.length ?? 0}, positiveBehaviors=${body.positiveBehaviors?.length ?? 0}, mentionedSpending=${body.mentionedSpending?.length ?? 0}, debts=${body.debts?.length ?? 0}`);

  // Confidence distribution
  if (body.cfpb_responses) {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0 };
    for (const r of body.cfpb_responses) {
      const c = r.confidence as string;
      if (counts[c] !== undefined) counts[c]++;
    }
    console.log(`CFPB confidence: low=${counts.low}, medium=${counts.medium}, high=${counts.high}`);
  }

  // Save if requested
  if (save) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(OUTPUTS_DIR, `${name}__${timestamp}.json`);
    const snapshot = {
      inputFile: name,
      timestamp: new Date().toISOString(),
      request: input,
      response: body,
      metadata: { responseTimeMs: elapsed, model: 'claude-sonnet-4-6' },
    };
    fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2));
    console.log(`\n💾 Saved to: ${outputFile}`);
  }

  console.log('');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    usage();
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
    console.error('Set them in your .env.local or export them in your shell.');
    process.exit(1);
  }

  const healthCheckMode = args.includes('--health-check');
  const inputIndex = args.indexOf('--input');
  const inputName = inputIndex >= 0 && inputIndex + 1 < args.length ? args[inputIndex + 1] : null;
  const saveMode = args.includes('--save');

  if (healthCheckMode) {
    if (inputName) {
      console.error('Cannot combine --health-check with --input.');
      process.exit(1);
    }
    await healthCheck();
  } else if (inputName) {
    await runInput(inputName, saveMode);
  } else {
    console.error('Specify --health-check or --input <name>.');
    usage();
  }
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
