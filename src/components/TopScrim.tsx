import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/theme/colors';
import { SCREEN_VARIANTS, type ScreenVariant } from '@/theme/screenVariants';

interface Props {
  variant: ScreenVariant;
}

// Fixed top mask: a SOLID opaque block of the screen's base background over the status-bar strip
// (so the clock / wifi / battery always sit on an opaque background — scrolled content can't show
// through under them), with a short gradient fade just below it to blend into the content. Rendered
// as the LAST child of a screen so it layers above the ScrollView (no zIndex needed); inert to touch.
export default function TopScrim({ variant }: Props) {
  const insets = useSafeAreaInsets();
  const base = SCREEN_VARIANTS[variant].gradient[0];

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      {/* opaque status-bar strip */}
      <View style={{ height: insets.top, backgroundColor: base }} />
      {/* short fade into the scrolling content below */}
      <LinearGradient
        colors={[base, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ height: Spacing.lg }}
      />
    </View>
  );
}
