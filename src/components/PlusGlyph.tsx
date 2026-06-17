import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/theme/colors';

/**
 * A stroke-based "+" matching the Claude Design prototype (round caps, tunable weight) — the
 * Heroicons solid plus reads either too heavy or too thin depending on size, so navigation/add
 * affordances use this for precise control. HTML reference: `.fab` plus = strokeWidth 2.6,
 * `.pinned-add` plus = strokeWidth 2.4.
 */
export default function PlusGlyph({
  size = 22, color = Colors.onAccent, strokeWidth = 2.6, style,
}: { size?: number; color?: string; strokeWidth?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
