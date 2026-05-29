import { deriveBucketKey, isWithinLimit, shouldBypass, resolveLimits } from '../../../supabase/functions/_shared/rateLimitLogic';

describe('deriveBucketKey', () => {
  it('uses first IP from forwarded-for header', () => {
    expect(deriveBucketKey('1.2.3.4, 5.6.7.8', 'analyze')).toBe('analyze:1.2.3.4');
  });

  it('handles single IP', () => {
    expect(deriveBucketKey('10.0.0.1', 'action-plan')).toBe('action-plan:10.0.0.1');
  });

  it('falls back to unknown when header is null', () => {
    expect(deriveBucketKey(null, 'analyze')).toBe('analyze:unknown');
  });

  it('falls back to unknown when header is empty', () => {
    expect(deriveBucketKey('', 'captions')).toBe('captions:');
  });

  it('trims whitespace from IP', () => {
    expect(deriveBucketKey('  192.168.1.1  ', 'analyze')).toBe('analyze:192.168.1.1');
  });
});

describe('isWithinLimit', () => {
  it('returns true when count is below max', () => {
    expect(isWithinLimit(1, 30)).toBe(true);
  });

  it('returns true when count equals max (boundary)', () => {
    expect(isWithinLimit(30, 30)).toBe(true);
  });

  it('returns false when count exceeds max', () => {
    expect(isWithinLimit(31, 30)).toBe(false);
  });

  it('returns true when count is zero', () => {
    expect(isWithinLimit(0, 10)).toBe(true);
  });
});

describe('shouldBypass', () => {
  it('returns true when RATE_LIMIT_ENABLED is false', () => {
    expect(shouldBypass('false')).toBe(true);
  });

  it('returns false when RATE_LIMIT_ENABLED is undefined', () => {
    expect(shouldBypass(undefined)).toBe(false);
  });

  it('returns false when RATE_LIMIT_ENABLED is true', () => {
    expect(shouldBypass('true')).toBe(false);
  });
});

describe('resolveLimits', () => {
  it('returns defaults when env vars are missing', () => {
    const limits = resolveLimits(undefined, undefined);
    expect(limits.max).toBe(30);
    expect(limits.windowSeconds).toBe(3600);
  });

  it('parses custom max and window', () => {
    const limits = resolveLimits('50', '900');
    expect(limits.max).toBe(50);
    expect(limits.windowSeconds).toBe(900);
  });

  it('falls back to defaults when env vars are non-numeric', () => {
    const limits = resolveLimits('abc', 'xyz');
    expect(limits.max).toBe(30);
    expect(limits.windowSeconds).toBe(3600);
  });
});
