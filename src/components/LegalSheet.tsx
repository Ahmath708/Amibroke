import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/theme/colors';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '@/screens/TermsOfServiceScreen';

export type LegalDoc = 'privacy' | 'terms';

/**
 * Self-contained legal viewer. Renders the Privacy/Terms content inside a plain
 * RN <Modal> with its own Close button — deliberately NOT a native-stack screen.
 *
 * Why: pushing the legal pages as native-stack cards from the auth flow hit a
 * react-native-screens (New Architecture) defect where the 2nd legal screen opened
 * in a session had a dead back button (goBack no-op). A Modal + explicit Close
 * toggles plain state, so it can never get stuck and works identically in the auth
 * and app contexts.
 */
export default function LegalSheet({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={doc !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + Spacing.sm }]}>
          <Text style={styles.title}>{doc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={hit} style={styles.closeBtn} accessibilityLabel="Close">
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {doc === 'privacy' && <PrivacyPolicyScreen />}
          {doc === 'terms' && <TermsOfServiceScreen />}
        </View>
      </View>
    </Modal>
  );
}

const hit = { top: 12, bottom: 12, left: 12, right: 12 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingBottom: Spacing.sm, paddingHorizontal: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator,
  },
  title: {
    fontFamily: Typography.fonts.headingSemi, fontSize: 17, color: Colors.textPrimary,
  },
  closeBtn: { position: 'absolute', right: Spacing.lg, bottom: Spacing.sm },
  closeText: { fontSize: Typography.title2.fontSize, color: Colors.accent, fontWeight: '400' },
  body: { flex: 1 },
});
