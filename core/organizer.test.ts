import { describe, expect, it } from 'vitest';
import type { Classifier } from './classifier';
import { applyOrganization, previewOrganization } from './organizer';
import type { ChatGPTAdapter } from '../adapters/chatgpt/ChatGPTAdapter';

describe('previewOrganization', () => {
  it('only asks the adapter for unorganized conversations', async () => {
    const adapter = {
      listProjects: async () => [{ id: 'career', name: 'Career' }],
      listUnorganizedChats: async () => [{ id: 'new', title: 'Interview' }],
      listAllChats: async () => [],
      getConversationContext: async () => ({ id: 'new', title: 'Interview', firstMessages: ['job interview'], recentMessages: [] }),
    } as unknown as ChatGPTAdapter;
    const classifier: Classifier = { classify: async () => ({ assignments: [{ conversationId: 'new', action: 'CREATE_NEW', project: 'Job Search', confidence: 0.9, reason: 'job' }] }) };
    const preview = await previewOrganization(adapter, classifier);
    expect(preview.assignments[0]?.action).toBe('USE_EXISTING');
    expect(preview.assignments[0]?.project).toBe('Career');
    expect(preview.assignments[0]?.conversationTitle).toBe('Interview');
  });

  it('proposes confident categories when no Projects are detected', async () => {
    const adapter = {
      listProjects: async () => [],
      listUnorganizedChats: async () => [{ id: 'new', title: 'Travel plans' }],
      getConversationContext: async () => ({ id: 'new', title: 'Travel plans', firstMessages: [], recentMessages: [] }),
    } as unknown as ChatGPTAdapter;
    const classifier: Classifier = { classify: async () => ({ assignments: [{ conversationId: 'new', action: 'CREATE_NEW', project: 'travel', confidence: 0.9, reason: 'travel' }] }) };
    const preview = await previewOrganization(adapter, classifier);
    expect(preview.assignments[0]?.action).toBe('CREATE_NEW');
  });
});

describe('applyOrganization', () => {
  it('moves only confident assignments and skips review items', async () => {
    const moved: string[] = [];
    const adapter = {
      createProject: async () => ({ id: 'new', name: 'Travel' }),
      moveChat: async (conversationId: string) => { moved.push(conversationId); },
    } as unknown as ChatGPTAdapter;
    const result = await applyOrganization(adapter, {
      projects: [{ id: 'travel', name: 'Travel' }],
      conversationsScanned: 2,
      review: [],
      assignments: [
        { conversationId: 'one', action: 'USE_EXISTING', project: 'Travel', confidence: 0.9, reason: 'match' },
        { conversationId: 'two', action: 'NEEDS_REVIEW', confidence: 0.5, reason: 'unclear' },
      ],
    });
    expect(moved).toEqual(['one']);
    expect(result).toMatchObject({ moved: 1, skipped: 1, failed: [] });
  });
});
