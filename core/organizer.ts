import type { Assignment, Classifier } from './classifier';
import { findMatchingExistingProject } from './projectMatcher';
import type { ChatGPTAdapter } from '../adapters/chatgpt/ChatGPTAdapter';
import type { ConversationContext, Project } from './types';

export interface OrganizationPreview {
  assignments: Assignment[];
  review: Assignment[];
  projects: Project[];
  conversationsScanned: number;
}

export async function previewOrganization(
  adapter: ChatGPTAdapter,
  classifier: Classifier,
): Promise<OrganizationPreview> {
  const projects = await adapter.listProjects();
  const conversations = await adapter.listUnorganizedChats();
  if (conversations.length === 0) {
    return { assignments: [], review: [], projects, conversationsScanned: 0 };
  }

  const contexts: ConversationContext[] = [];
  for (const conversation of conversations) {
    contexts.push(await adapter.getConversationContext(conversation.id));
  }

  const classification = await classifier.classify(contexts, projects);
  const assignments = classification.assignments.map((assignment) => {
    if (assignment.action !== 'CREATE_NEW' || !assignment.project) return assignment;
    const existing = findMatchingExistingProject(assignment.project, projects);
    return existing
      ? { ...assignment, action: 'USE_EXISTING' as const, project: existing.name, reason: `Reusing existing Project: ${existing.name}.` }
      : assignment;
  });

  return {
    assignments,
    review: assignments.filter((assignment) => assignment.action === 'NEEDS_REVIEW' || assignment.confidence < 0.7),
    projects,
    conversationsScanned: conversations.length,
  };
}
