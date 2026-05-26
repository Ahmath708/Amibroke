import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPurchaseTier, setPurchaseTier, isPremium, hasAccessTo } from '@/services/purchases';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('purchases service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns free when no tier exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await expect(getPurchaseTier()).resolves.toBe('free');
  });

  it('returns saved tier when a valid tier exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('action_plan');
    await expect(getPurchaseTier()).resolves.toBe('action_plan');
  });

  it('defaults to free for invalid stored values', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('premium');
    await expect(getPurchaseTier()).resolves.toBe('free');
  });

  it('saves the selected tier', async () => {
    await setPurchaseTier('deep_dive');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@ambroke_purchase_tier', 'deep_dive');
  });

  it('correctly identifies premium access', () => {
    expect(isPremium('free')).toBe(false);
    expect(isPremium('action_plan')).toBe(true);
    expect(isPremium('deep_dive')).toBe(true);
  });

  it('enforces tier access rules', () => {
    expect(hasAccessTo('free', 'action_plan')).toBe(false);
    expect(hasAccessTo('action_plan', 'action_plan')).toBe(true);
    expect(hasAccessTo('action_plan', 'deep_dive')).toBe(false);
    expect(hasAccessTo('deep_dive', 'deep_dive')).toBe(true);
  });
});
