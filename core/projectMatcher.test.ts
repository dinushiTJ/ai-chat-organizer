import { describe, expect, it } from 'vitest';
import { findMatchingExistingProject } from './projectMatcher';
import { normalizeProjectName } from './projectNormalizer';

describe('project matching', () => {
  it('normalizes punctuation and spacing', () => {
    expect(normalizeProjectName('Data Engineering')).toBe('dataengineering');
    expect(normalizeProjectName('data-engineering')).toBe('dataengineering');
  });

  it('reuses a semantic existing project', () => {
    expect(findMatchingExistingProject('Job Search', [{ id: '1', name: 'Career' }])).toEqual({ id: '1', name: 'Career' });
  });

  it('does not invent a match for unrelated topics', () => {
    expect(findMatchingExistingProject('Health', [{ id: '1', name: 'Career' }])).toBeUndefined();
  });
});
