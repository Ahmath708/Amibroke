import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenBackground, { type ScreenVariant } from '@/components/ScreenBackground';
import Skeleton from '@/components/Skeleton';
import { Spacing, Radius } from '@/theme/colors';

// Pulse-skeleton loading for a tool screen: the SOLID screen background + content-shaped placeholder
// blocks (a tall "hero" card + a few rows) under the screen's header. Mirrors the tool's layout so the
// real content swaps in without a jump — and never lets the previous screen bleed through.
export default function ToolSkeleton({ variant, heroHeight = 100, rows = 3, rowHeight = 68 }: {
  variant: ScreenVariant; heroHeight?: number; rows?: number; rowHeight?: number;
}) {
  return (
    <View style={styles.fill}>
      <ScreenBackground variant={variant} />
      <View style={styles.content}>
        <Skeleton height={heroHeight} radius={Radius.lg} />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} height={rowHeight} radius={Radius.lg} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.md },
});
