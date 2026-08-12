/** Stable, semantic selectors are kept here so ChatGPT UI changes are isolated. */
export const selectors = {
  navigation: 'nav',
  scrollContainers: 'nav, [role="navigation"], aside, main',
  projectLinks: 'a[href*="/project/"]',
  conversationLinks: 'a[href*="/c/"]',
} as const;
