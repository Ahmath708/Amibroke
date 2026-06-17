import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The iOS-style swipe-down handle pill. Render at the top of a swipe-to-dismiss
 * modal/sheet so the drag-down affordance is obvious. Shared by the FAB compose
 * modals (via the navigator's modal header) and the Paywall, so they never drift.
 */
export default function SheetGrabber({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.grabber, style]} />;
}

const styles = StyleSheet.create({
  grabber: { width: 40, height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.4)' },
});
