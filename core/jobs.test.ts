import { describe, expect, it } from 'vitest';
import type { OrganizationJobProgress } from './jobs';

describe('organization job progress', () => {
  it('represents a terminal completion with results', () => {
    const progress: OrganizationJobProgress = {
      type: 'ORGANIZE_PROGRESS',
      jobId: 'job-1',
      phase: 'complete',
      completed: 2,
      total: 3,
      result: { moved: 2, created: 0, skipped: 1, failed: [] },
    };
    expect(progress.phase).toBe('complete');
    expect(progress.result?.moved).toBe(2);
  });
});
