import { z } from 'zod';
import {
  UserContextSchema,
  AnalyzeRequestSchema,
  AIRawOutputSchema,
  FinalAnalysisSchema,
  ActionPlanStepSchema,
  ActionPlanRequestSchema,
  ActionPlanResponseSchema,
} from './schemas';

export type UserContext = z.infer<typeof UserContextSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AIRawOutput = z.infer<typeof AIRawOutputSchema>;
export type FinalAnalysis = z.infer<typeof FinalAnalysisSchema>;
export type ActionPlanStep = z.infer<typeof ActionPlanStepSchema>;
export type ActionPlanRequest = z.infer<typeof ActionPlanRequestSchema>;
export type ActionPlanResponse = z.infer<typeof ActionPlanResponseSchema>;
