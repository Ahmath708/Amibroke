// The roast/flame brand icon — MaterialCommunityIcons `fire`, bumped up a touch because MCI `fire`
// renders optically smaller than the Heroicons glyphs on the other tabs at the same size. Same
// {size,color} API as a Heroicon so it tints for active/inactive tab states like the rest of the bar.
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const SCALE = 1.15; // nudge to match the other tab icons' optical size

export default function RoastIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="fire" size={Math.round(size * SCALE)} color={color} />;
}
