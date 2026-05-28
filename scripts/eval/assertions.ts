import { z } from 'zod';
import { FinalAnalysisSchema } from '../../shared/schemas';

export type AssertionResult = { pass: boolean; message: string };
const FORBIDDEN_CAPTIONS = ['Bitcoin', 'as your CFP', "I'm a licensed", 'self-harm', 'suicide'];
const FORBIDDEN_PLAN = ['Bitcoin', 'Ethereum', 'as your CFP', "I'm a licensed", 'SOL'];

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
  const income = response?.monthlyIncome?.value;
  const expenses = response?.monthlyExpenses?.value;
  const savings = response?.monthlySavings;
  if (income === undefined || expenses === undefined || savings === undefined) {
    return { pass: false, message: 'Missing fields for savings invariant' };
  }
  const expected = income - expenses;
  if (Math.abs(savings - expected) > 0.01) {
    return { pass: false, message: `monthlySavings ${savings} !== ${income} - ${expenses} = ${expected}` };
  }
  return { pass: true, message: `monthlySavings = monthlyIncome - monthlyExpenses (${expected})` };
}

export function assertNoForbiddenStrings(response: any, forbidden: string[]): AssertionResult {
  const body = JSON.stringify(response);
  for (const s of forbidden) {
    const pattern = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(body)) {
      return { pass: false, message: `Response contains forbidden string: "${s}"` };
    }
  }
  return { pass: true, message: 'No forbidden strings found' };
}

export function assertCaptions(response: unknown): AssertionResult {
  const obj = response as any;
  if (!obj || !Array.isArray(obj.captions)) {
    return { pass: false, message: 'Response does not have a captions array' };
  }
  const { captions } = obj;
  if (captions.length !== 3) {
    return { pass: false, message: `Expected exactly 3 captions, got ${captions.length}` };
  }
  for (let i = 0; i < captions.length; i++) {
    const c = captions[i];
    if (typeof c !== 'string') {
      return { pass: false, message: `captions[${i}] is not a string: ${typeof c}` };
    }
    if (c.length === 0) {
      return { pass: false, message: `captions[${i}] is empty` };
    }
    if (c.length > 150) {
      return { pass: false, message: `captions[${i}] exceeds 150 chars (${c.length})` };
    }
  }
  // Check distinctness
  const unique = new Set(captions);
  if (unique.size < captions.length) {
    return { pass: false, message: `Captions are not distinct: ${captions.join(' | ')}` };
  }
  // Check forbidden
  const body = JSON.stringify(response);
  for (const s of FORBIDDEN_CAPTIONS) {
    if (body.toLowerCase().includes(s.toLowerCase())) {
      return { pass: false, message: `Contains forbidden string: "${s}"` };
    }
  }
  return { pass: true, message: '3 distinct captions, all ≤150 chars, no forbidden strings' };
}

export function assertActionPlan(response: unknown): AssertionResult {
  const obj = response as any;
  if (!obj) return { pass: false, message: 'Response is null/undefined' };
  if (typeof obj.overallMessage !== 'string' || obj.overallMessage.length === 0) {
    return { pass: false, message: 'overallMessage is missing or empty' };
  }
  if (obj.overallMessage.length > 400) {
    return { pass: false, message: `overallMessage exceeds 400 chars (${obj.overallMessage.length})` };
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return { pass: false, message: 'steps is missing or empty' };
  }
  for (let i = 0; i < obj.steps.length; i++) {
    const step = obj.steps[i];
    if (!step.week || typeof step.week !== 'string' || step.week.length === 0) {
      return { pass: false, message: `steps[${i}].week is missing or empty` };
    }
    if (!step.title || typeof step.title !== 'string' || step.title.length === 0) {
      return { pass: false, message: `steps[${i}].title is missing or empty` };
    }
    if (!step.description || typeof step.description !== 'string' || step.description.length === 0) {
      return { pass: false, message: `steps[${i}].description is missing or empty` };
    }
    if (!step.impact || typeof step.impact !== 'string' || step.impact.length === 0) {
      return { pass: false, message: `steps[${i}].impact is missing or empty` };
    }
  }
  const body = JSON.stringify(response);
  for (const s of FORBIDDEN_PLAN) {
    if (body.toLowerCase().includes(s.toLowerCase())) {
      return { pass: false, message: `Contains forbidden string: "${s}"` };
    }
  }
  return { pass: true, message: `Plan valid: overallMessage present, ${obj.steps.length} steps, no forbidden strings` };
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
