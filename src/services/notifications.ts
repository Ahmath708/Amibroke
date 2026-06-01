/**
 * Local notifications for the monthly check-in reminder.
 *
 * Uses expo-notifications to schedule a single local (no server / no APNs) reminder
 * at the next check-in anchor date. The user opts in via Settings; the enabled flag
 * is persisted so the schedule survives restarts. Tapping the reminder routes to the
 * check-in screen (see the response listener wired in App.tsx).
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'checkin_reminder_enabled';
export const CHECKIN_NOTIFICATION_SCREEN = 'MonthlyCheckIn';

// Show the banner even if the app is foregrounded when it fires.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (e) {
    console.warn('[notifications] permission request failed:', e);
    return false;
  }
}

/** Cancel any previously scheduled check-in reminder(s). */
export async function cancelCheckinReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => (n.content.data as any)?.screen === CHECKIN_NOTIFICATION_SCREEN)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch (e) {
    console.warn('[notifications] cancel failed:', e);
  }
}

/** Replace any existing check-in reminder with one at `date` (no-op if date is null/past). */
export async function scheduleCheckinReminder(date: Date | null): Promise<string | null> {
  await cancelCheckinReminders();
  if (!date || date.getTime() <= Date.now()) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your monthly check-in 📅',
        body: 'Update your numbers and see how your money moved this month.',
        data: { screen: CHECKIN_NOTIFICATION_SCREEN },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  } catch (e) {
    console.warn('[notifications] schedule failed:', e);
    return null;
  }
}

export async function getCheckinReminderEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true'; } catch { return false; }
}

export async function setCheckinReminderEnabledFlag(enabled: boolean): Promise<void> {
  try { await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false'); } catch { /* noop */ }
}
