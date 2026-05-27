import { z } from 'zod';
import {
  UserContextSchema,
  AnalyzeRequestSchema,
  AIRawOutputSchema,
  FinalAnalysisSchema,
} from './schemas';

export type UserContext = z.infer<typeof UserContextSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AIRawOutput = z.infer<typeof AIRawOutputSchema>;
export type FinalAnalysis = z.infer<typeof FinalAnalysisSchema>;
