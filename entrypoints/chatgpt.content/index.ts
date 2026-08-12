import { ChatGPTDomAdapter } from '../../adapters/chatgpt/ChatGPTAdapter';
import { applyOrganization, previewOrganization, type OrganizationPreview } from '../../core/organizer';
import { LocalClassifier } from '../../core/ruleClassifier';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message: { type?: string; preview?: OrganizationPreview }, _sender, sendResponse) => {
      if (message.type !== 'SCAN_CHATGPT' && message.type !== 'ORGANIZE_PREVIEW' && message.type !== 'ORGANIZE_APPLY') return;
      const adapter = new ChatGPTDomAdapter(document);
      const operation = message.type === 'ORGANIZE_PREVIEW'
        ? previewOrganization(adapter, new LocalClassifier())
        : message.type === 'ORGANIZE_APPLY'
          ? message.preview ? applyOrganization(adapter, message.preview) : Promise.reject(new Error('Organization preview is missing.'))
          : adapter.scan();
      void operation
        .then((value) => sendResponse({ ok: true, value }))
        .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'ChatGPT operation failed.' }));
      return true;
    });
  },
});
