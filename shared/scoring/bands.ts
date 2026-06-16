export type ScoreBand = {
  label: 'Cooked' | 'Surviving' | 'Stable' | 'Thriving';
  color: string;
};

export function getScoreBand(score: number): ScoreBand {
  if (score <= 40) return { label: 'Cooked', color: '#FF4D6D' };
  if (score <= 60) return { label: 'Surviving', color: '#FFB020' };
  if (score <= 80) return { label: 'Stable', color: '#00C2A8' };
  return { label: 'Thriving', color: '#00E676' };
}
