// Centralized brand strings — one source for the domain, support email, and App
// Store URL so they can't drift across screens (and the placeholder store ID
// can't be silently forgotten at release).
export const BRAND = {
  name: 'Am I Broke?',
  // NOTE: the marketing domain (aibroke.app) and support email host (amibroke.app)
  // currently differ — confirm which is canonical before launch.
  domain: 'aibroke.app',
  supportEmail: 'support@amibroke.app',
  // TODO(release): replace the placeholder App Store ID before shipping.
  appStoreUrl: 'https://apps.apple.com/app/am-i-broke/id123456789',
} as const;
