import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-local-authentication is a NATIVE module. We require it lazily + defensively so
// the app never crashes on a build that predates the native rebuild — every call just
// resolves to "biometrics unavailable" until `npx expo run:ios` includes the module.
let cached: any;
function LA(): any {
  if (cached !== undefined) return cached;
  try { cached = require('expo-local-authentication'); } catch { cached = null; }
  return cached;
}

const KEY = 'biometric_lock_enabled';

/** True only when the device has biometric hardware AND the user has enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  const la = LA();
  if (!la) return false;
  try {
    return (await la.hasHardwareAsync()) && (await la.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Prompt Face ID / Touch ID (with device-passcode fallback). Returns true on success. */
export async function authenticate(reason = 'Unlock Am I Broke?'): Promise<boolean> {
  const la = LA();
  if (!la) return false;
  try {
    const res = await la.authenticateAsync({ promptMessage: reason });
    return !!res?.success;
  } catch {
    return false;
  }
}

export async function isLockEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) === '1'; } catch { return false; }
}

export async function setLockEnabled(on: boolean): Promise<void> {
  try { await AsyncStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
}
