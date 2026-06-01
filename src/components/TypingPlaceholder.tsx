import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme/colors';

interface TypingPlaceholderProps {
  placeholders: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  style?: object;
  /** Override the text/cursor font metrics (e.g. to match the host TextInput exactly). */
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
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, [displayText, isDeleting, isPaused, currentIndex, placeholders, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.text, textStyle]}>
        {displayText}
        <Text style={[styles.cursor, textStyle, { color: Colors.primary, opacity: isPaused ? 0.3 : 1 }]}>|</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 24,
  },
  text: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  cursor: {
    fontFamily: Typography.fonts.body,
    fontSize: Typography.subhead.fontSize,
    color: Colors.primary,
    fontWeight: '300',
  },
});
