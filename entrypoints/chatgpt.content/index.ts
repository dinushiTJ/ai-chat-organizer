import { ChatGPTDomAdapter } from '../../adapters/chatgpt/ChatGPTAdapter';
import { applyOrganization, previewOrganization, type OrganizationPreview } from '../../core/organizer';
import { LocalClassifier } from '../../core/ruleClassifier';
import type { OrganizationJobProgress } from '../../core/jobs';

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://www.chatgpt.com/*', 'https://chat.openai.com/*'],
  runAt: 'document_start',
  main() {
    const listenerKey = '__chatOrganizerMessageListener';
    if ((window as unknown as Record<string, boolean>)[listenerKey]) return;
    (window as unknown as Record<string, boolean>)[listenerKey] = true;

    const publish = (progress: OrganizationJobProgress) => {
      void chrome.runtime.sendMessage(progress).catch(() => undefined);
    };

    async function runOrganizationJob(jobId: string): Promise<void> {
      try {
        publish({ type: 'ORGANIZE_PROGRESS', jobId, phase: 'scanning', message: 'Scanning Projects and new chats...' });
        const adapter = new ChatGPTDomAdapter(document);
        publish({ type: 'ORGANIZE_PROGRESS', jobId, phase: 'classifying', message: 'Classifying new chats...' });
        const preview = await previewOrganization(adapter, new LocalClassifier());
        publish({ type: 'ORGANIZE_PROGRESS', jobId, phase: 'moving', completed: 0, total: preview.assignments.length, preview, message: 'Moving confident assignments...' });
        const result = await applyOrganization(adapter, preview);
        publish({ type: 'ORGANIZE_PROGRESS', jobId, phase: 'complete', completed: result.moved, total: preview.assignments.length, preview, result, message: 'Organization complete.' });
      } catch (error: unknown) {
        publish({ type: 'ORGANIZE_PROGRESS', jobId, phase: 'failed', error: error instanceof Error ? error.message : 'Organization failed.' });
      }
    }

    chrome.runtime.onMessage.addListener((message: { type?: string; preview?: OrganizationPreview }, _sender, sendResponse) => {
      if (message.type === 'START_ORGANIZE') {
        const jobId = crypto.randomUUID();
        sendResponse({ ok: true, jobId });
        void runOrganizationJob(jobId);
        return false;
      }
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
