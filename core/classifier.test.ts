import { describe, expect, it } from 'vitest';
import { validateClassification } from './classifier';

describe('classification schema', () => {
  it('accepts validated assignments', () => {
    expect(validateClassification({ assignments: [{ conversationId: '1', action: 'NEEDS_REVIEW', confidence: 0.4, reason: 'Unclear' }] }).assignments).toHaveLength(1);
  });

  it('rejects malformed assignments', () => {
    expect(() => validateClassification({ assignments: [{ conversationId: '1', action: 'MOVE' }] })).toThrow();
  });
});
