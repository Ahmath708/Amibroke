import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, View, Animated, Easing } from 'react-native';
import { Colors, Typography } from '@/theme/colors';
import { useReducedMotion } from '@/components/motion';

interface TypingPlaceholderProps {
  placeholders: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  style?: object;
  /** Override the text font metrics (e.g. to match the host TextInput exactly). */
  textStyle?: object;
}

export default function TypingPlaceholder({
  placeholders,
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseDuration = 2000,
  style,
  textStyle,
}: TypingPlaceholderProps) {
  const reduce = useReducedMotion();
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Caret position, measured from the last line of the (possibly wrapped) text so the bar sits at
  // the end of the typed text, not the end of the block.
  const [caret, setCaret] = useState({ x: 0, y: 0, h: 24 });
  const caretOpacity = useRef(new Animated.Value(1)).current;

  // Native-style caret: a thin bar that holds solid, fades out, holds off, fades in (~1.06s — the
  // macOS/iOS caret blink rate).
  useEffect(() => {
    if (reduce) { caretOpacity.setValue(0); return; } // reduce-motion: static placeholder, no caret blink
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(420),
      Animated.timing(caretOpacity, { toValue: 0, duration: 160, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(320),
      Animated.timing(caretOpacity, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [caretOpacity, reduce]);

  useEffect(() => {
    if (reduce) {
      // Reduce Motion: show the first example statically — no typing/cycling (info preserved).
      if (displayText !== (placeholders[0] ?? '')) setDisplayText(placeholders[0] ?? '');
      return;
    }
    const currentPlaceholder = placeholders[currentIndex];

    function tick() {
      if (isPaused) {
        timeoutRef.current = setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, pauseDuration);
        return;
      }

      if (!isDeleting && displayText.length < currentPlaceholder.length) {
        setDisplayText(currentPlaceholder.slice(0, displayText.length + 1));
        timeoutRef.current = setTimeout(tick, typingSpeed + Math.random() * 30);
      } else if (!isDeleting && displayText.length === currentPlaceholder.length) {
        setIsPaused(true);
      } else if (isDeleting && displayText.length > 0) {
        setDisplayText(displayText.slice(0, -1));
        timeoutRef.current = setTimeout(tick, deletingSpeed);
      } else if (isDeleting && displayText.length === 0) {
        setIsDeleting(false);
        setCurrentIndex((prev) => (prev + 1) % placeholders.length);
      }
    }

    timeoutRef.current = setTimeout(tick, typingSpeed + Math.random() * 30);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [displayText, isDeleting, isPaused, currentIndex, placeholders, typingSpeed, deletingSpeed, pauseDuration, reduce]);

  const caretH = caret.h; // the native caret spans the full line height — match it
  return (
    <View style={[styles.container, style]}>
      <Text
        style={[styles.text, textStyle]}
        onTextLayout={(e) => {
          const lines = e.nativeEvent.lines;
          if (lines.length) {
            const last = lines[lines.length - 1];
            setCaret({ x: last.x + last.width, y: last.y, h: last.height });
          }
        }}
      >
        {displayText || ' '}
      </Text>
      <Animated.View
        pointerEvents="none"
        style={[styles.caret, { left: caret.x, top: caret.y + (caret.h - caretH) / 2, height: caretH, opacity: caretOpacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', minHeight: 24 },
  text: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  // Caret bar — width/color match AppTextInput's native caret (CARET = accentSolid).
  caret: { position: 'absolute', width: 2, borderRadius: 1, backgroundColor: Colors.accentSolid },
});
