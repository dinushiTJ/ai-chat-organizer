import { ChatGPTDomAdapter } from '../../adapters/chatgpt/ChatGPTAdapter';
import { applyOrganization, previewOrganization, type OrganizationPreview } from '../../core/organizer';
import { LocalClassifier } from '../../core/ruleClassifier';

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  runAt: 'document_idle',
  main() {
    const listenerKey = '__chatOrganizerMessageListener';
    if ((window as unknown as Record<string, boolean>)[listenerKey]) return;
    (window as unknown as Record<string, boolean>)[listenerKey] = true;

    chrome.runtime.onMessage.addListener((message: { type?: string; preview?: OrganizationPreview }, _sender, sendResponse) => {
      if (message.type !== 'PING_CHATGPT' && message.type !== 'SCAN_CHATGPT' && message.type !== 'ORGANIZE_PREVIEW' && message.type !== 'ORGANIZE_APPLY') return false;

      void (async () => {
        try {
          if (message.type === 'PING_CHATGPT') {
            sendResponse({ ok: true, value: { connected: true } });
            return;
          }
          const adapter = new ChatGPTDomAdapter(document);
          const value = message.type === 'ORGANIZE_PREVIEW'
            ? await previewOrganization(adapter, new LocalClassifier())
            : message.type === 'ORGANIZE_APPLY'
              ? message.preview ? await applyOrganization(adapter, message.preview) : await Promise.reject(new Error('Organization preview is missing.'))
              : await adapter.scan();
          sendResponse({ ok: true, value });
        } catch (error: unknown) {
          sendResponse({ ok: false, error: error instanceof Error ? error.message : 'ChatGPT operation failed.' });
        }
      })();
      return true;
    });
  },
});
