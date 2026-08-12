import { describe, expect, it } from 'vitest';
import type { Classifier } from './classifier';
import { previewOrganization } from './organizer';
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
  });
});
