import React from 'react';
import StatusPill from '@/components/StatusPill';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

// Single source of truth for severity/urgency badges. high = red, medium = orange,
// low = gray (neutral — a low-severity item isn't "good"). critical = filled red (alarm),
// same hue as high but escalated by emphasis. Matches the `urgency` enum from the
// analyze schema (low/medium/high/critical).
const META: Record<SeverityLevel, { variant: 'danger' | 'warning' | 'muted'; filled: boolean }> = {
  critical: { variant: 'danger', filled: true },
  high:     { variant: 'danger', filled: false },
  medium:   { variant: 'warning', filled: false },
  low:      { variant: 'muted', filled: false },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SeverityPill({ level, size }: { level: SeverityLevel; size?: 'sm' | 'md' }) {
  const m = META[level];
  return <StatusPill label={cap(level)} variant={m.variant} filled={m.filled} size={size} />;
}
