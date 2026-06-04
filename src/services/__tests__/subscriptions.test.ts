import {
  hasAccessTo, isSubscriptionPremium, isActive,
  getTrialStatus, canAccess, canUseApp, TRIAL_DURATION_DAYS,
} from '@/services/subscriptions';

const DAY_MS = 24 * 60 * 60 * 1000;
// Fixed "now" so the suite is deterministic (no Date.now()).
const NOW = new Date('2026-06-03T12:00:00.000Z');
const agoDays = (d: number) => new Date(NOW.getTime() - d * DAY_MS).toISOString();

describe('subscriptions service', () => {
  describe('hasAccessTo', () => {
    it('returns false for free tier', () => {
      expect(hasAccessTo('free', 'action_plan')).toBe(false);
      expect(hasAccessTo('free', 'deep_dive')).toBe(false);
    });

    it('grants action_plan access for action_plan tier', () => {
      expect(hasAccessTo('action_plan', 'action_plan')).toBe(true);
    });

    it('denies deep_dive access for action_plan tier', () => {
      expect(hasAccessTo('action_plan', 'deep_dive')).toBe(false);
    });

    it('grants all access for deep_dive tier', () => {
      expect(hasAccessTo('deep_dive', 'action_plan')).toBe(true);
      expect(hasAccessTo('deep_dive', 'deep_dive')).toBe(true);
    });
  });

  describe('isSubscriptionPremium', () => {
    it('returns false for free', () => {
      expect(isSubscriptionPremium('free')).toBe(false);
    });

    it('returns true for paid tiers', () => {
      expect(isSubscriptionPremium('action_plan')).toBe(true);
      expect(isSubscriptionPremium('deep_dive')).toBe(true);
    });
  });

  describe('isActive', () => {
    it('returns true for active statuses', () => {
      expect(isActive('active')).toBe(true);
      expect(isActive('trialing')).toBe(true);
      expect(isActive('past_due')).toBe(true);
    });

    it('returns false for inactive statuses', () => {
      expect(isActive('canceled')).toBe(false);
      expect(isActive('incomplete')).toBe(false);
      expect(isActive(null)).toBe(false);
    });
  });

  describe('getTrialStatus (3-day free access)', () => {
    it('is active just after signup, with the full window left', () => {
      const t = getTrialStatus(agoDays(0), NOW);
      expect(t.active).toBe(true);
      expect(t.daysLeft).toBe(TRIAL_DURATION_DAYS);
    });

    it('counts down (ceil) within the window', () => {
      expect(getTrialStatus(agoDays(1), NOW).daysLeft).toBe(2);
      expect(getTrialStatus(agoDays(2.5), NOW).daysLeft).toBe(1);
    });

    it('is expired exactly at the boundary', () => {
      const t = getTrialStatus(agoDays(TRIAL_DURATION_DAYS), NOW);
      expect(t.active).toBe(false);
      expect(t.daysLeft).toBe(0);
    });

    it('is expired well past the window', () => {
      expect(getTrialStatus(agoDays(30), NOW).active).toBe(false);
    });

    it('is inactive for missing / malformed timestamps', () => {
      expect(getTrialStatus(null, NOW).active).toBe(false);
      expect(getTrialStatus(undefined, NOW).active).toBe(false);
      expect(getTrialStatus('not-a-date', NOW).active).toBe(false);
    });
  });

  describe('canAccess (trial-aware feature gate)', () => {
    it('grants everything during the trial regardless of tier', () => {
      expect(canAccess('free', 'action_plan', true)).toBe(true);
      expect(canAccess('free', 'deep_dive', true)).toBe(true);
    });

    it('falls back to tier once the trial is over', () => {
      expect(canAccess('free', 'action_plan', false)).toBe(false);
      expect(canAccess('action_plan', 'action_plan', false)).toBe(true);
      expect(canAccess('action_plan', 'deep_dive', false)).toBe(false);
      expect(canAccess('deep_dive', 'deep_dive', false)).toBe(true);
    });
  });

  describe('canUseApp (hard-paywall app gate)', () => {
    it('allows free users only while the trial is active', () => {
      expect(canUseApp('free', true)).toBe(true);
      expect(canUseApp('free', false)).toBe(false);
    });

    it('always allows paid users', () => {
      expect(canUseApp('action_plan', false)).toBe(true);
      expect(canUseApp('deep_dive', false)).toBe(true);
    });
  });
});
