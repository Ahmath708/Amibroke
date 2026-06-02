import React from 'react';
import StatusPill from '@/components/StatusPill';
import { Colors } from '@/theme/colors';

type Level = 'high' | 'medium' | 'low';

// Confidence is the *inverted* axis vs severity: high = good (green), low = bad (red),
// medium = caution (yellow — kept distinct from severity's orange so the two scales read
// differently). Wraps StatusPill so all semantic badges share one base + the theme tokens.
const COLORS: Record<Level, string> = {
  high: Colors.success,
  medium: Colors.caution,
  low: Colors.danger,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ConfidenceBadge({ level, size = 'sm' }: { level: Level; size?: 'sm' | 'md' }) {
  return <StatusPill label={cap(level)} color={COLORS[level]} size={size} />;
}

export function confidenceLevel(avgConfidence: number): Level {
  return avgConfidence >= 0.8 ? 'high' : avgConfidence >= 0.5 ? 'medium' : 'low';
}
