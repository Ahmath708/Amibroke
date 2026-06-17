import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { StyleSheet, Pressable, TextInput, TextInputProps, View } from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, interpolateColor, useReducedMotion,
} from 'react-native-reanimated';
import AppTextInput from '@/components/AppTextInput';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';
import { Durations, Easings } from '@/theme/motion';

// Claude Design field: a solid card with a floating label (the label IS the placeholder — resting
// centered, floating up + shrinking on focus or when there's a value) and a neon focus border + glow.
// Transform-only label animation (UI thread → true 60fps); border/glow interpolated on focus.
const CARD_H = 60;                                   // matches the reference field height
const INPUT_FONT = 16;
const FLOAT_TY = -12;                                // lift the (vertically-centered) label toward the top (kept a touch lower than dead-top)
const FLOAT_SCALE = 0.78;                            // floated label ≈ 12.5px

interface Props extends TextInputProps {
  /** Acts as the placeholder when empty/unfocused; floats up on focus or when there's a value. */
  label: string;
  /** Red border + red floated label (the field's inline-error state). */
  error?: boolean;
  /** e.g. a password show/hide toggle, pinned right and vertically centered. */
  rightAccessory?: React.ReactNode;
  /** Only reveal the accessory once the label has floated (focus or value) — e.g. the password eye. */
  hideAccessoryUntilFloated?: boolean;
}

/**
 * Floating-label text field (filled style): the label is the placeholder, resting centered and floating
 * to the top-left on focus or value. A persistent `Text` (never the native placeholder, so it never
 * disappears). Accent border + soft glow on focus, optional float-gated accessory. Snaps under
 * reduce-motion. Branded caret via AppTextInput.
 */
const FloatingLabelInput = forwardRef<TextInput, Props>(
  ({ label, error, rightAccessory, hideAccessoryUntilFloated, value, onFocus, onBlur, style, ...rest }, ref) => {
    const reduce = useReducedMotion();
    const [focused, setFocused] = useState(false);
    const floated = focused || !!value;
    const f = useSharedValue(floated ? 1 : 0);   // drives the label transform + float-gated accessory
    const focusV = useSharedValue(0);             // drives the border + glow (focus only)
    const innerRef = useRef<TextInput | null>(null);

    const setRefs = (node: TextInput | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<TextInput | null>).current = node;
    };

    // Claude Design uses `transition .2s cubic-bezier(.4,0,.2,1)` — that curve is our Easings.sharp
    // (standard in/out). Transform + color animate together on the UI thread so the lift reads smooth.
    useEffect(() => {
      const to = floated ? 1 : 0;
      f.value = reduce ? to : withTiming(to, { duration: Durations.fast, easing: Easings.sharp });
    }, [floated, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      const to = focused ? 1 : 0;
      focusV.value = reduce ? to : withTiming(to, { duration: Durations.fast, easing: Easings.sharp });
    }, [focused, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

    // The wrapper is flex-centered in the field (true vertical center, like the reference's top:50%),
    // and lifts toward the top on float; the text scales + recolors. Split so centering is robust.
    const labelWrapStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: interpolate(f.value, [0, 1], [0, FLOAT_TY]) }],
    }));
    const labelTextStyle = useAnimatedStyle(() => {
      const restColor = interpolateColor(f.value, [0, 1], [Colors.textSecondary, Colors.textTertiary]);
      return {
        transform: [{ scale: interpolate(f.value, [0, 1], [1, FLOAT_SCALE]) }],
        color: error ? Colors.danger : interpolateColor(focusV.value, [0, 1], [restColor, Colors.accentSolid]),
      };
    });

    const cardStyle = useAnimatedStyle(() => ({
      borderColor: error
        ? Colors.danger
        : interpolateColor(focusV.value, [0, 1], [Colors.glassBorder, Colors.accentSolid]),
      shadowOpacity: error ? 0 : focusV.value * 0.35,
    }));

    return (
      <ReAnimated.View style={[styles.card, cardStyle, style]}>
        {/* Tap anywhere in the card focuses the input. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => innerRef.current?.focus()} />
        <ReAnimated.View style={[styles.labelWrap, labelWrapStyle]} pointerEvents="none">
          <ReAnimated.Text style={[styles.label, labelTextStyle]} numberOfLines={1}>
            {label}
          </ReAnimated.Text>
        </ReAnimated.View>
        <AppTextInput
          ref={setRefs}
          value={value}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[styles.input, rightAccessory ? styles.inputWithAccessory : null]}
          {...rest}
        />
        {rightAccessory && (floated || !hideAccessoryUntilFloated) ? (
          <View style={styles.accessory}>{rightAccessory}</View>
        ) : null}
      </ReAnimated.View>
    );
  },
);

FloatingLabelInput.displayName = 'FloatingLabelInput';
export default FloatingLabelInput;

const styles = StyleSheet.create({
  card: {
    height: CARD_H,
    borderRadius: Radius.xl,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
    // Focus glow (shadowOpacity animated by focusV; no overflow:hidden so it shows).
    shadowColor: Colors.accentSolid,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  // Fills the field and centers the label vertically (resting placeholder), then translateY lifts it.
  labelWrap: {
    position: 'absolute', left: 17, right: 17, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'flex-start',
  },
  label: {
    fontFamily: Typography.fonts.bodyMed, fontSize: INPUT_FONT,
    letterSpacing: -0.2,
    transformOrigin: 'left center', // scale shrinks toward the left edge — no horizontal drift
  },
  // Sit the input in the LOWER portion of the card (like the reference's top:28) so the typed text +
  // caret clear the floated label — not a centered fill, which floats the caret up near the label.
  input: {
    position: 'absolute', left: 17, right: 17, top: 27, bottom: 5,
    fontFamily: Typography.fonts.bodyMed, fontSize: INPUT_FONT, color: Colors.textPrimary,
    letterSpacing: -0.2, padding: 0,
  },
  inputWithAccessory: { right: 50 }, // clear the right accessory (eye toggle)
  accessory: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 40, alignItems: 'center', justifyContent: 'center' },
});
