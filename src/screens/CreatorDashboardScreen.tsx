import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import GlassCard from '../components/GlassCard';
import StatusPill from '../components/StatusPill';
import NeonButton from '../components/NeonButton';

const { width } = Dimensions.get('window');

const STATS = [
  { label: 'Referrals', value: '1,284', change: '+12%', positive: true, icon: '👥' },
  { label: 'Conversions', value: '342', change: '+8%', positive: true, icon: '✅' },
  { label: 'Earnings', value: '$684', change: '+23%', positive: true, icon: '💰' },
  { label: 'Avg Score', value: '61', change: '-3 pts', positive: false, icon: '📊' },
];

const EARNINGS = [
  { month: 'Jan', amount: 80 },
  { month: 'Feb', amount: 95 },
  { month: 'Mar', amount: 110 },
  { month: 'Apr', amount: 140 },
  { month: 'May', amount: 180 },
];

const RECENT = [
  { id: '1', user: 'anon_7842', product: 'Marcus HYSA', amount: 30, date: 'Today', status: 'paid' },
  { id: '2', user: 'anon_1193', product: 'YNAB', amount: 15, date: 'Yesterday', status: 'paid' },
  { id: '3', user: 'anon_5521', product: 'Citi Double Cash', amount: 75, date: 'May 12', status: 'pending' },
  { id: '4', user: 'anon_9018', product: 'Betterment', amount: 20, date: 'May 11', status: 'paid' },
  { id: '5', user: 'anon_3376', product: 'Fidelity', amount: 25, date: 'May 10', status: 'pending' },
];

const LEADERBOARD = [
  { rank: 1, name: 'creator_moneycoach', earnings: '$2,840', referrals: 94 },
  { rank: 2, name: 'broketo_rich_pod', earnings: '$1,920', referrals: 64 },
  { rank: 3, name: 'you', earnings: '$684', referrals: 23, isYou: true },
  { rank: 4, name: 'debtfree_dana', earnings: '$590', referrals: 20 },
  { rank: 5, name: 'budget_with_ben', earnings: '$410', referrals: 14 },
];

type Tab = 'overview' | 'referrals' | 'leaderboard';

const BAR_MAX = Math.max(...EARNINGS.map((e) => e.amount));

