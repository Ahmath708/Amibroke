import { z } from 'zod';
import {
  UserContextSchema,
  AnalyzeRequestSchema,
  AIRawOutputSchema,
  FinalAnalysisSchema,
  ActionPlanStepSchema,
  ActionPlanRequestSchema,
  ActionPlanResponseSchema,
  DebtItemSchema,
  ToneSchema,
  CaptionRequestSchema,
  CaptionResponseSchema,
} from './schemas';

export type UserContext = z.infer<typeof UserContextSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AIRawOutput = z.infer<typeof AIRawOutputSchema>;
export type FinalAnalysis = z.infer<typeof FinalAnalysisSchema>;
export type ActionPlanStep = z.infer<typeof ActionPlanStepSchema>;
export type ActionPlanRequest = z.infer<typeof ActionPlanRequestSchema>;
export type ActionPlanResponse = z.infer<typeof ActionPlanResponseSchema>;
export type DebtItem = z.infer<typeof DebtItemSchema>;
export type Tone = z.infer<typeof ToneSchema>;
export type CaptionRequest = z.infer<typeof CaptionRequestSchema>;
export type CaptionResponse = z.infer<typeof CaptionResponseSchema>;
