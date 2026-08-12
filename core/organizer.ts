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

export interface OrganizationResult {
  moved: number;
  created: number;
  skipped: number;
  failed: string[];
}

export async function applyOrganization(adapter: ChatGPTAdapter, preview: OrganizationPreview): Promise<OrganizationResult> {
  const result: OrganizationResult = { moved: 0, created: 0, skipped: 0, failed: [] };
  const projects = [...preview.projects];
  for (const assignment of preview.assignments) {
    if (assignment.action === 'NEEDS_REVIEW' || assignment.confidence < 0.7 || !assignment.project) {
      result.skipped += 1;
      continue;
    }
    try {
      let project = findMatchingExistingProject(assignment.project, projects);
      if (!project && assignment.action === 'CREATE_NEW') {
        project = await adapter.createProject(assignment.project);
        projects.push(project);
        result.created += 1;
      }
      if (!project) {
        result.skipped += 1;
        continue;
      }
      await adapter.moveChat(assignment.conversationId, project.id);
      result.moved += 1;
    } catch (error) {
      result.failed.push(error instanceof Error ? error.message : `Failed to move ${assignment.conversationId}.`);
    }
  }
  return result;
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
  const titles = new Map(conversations.map((conversation) => [conversation.id, conversation.title]));
  const assignments = classification.assignments.map((assignment) => {
    const withTitle = { ...assignment, conversationTitle: titles.get(assignment.conversationId) ?? assignment.conversationId };
    if (assignment.action !== 'CREATE_NEW' || !assignment.project) return withTitle;
    const existing = findMatchingExistingProject(assignment.project, projects);
    return existing
      ? { ...withTitle, action: 'USE_EXISTING' as const, project: existing.name, reason: `Reusing existing Project: ${existing.name}.` }
      : withTitle;
  });

  return {
    assignments,
    review: assignments.filter((assignment) => assignment.action === 'NEEDS_REVIEW' || assignment.confidence < 0.7),
    projects,
    conversationsScanned: conversations.length,
  };
}
