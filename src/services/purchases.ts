import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import type { SubscriptionTier } from './subscriptions';

// Entitlement identifiers as configured in the RevenueCat dashboard.
// These are NOT App Store product IDs — RevenueCat maps products → entitlements.
export const ENTITLEMENT_ACTION_PLAN = 'action_plan';
export const ENTITLEMENT_DEEP_DIVE = 'deep_dive';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let configured = false;

function apiKey(): string | undefined {
  return Platform.OS === 'android' ? ANDROID_KEY : IOS_KEY;
}

/** True once RevenueCat has been configured with a real key on a supported platform. */
export function isPurchasesConfigured(): boolean {
  return configured;
}

/**
 * Configure RevenueCat once at app startup. No-ops safely (leaving the app on
 * the free tier) when there's no key yet or on web, so the app keeps running
 * before the RevenueCat/App Store setup is complete.
 */
export function configurePurchases(appUserID?: string): void {
  if (configured || Platform.OS === 'web') return;
  const key = apiKey();
  if (!key || key.includes('your_revenuecat')) {
    console.warn('[purchases] RevenueCat key not set — IAP disabled, treating as free tier.');
    return;
  }
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.INFO : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key, appUserID });
    configured = true;
  } catch (e) {
    console.warn('[purchases] configure failed:', e);
  }
}

/** Align the RevenueCat app-user-id with the Supabase user id (so webhooks map back). */
export async function loginPurchases(userId: string): Promise<void> {
  if (!configured || !userId) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('[purchases] logIn failed:', e);
  }
}

export async function logoutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('[purchases] logOut failed:', e);
  }
}

/** The current offering's packages to display on the paywall, or null if unavailable. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn('[purchases] getOfferings failed:', e);
    return null;
  }
}

export interface PurchaseResult {
  customerInfo: CustomerInfo | null;
  cancelled: boolean;
  error?: string;
}

/** Trigger Apple's native purchase sheet for a package. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!configured) return { customerInfo: null, cancelled: false, error: 'Purchases not available.' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, cancelled: false };
  } catch (e: any) {
    if (e?.userCancelled) return { customerInfo: null, cancelled: true };
    console.warn('[purchases] purchase failed:', e);
    return { customerInfo: null, cancelled: false, error: e?.message ?? 'Purchase failed.' };
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    console.warn('[purchases] restore failed:', e);
    return null;
  }
}

/** Open the OS-native "manage subscriptions" screen (App Store / Play). */
export async function manageSubscriptions(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.showManageSubscriptions();
  } catch (e) {
    console.warn('[purchases] showManageSubscriptions failed:', e);
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[purchases] getCustomerInfo failed:', e);
    return null;
  }
}

/** Subscribe to entitlement changes (e.g. after a purchase or renewal). Returns an unsubscribe fn. */
export function addCustomerInfoListener(cb: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => Purchases.removeCustomerInfoUpdateListener(cb);
}

/**
 * Find the package in an offering that corresponds to a tier. Matches the
 * RevenueCat package identifier or product identifier against the tier name
 * (e.g. configure packages 'action_plan' / 'deep_dive' in the dashboard).
 */
export function packageForTier(
  offering: PurchasesOffering | null,
  tier: 'action_plan' | 'deep_dive',
): PurchasesPackage | null {
  if (!offering) return null;
  return (
    offering.availablePackages.find(
      (p) =>
        p.identifier === tier ||
        p.product.identifier.toLowerCase().includes(tier),
    ) ?? null
  );
}

/** Map RevenueCat entitlements → our app tier. Deep Dive supersedes Action Plan. */
export function tierFromCustomerInfo(info: CustomerInfo | null): SubscriptionTier {
  if (!info) return 'free';
  const active = info.entitlements.active;
  if (active[ENTITLEMENT_DEEP_DIVE]) return 'deep_dive';
  if (active[ENTITLEMENT_ACTION_PLAN]) return 'action_plan';
  return 'free';
}
