import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * The 90-Day Action Plan icon — a folded map with a route curving to a destination (the journey to
 * your goal). Custom SVG, chosen over Heroicons' generic `MapIcon` for the meaning (a *plan toward a
 * goal*, not just "a map"); drawn in the Heroicons 24px / ~1.5 stroke style so it sits consistently.
 * Source of truth: config/tools.ts → TOOLS.action_plan.icon.
 */
export default function PlanRouteIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* folded map (dimmed so the route stays the focal point at small sizes) */}
      <Path d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M9 4 V18 M15 6 V20" stroke={color} strokeWidth={1.3} strokeLinecap="round" opacity={0.5} />
      {/* route + destination */}
      <Path d="M6.5 16.5 C 9 14 10 12 12.5 11 C 14.5 10.2 15.6 9 16.4 8.1" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={17} cy={7.4} r={1.5} fill={color} />
    </Svg>
  );
}
