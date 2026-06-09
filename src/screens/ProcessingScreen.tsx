import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { analyzeFinances } from '@/services/ai';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { trackFunnelStep, trackError } from '@/services/analytics';
import ScreenBackground from '@/components/ScreenBackground';
import RoastLoading from '@/components/RoastLoading';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Processing'>;
  route: RouteProp<RootStackParamList, 'Processing'>;
};

const ANALYSIS_TIMEOUT_MS = 45000;
const RESULTS_DELAY = 520; // hold on "complete" before routing to Results

export default function ProcessingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { userInput, tone, userContext } = route.params;
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doAnalysis = useCallback(async () => {
    setError(null);
    setDone(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    try {
      const analysis = await analyzeFinances(userInput, tone || 'savage', controller.signal, 2, userContext as Record<string, unknown> | undefined);
      clearTimeout(timeout);
      trackFunnelStep('analysis_completed', { score: analysis.score, tone: tone || 'savage' });
      setDone(true);
      setTimeout(() => navigation.replace('Results', { analysis, userInput }), RESULTS_DELAY);
    } catch (e) {
      clearTimeout(timeout);
      let msg = e instanceof Error ? e.message : 'Something went wrong while roasting. Please try again.';
      console.error('[Processing] Analysis error:', e);
      if (e instanceof Error && e.name === 'AbortError') {
        msg = `Request timed out after ${ANALYSIS_TIMEOUT_MS / 1000} seconds. Check your internet connection and try again.`;
      }
      trackError('analysis_failed', msg, 'ProcessingScreen');
      setError(msg);
    }
  }, [userInput, tone, navigation]);

  useEffect(() => { doAnalysis(); }, [doAnalysis]);

  return (
    <View style={styles.container}>
      <ScreenBackground variant="processing" />
      <TouchableOpacity style={[styles.backBtn, { marginTop: insets.top + 8 }]} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })} activeOpacity={0.7}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <View style={[styles.inner, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* The roast "thinking" animation (ring + cycling steps) — also drives the success/error landing. */}
        <RoastLoading done={done} error={error} />

        {error ? (
          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.retryButton} onPress={doAnalysis} activeOpacity={0.7}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.retryButtonSecondary} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })} activeOpacity={0.7}>
              <Text style={styles.retryTextSecondary}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.hint}>Roasting your finances with brutal honesty ✨</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.xxl },
  hint: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textMuted, textAlign: 'center' },
  errorActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%', paddingHorizontal: Spacing.xl },
  retryButton: { flex: 1, backgroundColor: Colors.accent, paddingVertical: Spacing.md, borderRadius: Radius.lg, marginTop: Spacing.md, alignItems: 'center' },
  retryButtonSecondary: { flex: 1, backgroundColor: Colors.surfaceElevated, paddingVertical: Spacing.md, borderRadius: Radius.lg, marginTop: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorderLight },
  retryText: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.background, textAlign: 'center' },
  retryTextSecondary: { fontFamily: Typography.fonts.bodyMed, fontSize: Typography.callout.fontSize, color: Colors.textPrimary, textAlign: 'center' },
  backBtn: { position: 'absolute', top: 0, left: 16, zIndex: 10, padding: Spacing.sm },
  backBtnText: { fontFamily: Typography.fonts.body, fontSize: Typography.callout.fontSize, color: Colors.accent },
});
