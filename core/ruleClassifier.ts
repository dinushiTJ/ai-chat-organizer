import type { Classifier, Classification } from './classifier';
import type { ConversationContext, Project } from './types';
import { findMatchingExistingProject } from './projectMatcher';

const signals: Record<string, string[]> = {
  career: ['career', 'job', 'interview', 'cv', 'resume', 'application', 'salary'],
  travel: ['travel', 'trip', 'flight', 'hotel', 'visa', 'train', 'holiday', 'vacation'],
  finance: ['finance', 'money', 'budget', 'tax', 'bank', 'saving', 'investment'],
  projects: ['code', 'coding', 'software', 'programming', 'bug', 'pipeline', 'development'],
  health: ['health', 'fitness', 'doctor', 'workout', 'nutrition', 'medical'],
};

export class LocalClassifier implements Classifier {
  async classify(contexts: ConversationContext[], projects: Project[]): Promise<Classification> {
    return {
      assignments: contexts.map((context) => {
        const text = [context.title, ...context.firstMessages, ...context.recentMessages].join(' ').toLowerCase();
        const candidate = Object.entries(signals)
          .map(([project, words]) => ({ project, score: words.filter((word) => text.includes(word)).length }))
          .sort((left, right) => right.score - left.score)[0];
        const existing = candidate && findMatchingExistingProject(candidate.project, projects);
        const confidence = candidate?.score ? Math.min(0.95, 0.65 + candidate.score * 0.1) : 0.35;

        if (!candidate?.score || confidence < 0.7) {
          return { conversationId: context.id, action: 'NEEDS_REVIEW' as const, confidence, reason: 'Not enough signal for a safe automatic classification.' };
        }
        if (existing) {
          return { conversationId: context.id, action: 'USE_EXISTING' as const, project: existing.name, confidence, reason: `Matches the existing ${existing.name} Project.` };
        }
        return { conversationId: context.id, action: 'NEEDS_REVIEW' as const, confidence, reason: `Suggested category "${candidate.project}" does not match a detected Project. Review before creating anything.` };
      }),
    };
  }
}
