import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList,
  TouchableOpacity, Animated, ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme/colors';
import NeonButton from '../components/NeonButton';

const { width } = Dimensions.get('window');

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'> };

const SLIDES = [
  {
    emoji: '🧠',
    title: 'Describe your finances\nin plain English',
    body: 'No spreadsheets. No jargon. Just tell us what\'s going on like you\'re texting a friend.',
    gradient: ['#1a0026', '#19101c'] as [string, string],
  },
  {
    emoji: '⚡',
    title: 'Get an AI-powered\nfinancial roast',
    body: 'Claude scores your financial health 0–100 and tells you exactly where you\'re bleeding money.',
    gradient: ['#001a26', '#19101c'] as [string, string],
  },
  {
    emoji: '🎯',
    title: 'A 90-day plan to\nstop being broke',
    body: 'Personalized weekly actions, debt payoff strategies, and subscription audits. No fluff.',
    gradient: ['#1a0010', '#19101c'] as [string, string],
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <LinearGradient colors={['#19101c', '#1a0a30']} style={styles.container}>
      {/* Skip */}
      <TouchableOpacity
        onPress={() => navigation.replace('Home')}
        style={[styles.skipBtn, { top: insets.top + 12 }]}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <LinearGradient colors={item.gradient} style={styles.emojiCard}>
              <Text style={styles.slideEmoji}>{item.emoji}</Text>
            </LinearGradient>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [6, 22, 6], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, opacity, backgroundColor: Colors.primary }]}
            />
          );
        })}
      </View>

      {/* CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <NeonButton
          label={activeIndex < SLIDES.length - 1 ? 'Continue' : 'Get Started'}
          onPress={goNext}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: 'absolute',
    right: Spacing.xl,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: { fontFamily: Typography.fonts.body, fontSize: 15, color: Colors.textSecondary },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
  },
  emojiCard: {
    width: 140,
    height: 140,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    shadowColor: Colors.primarySolid,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  slideEmoji: { fontSize: 56 },
  slideTitle: {
    fontFamily: Typography.fonts.heading,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  slideBody: {
    fontFamily: Typography.fonts.body,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  dotsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 28 },
  dot: { height: 6, borderRadius: Radius.pill },
  footer: { paddingHorizontal: Spacing.xl },
});
