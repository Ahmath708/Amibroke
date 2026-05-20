import { PostHog } from 'posthog-react-native';

let posthog: PostHog | null = null;

export function getPostHog(): PostHog | null {
  return posthog;
}

export async function initAnalytics(apiKey?: string, host?: string): Promise<PostHog | null> {
  if (posthog) return posthog;

  const key = apiKey || process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  if (!key) {
    console.warn('[analytics] PostHog API key not set. Analytics disabled.');
    return null;
  }

  try {
    posthog = new PostHog(key, {
      host: host || process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 10,
      flushInterval: 30,
    });
    return posthog;
  } catch (e) {
    console.error('[analytics] Failed to initialize PostHog:', e);
    return null;
  }
}

export async function identifyUser(userId: string, properties?: Record<string, string | number | boolean | null>) {
  if (!posthog) return;
  try {
    posthog.identify(userId, properties);
  } catch (e) {
    console.error('[analytics] identifyUser error:', e);
  }
}

export async function trackEvent(event: string, properties?: Record<string, string | number | boolean | null>) {
  if (!posthog) return;
  try {
    posthog.capture(event, properties);
  } catch (e) {
    console.error('[analytics] trackEvent error:', e);
  }
}

export async function trackScreenView(screenName: string) {
  await trackEvent('$screen', { $screen_name: screenName });
}

export async function trackSnapshotGenerated(
  score: number,
  scoreLabel: string,
  tone: string,
  inputLength: number,
) {
  await trackEvent('snapshot_generated', {
    score,
    score_label: scoreLabel,
    tone,
    input_length: inputLength,
  });
}

export async function trackShareInitiated(platform: string, score: number) {
  await trackEvent('share_initiated', { platform, score });
}

export async function trackShareCompleted(platform: string) {
  await trackEvent('share_completed', { platform });
}

export async function trackPaywallViewed(tier: string) {
  await trackEvent('paywall_viewed', { tier });
}

export async function trackPurchaseInitiated(productId: string, amount: number) {
  await trackEvent('purchase_initiated', { product_id: productId, amount });
}

export async function trackPurchaseCompleted(productId: string, amount: number) {
  await trackEvent('purchase_completed', { product_id: productId, amount });
}

export async function trackPurchaseFailed(productId: string, reason: string) {
  await trackEvent('purchase_failed', { product_id: productId, reason });
}

export async function trackRoastGenerated(tone: string, roastLength: number) {
  await trackEvent('roast_generated', { tone, roast_length: roastLength });
}

export async function trackCommunityPostShared(score: number) {
  await trackEvent('community_post_shared', { score });
}

export async function trackActionPlanViewed(stepsCount: number) {
  await trackEvent('action_plan_viewed', { steps_count: stepsCount });
}

export async function trackScenarioSimulated(scenarioId: string, scoreDelta: number) {
  await trackEvent('scenario_simulated', { scenario_id: scenarioId, score_delta: scoreDelta });
}

export async function trackSubscriptionTracked(count: number, totalSaved: number) {
  await trackEvent('subscription_tracked', { count, total_saved: totalSaved });
}

export async function trackCheckInCompleted(mood: number) {
  await trackEvent('check_in_completed', { mood });
}

export async function trackVoiceInputUsed(duration: number) {
  await trackEvent('voice_input_used', { duration });
}

export async function trackError(errorType: string, message: string, screen?: string) {
  await trackEvent('error_occurred', { error_type: errorType, message, screen: screen || null });
}

export async function trackFunnelStep(step: string, properties?: Record<string, string | number | boolean | null>) {
  await trackEvent(`funnel_${step}`, properties);
}
