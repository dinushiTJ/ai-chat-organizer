import { ChatGPTDomAdapter } from '../../adapters/chatgpt/ChatGPTAdapter';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
      if (message.type !== 'SCAN_CHATGPT' && message.type !== 'ORGANIZE_PREVIEW') return;
      const adapter = new ChatGPTDomAdapter(document);
      void adapter.scan().then(sendResponse);
      return true;
    });
  },
});
