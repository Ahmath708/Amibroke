import type { ComponentType } from 'react';
import { HeartIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon, ArrowTrendingUpIcon } from 'react-native-heroicons/outline';
import RoastIcon from '@/components/RoastIcon';
import type { RoastTone } from '@/types';

export type ToneOption = {
  key: RoastTone;
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  /** A one-line roast in this voice — shown on the Profile voice-card picker so you can hear it before picking. */
  sample: string;
};

/**
 * Single source of truth for the roast voices. Both the RoastComposer tone chips and the Profile
 * "Roast Voice" picker (RoastVoiceScreen) read this — keep labels/keys in sync with `profiles.preferred_tone`.
 */
export const TONES: ToneOption[] = [
  { key: 'savage',        label: 'Savage',      icon: RoastIcon,                sample: 'Your checking account is a crime scene and you’re the only suspect.' },
  { key: 'gentle',        label: 'Gentle',      icon: HeartIcon,                sample: 'You’re not broke — you’re early in the glow-up. Let’s keep going.' },
  { key: 'therapist',     label: 'Therapist',   icon: ChatBubbleLeftRightIcon,  sample: 'Let’s gently sit with what that purchase was really about.' },
  { key: 'older_sibling', label: 'Big Sibling', icon: ShieldCheckIcon,          sample: 'Put the card down till payday. I’ve got you — trust me.' },
  { key: 'finance_bro',   label: 'Finance Bro', icon: ArrowTrendingUpIcon,      sample: 'Bro. That daily latte is a Roth IRA in disguise. Lock in.' },
];
