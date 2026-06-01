import React, { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { Colors } from '@/theme/colors';

/**
 * App-wide TextInput with a branded caret + selection color (the same electric
 * purple as the Home typewriter). Use this everywhere instead of RN's TextInput so
 * the cursor/selection is consistent. Defaults are overridable via props.
 *
 * - iOS: `selectionColor` tints the caret + the selection highlight.
 * - Android: `cursorColor` tints the caret; `selectionColor` the selection.
 */
const CARET = Colors.primarySolid; // #bd00ff

const AppTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => (
  <TextInput ref={ref} selectionColor={CARET} cursorColor={CARET} {...props} />
));

AppTextInput.displayName = 'AppTextInput';
export default AppTextInput;