export default function CreatorDashboardScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <LinearGradient colors={['#19101c', '#1a0a30', '#19101c']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Segmented tabs */}
        <View style={styles.segmentRow}>
          {(['overview', 'referrals', 'leaderboard'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.segment, tab === t && styles.segmentActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── OVERVIEW TAB ─── */}
        {tab === 'overview' && (
          <>
            {/* 2×2 stat grid */}
            <View style={styles.statsGrid}>
              {STATS.map((s) => (
                <GlassCard key={s.label} style={styles.statCard}>
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={[styles.statChange, { color: s.positive ? Colors.success : Colors.danger }]}>
                    {s.change}
                  </Text>
                </GlassCard>
              ))}
            </View>

            {/* Earnings chart */}
            <Text style={styles.sectionLabel}>Monthly Earnings</Text>
            <GlassCard style={styles.chartCard}>
              <View style={styles.chart}>
                {EARNINGS.map((e) => {
                  const barH = (e.amount / BAR_MAX) * 90;
                  return (
                    <View key={e.month} style={styles.barCol}>
                      <Text style={styles.barValue}>${e.amount}</Text>
                      <View style={styles.barTrack}>
                        <LinearGradient
                          colors={Colors.gradientPrimary}
                          style={[styles.barFill, { height: barH }]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{e.month}</Text>
                    </View>
                  );
                })}
              </View>
            </GlassCard>

            {/* Payout card */}
            <LinearGradient
              colors={['rgba(57,255,20,0.14)', 'rgba(0,224,255,0.10)']}
              style={styles.payoutCard}
            >
              <View>
                <Text style={styles.payoutLabel}>Available to Withdraw</Text>
                <Text style={styles.payoutAmount}>$389.00</Text>
                <Text style={styles.payoutSub}>Next payout: June 1 · via Stripe</Text>
              </View>
              <NeonButton label="Withdraw" onPress={() => {}} variant="secondary" size="md" style={styles.withdrawBtn} />
            </LinearGradient>

            {/* Share links */}
            <Text style={styles.sectionLabel}>Your Referral Links</Text>
            <View style={styles.linksGroup}>
              {[
                { label: 'Main Link', url: 'aibroke.app/ref/you', icon: '🔗' },
                { label: 'TikTok Bio', url: 'aibroke.app/tiktok/you', icon: '📱' },
              ].map((link, i) => (
                <React.Fragment key={link.label}>
                  {i > 0 && <View style={styles.linkSep} />}
                  <View style={styles.linkRow}>
                    <View style={styles.linkIconBadge}>
                      <Text style={styles.linkIcon}>{link.icon}</Text>
                    </View>
                    <View style={styles.linkInfo}>
                      <Text style={styles.linkLabel}>{link.label}</Text>
                      <Text style={styles.linkUrl}>{link.url}</Text>
                    </View>
                    <TouchableOpacity style={styles.copyBtn} activeOpacity={0.7}>
                      <Text style={styles.copyBtnText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* ─── REFERRALS TAB ─── */}
        {tab === 'referrals' && (
          <>
            <Text style={styles.sectionLabel}>Recent Conversions</Text>
            <View style={styles.referralGroup}>
              {RECENT.map((r, i) => (
                <React.Fragment key={r.id}>
                  {i > 0 && <View style={styles.refSep} />}
                  <View style={styles.refRow}>
                    <View style={styles.refAvatar}>
                      <Text style={styles.refAvatarText}>👤</Text>
                    </View>
                    <View style={styles.refInfo}>
                      <View style={styles.refHeader}>
                        <Text style={styles.refUser}>@{r.user}</Text>
                        <StatusPill label={r.status} variant={r.status === 'paid' ? 'good' : 'warning'} />
                      </View>
                      <Text style={styles.refProduct}>{r.product}</Text>
                      <Text style={styles.refDate}>{r.date}</Text>
                    </View>
                    <Text style={[styles.refAmount, { color: r.status === 'paid' ? Colors.success : Colors.warning }]}>
                      +${r.amount}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* Conversion breakdown */}
            <Text style={styles.sectionLabel}>Product Breakdown</Text>
            <View style={styles.breakdownGroup}>
              {[
                { name: 'Savings Accounts', pct: 44, color: Colors.success },
                { name: 'Credit Cards', pct: 28, color: Colors.primary },
                { name: 'Investing Apps', pct: 18, color: Colors.secondary },
                { name: 'Budgeting Tools', pct: 10, color: Colors.warning },
              ].map((item, i, arr) => (
                <React.Fragment key={item.name}>
                  {i > 0 && <View style={styles.refSep} />}
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownName}>{item.name}</Text>
                    <View style={styles.breakdownBarWrap}>
                      <View style={[styles.breakdownBar, { width: `${item.pct}%`, backgroundColor: item.color }]} />
                    </View>
                    <Text style={styles.breakdownPct}>{item.pct}%</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* ─── LEADERBOARD TAB ─── */}
        {tab === 'leaderboard' && (
          <>
            <GlassCard style={styles.leaderboardIntro}>
              <Text style={styles.leaderboardIntroText}>
                Top creators this month · Resets June 1
              </Text>
            </GlassCard>

            <View style={styles.leaderGroup}>
              {LEADERBOARD.map((entry, i) => (
                <React.Fragment key={entry.rank}>
                  {i > 0 && <View style={[styles.refSep, entry.isYou ? styles.youSep : null]} />}
                  <View style={[styles.leaderRow, entry.isYou && styles.leaderRowYou]}>
                    <View style={[styles.rankBadge, entry.rank <= 3 && styles.rankBadgeTop]}>
                      <Text style={[styles.rankNum, entry.rank <= 3 && styles.rankNumTop]}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </Text>
                    </View>
                    <View style={styles.leaderInfo}>
                      <Text style={[styles.leaderName, entry.isYou && styles.leaderNameYou]}>
                        @{entry.name}{entry.isYou ? ' (you)' : ''}
                      </Text>
                      <Text style={styles.leaderReferrals}>{entry.referrals} referrals</Text>
                    </View>
                    <Text style={[styles.leaderEarnings, entry.isYou && { color: Colors.primary }]}>
                      {entry.earnings}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <GlassCard style={styles.rankTip}>
              <Text style={styles.rankTipTitle}>💡 Move up the leaderboard</Text>
              <Text style={styles.rankTipText}>
                Post your roast on TikTok with #AmIBroke. Creators who post video reviews convert 3× better than link-in-bio only.
              </Text>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 16 },
  segmentRow: {
    flexDirection: 'row', backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md, padding: 3, marginBottom: 24, gap: 2,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.sm },
  segmentActive: { backgroundColor: Colors.groupedRow },
  segmentText: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.textPrimary, fontFamily: Typography.fonts.bodyMed },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: (width - Spacing.xl * 2 - 10) / 2, padding: 14 },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontFamily: Typography.fonts.heading, fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  statChange: { fontFamily: Typography.fonts.bodyMed, fontSize: 12, fontWeight: '600', marginTop: 4 },
  sectionLabel: {
    fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  chartCard: { padding: 16, marginBottom: 16 },
  chart: { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 8 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontFamily: Typography.fonts.body, fontSize: 10, color: Colors.textMuted, marginBottom: 4 },
  barTrack: { width: '70%', backgroundColor: Colors.backgroundSecondary, borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 5 },
  barLabel: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textSecondary, marginTop: 6 },
  payoutCard: {
    borderRadius: Radius.lg, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24,
  },
  payoutLabel: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  payoutAmount: { fontFamily: Typography.fonts.heading, fontSize: 26, fontWeight: '700', color: Colors.success },
  payoutSub: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  withdrawBtn: { minWidth: 100 },
  linksGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 8,
  },
  linkSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 56 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  linkIconBadge: {
    width: 32, height: 32, borderRadius: 7,
    backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  linkIcon: { fontSize: 15 },
  linkInfo: { flex: 1 },
  linkLabel: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  linkUrl: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  copyBtn: {
    backgroundColor: Colors.primaryContainer, borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  copyBtnText: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.primary, fontWeight: '500' },
  referralGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 24,
  },
  refSep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: 56 },
  youSep: { backgroundColor: Colors.primaryContainer },
  refRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  refAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center',
  },
  refAvatarText: { fontSize: 16 },
  refInfo: { flex: 1, gap: 2 },
  refHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refUser: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  refProduct: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
  refDate: { fontFamily: Typography.fonts.body, fontSize: 11, color: Colors.textMuted },
  refAmount: { fontFamily: Typography.fonts.heading, fontSize: 16, fontWeight: '700' },
  breakdownGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  breakdownName: { width: 120, fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textPrimary },
  breakdownBarWrap: { flex: 1, height: 6, backgroundColor: Colors.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  breakdownBar: { height: '100%', borderRadius: 3 },
  breakdownPct: { fontFamily: Typography.fonts.bodyMed, fontSize: 13, color: Colors.textSecondary, width: 36, textAlign: 'right' },
  leaderboardIntro: { padding: 12, marginBottom: 12, alignItems: 'center' },
  leaderboardIntroText: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary },
  leaderGroup: {
    backgroundColor: Colors.groupedRow, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorder, marginBottom: 20,
  },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  leaderRowYou: { backgroundColor: Colors.primaryContainer },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center',
  },
  rankBadgeTop: { backgroundColor: 'transparent' },
  rankNum: { fontFamily: Typography.fonts.heading, fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  rankNumTop: { fontSize: 20 },
  leaderInfo: { flex: 1 },
  leaderName: { fontFamily: Typography.fonts.bodyMed, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  leaderNameYou: { color: Colors.primary },
  leaderReferrals: { fontFamily: Typography.fonts.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  leaderEarnings: { fontFamily: Typography.fonts.heading, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  rankTip: { padding: 16, gap: 6 },
  rankTipTitle: { fontFamily: Typography.fonts.bodyMed, fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  rankTipText: { fontFamily: Typography.fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
