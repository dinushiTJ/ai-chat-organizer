export interface Project {
  id: string;
  name: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  projectId?: string;
}

export interface ScanResult {
  projects: Project[];
  unorganizedChats: ConversationSummary[];
}
