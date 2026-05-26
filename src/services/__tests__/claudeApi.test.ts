import * as claudeApi from '@/services/claudeApi';

describe('fetchActionPlan', () => {
  const mockInvoke = jest.fn();
  let fetchActionPlan: (userId: string, analysisId?: string) => Promise<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    claudeApi.__setSupabaseForTests({ functions: { invoke: mockInvoke } } as any);
    fetchActionPlan = claudeApi.fetchActionPlan;
  });

  it('returns the saved action plan for a user', async () => {
    const actionPlan = [
      { week: 1, title: 'Test step', description: 'Do the thing.', impact: 'Saves money', category: 'savings', completed: false },
    ];

    mockInvoke.mockResolvedValue({ data: { actionPlan }, error: null });

    const result = await fetchActionPlan('user-1');

    expect(mockInvoke).toHaveBeenCalledWith('action-plan', { body: { userId: 'user-1', analysisId: undefined } });
    expect(result).toEqual(actionPlan);
  });

  it('returns empty array when the action plan endpoint errors', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const result = await fetchActionPlan('user-2', 'analysis-1');

    expect(result).toEqual([]);
    expect(mockInvoke).toHaveBeenCalledWith('action-plan', { body: { userId: 'user-2', analysisId: 'analysis-1' } });
  });
});
