import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Chat Organizer',
    description: 'Incrementally organize ChatGPT conversations into Projects.',
    version: '0.1.0',
    permissions: ['sidePanel', 'storage', 'tabs'],
    host_permissions: ['https://chatgpt.com/*'],
    action: {
      default_title: 'Open Chat Organizer',
      default_icon: {
        '128': 'icons/Sorta Logo - dark.png',
      },
    },
    icons: {
      '128': 'icons/Sorta Logo - dark.png',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
