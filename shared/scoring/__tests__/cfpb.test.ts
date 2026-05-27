import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cfpbScore, computeTotalRawValue, estimateTheta, scoreFromRawTotal } from '../cfpb_irt';
import { computeFinalScore } from '../index';

void describe('cfpb_irt', () => {
  void it('computes raw total correctly with reverse coding', () => {
    // All 0s: reversed items (2,4,5,6,8,9) → 4 each
    const allZero = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    assert.equal(computeTotalRawValue(allZero), 24);
  });

  void it('computes raw total correctly — all 4s', () => {
    // All 4s: reversed items (2,4,5,6,8,9) → 0 each
    const allFour = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    assert.equal(computeTotalRawValue(allFour), 16);
  });

  void it('computes raw total for middle values', () => {
    const allTwo = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    assert.equal(computeTotalRawValue(allTwo), 20);
  });

  void it('looks up score from raw total', () => {
    assert.equal(scoreFromRawTotal(20), 50);
    assert.equal(scoreFromRawTotal(0), 14);
    assert.equal(scoreFromRawTotal(40), 86);
    assert.equal(scoreFromRawTotal(12), 40);
  });

  void it('cfpbScore returns correct score', () => {
    // Raw=20 → score 50
    const allTwo = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    assert.equal(cfpbScore(allTwo), 50);

    // Raw=12 → score 40 (matches webinar example)
    const raw12 = [0, 0, 2, 0, 2, 2, 2, 0, 2, 2];
    assert.equal(cfpbScore(raw12), 40);
  });

  void it('estimateTheta is derived from score', () => {
    // Score 50 → theta = 0
    const allTwo = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    assert.equal(estimateTheta(allTwo), 0);

    // Score 14 → theta = (14-50)/15 = -2.4
    // Raw=0 means: non-rev=0, rev=4 (reverse of 4 is 0)
    const raw0 = [0, 0, 4, 0, 4, 4, 4, 0, 4, 4];
    assert.equal(estimateTheta(raw0), (14 - 50) / 15);

    // Score 86 → theta = (86-50)/15 = 2.4
    // Raw=40 means: non-rev=4, rev=0 (reverse of 0 is 4)
    const raw40 = [4, 4, 0, 4, 0, 0, 0, 4, 0, 0];
    assert.equal(estimateTheta(raw40), (86 - 50) / 15);
  });
});

void describe('computeFinalScore', () => {
  void it('all-high confidence produces unmodified IRT score', () => {
    const responses = Array.from({ length: 10 }, () => ({ value: 2, confidence: 'high' as const }));
    const result = computeFinalScore(responses, 0);
    assert.equal(result.score, 50);
    assert.equal(result.avgConfidence, 1);
  });

  void it('all-low confidence pulls toward 50', () => {
    // Raw=0 (score=14) with all-low: avgConf=0.5
    // attenuated = 14*0.5 + 50*0.5 = 32
    const responses = [
      { value: 0, confidence: 'low' as const },
      { value: 0, confidence: 'low' as const },
      { value: 4, confidence: 'low' as const },
      { value: 0, confidence: 'low' as const },
      { value: 4, confidence: 'low' as const },
      { value: 4, confidence: 'low' as const },
      { value: 4, confidence: 'low' as const },
      { value: 0, confidence: 'low' as const },
      { value: 4, confidence: 'low' as const },
      { value: 4, confidence: 'low' as const },
    ];
    const result = computeFinalScore(responses, 0);
    assert.equal(result.score, 32);
    assert.equal(result.avgConfidence, 0.5);
  });

  void it('scoreModifier of +5 raises the score by 5', () => {
    const responses = Array.from({ length: 10 }, () => ({ value: 2, confidence: 'high' as const }));
    const result = computeFinalScore(responses, 5);
    assert.equal(result.score, 55);
  });

  void it('perfect 40/40 raw produces high score', () => {
    // Non-rev=4, rev=0 → raw=40 → score=86
    const responses = [
      { value: 4, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
    ];
    const result = computeFinalScore(responses, 0);
    assert.equal(result.score, 86);
  });

  void it('0/40 raw with all-high-confidence produces lowest score', () => {
    // Non-rev=0, rev=4 → raw=0 → score=14
    const responses = [
      { value: 0, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 0, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
      { value: 4, confidence: 'high' as const },
    ];
    const result = computeFinalScore(responses, 0);
    assert.equal(result.score, 14);
  });

  void it('throws for invalid response count', () => {
    assert.throws(() => cfpbScore([1, 2, 3]), /Expected 10 responses/);
  });

  void it('throws for invalid response value', () => {
    assert.throws(() => computeTotalRawValue([5, 2, 2, 2, 2, 2, 2, 2, 2, 2]), /Invalid response/);
    assert.throws(() => computeTotalRawValue([-1, 2, 2, 2, 2, 2, 2, 2, 2, 2]), /Invalid response/);
  });
});
