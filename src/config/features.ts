export const FEATURES = {
  CREATOR_DASHBOARD: process.env.EXPO_PUBLIC_FEATURE_CREATOR_DASHBOARD === 'true',

  // Hard paywall: once the 3-day free access expires and the user has no paid
  // plan, block the core surface (running a roast) — not just the premium tools.
  // Default OFF so QA isn't gated by an aged dev account and so this never ships
  // ahead of the server-side check; flip on with EXPO_PUBLIC_PAYWALL_ENFORCEMENT=true.
  // NOTE: client gating is bypassable — the edge functions (analyze, action-plan)
  // must enforce the same trial/entitlement rule before this is a real paywall.
  PAYWALL_ENFORCEMENT: process.env.EXPO_PUBLIC_PAYWALL_ENFORCEMENT === 'true',
};
