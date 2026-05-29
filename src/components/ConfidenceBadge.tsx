import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Typography } from '@/theme/colors';

type Level = 'high' | 'medium' | 'low';

interface Props {
  level: Level;
  size?: 'sm' | 'md';
}

const CONFIG: Record<Level, { bg: string; color: string; label: string }> = {
  high:   { bg: 'rgba(52,199,89,0.15)', color: '#34C759', label: 'High' },
  medium: { bg: 'rgba(255,204,0,0.15)', color: '#FFCC00', label: 'Medium' },
  low:    { bg: 'rgba(255,69,58,0.15)', color: '#FF453A', label: 'Low' },
};

export default function ConfidenceBadge({ level, size = 'sm' }: Props) {
  const { bg, color, label } = CONFIG[level];
  return (
    <View style={[styles.pill, { backgroundColor: bg }, size === 'md' && styles.pillMd]}>
      <Text style={[styles.text, { color }, size === 'md' && styles.textMd]}>{label}</Text>
    </View>
  );
}

export function confidenceLevel(avgConfidence: number): Level {
  return avgConfidence >= 0.8 ? 'high' : avgConfidence >= 0.5 ? 'medium' : 'low';
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillMd: { paddingHorizontal: 11, paddingVertical: 4 },
  text: {
    fontFamily: Typography.fonts.bodySemi,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textMd: { fontSize: 12 },
});
