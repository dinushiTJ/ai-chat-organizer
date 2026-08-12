import { selectors } from './selectors';
import type { ConversationSummary, Project, ScanResult } from './types';

export interface ChatGPTAdapter {
  listProjects(): Promise<Project[]>;
  listUnorganizedChats(): Promise<ConversationSummary[]>;
  listAllChats(): Promise<ConversationSummary[]>;
  scan(): Promise<ScanResult>;
}

export class ChatGPTDomAdapter implements ChatGPTAdapter {
  constructor(private readonly document: Document) {}

  async listProjects(): Promise<Project[]> {
    await this.loadAllChats();
    return this.uniqueById([...this.document.querySelectorAll<HTMLAnchorElement>(selectors.projectLinks)]
      .map((link) => ({ id: this.idFromHref(link.href), name: link.textContent?.trim() ?? '' }))
      .filter((project) => project.id && project.name));
  }

  async listAllChats(): Promise<ConversationSummary[]> {
    await this.loadAllChats();
    return this.uniqueById([...this.document.querySelectorAll<HTMLAnchorElement>(selectors.conversationLinks)]
      .map((link) => ({ id: this.idFromHref(link.href), title: link.textContent?.trim() ?? 'Untitled conversation' }))
      .filter((chat) => chat.id));
  }

  async listUnorganizedChats(): Promise<ConversationSummary[]> {
    const chats = await this.listAllChats();
    const projectIds = new Set((await this.listProjects()).map((project) => project.id));
    return chats.filter((chat) => !chat.projectId || !projectIds.has(chat.projectId));
  }

  async scan(): Promise<ScanResult> {
    const [projects, unorganizedChats] = await Promise.all([
      this.listProjects(),
      this.listUnorganizedChats(),
    ]);
    return { projects, unorganizedChats };
  }

  private idFromHref(href: string): string {
    return href.split('/').filter(Boolean).at(-1) ?? '';
  }

  private async loadAllChats(): Promise<void> {
    const containers = this.scrollableContainers();
    for (const container of containers) {
      let unchangedRounds = 0;
      let previousCount = this.document.querySelectorAll(selectors.conversationLinks).length;
      let previousTop = -1;

      for (let round = 0; round < 30 && unchangedRounds < 3; round += 1) {
        container.scrollTop = container.scrollHeight;
        await this.wait(120);
        const nextCount = this.document.querySelectorAll(selectors.conversationLinks).length;
        const reachedSamePosition = container.scrollTop === previousTop;
        unchangedRounds = nextCount === previousCount && reachedSamePosition ? unchangedRounds + 1 : 0;
        previousCount = nextCount;
        previousTop = container.scrollTop;
      }
    }
  }

  private scrollableContainers(): HTMLElement[] {
    const containers = new Set<HTMLElement>();
    const candidates = [...this.document.querySelectorAll<HTMLElement>(selectors.scrollContainers)];
    const firstLink = this.document.querySelector<HTMLAnchorElement>(selectors.conversationLinks);
    let current = firstLink?.parentElement;
    while (current) {
      candidates.push(current);
      current = current.parentElement;
    }

    for (const element of candidates) {
      if (element.scrollHeight > element.clientHeight) containers.add(element);
    }
    return [...containers];
  }

  private uniqueById<T extends { id: string }>(items: T[]): T[] {
    return [...new Map(items.map((item) => [item.id, item])).values()];
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }
}
