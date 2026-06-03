import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated,
} from 'react-native';
import {
  ClipboardDocumentListIcon, ArrowTrendingDownIcon, MagnifyingGlassIcon, BeakerIcon,
  ChevronRightIcon, LockClosedIcon,
} from 'react-native-heroicons/outline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TabScreenNav } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { hasAccessTo } from '@/services/subscriptions';
import { getAnalysisHistory, getAnalysisById } from '@/services/claudeApi';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import ScreenBackground from '@/components/ScreenBackground';
import SectionLabel from '@/components/SectionLabel';
import PremiumCard from '@/components/PremiumCard';
import TierPill from '@/components/TierPill';

type Props = { navigation: TabScreenNav<'Tools'> };

// Premium features — gated by tier. `action: 'latest' | 'debt'` are analysis-scoped
// (open the latest analysis); `nav` items are standalone screens.
const TOOLS: { icon: React.ComponentType<any>; label: string; sub: string; requires: 'action_plan' | 'deep_dive'; soon?: boolean; nav?: string; action?: 'latest' | 'debt' }[] = [
  { icon: ClipboardDocumentListIcon, label: '90-Day Action Plan',  sub: 'Week-by-week roadmap with goals', requires: 'action_plan', action: 'latest' },
  { icon: ArrowTrendingDownIcon,     label: 'Debt Payoff',          sub: 'Avalanche vs snowball strategy',  requires: 'deep_dive',   action: 'debt' },
  { icon: MagnifyingGlassIcon,       label: 'Subscription Audit',   sub: 'Find recurring money leaks',      requires: 'action_plan', nav: 'SubscriptionAudit' },
  { icon: BeakerIcon,                label: 'Scenario Simulator',   sub: 'Model "what if" money moves',     requires: 'deep_dive', soon: true, nav: 'ScenarioSimulator' },
];

export default function ToolsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier, refresh } = useSubscription();
  const { animatedStyle } = useEntryAnimation();
  const [latestId, setLatestId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const loaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (!user) return;
      if (loaded.current) return;
      getAnalysisHistory(user.id)
        .then((h) => setLatestId(h?.[0]?.id ?? null))
        .catch(() => {})
        .finally(() => { loaded.current = true; });
    }, [user, refresh]),
  );

  // Analysis-scoped tools live inside a specific analysis → open the latest one.
  const openLatest = useCallback(async (mode: 'latest' | 'debt') => {
    if (opening) return;
    if (!latestId) {
      Alert.alert('No analysis yet', 'Run an analysis first, then your tools open right from it.');
      return;
    }
    setOpening(true);
    try {
      const analysis: any = await getAnalysisById(latestId);
      if (!analysis) return;
      if (mode === 'debt') {
        const debts = analysis.debts ?? [];
        const monthlyIncome = analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0;
        (navigation.navigate as any)('DebtPayoff', { debts, monthlyIncome });
      } else {
        (navigation.navigate as any)('Results', { analysis, userInput: '' });
      }
    } catch {
      // ignore
    } finally {
      setOpening(false);
    }
  }, [opening, latestId, navigation]);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="home" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tools</Text>
          <TierPill tier={tier} />
        </View>
        <Text style={styles.subtitle}>Your premium toolkit to actually fix things.</Text>

        {/* Upgrade CTA unless fully unlocked */}
        {tier !== 'deep_dive' && (
          <PremiumCard
            variant={tier === 'action_plan' ? 'upgrade' : 'go'}
            onPress={() => navigation.navigate('Paywall')}
            style={{ marginBottom: Spacing.xl }}
          />
        )}

        <SectionLabel>Premium Tools</SectionLabel>
        <View style={styles.group}>
          {TOOLS.map((tool, i) => {
            const unlocked = hasAccessTo(tier, tool.requires);
            const onPress = !unlocked
              ? () => navigation.navigate('Paywall')
              : tool.action
                ? () => openLatest(tool.action!)
                : () => (navigation.navigate as any)(tool.nav);
            const ToolIcon = tool.icon;
            return (
              <React.Fragment key={tool.label}>
                {i > 0 && <View style={styles.sep} />}
                <TouchableOpacity style={styles.cell} onPress={onPress} activeOpacity={0.7} disabled={opening}>
                  <View style={[styles.iconBadge, !unlocked && styles.iconBadgeLocked]}>
                    <ToolIcon size={18} color={unlocked ? Colors.primary : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, !unlocked && styles.labelLocked]}>{tool.label}</Text>
                    <Text style={styles.sub}>{!unlocked ? 'Subscribe to unlock' : tool.sub}</Text>
                  </View>
                  <View style={styles.right}>
                    {unlocked && tool.soon ? <Text style={styles.soon}>Soon</Text> : null}
                    {unlocked
                      ? <ChevronRightIcon size={16} color={Colors.textSecondary} />
                      : <LockClosedIcon size={15} color={Colors.textMuted} />}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  title: { ...Typography.largeTitle, fontFamily: Typography.fonts.heading, color: Colors.textPrimary },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xl },
  group: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.rowHeightLg },
  cell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md, minHeight: 60 },
  iconBadge: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  iconBadgeLocked: { backgroundColor: Colors.backgroundSecondary },
  label: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  labelLocked: { color: Colors.textMuted },
  sub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  soon: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, letterSpacing: 0.3 },
});
