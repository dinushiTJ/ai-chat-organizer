import { selectors } from './selectors';
import type { ConversationContext, ConversationSummary, Project, ScanResult } from './types';

export interface ChatGPTAdapter {
  listProjects(): Promise<Project[]>;
  listUnorganizedChats(): Promise<ConversationSummary[]>;
  listAllChats(): Promise<ConversationSummary[]>;
  getConversationContext(conversationId: string): Promise<ConversationContext>;
  createProject(name: string): Promise<Project>;
  moveChat(conversationId: string, projectId: string): Promise<void>;
  archiveChat(conversationId: string): Promise<void>;
  deleteChat(conversationId: string): Promise<void>;
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

  async getConversationContext(conversationId: string): Promise<ConversationContext> {
    const chat = (await this.listAllChats()).find((item) => item.id === conversationId);
    if (!chat) throw new Error(`Conversation ${conversationId} was not found.`);
    return { id: chat.id, title: chat.title, firstMessages: [], recentMessages: [] };
  }

  async createProject(_name: string): Promise<Project> {
    throw new Error('Project creation is not available until ChatGPT action verification is implemented.');
  }

  async moveChat(conversationId: string, projectId: string): Promise<void> {
    const link = [...this.document.querySelectorAll<HTMLAnchorElement>(selectors.conversationLinks)]
      .find((candidate) => this.idFromHref(candidate.href) === conversationId);
    if (!link) throw new Error(`Conversation ${conversationId} is not visible in the ChatGPT sidebar.`);

    const row = link.closest('div');
    const menuButton = row?.querySelector<HTMLButtonElement>('button[aria-label*="option" i], button[aria-label*="menu" i]');
    if (!menuButton) throw new Error(`Could not verify the options menu for conversation "${link.textContent?.trim() ?? conversationId}".`);
    menuButton.click();
    const menu = await this.waitForElement<HTMLElement>(selectors.menu);
    const moveItem = [...menu.querySelectorAll<HTMLElement>(selectors.menuItems)]
      .find((item) => /move.*project|add.*project/i.test(item.textContent ?? ''));
    if (!moveItem) throw new Error('ChatGPT did not show a Move to project action.');
    moveItem.click();

    const project = await this.waitForElement<HTMLElement>(`[data-project-id="${CSS.escape(projectId)}"]`)
      .catch(() => undefined);
    const projectItem = project ?? [...this.document.querySelectorAll<HTMLElement>(selectors.menuItems)]
      .find((item) => item.textContent?.trim() === this.projectName(projectId));
    if (!projectItem) throw new Error(`Could not verify destination Project ${projectId}.`);
    projectItem.click();
    await this.wait(250);
  }

  async archiveChat(_conversationId: string): Promise<void> {
    throw new Error('Archiving chats is not available until ChatGPT action verification is implemented.');
  }

  async deleteChat(_conversationId: string): Promise<void> {
    throw new Error('Deleting chats is not available until ChatGPT action verification is implemented.');
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

  private async waitForElement<T extends Element>(selector: string, timeout = 2000): Promise<T> {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const element = this.document.querySelector<T>(selector);
      if (element) return element;
      await this.wait(80);
    }
    throw new Error(`ChatGPT did not show the expected UI element: ${selector}`);
  }

  private projectName(projectId: string): string {
    return [...this.document.querySelectorAll<HTMLAnchorElement>(selectors.projectLinks)]
      .find((link) => this.idFromHref(link.href) === projectId)?.textContent?.trim() ?? '';
  }
}
