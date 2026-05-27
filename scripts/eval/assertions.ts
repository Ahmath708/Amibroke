import { z } from 'zod';
import { FinalAnalysisSchema } from '../../shared/schemas';

export type AssertionResult = { pass: boolean; message: string };

export function assertSchema(response: unknown, schema: z.ZodSchema): AssertionResult {
  const result = schema.safeParse(response);
  if (result.success) return { pass: true, message: 'Schema validation passed' };
  return { pass: false, message: `Schema validation failed: ${result.error.message}` };
}

export function assertFinalAnalysisShape(response: unknown): AssertionResult {
  return assertSchema(response, FinalAnalysisSchema);
}

export function assertScoreInRange(response: any, min: number, max: number): AssertionResult {
  const score = response?.score;
  if (typeof score !== 'number') return { pass: false, message: `score is not a number: ${typeof score}` };
  if (score < min || score > max) return { pass: false, message: `score ${score} not in [${min}, ${max}]` };
  return { pass: true, message: `score ${score} in [${min}, ${max}]` };
}

export function assertCfpbResponses(response: any): AssertionResult {
  const cfpb = response?.cfpb_responses;
  if (!Array.isArray(cfpb)) return { pass: false, message: 'cfpb_responses is not an array' };
  if (cfpb.length !== 10) return { pass: false, message: `cfpb_responses has length ${cfpb.length}, expected 10` };
  for (let i = 0; i < cfpb.length; i++) {
    const r = cfpb[i];
    if (typeof r.value !== 'number' || r.value < 0 || r.value > 4 || !Number.isInteger(r.value)) {
      return { pass: false, message: `cfpb_responses[${i}].value is invalid: ${JSON.stringify(r.value)}` };
    }
    if (!['low', 'medium', 'high'].includes(r.confidence)) {
      return { pass: false, message: `cfpb_responses[${i}].confidence is invalid: ${r.confidence}` };
    }
  }
  return { pass: true, message: 'cfpb_responses are valid' };
}

export function assertSavingsInvariant(response: any): AssertionResult {
  const { monthlyIncome, monthlyExpenses, monthlySavings } = response;
  if (monthlyIncome === undefined || monthlyExpenses === undefined || monthlySavings === undefined) {
    return { pass: false, message: 'Missing fields for savings invariant' };
  }
  const expected = monthlyIncome - monthlyExpenses;
  if (Math.abs(monthlySavings - expected) > 0.01) {
    return { pass: false, message: `monthlySavings ${monthlySavings} !== ${monthlyIncome} - ${monthlyExpenses} = ${expected}` };
  }
  return { pass: true, message: `monthlySavings = monthlyIncome - monthlyExpenses (${expected})` };
}

export function assertNoForbiddenStrings(response: any, forbidden: string[]): AssertionResult {
  const body = JSON.stringify(response).toLowerCase();
  for (const s of forbidden) {
    if (body.includes(s.toLowerCase())) {
      return { pass: false, message: `Response contains forbidden string: "${s}"` };
    }
  }
  return { pass: true, message: 'No forbidden strings found' };
}

export function assertConfidenceDistribution(
  response: any,
  expected: { low?: number; medium?: number; high?: number },
): AssertionResult {
  const cfpb = response?.cfpb_responses;
  if (!Array.isArray(cfpb)) return { pass: false, message: 'No cfpb_responses array' };
  const counts: Record<string, number> = { low: 0, medium: 0, high: 0 };
  for (const r of cfpb) {
    if (counts[r.confidence] !== undefined) counts[r.confidence]++;
  }
  const parts: string[] = [];
  for (const [level, minCount] of Object.entries(expected)) {
    if (counts[level] < minCount) {
      parts.push(`expected >=${minCount} ${level}, got ${counts[level]}`);
    }
  }
  if (parts.length > 0) return { pass: false, message: parts.join('; ') };
  return { pass: true, message: `Confidence distribution: low=${counts.low}, medium=${counts.medium}, high=${counts.high}` };
}
