import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

interface Props {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}

// Hand-rolled score sparkline (extracted from DashboardScreen's Trend tile).
// Maps a chronological series (oldest → newest) to a polyline scaled to the box.
export default function Sparkline({ values, color, width = 140, height = 40 }: Props) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
