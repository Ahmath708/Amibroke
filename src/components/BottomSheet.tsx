import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, useAnimatedRef, useAnimatedKeyboard,
  withTiming, withSpring, runOnJS, clamp, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Durations, Springs } from '@/theme/motion';

// How far (px) or how fast (px/s) a downward drag must reach to dismiss instead of snap back.
const CLOSE_DISTANCE_RATIO = 0.28; // of the sheet's own height
const CLOSE_VELOCITY = 900;

interface Props {
  /** Controlled visibility. Parent flips this; the sheet animates itself in/out. */
  visible: boolean;
  /** Called once the close animation finishes (or immediately under reduce-motion). */
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title rendered in the grabber header. Skip it when the content has its own heading. */
  title?: string;
  /** Fraction of screen height: the fixed height when scrollable, else the max cap. Default 0.85. */
  heightFraction?: number;
  /** Wrap children in a scrollable body (default true). Set false for short, fixed content. */
  scrollable?: boolean;
  /**
   * Hug the content's height instead of filling `heightFraction` (capped at heightFraction).
   * Defaults to true when `!scrollable` — short sheets (confirms, small pickers) shouldn't
   * render as a tall, mostly-empty panel.
   */
  fitContent?: boolean;
  /**
   * Only the grabber/header drags the sheet down — the body keeps its own gestures untouched.
   * Use for content with its own vertical gesture (a date wheel, a list) that the dismiss-pan
   * would otherwise fight.
   */
  dragHandleOnly?: boolean;
  /**
   * Lift the sheet to sit above the keyboard when an input inside it focuses (default true).
   * Set false to let the keyboard overlap the sheet — e.g. a search list, where results should
   * stay put and a few leak above the keyboard rather than the whole sheet jumping up.
   */
  avoidKeyboard?: boolean;
}

/**
 * Reusable bottom sheet — slides up over a dimmed backdrop, with a drag-handle indicator,
 * tap-outside-to-close, and swipe-down-to-dismiss (velocity-aware). When `scrollable`, the
 * body owns a ScrollView and the sheet only drags down once the list is scrolled to the top
 * (so scrolling and dismissing don't fight). When `fitContent`, the sheet hugs its content
 * (good for confirms/pickers). Lifts above the keyboard when an input inside it focuses.
 * Honors reduce-motion (snaps, no slide).
 *
 * Mounting is self-managed: the parent toggles `visible`; the Modal stays alive through the
 * close animation, then `onClose` fires.
 */
