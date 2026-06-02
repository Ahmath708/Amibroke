import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Central haptics wrapper so the Settings "Haptic Feedback" toggle actually gates
// every haptic in the app. Call sites use selection()/impact()/notify() instead of
// expo-haptics directly; each checks the persisted preference first.

const KEY = 'haptics_enabled';
let enabled = true; // in-memory mirror of the persisted setting

/** Load the persisted preference once on app start. */
export async function loadHapticsPref(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    enabled = v === null ? true : v === '1';
  } catch {
    enabled = true;
  }
  return enabled;
}

/** Persist + apply the preference (from the Settings toggle). */
export async function setHapticsEnabled(on: boolean): Promise<void> {
  enabled = on;
  try { await AsyncStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

export function getHapticsEnabled(): boolean { return enabled; }

export function selection() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}
export function impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  if (enabled) Haptics.impactAsync(style).catch(() => {});
}
export function notify(type: Haptics.NotificationFeedbackType) {
  if (enabled) Haptics.notificationAsync(type).catch(() => {});
}

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
