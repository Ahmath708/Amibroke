import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { useNotifications, type NotifType } from '@/hooks/useNotifications';
import { useRescore } from '@/hooks/useRescore';
import ScreenBackground from '@/components/ScreenBackground';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import { PressableScale } from '@/components/motion';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Notifications'> };

// Computed notifications center — the nudges we already derive (score/plan stale, check-in due).
// Each row routes to where you act (score → re-score; plan → the plan; check-in → the check-in).
export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { items, loading } = useNotifications();
  const rescore = useRescore();

  const act = (type: NotifType) => {
    if (type === 'score_stale') rescore();
    else if (type === 'plan_stale') navigation.navigate('ActionPlan', {});
    else if (type === 'checkin_due') navigation.navigate('MonthlyCheckIn');
  };

  if (loading) return <LoadingState style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={{ paddingTop: Spacing.xxl }}>
            <EmptyState
              emoji="✅"
              title="You're all caught up"
              body="No nudges right now. We'll let you know when your score, plan, or check-in needs attention."
            />
          </View>
        ) : (
          items.map((n) => (
            <PressableScale key={n.type} haptic="light" onPress={() => act(n.type)} style={styles.row}>
              <Text style={styles.emoji}>{n.emoji}</Text>
              <View style={styles.info}>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
              </View>
              <ChevronRightIcon size={18} color={Colors.textSecondary} />
            </PressableScale>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  title: { fontFamily: Typography.fonts.bodySemi, fontSize: Typography.subhead.fontSize, color: Colors.textPrimary },
  body: { fontFamily: Typography.fonts.body, fontSize: Typography.footnote.fontSize, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
