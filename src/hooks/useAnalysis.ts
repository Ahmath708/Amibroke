import { useState, useCallback } from 'react';
import { FinancialAnalysis, RoastTone, AiProvider } from '@/types';
import { analyzeFinancialSituation, saveAnalysis } from '@/services/claudeApi';

interface UseAnalysisResult {
  loading: boolean;
  error: string | null;
  result: FinancialAnalysis | null;
  analyze: (input: string, tone?: RoastTone, provider?: AiProvider) => Promise<FinancialAnalysis | null>;
  reset: () => void;
}

export function useAnalysis(userId?: string): UseAnalysisResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinancialAnalysis | null>(null);

  const analyze = useCallback(async (input: string, tone: RoastTone = 'savage', provider: AiProvider = 'claude') => {
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeFinancialSituation(input, tone, undefined, 2, provider);
      if (userId) {
        await saveAnalysis(userId, input, analysis);
      }
      setResult(analysis);
      return analysis;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return { loading, error, result, analyze, reset };
}
