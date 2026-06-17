import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography } from '@/theme/colors';

/**
 * Elevated list-group — hairline-separated rows inside one rounded card (Claude Design `.list-group`).
 * The single source of truth for the grouped-row shape (Results Key Metrics / Mentioned Spending,
 * History rows, …). Pass `ListRow`s (or any row nodes) as children; separators are inserted between.
 */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {child}
          {i < items.length - 1 && <View style={styles.sep} />}
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * A standard label/value row for a ListGroup. `left` is an optional leading node (icon tile);
 * the value renders in Geist Mono (money/figures) unless `mono={false}`.
 */
export function ListRow({
  label, value, left, valueColor, mono = true,
}: { label: string; value: string; left?: React.ReactNode; valueColor?: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      {left}
      <Text style={[styles.label, left ? styles.labelWithLeft : null]} numberOfLines={1}>{label}</Text>
      <Text style={[mono ? styles.valueMono : styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginHorizontal: 17 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 17, gap: 11 },
  label: { flex: 1, fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: 'rgba(255,255,255,0.82)', letterSpacing: -0.2 },
  labelWithLeft: { flex: 1 },
  value: { fontFamily: Typography.fonts.bodySemi, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.4 },
  valueMono: { fontFamily: Typography.fonts.monoSemi, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.4 },
});

export default ListGroup;
