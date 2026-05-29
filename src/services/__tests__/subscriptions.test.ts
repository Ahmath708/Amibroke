import { hasAccessTo, isSubscriptionPremium, isActive } from '@/services/subscriptions';

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
});
