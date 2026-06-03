import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';

const FAQS = [
  {
    q: 'What is Am I Broke?',
    a: 'Am I Broke? is an AI-powered financial snapshot tool. Describe your finances in plain English, and we\'ll give you a financial health score, a brutally honest roast, a spending breakdown, and actionable steps to improve — all in under 10 seconds.',
  },
  {
    q: 'Do I need to link my bank account?',
    a: 'Nope. No bank linking, no Plaid, no passwords. Just type your situation and get your results. Your financial data stays private.',
  },
  {
    q: 'Is this actual financial advice?',
    a: 'No. Am I Broke? is for educational and entertainment purposes only. It provides directional insights, not personalized financial advice. Always consult a licensed professional before making financial decisions.',
  },
  {
    q: 'How is my financial health score calculated?',
    a: 'Your score (0–100) is based on: savings rate (30%), debt-to-income ratio (30%), expense allocation vs. benchmarks (20%), and emergency fund status (20%). The AI extracts these factors from your description.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your raw financial input is not stored unless you create an account. We use Anthropic (Claude) to process your data and never sell your information. See our Privacy Policy for full details.',
  },
  {
    q: 'How much does it cost?',
    a: 'The basic snapshot (score, roast, spending breakdown) is free forever. Premium features like the 90-day Action Plan, Scenario Simulator, and Monthly Check-Ins are available as one-time purchases starting at $4.99.',
  },
  {
    q: 'Can I share my results?',
    a: 'Yes! Every result card is designed for sharing. Tap the Share button to save or post to TikTok, Instagram, Twitter, or anywhere else. Sharing helps others discover the app too.',
  },
  {
    q: 'What if I don\'t have exact numbers?',
    a: 'No problem. Estimate. The AI is smart enough to work with rough numbers. "I make like $4K a month" works just fine.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings → Danger Zone → Delete Account. This permanently removes all your saved data.',
  },
  {
    q: 'Can I use this as a creator?',
    a: 'Absolutely. We have a Creator Dashboard with tools like batch roasting, custom referral links, and embed widgets. Go to Profile → Creator Dashboard to get started.',
  },
];

export default function HelpFAQScreen() {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <ScreenBackground variant="info" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.intro}>
        Everything you need to know about Am I Broke?. Can't find what you're looking for? Email
        us at support@amibroke.app.
      </Text>

      <View style={styles.faqGroup}>
        {FAQS.map((faq, i) => {
          const open = expanded === faq.q;
          return (
            <React.Fragment key={faq.q}>
              {i > 0 && <View style={styles.sep} />}
              <TouchableOpacity
                style={styles.faqRow}
                activeOpacity={0.7}
                onPress={() => setExpanded(open ? null : faq.q)}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Text style={styles.faqChevron}>{open ? '−' : '+'}</Text>
                </View>
                {open && <Text style={styles.faqAnswer}>{faq.a}</Text>}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  intro: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.xxl,
  },
  faqGroup: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderLight,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator, marginLeft: Spacing.lg },
  faqRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.md,
  },
  faqChevron: {
    fontFamily: Typography.fonts.headingMed,
    fontSize: Typography.title3.fontSize,
    color: Colors.primary,
    width: 24,
    textAlign: 'center',
  },
  faqAnswer: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.callout.fontSize,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: Spacing.sm + 2,
  },
});
