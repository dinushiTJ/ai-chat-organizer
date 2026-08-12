import { describe, expect, it } from 'vitest';
import { ChatGPTDomAdapter } from './ChatGPTAdapter';

describe('ChatGPTDomAdapter', () => {
  it('scans semantic project and conversation links', async () => {
    const project = { href: 'https://chatgpt.com/project/career', textContent: 'Career' } as HTMLAnchorElement;
    const conversation = { href: 'https://chatgpt.com/c/one', textContent: 'Interview preparation' } as HTMLAnchorElement;
    const document = {
      querySelectorAll: (selector: string) => selector.includes('/project/') ? [project] : [conversation],
      querySelector: () => conversation,
    } as unknown as Document;
    const result = await new ChatGPTDomAdapter(document).scan();

    expect(result.projects).toEqual([{ id: 'career', name: 'Career' }]);
    expect(result.unorganizedChats).toEqual([{ id: 'one', title: 'Interview preparation' }]);
  });
});
