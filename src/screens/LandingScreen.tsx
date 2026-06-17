import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Durations } from '@/theme/motion';
import ReAnimated from 'react-native-reanimated';
import NeonButton from '@/components/NeonButton';
import ScreenBackground from '@/components/ScreenBackground';
import AnalyzingHero from '@/components/AnalyzingHero';
import RoastIcon from '@/components/RoastIcon';
import { getScoreBand } from '@shared/scoring/bands.ts';
import { enterUp, useReducedMotion } from '@/components/motion';
import { trackFunnelStep } from '@/services/analytics';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'> };

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// "cooked" is rendered in the Cooked-band color — the one intentional non-accent
// hue on this screen (matches the score-band reference).
const COOKED = getScoreBand(0).color;

type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type IconComp = (p: { size?: number; color?: string }) => React.JSX.Element;
const ion = (name: IoniconsName): IconComp => (p) => <Ionicons name={name} {...p} />;
const mci = (name: MciName): IconComp => (p) => <MaterialCommunityIcons name={name} {...p} />;
const VALUE_PROPS: { Icon: IconComp; label: string }[] = [
  { Icon: mci('keyboard-outline'),     label: 'Type your finances' },
  { Icon: RoastIcon,                   label: 'Get roasted by AI' },
  { Icon: ion('speedometer-outline'),  label: 'See your score' },
  { Icon: ion('trending-up-outline'),  label: 'Fix your life' },
];

export default function LandingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [, setVisible] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      // Reduce Motion: present immediately, no entrance slide or CTA pulse.
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      setVisible(true);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: Durations.slow, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: Durations.slow, useNativeDriver: true }),
    ]).start(() => setVisible(true));

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: Durations.reveal, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: Durations.reveal, useNativeDriver: true }),
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
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* Hero headline */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.heroTitle}>
            Find out if your finances are <Text style={styles.heroAccent}>cooked</Text>
          </Text>
        </Animated.View>

        {/* Animated "analyzing" score hero — floats centered in the gap */}
        <Animated.View style={[styles.slot, { opacity: fadeAnim }]}>
          <AnalyzingHero />
        </Animated.View>

        {/* Value props — 2×2 card grid */}
        <View style={styles.grid}>
          {VALUE_PROPS.map((v, i) => (
            <ReAnimated.View key={i} entering={enterUp(i + 2)} style={styles.card}>
              <View style={styles.cardIcon}>
                <v.Icon size={20} color={Colors.accentSolid} />
              </View>
              <Text style={styles.cardLabel}>{v.label}</Text>
            </ReAnimated.View>
          ))}
        </View>

        {/* Conversion */}
        <Animated.View style={[styles.conversion, { opacity: fadeAnim }]}>
          <Text style={styles.micro}>
            3 days free <Text style={styles.microDot}>●</Text> Brutally honest{' '}
            <Text style={styles.microDot}>●</Text> Results in seconds
          </Text>
          <Animated.View style={{ width: '100%', transform: [{ scale: pulseAnim }] }}>
            <NeonButton label="Get Started" onPress={handleStart} glow />
          </Animated.View>
          <TouchableOpacity onPress={handleSignIn} style={styles.signInBtn} activeOpacity={0.7}>
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.xxl },
  heroTitle: {
    fontFamily: Typography.fonts.extrabold,
    fontSize: 38,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1.6,
    lineHeight: 40,
  },
  heroAccent: { color: COOKED },

  // Flexible slot pushes the value grid + conversion to the bottom while keeping
  // the analyzing card vertically centered in the space beneath the headline.
  slot: { flex: 1, justifyContent: 'center' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 3,
    marginBottom: Spacing.xl,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    padding: Spacing.md + 2,
    gap: Spacing.md,
  },
  cardIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: Colors.accentContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: {
    fontFamily: Typography.fonts.bodySemi,
    fontSize: 14,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },

  conversion: { alignItems: 'center' },
  micro: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 12.5,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
    marginBottom: Spacing.xxl,
    textAlign: 'center',
  },
  microDot: { color: Colors.textTertiary, fontSize: 9 },
  signInBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  signInText: {
    fontFamily: Typography.fonts.bodyMed,
    fontSize: 13.5,
    color: Colors.textSecondary,
  },
  signInBold: { fontFamily: Typography.fonts.heading, color: Colors.textPrimary, fontWeight: '700' },
});
