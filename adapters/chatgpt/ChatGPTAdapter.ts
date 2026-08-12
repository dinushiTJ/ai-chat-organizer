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
    const links = [...this.document.querySelectorAll<HTMLAnchorElement>(selectors.projectLinks)];
    const fallbackLinks = [...this.document.querySelectorAll<HTMLAnchorElement>('a[href*="project"]')]
      .filter((link) => /project/i.test(link.href));
    const projects = this.uniqueById([...links, ...fallbackLinks]
      .map((link) => ({ id: this.idFromHref(link.href), name: link.textContent?.trim() ?? '' }))
      .filter((project) => project.id && project.name));
    return this.uniqueByName(projects);
  }

  async listAllChats(): Promise<ConversationSummary[]> {
    await this.loadAllChats();
    return this.uniqueById([...this.document.querySelectorAll<HTMLAnchorElement>(selectors.conversationLinks)]
      .map((link) => ({ id: this.conversationId(link.href), projectId: this.projectId(link.href), title: this.conversationTitle(link) }))
      .filter((chat) => chat.id));
  }

  async listUnorganizedChats(): Promise<ConversationSummary[]> {
    const chats = await this.listAllChats();
    return chats.filter((chat) => !chat.projectId);
  }

  async getConversationContext(conversationId: string): Promise<ConversationContext> {
    const chat = (await this.listAllChats()).find((item) => item.id === conversationId);
    if (!chat) throw new Error(`Conversation ${conversationId} was not found.`);
    return { id: chat.id, title: chat.title, firstMessages: [], recentMessages: [] };
  }

  async createProject(name: string): Promise<Project> {
    const trigger = [...this.document.querySelectorAll<HTMLElement>(selectors.projectCreateTriggers)]
      .find((element) => /^\s*(new project|create project|add project)\s*$/i.test(element.textContent ?? '') || /new project|create project/i.test(element.getAttribute('aria-label') ?? ''));
    if (!trigger) throw new Error(`Could not find ChatGPT's New Project control for "${name}".`);
    trigger.click();

    const dialog = await this.waitForElement<HTMLElement>(selectors.dialogs).catch(() => this.document.body);
    const input = await this.waitForElement<HTMLInputElement>('input[placeholder*="project" i], input[name="name"], input[type="text"]', 2500);
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const create = [...dialog.querySelectorAll<HTMLElement>('button, [role="button"]')]
      .find((element) => /^\s*(create|continue|save)\s*$/i.test(element.textContent ?? '') && !element.hasAttribute('disabled'));
    if (!create) throw new Error(`ChatGPT did not show a confirmation button for Project "${name}".`);
    create.click();
    await this.wait(500);
    const project = (await this.listProjects()).find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!project) throw new Error(`Project "${name}" was not verified after creation.`);
    return project;
  }

  async moveChat(conversationId: string, projectId: string): Promise<void> {
    const link = [...this.document.querySelectorAll<HTMLAnchorElement>(selectors.conversationLinks)]
      .find((candidate) => this.idFromHref(candidate.href) === conversationId);
    if (!link) throw new Error(`Conversation ${conversationId} is not visible in the ChatGPT sidebar.`);

    const row = this.conversationRow(link);
    const menuButton = row?.querySelector<HTMLButtonElement>(
      'button[aria-label*="option" i], button[aria-label*="menu" i], button[data-testid*="menu" i]'
    ) ?? this.nearbyMenuButton(link);
    if (!menuButton) throw new Error(`Could not verify the options menu for conversation "${link.textContent?.trim() ?? conversationId}".`);
    menuButton.click();
    const menu = await this.waitForElement<HTMLElement>(selectors.menu).catch(() => this.document.body);
    const moveItem = [...menu.querySelectorAll<HTMLElement>(selectors.menuItems), ...this.document.querySelectorAll<HTMLElement>('button')]
      .find((item) => /move to project|add to project|move conversation/i.test(item.textContent ?? item.getAttribute('aria-label') ?? ''));
    if (!moveItem) throw new Error('ChatGPT did not show a Move to project action.');
    moveItem.click();

    const project = await this.waitForElement<HTMLElement>(`[data-project-id="${CSS.escape(projectId)}"]`)
      .catch(() => undefined);
    const projectItem = project ?? [...this.document.querySelectorAll<HTMLElement>(selectors.menuItems), ...this.document.querySelectorAll<HTMLElement>('button')]
      .find((item) => item.textContent?.trim() === this.projectName(projectId));
    if (!projectItem) throw new Error(`Could not verify destination Project ${projectId}.`);
    projectItem.click();
    await this.wait(500);
    const current = await this.listAllChats();
    const moved = current.find((chat) => chat.id === conversationId)?.projectId === projectId;
    if (!moved) throw new Error(`ChatGPT did not verify that "${link.textContent?.trim() ?? conversationId}" moved to the selected Project.`);
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

  private conversationId(href: string): string {
    const parts = href.split('/').filter(Boolean);
    const index = parts.findIndex((part) => part === 'c');
    return index >= 0 ? parts[index + 1] ?? '' : this.idFromHref(href);
  }

  private projectId(href: string): string | undefined {
    const parts = href.split('/').filter(Boolean);
    const index = parts.findIndex((part) => part === 'project');
    return index >= 0 ? parts[index + 1] : undefined;
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

  private conversationTitle(link: HTMLAnchorElement): string {
    const labelled = link.getAttribute?.('aria-label')?.trim();
    if (labelled) return labelled;
    const row = this.conversationRow(link);
    const text = row?.textContent?.replace(/\s+/g, ' ').trim() ?? link.textContent?.trim();
    return text || 'Untitled conversation';
  }

  private uniqueByName(projects: Project[]): Project[] {
    const seen = new Set<string>();
    return projects.filter((project) => {
      const key = project.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private conversationRow(link: HTMLAnchorElement): HTMLElement | undefined {
    let current = link.parentElement;
    for (let depth = 0; current && depth < 6; depth += 1) {
      if (current.querySelector('button')) return current;
      current = current.parentElement;
    }
    return undefined;
  }

  private nearbyMenuButton(link: HTMLAnchorElement): HTMLButtonElement | undefined {
    const row = link.parentElement?.parentElement;
    return row?.querySelector<HTMLButtonElement>('button') ?? undefined;
  }
}
