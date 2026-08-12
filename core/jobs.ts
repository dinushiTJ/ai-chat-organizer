import type { OrganizationPreview, OrganizationResult } from './organizer';

export type OrganizationJobPhase = 'scanning' | 'classifying' | 'moving' | 'complete' | 'failed';

export interface OrganizationJobProgress {
  type: 'ORGANIZE_PROGRESS';
  jobId: string;
  phase: OrganizationJobPhase;
  completed?: number;
  total?: number;
  message?: string;
  preview?: OrganizationPreview;
  result?: OrganizationResult;
  error?: string;
}
