import { runSuite } from './lib/harness';
import { FIXTURES } from './fixtures.analyze';
import {
  assertFinalAnalysisShape,
  assertScoreInRange,
  assertCfpbResponses,
  assertSavingsInvariant,
  assertNoForbiddenStrings,
  assertConfidenceDistribution,
} from './assertions';

function extractScore(responseBody: unknown): number | undefined {
  return (responseBody as any)?.score;
}

runSuite({
  suite: 'analyze',
  endpointPath: 'analyze',
  fixtures: FIXTURES,
  assertFixture: (responseBody, fixture) => {
    const expects = (fixture as any).expects || {};

    const schemaCheck = assertFinalAnalysisShape(responseBody);
    if (!schemaCheck.pass) return schemaCheck;

    const scoreCheck = assertScoreInRange(responseBody, expects.scoreMin ?? 0, expects.scoreMax ?? 100);
    if (!scoreCheck.pass) return scoreCheck;

    const cfpbCheck = assertCfpbResponses(responseBody);
    if (!cfpbCheck.pass) return cfpbCheck;

    const savingsCheck = assertSavingsInvariant(responseBody);
    if (!savingsCheck.pass) return savingsCheck;

    if (Array.isArray(expects.forbiddenStrings) && expects.forbiddenStrings.length > 0) {
      const forbiddenCheck = assertNoForbiddenStrings(responseBody, expects.forbiddenStrings);
      if (!forbiddenCheck.pass) return forbiddenCheck;
    }

    if (expects.minHighConfidence !== undefined) {
      const distCheck = assertConfidenceDistribution(responseBody, { high: expects.minHighConfidence as number });
      if (!distCheck.pass) return distCheck;
    }

    return { pass: true, message: 'All assertions passed' };
  },
  extractScore,
}).catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
