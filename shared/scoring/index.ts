import { cfpbScore, estimateTheta } from './cfpb_irt.ts';
import { getScoreBand } from './bands.ts';

export type Confidence = 'low' | 'medium' | 'high';
export type CfpbResponse = { value: number; confidence: Confidence };

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1.0,
};

export function computeFinalScore(
  cfpbResponses: CfpbResponse[],
  scoreModifier: number,
): { score: number; scoreLabel: string; scoreColor: string; avgConfidence: number; theta: number } {
  const values = cfpbResponses.map((r) => r.value);
  const irtScore = cfpbScore(values);
  const theta = estimateTheta(values);

  const avgConfidence =
    cfpbResponses.reduce((sum, r) => sum + CONFIDENCE_WEIGHT[r.confidence], 0) /
    cfpbResponses.length;

  const attenuated = irtScore * avgConfidence + 50 * (1 - avgConfidence);

  const finalScore = Math.max(0, Math.min(100, Math.round(attenuated + scoreModifier)));

  const band = getScoreBand(finalScore);

  return {
    score: finalScore,
    scoreLabel: band.label,
    scoreColor: band.color,
    avgConfidence,
    theta,
  };
}

export { cfpbScore, estimateTheta, computeTotalRawValue } from './cfpb_irt.ts';
export { getScoreBand } from './bands.ts';
export type { ScoreBand } from './bands.ts';
