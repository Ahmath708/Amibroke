// Mock the native SDK so the module loads without a native binding under Jest.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
  LOG_LEVEL: { INFO: 0, WARN: 1 },
}));

import { tierFromCustomerInfo, packageForTier } from '../purchases';

describe('tierFromCustomerInfo', () => {
  const withActive = (active: Record<string, unknown>) =>
    ({ entitlements: { active } } as any);

  it('returns free with no active entitlements (or null info)', () => {
    expect(tierFromCustomerInfo(null)).toBe('free');
    expect(tierFromCustomerInfo(withActive({}))).toBe('free');
  });

  it('returns action_plan when only action_plan is active', () => {
    expect(tierFromCustomerInfo(withActive({ action_plan: {} }))).toBe('action_plan');
  });

  it('deep_dive supersedes action_plan', () => {
    expect(tierFromCustomerInfo(withActive({ action_plan: {}, deep_dive: {} }))).toBe('deep_dive');
  });
});

describe('packageForTier', () => {
  const pkg = (identifier: string, productId: string) =>
    ({ identifier, product: { identifier: productId } } as any);
  const offering = {
    availablePackages: [pkg('action_plan', 'ap.monthly'), pkg('deep_dive', 'dd.monthly')],
  } as any;

  it('matches by package identifier', () => {
    expect(packageForTier(offering, 'deep_dive')?.identifier).toBe('deep_dive');
  });

  it('falls back to matching the product identifier', () => {
    const byProduct = { availablePackages: [pkg('$rc_monthly', 'com.app.deep_dive.monthly')] } as any;
    expect(packageForTier(byProduct, 'deep_dive')?.product.identifier).toContain('deep_dive');
  });

  it('returns null when offering is missing', () => {
    expect(packageForTier(null, 'deep_dive')).toBeNull();
  });
});
