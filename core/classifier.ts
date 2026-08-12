import { z } from 'zod';
import type { ConversationContext, Project } from './types';

export const assignmentSchema = z.object({
  conversationId: z.string().min(1),
  conversationTitle: z.string().optional(),
  action: z.enum(['USE_EXISTING', 'CREATE_NEW', 'NEEDS_REVIEW']),
  project: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export const classificationSchema = z.object({ assignments: z.array(assignmentSchema) });
export type Classification = z.infer<typeof classificationSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;

export interface Classifier {
  classify(contexts: ConversationContext[], projects: Project[]): Promise<Classification>;
}

export function validateClassification(value: unknown): Classification {
  return classificationSchema.parse(value);
}
