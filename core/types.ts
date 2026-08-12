export interface Project {
  id: string;
  name: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  projectId?: string;
}

export interface ConversationContext {
  id: string;
  title: string;
  firstMessages: string[];
  recentMessages: string[];
}

export interface ScanResult {
  projects: Project[];
  unorganizedChats: ConversationSummary[];
}
