jest.mock('@/config/ai', () => ({ USE_AI_MOCKS: false }));

import { getProfile } from '@/services/profile';
import { getSubscriptions } from '@/services/subscriptionAudit';
import { __setSupabaseForTests } from '@/services/supabaseClient';

// A thenable chainable query-builder mock: chain methods return the chain,
// terminal `.single()/.maybeSingle()` resolve, and `await chain` resolves too.
function mockClient(result: any) {
  const chain: any = {
    select: () => chain, eq: () => chain, order: () => chain,
    insert: () => chain, update: () => chain, delete: () => chain,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: any) => resolve(result),
  };
  return { from: () => chain };
}

describe('data-layer guard behavior (locked across the withClient refactor)', () => {
  afterEach(() => __setSupabaseForTests(null));

  describe('getProfile (single → null fallback)', () => {
    it('returns the row on success', async () => {
      __setSupabaseForTests(mockClient({ data: { id: 'u1', username: 'jay' }, error: null }) as any);
      expect(await getProfile('u1')).toEqual({ id: 'u1', username: 'jay' });
    });
    it('returns null when the client is unavailable', async () => {
      __setSupabaseForTests(null);
      expect(await getProfile('u1')).toBeNull();
    });
    it('returns null when the query errors', async () => {
      __setSupabaseForTests(mockClient({ data: null, error: { message: 'boom' } }) as any);
      expect(await getProfile('u1')).toBeNull();
    });
  });

  describe('getSubscriptions (list → [] fallback)', () => {
    it('maps rows on success', async () => {
      __setSupabaseForTests(mockClient({ data: [{ id: 's1', name: 'Netflix', amount: '9.99', category: '', billing_period: 'monthly', last_used: '' }], error: null }) as any);
      expect(await getSubscriptions('u1')).toEqual([{ id: 's1', name: 'Netflix', amount: 9.99, category: '', billing_period: 'monthly', last_used: '' }]);
    });
    it('returns [] when the client is unavailable', async () => {
      __setSupabaseForTests(null);
      expect(await getSubscriptions('u1')).toEqual([]);
    });
    it('returns [] when the query errors', async () => {
      __setSupabaseForTests(mockClient({ data: null, error: { message: 'boom' } }) as any);
      expect(await getSubscriptions('u1')).toEqual([]);
    });
  });
});
