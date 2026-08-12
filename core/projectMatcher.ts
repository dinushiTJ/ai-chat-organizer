import type { Project } from './types';
import { normalizeProjectName } from './projectNormalizer';

const semanticGroups = [
  ['career', 'jobs', 'jobsearch', 'applications', 'employment'],
  ['travel', 'trips', 'holiday', 'holidays', 'vacation'],
  ['projects', 'codingprojects', 'developmentprojects', 'software'],
  ['finance', 'money', 'budgeting', 'budget'],
  ['health', 'wellness', 'fitness'],
];

export function findMatchingExistingProject(candidate: string, projects: Project[]): Project | undefined {
  const normalizedCandidate = normalizeProjectName(candidate);
  const exact = projects.find((project) => normalizeProjectName(project.name) === normalizedCandidate);
  if (exact) return exact;

  const group = semanticGroups.find((names) => names.includes(normalizedCandidate));
  if (!group) return undefined;
  return projects.find((project) => group.includes(normalizeProjectName(project.name)));
}
