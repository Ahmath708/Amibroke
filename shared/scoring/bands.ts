export type ScoreBand = {
  label: 'Financially Fragile' | 'Surviving' | 'Stable' | 'Thriving';
  color: string;
};

export function getScoreBand(score: number): ScoreBand {
  if (score <= 40) return { label: 'Financially Fragile', color: '#FF4D6D' };
  if (score <= 60) return { label: 'Surviving', color: '#FFB020' };
  if (score <= 80) return { label: 'Stable', color: '#00C2A8' };
  return { label: 'Thriving', color: '#00E676' };
}