export default function BottomSheet({
  visible, onClose, children, title, heightFraction = 0.85, scrollable = true, fitContent, dragHandleOnly,
  avoidKeyboard = true,
}: Props) {
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const { height: screenH } = useWindowDimensions();
  const sheetH = Math.round(screenH * heightFraction); // fixed height (scrollable) or the max cap (fitContent)
  const fit = fitContent ?? !scrollable;

  const [mounted, setMounted] = useState(false); // keeps the Modal alive through the exit animation
  // `closeY` = how far down to translate to sit fully off-screen = the sheet's rendered height.
  // Fixed height → sheetH; fit-content → measured via onLayout (seeded to screenH so it starts off-screen).
  const closeY = useSharedValue(fit ? screenH : sheetH);
  const translateY = useSharedValue(fit ? screenH : sheetH); // 0 = open, closeY = closed
  const scrollY = useSharedValue(0);
  const scrollRef = useAnimatedRef<ReAnimated.ScrollView>();
  const closingRef = useRef(false);

  // Mount when asked to show.
  useEffect(() => {
    if (visible) { closingRef.current = false; setMounted(true); }
  }, [visible]);

  // Animate up once mounted.
  useEffect(() => {
    if (!mounted) return;
    translateY.value = closeY.value; // start below the screen
    translateY.value = reduce ? 0 : withTiming(0, { duration: Durations.normal, easing: Easing.out(Easing.cubic) });
  }, [mounted, reduce]);

  const finishClose = () => { setMounted(false); onClose(); };

  // Slide out, then unmount + notify. Idempotent (a flung + tapped close won't double-fire).
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (reduce) { finishClose(); return; }
    translateY.value = withTiming(closeY.value, { duration: Durations.fast, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(finishClose)();
    });
  };

  // Drive `visible=false` from the parent → animate out.
  useEffect(() => {
    if (!visible && mounted) close();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure content height in fit mode so the close translate + backdrop math track the real height.
  const onSheetLayout = (e: LayoutChangeEvent) => {
    if (fit) closeY.value = e.nativeEvent.layout.height;
  };

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Pan on the whole sheet. Only translate it down when the body is at the top and the user is
  // pulling down — otherwise the inner ScrollView keeps the gesture. Runs simultaneously with the
  // scroll's native gesture so the handoff at the top edge is seamless.
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(scrollRef as any)
    .onUpdate((e) => {
      'worklet';
      const atTop = scrollY.value <= 0;
      if (e.translationY > 0 && atTop) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      const shouldClose = translateY.value > closeY.value * CLOSE_DISTANCE_RATIO || e.velocityY > CLOSE_VELOCITY;
      if (shouldClose) {
        translateY.value = withTiming(closeY.value, { duration: Durations.fast, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) runOnJS(finishClose)();
        });
      } else {
        translateY.value = withSpring(0, Springs.gentle);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - clamp(translateY.value / closeY.value, 0, 1),
  }));
  // Clamp ≥ 0 so a spring settle can't lift the sheet above rest and reveal a gap; lift by the
  // keyboard height so a focused input inside the sheet stays visible above the keyboard.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, translateY.value) - (avoidKeyboard ? keyboard.height.value : 0) }],
  }));

  const Body = scrollable ? (
    <ReAnimated.ScrollView
      ref={scrollRef}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      bounces={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.xxl }]}
    >
      {children}
    </ReAnimated.ScrollView>
  ) : (
    <View style={[styles.body, !fit && styles.fill, { paddingBottom: insets.bottom + Spacing.xl }]}>{children}</View>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.handle} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );

  // dragHandleOnly: pan attaches to the grabber alone so the body's own gestures (wheel/list) are
  // untouched. Otherwise the pan covers the whole sheet — gated to scroll-top in the worklet so a
  // ScrollView keeps mid-scroll drags.
  const inner = dragHandleOnly ? (
    <View style={!fit && styles.fill}>
      <GestureDetector gesture={pan}>{header}</GestureDetector>
      {Body}
    </View>
  ) : (
    <GestureDetector gesture={pan}>
      <View style={!fit && styles.fill}>
        {header}
        {Body}
      </View>
    </GestureDetector>
  );

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <ReAnimated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        {/* Outer wrapper carries the soft accent glow — it must NOT clip (no overflow:hidden),
            so the shadow can spill past the top edge. The inner sheet does the rounded-corner
            clipping of the content. */}
        <ReAnimated.View
          onLayout={onSheetLayout}
          style={[styles.sheetWrap, fit ? { maxHeight: sheetH } : { height: sheetH }, sheetStyle]}
        >
          <View style={[styles.sheet, !fit && styles.fill]}>{inner}</View>
        </ReAnimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  // Glow wrapper — same bg + top radius as the inner sheet (iOS needs an opaque, rounded layer
  // to cast a shaped shadow), but NOT clipped, so the accent glow spills past the top edge.
  sheetWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.backgroundTertiary,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    shadowColor: Colors.accentSolid,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.22, shadowRadius: 14,
    elevation: 12,
  },
  sheet: {
    // Elevated surface — deliberately LIGHTER than the app background so the sheet reads as
    // floating above the dimmed backdrop (groupedBackground is darker and blended in).
    backgroundColor: Colors.backgroundTertiary,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderLight,
    overflow: 'hidden',
  },
  // The drag-handle region — generous hit area so the grabber is easy to catch.
  header: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  handle: { width: 40, height: 5, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.32)' },
  title: {
    fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize,
    color: Colors.textPrimary, marginTop: Spacing.sm,
  },
  body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
