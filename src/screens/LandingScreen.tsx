import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import NeonButton from '@/components/NeonButton';
import ScreenBackground from '@/components/ScreenBackground';
import { trackFunnelStep } from '@/services/analytics';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'> };

const { width } = Dimensions.get('window');

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const HERO_LINES = [
  { text: 'Find out if your finances', emoji: '' },
  { text: 'are cooked.', emoji: '' },
];

const VALUE_PROPS: { icon: IoniconsName; title: string; desc: string }[] = [
  { icon: 'create-outline',    title: 'Type your finances', desc: 'Plain English. No spreadsheets.' },
  { icon: 'flame-outline',     title: 'Get roasted by AI',  desc: 'Brutally honest but never cruel.' },
  { icon: 'bar-chart-outline', title: 'See your score',     desc: '0–100 financial health rating.' },
  { icon: 'calendar-outline',  title: 'Fix your life',      desc: 'Personalized 90-day action plan.' },
];

export default function LandingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start(() => setVisible(true));

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const handleStart = () => {
    trackFunnelStep('landing_cta_clicked');
    navigation.navigate('Login', { mode: 'signup' });
  };

  const handleSignIn = () => {
    trackFunnelStep('landing_signin_clicked');
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <ScreenBackground variant="home" />
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xxl }]}>
        {/* Hero Section */}
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.heroPre}>Your bank account won't judge you.</Text>
          <View style={styles.heroTitleWrap}>
            {HERO_LINES.map((line, i) => (
              <View key={i} style={styles.heroLine}>
                <Text style={styles.heroTitle}>{line.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.heroSub}>
            Type your finances. Get an AI roast. See your score. Fix your life.
          </Text>
        </Animated.View>

        {/* Value Props */}
        <Animated.View style={[styles.values, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {VALUE_PROPS.map((v, i) => (
            <View key={i} style={styles.valueRow}>
              <View style={styles.valueIcon}>
                <Ionicons name={v.icon} size={22} color={Colors.primary} />
              </View>
              <View style={styles.valueText}>
                <Text style={styles.valueTitle}>{v.title}</Text>
                <Text style={styles.valueDesc}>{v.desc}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Social Proof */}
        <Animated.View style={[styles.socialProof, { opacity: fadeAnim }]}>
          <Text style={styles.socialProofText}>
            <Text style={styles.socialProofNum}>47,283</Text> people found out if they're broke
          </Text>
        </Animated.View>

        {/* CTA Buttons */}
        <Animated.View style={[styles.ctaWrap, { opacity: fadeAnim, transform: [{ scale: pulseAnim }] }]}>
          <NeonButton
            label="Get Started"
            onPress={handleStart}
            style={styles.ctaBtn}
          />
          <TouchableOpacity onPress={handleSignIn} style={styles.signInBtn} activeOpacity={0.7}>
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This app is for educational and entertainment purposes only and does not constitute financial advice.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.xl },
  hero: { marginBottom: Spacing.xxl },
  heroPre: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  heroTitleWrap: { marginBottom: Spacing.md },
  heroLine: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: 42,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  heroEmoji: { fontSize: 42, marginLeft: Spacing.sm },
  heroSub: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
  values: { gap: Spacing.md, marginBottom: Spacing.xl },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  valueIcon: {
    width: 44, height: 44, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  valueEmoji: { fontSize: Typography.title2.fontSize },
  valueText: { flex: 1 },
  valueTitle: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: Typography.callout.fontSize,
    color: Colors.textPrimary,
  },
  valueDesc: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.footnote.fontSize,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  socialProof: { alignItems: 'center', marginBottom: Spacing.xl },
  socialProofText: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.caption1.fontSize,
    color: Colors.textMuted,
  },
  socialProofNum: {
    fontFamily: Typography.fonts.headingSemi,
    color: Colors.primary,
  },
  ctaWrap: { gap: Spacing.md, marginBottom: Spacing.xl },
  ctaBtn: {},
  signInBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  signInText: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.callout.fontSize,
    color: Colors.textSecondary,
  },
  disclaimer: {
    fontFamily: Typography.fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
    paddingBottom: Spacing.lg,
  },
});
