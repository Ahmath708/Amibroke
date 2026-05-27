// CFPB Financial Well-Being Scale scoring via the published lookup table.
//
// The CFPB scale uses a graded-response IRT model internally, but the CFPB
// publishes a lookup table as the recommended scoring method for most users
// (see webinar transcript: https://files.consumerfinance.gov/f/documents/201602_cfpb_webinar-well-being-transcript.txt
// and the scoring worksheet: https://files.consumerfinance.gov/f/documents/bcfp_fin-well-being_full-scorecard.pdf).
//
// The IRT item parameters (discrimination a, thresholds b1-b4) are in
// Appendix B of the technical report at
//   https://files.consumerfinance.gov/f/documents/201705_cfpb_financial-well-being-scale-technical-report.pdf
// but the PDF is image-based and the numeric tables could not be extracted.
//
// Scoring process (per the CFPB guide):
//   1. Sum the 10 response values (0-4 each, with items 3,5,6,7,9,10 reverse-coded)
//      to get the "total response value" (0-40).
//   2. Look up the corresponding FWB score (0-100) in the published table.
//      score ≈ (theta × 15) + 50, so theta ≈ (score - 50) / 15.

// Lookup table: self-administered, age 18-61 (the most common mode for our app).
// Source: CFPB scoring worksheet PDF, "Self-administered 18-61" column.
const RAW_TO_SCORE: Record<number, number> = {
  0: 14,  1: 19,  2: 22,  3: 25,  4: 27,
  5: 29,  6: 31,  7: 32,  8: 34,  9: 35,
  10: 37, 11: 38, 12: 40, 13: 41, 14: 42,
  15: 44, 16: 45, 17: 47, 18: 47, 19: 49,
  20: 50, 21: 51, 22: 52, 23: 54, 24: 55,
  25: 56, 26: 58, 27: 59, 28: 60, 29: 62,
  30: 63, 31: 65, 32: 66, 33: 68, 34: 69,
  35: 71, 36: 72, 37: 74, 38: 78, 39: 81,
  40: 86,
};

// Which items need reverse coding (0→4, 1→3, 2→2, 3→1, 4→0)
// Items 3, 5, 6, 7, 9, 10 are reverse-coded (negatively worded).
const REVERSED_ITEMS = new Set([2, 4, 5, 6, 8, 9]); // 0-indexed

function reverseCode(value: number): number {
  return 4 - value;
}

export function computeTotalRawValue(responses: number[]): number {
  if (responses.length !== 10) {
    throw new Error(`Expected 10 responses, got ${responses.length}`);
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const v = responses[i];
    if (v < 0 || v > 4 || !Number.isInteger(v)) {
      throw new Error(`Invalid response at index ${i}: ${v}`);
    }
    sum += REVERSED_ITEMS.has(i) ? reverseCode(v) : v;
  }
  return sum;
}

export function cfpbScore(responses: number[]): number {
  const raw = computeTotalRawValue(responses);
  const score = RAW_TO_SCORE[raw];
  if (score === undefined) {
    throw new Error(`No lookup table entry for raw value ${raw}`);
  }
  return score;
}

export function estimateTheta(responses: number[]): number {
  const score = cfpbScore(responses);
  return (score - 50) / 15;
}

export function scoreFromRawTotal(rawTotal: number): number {
  const score = RAW_TO_SCORE[rawTotal];
  if (score === undefined) {
    throw new Error(`No lookup table entry for raw value ${rawTotal}`);
  }
  return score;
}
