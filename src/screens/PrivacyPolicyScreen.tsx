import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import ScreenBackground from '@/components/ScreenBackground';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScreenBackground variant="info" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.lastUpdated}>Last Updated: May 2026</Text>

      <Text style={styles.paragraph}>
        Am I Broke? ("we," "our," or "us") is committed to protecting your privacy. This Privacy
        Policy explains how we collect, use, and safeguard your information when you use our
        application.
      </Text>

      <Text style={styles.heading}>1. Information We Collect</Text>
      <Text style={styles.paragraph}>
        We collect minimal data by design. When you use Am I Broke?, you provide financial
        information through free-form text input (income, expenses, debts). This data is sent to our
        AI provider (Anthropic) to generate your financial analysis. We do not permanently store your
        raw financial input unless you explicitly create an account and save your results.
      </Text>
      <Text style={styles.paragraph}>
        If you create an account, we store: your email address (if provided), your saved analysis
        snapshots (score, breakdown, action plan), and your subscription status. We never store your
        raw bank account numbers, Social Security numbers, or any government-issued identifiers.
      </Text>

      <Text style={styles.heading}>2. How We Use Your Information</Text>
      <Text style={styles.paragraph}>
        Your data is used solely to: generate your financial health score and analysis, improve our
        AI prompts and product features (using anonymized aggregate data), process payments through
        Stripe (we never see your full payment details), and send occasional product updates if you
        have an account.
      </Text>

      <Text style={styles.heading}>3. Data Sharing</Text>
      <Text style={styles.paragraph}>
        We do not sell your personal information. Your financial data is shared with Anthropic (our
        AI provider) solely for the purpose of generating your analysis. Anthropic processes data in
        accordance with their own privacy policy and does not use your data for model training. We
        may share anonymized, aggregate data (e.g., "average user score is 42") publicly for product
        improvement and marketing. No individual user can be identified from this data.
      </Text>

      <Text style={styles.heading}>4. Data Retention</Text>
      <Text style={styles.paragraph}>
        If you do not create an account, your financial input and results are ephemeral and not
        stored on our servers. If you create an account, your data is retained until you delete your
        account. You can request data deletion at any time by contacting us or using the Delete
        Account feature in Settings.
      </Text>

      <Text style={styles.heading}>5. Security</Text>
      <Text style={styles.paragraph}>
        All data transmitted between our app and servers is encrypted using TLS 1.3. We follow
        industry best practices for data security, including limited access controls and regular
        security reviews. However, no method of electronic storage is 100% secure, and we cannot
        guarantee absolute security.
      </Text>

      <Text style={styles.heading}>6. Third-Party Services</Text>
      <Text style={styles.paragraph}>
        We use the following third-party services: Anthropic (Claude API) for AI analysis, Stripe for
        payment processing, and Supabase for database and authentication. Each service has its own
        privacy policy governing data handling.
      </Text>

      <Text style={styles.heading}>7. Your Rights</Text>
      <Text style={styles.paragraph}>
        You have the right to: access your personal data stored on our servers, request correction or
        deletion of your data, withdraw consent for data processing at any time, and export your data
        in a portable format. To exercise these rights, contact us through the app or email
        privacy@amibroke.app.
      </Text>

      <Text style={styles.heading}>8. Children's Privacy</Text>
      <Text style={styles.paragraph}>
        Am I Broke? is not intended for users under the age of 13. We do not knowingly collect
        information from children under 13. If we discover that a child under 13 has provided us with
        personal information, we will delete it immediately.
      </Text>

      <Text style={styles.heading}>9. Changes to This Policy</Text>
      <Text style={styles.paragraph}>
        We may update this Privacy Policy from time to time. We will notify users of material changes
        through the app or via email if you have an account. Continued use of the app after changes
        constitutes acceptance of the updated policy.
      </Text>

      <Text style={styles.heading}>10. Contact</Text>
      <Text style={styles.paragraph}>
        For privacy-related inquiries, contact us at privacy@amibroke.app.
      </Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  lastUpdated: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.footnote.fontSize,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
  },
  heading: {
    fontFamily: Typography.fonts.headingSemi,
    fontSize: 18,
    color: Colors.textPrimary,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
});
