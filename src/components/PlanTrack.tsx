import React from 'react';
import Svg, { Line, Circle } from 'react-native-svg';
import { Colors } from '@/theme/colors';

interface Props {
  /** Steps with completion status — one node each. */
  steps: { status: string }[];
  width: number;
  height?: number;
}

/**
 * Horizontal "90-day journey" track: a node per step along a path, filled in the
 * brand accent as steps complete, with the earliest pending step ringed as
 * "you're here". The hero visual for the Active Plan (Journey direction).
 */
export default function PlanTrack({ steps, width, height = 34 }: Props) {
  const n = Math.max(steps.length, 1);
  const pad = 9;
  const y = height / 2;
  const x = (i: number) => (n === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (n - 1));
  const firstPending = steps.findIndex((s) => s.status !== 'done');

  return (
    <Svg width={width} height={height}>
      <Line x1={x(0)} y1={y} x2={x(n - 1)} y2={y} stroke={Colors.backgroundSecondary} strokeWidth={3} strokeLinecap="round" />
      {steps.map((s, i) => {
        const done = s.status === 'done';
        const current = i === firstPending;
        return (
          <Circle
            key={i} cx={x(i)} cy={y} r={current ? 8 : 6}
            fill={done ? Colors.accentSolid : Colors.background}
            stroke={done || current ? Colors.accentSolid : Colors.glassBorderLight}
            strokeWidth={current ? 3 : 2}
          />
        );
      })}
    </Svg>
  );
}
