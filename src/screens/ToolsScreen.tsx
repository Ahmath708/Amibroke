import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Animated,
} from 'react-native';
import { PressableScale } from '@/components/motion';
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
import { getAnalysisHistory, getAnalysisById } from '@/services/analyses';
import { useEntryAnimation } from '@/hooks/useEntryAnimation';
import { TAB_BAR_HEIGHT } from '@/navigation/constants';
import ScreenBackground from '@/components/ScreenBackground';
import SectionLabel from '@/components/SectionLabel';
import PremiumCard from '@/components/PremiumCard';
import TierPill from '@/components/TierPill';
import Skeleton from '@/components/Skeleton';
import NotificationBell from '@/components/NotificationBell';

type Props = { navigation: TabScreenNav<'Tools'> };

// Premium features — gated by tier. `action: 'latest' | 'debt'` are analysis-scoped
// (open the latest analysis); `nav` items are standalone screens.
const TOOLS: { icon: React.ComponentType<any>; label: string; sub: string; requires: 'action_plan' | 'deep_dive'; soon?: boolean; nav?: string; action?: 'plan' | 'debt' }[] = [
  { icon: MagnifyingGlassIcon,       label: 'Subscription Audit',   sub: 'Track subscriptions & spot waste', requires: 'action_plan', nav: 'SubscriptionAudit' },
  { icon: ArrowTrendingDownIcon,     label: 'Debt Payoff',          sub: 'Avalanche vs snowball strategy',  requires: 'deep_dive',   action: 'debt' },
  { icon: ClipboardDocumentListIcon, label: '90-Day Action Plan',  sub: 'Week-by-week roadmap with goals', requires: 'action_plan', action: 'plan' },
  { icon: BeakerIcon,                label: 'Scenario Simulator',   sub: 'Model "what if" money moves',     requires: 'deep_dive', soon: true, nav: 'ScenarioSimulator' },
];

export default function ToolsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier, hasAccess, refresh, loading: subLoading } = useSubscription();
  const { animatedStyle } = useEntryAnimation();
  const [opening, setOpening] = useState(false);

  // Keep subscription state fresh on focus. The latest-analysis check happens at TAP time (below) —
  // fetched fresh, not from a cache — so a roast done this session is always reflected (no stale gate).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Analysis-scoped tools open from the user's LATEST analysis (Model A —
  // "latest = your plan"; see docs/DECISIONS.md), straight into the tool screen.
  const openLatest = useCallback(async (mode: 'plan' | 'debt') => {
    if (opening || !user) return;
    setOpening(true);
    try {
      // Fetch the latest analysis FRESH at tap time — reflects a roast done this session immediately,
      // with no stale focus-effect cache and no focus-timing race.
      const history = await getAnalysisHistory(user.id);
      const latestId = history?.[0]?.id ?? null;
      if (!latestId) {
        Alert.alert('No roast yet', 'Run a roast first, then your tools open right from it.');
        return;
      }
      const analysis: any = await getAnalysisById(latestId);
      if (!analysis) return;
      if (mode === 'debt') {
        const debts = analysis.debts ?? [];
        const monthlyIncome = analysis.monthlyIncome?.value ?? analysis.monthlyIncome ?? 0;
        (navigation.navigate as any)('DebtPayoff', { debts, monthlyIncome });
      } else {
        // Navigate IMMEDIATELY — ActionPlan fetches the active plan and handles create/refresh with
        // its own loading state. No blocking generation here (that caused the open stall).
        (navigation.navigate as any)('ActionPlan', { analysis, analysisId: latestId });
      }
    } catch {
      // ignore
    } finally {
      setOpening(false);
    }
  }, [opening, user, navigation]);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <ScreenBackground variant="home" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Tools</Text>
            {subLoading ? <Skeleton width={68} height={22} radius={11} /> : <TierPill tier={tier} />}
          </View>
          <NotificationBell />
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
        <View style={styles.grid}>
          {TOOLS.map((tool) => {
            const unlocked = hasAccess(tool.requires);
            const onPress = !unlocked
              ? () => navigation.navigate('Paywall')
              : tool.action
                ? () => openLatest(tool.action!)
                : () => (navigation.navigate as any)(tool.nav);
            const ToolIcon = tool.icon;
            return (
              <PressableScale key={tool.label} style={styles.tile} onPress={onPress} haptic="light" disabled={opening}>
                <View style={styles.tileTop}>
                  <View style={[styles.iconBadge, !unlocked && styles.iconBadgeLocked]}>
                    <ToolIcon size={20} color={unlocked ? Colors.accent : Colors.textMuted} />
                  </View>
                  {unlocked
                    ? (tool.soon
                        ? <Text style={styles.soon}>Soon</Text>
                        : <ChevronRightIcon size={16} color={Colors.textSecondary} />)
                    : <LockClosedIcon size={15} color={Colors.textMuted} />}
                </View>
                <View style={styles.tileText}>
                  <Text style={[styles.label, !unlocked && styles.labelLocked]} numberOfLines={2}>{tool.label}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{!unlocked ? 'Subscribe to unlock' : tool.sub}</Text>
                </View>
              </PressableScale>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { ...Typography.screenTitle, fontFamily: Typography.fonts.heading, color: Colors.textPrimary },
  subtitle: { fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize, color: Colors.textSecondary, marginBottom: Spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    justifyContent: 'space-between', // text sinks to the bottom when a row-mate is taller
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileText: { marginTop: Spacing.lg }, // breathing room between the icon and the title

  iconBadge: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.accentContainer, alignItems: 'center', justifyContent: 'center' },
  iconBadgeLocked: { backgroundColor: Colors.backgroundSecondary },
  label: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  labelLocked: { color: Colors.textMuted },
  sub: { fontFamily: Typography.fonts.body, fontSize: Typography.caption1.fontSize, color: Colors.textSecondary, marginTop: 2 },
  soon: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.caption2.fontSize, color: Colors.textSecondary, letterSpacing: 0.3 },
});
