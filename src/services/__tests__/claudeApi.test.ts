jest.mock('@/config/ai', () => ({ USE_AI_MOCKS: false }));

import * as claudeApi from '@/services/claudeApi';

const mockAnalysis = { score: 65, scoreLabel: 'Surviving', summary: 'test' } as any;
const mockTone = 'savage' as const;

function makeSteps(count: number) {
  const cats = ['savings', 'debt', 'income', 'mindset'] as const;
  return Array.from({ length: count }, (_, i) => ({
    week: String(i + 1),
    title: `Step ${i + 1}`,
    description: 'desc',
    category: cats[i % 4],
    impact: 'High',
    confidence: 'high' as const,
  }));
}

describe('fetchOrGenerateActionPlan', () => {
  const mockInvoke = jest.fn();
  const mockFrom = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { action_plan: null }, error: null }),
      update: jest.fn().mockReturnThis(),
    });
    claudeApi.__setSupabaseForTests({
      functions: { invoke: mockInvoke },
      from: mockFrom,
    } as any);
  });

  it('returns saved plan from DB when available', async () => {
    const savedPlan = { overallMessage: 'You can do this', steps: makeSteps(4) };
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { action_plan: savedPlan }, error: null }),
      update: jest.fn().mockReturnThis(),
    });

    const result = await claudeApi.fetchOrGenerateActionPlan(mockAnalysis, mockTone, 'analysis-1');

    expect(result).toEqual(savedPlan);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('calls edge function when no saved plan exists', async () => {
    const apiPlan = { overallMessage: 'Generated plan', steps: makeSteps(4) };
    mockInvoke.mockResolvedValue({ data: apiPlan, error: null });

    const result = await claudeApi.fetchOrGenerateActionPlan(mockAnalysis, mockTone, 'analysis-1');

    expect(mockInvoke).toHaveBeenCalledWith('action-plan', { body: { analysis: mockAnalysis, tone: mockTone } });
    expect(result).toEqual(apiPlan);
  });

  it('returns null when the edge function errors', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'API error' } });

    const result = await claudeApi.fetchOrGenerateActionPlan(mockAnalysis, mockTone);

    expect(result).toBeNull();
  });
});
