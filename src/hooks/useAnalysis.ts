import { useState, useCallback } from 'react';
import { FinalAnalysis } from '@shared/types';
import { RoastTone } from '@/types';
import { analyzeFinancialSituation } from '@/services/ai';
import { saveAnalysis } from '@/services/analyses';

interface UseAnalysisResult {
  loading: boolean;
  error: string | null;
  result: FinalAnalysis | null;
  analyze: (input: string, tone?: RoastTone) => Promise<FinalAnalysis | null>;
  reset: () => void;
}

export function useAnalysis(userId?: string): UseAnalysisResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalAnalysis | null>(null);

  const analyze = useCallback(async (input: string, tone: RoastTone = 'savage') => {
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeFinancialSituation(input, tone);
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
