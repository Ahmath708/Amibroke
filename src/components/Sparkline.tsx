import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getScoreBand } from '@shared/scoring/bands.ts';

interface Props {
  values: number[];
  /** Latest band color — used for the leading end-dot. */
  color: string;
  width?: number;
  height?: number;
}

type Pt = { x: number; y: number };

// Smooth the series with a Catmull-Rom spline (→ cubic béziers) so the trend reads as an organic
// climb instead of an angular polyline. Control points are 1/6 of the neighbor span (standard CR).
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Score sparkline (Home Trend tile): a smooth curve stroked with a band-color gradient
// (red → amber → teal → green) keyed to each point's score, so the line visibly climbs through
// the bands — the Claude Design treatment, not a flat single-color polyline.
export default function Sparkline({ values, color, width = 140, height = 40 }: Props) {
  const gid = `spark${React.useId().replace(/:/g, '')}`; // unique per instance (avoid SVG id clashes)
  const pad = 4; // keep the round stroke + end-dot inside the box
  const innerH = height - pad * 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const pts: Pt[] = values.map((v, i) => ({
    x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: pad + (innerH - ((v - min) / span) * innerH),
  }));
  const last = pts[pts.length - 1];

  // Gradient stop per data point: its band color at its x-fraction. The stroke is colored by the
  // band the score was actually in at each point.
  const stops = values.map((v, i) => ({
    offset: values.length === 1 ? 0 : i / (values.length - 1),
    color: getScoreBand(v).color,
  }));

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          {stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} />)}
        </LinearGradient>
      </Defs>
      {values.length > 1 && (
        <Path d={smoothPath(pts)} fill="none" stroke={`url(#${gid})`} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      )}
      <Circle cx={last.x} cy={last.y} r={2.8} fill={color} />
    </Svg>
  );
}
