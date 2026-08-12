import { useEffect, useState } from 'react';
import type { ScanResult } from '../adapters/chatgpt/types';
import type { OrganizationPreview, OrganizationResult } from '../core/organizer';

type RuntimeResponse<T> = { ok: true; value: T } | { ok: false; error: string };
type ConnectionState = 'checking' | 'connected' | 'disconnected';

export default function App() {
  const [scan, setScan] = useState<ScanResult>({ projects: [], unorganizedChats: [] });
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle');
  const [preview, setPreview] = useState<OrganizationPreview | undefined>();
  const [result, setResult] = useState<OrganizationResult | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [connection, setConnection] = useState<ConnectionState>('checking');

  function isChatGPTUrl(url: string | undefined): boolean {
    return Boolean(url?.startsWith('https://chatgpt.com/') || url?.startsWith('https://chat.openai.com/'));
  }

  async function getChatGPTTab(): Promise<chrome.tabs.Tab & { id: number }> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isChatGPTUrl(tab.url)) throw new Error('Open ChatGPT in the active browser tab.');
    return tab as chrome.tabs.Tab & { id: number };
  }

  async function sendToChatGPT<T>(tabId: number, message: unknown): Promise<T> {
    try {
      return await chrome.tabs.sendMessage(tabId, message) as T;
    } catch (error) {
      await connectContentScript(tabId);
      try {
        return await chrome.tabs.sendMessage(tabId, message) as T;
      } catch {
        throw error;
      }
    }
  }

  async function connectContentScript(tabId: number): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/chatgpt.js'],
    });
  }

  async function checkConnection() {
    try {
      const tab = await getChatGPTTab();
      const response = await sendToChatGPT<RuntimeResponse<{ connected: boolean }>>(tab.id, { type: 'PING_CHATGPT' });
      if (!response.ok) throw new Error(response.error);
      setConnection('connected');
    } catch {
      setConnection('disconnected');
    }
  }

  useEffect(() => { void checkConnection(); }, []);

  async function scanChatGPT() {
    setStatus('scanning');
    setErrorMessage(undefined);
    try {
      const tab = await getChatGPTTab();
      let result: ScanResult;
      try {
        const response = await sendToChatGPT<RuntimeResponse<ScanResult>>(tab.id, { type: 'SCAN_CHATGPT' });
        if (!response.ok) throw new Error(response.error);
        result = response.value;
      } catch {
        throw new Error('ChatGPT is still loading. Refresh the ChatGPT tab and try again.');
      }
      setScan(result);
      setConnection('connected');
      setStatus('idle');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Scan failed.');
      setStatus('error');
      console.error(error);
    }
  }

  async function organizeNew() {
    setStatus('scanning');
    setPreview(undefined);
    setResult(undefined);
    setErrorMessage(undefined);
    try {
      const tab = await getChatGPTTab();
      const response = await sendToChatGPT<RuntimeResponse<OrganizationPreview>>(tab.id, { type: 'ORGANIZE_PREVIEW' });
      if (!response.ok) throw new Error(response.error);
      setPreview(response.value);
      const actionable = response.value.assignments.some((assignment) => assignment.action !== 'NEEDS_REVIEW' && assignment.confidence >= 0.7);
      if (actionable) {
        const appliedResponse = await sendToChatGPT<RuntimeResponse<OrganizationResult>>(tab.id, { type: 'ORGANIZE_APPLY', preview: response.value });
        if (!appliedResponse.ok) throw new Error(appliedResponse.error);
        setResult(appliedResponse.value);
      }
      setStatus('idle');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Organization failed.');
      setStatus('error');
      console.error(error);
    }
  }

  async function applyOrganization() {
    if (!preview) return;
    setStatus('scanning');
    setErrorMessage(undefined);
    try {
      const tab = await getChatGPTTab();
      const response = await sendToChatGPT<RuntimeResponse<OrganizationResult>>(tab.id, { type: 'ORGANIZE_APPLY', preview });
      if (!response.ok) throw new Error(response.error);
      setResult(response.value);
      setStatus('idle');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Organization failed.');
      setStatus('error');
      console.error(error);
    }
  }

  return (
    <main className="panel">
      <header>
        <div className="brand"><img src="/icons/Sorta Logo - dark.png" alt="" /><div className="eyebrow">CHAT ORGANIZER</div></div>
        <h1>Organize your chats</h1>
        <p className="muted">Your Projects are the source of truth. Nothing is stored by us.</p>
      </header>
      <section className={`connection ${connection === 'disconnected' ? 'connection-error' : ''}`}><span className="dot" /> {connection === 'connected' ? 'Connected to ChatGPT' : connection === 'checking' ? 'Checking ChatGPT connection...' : 'ChatGPT page not connected'}</section>
      <section className="stats">
        <div><strong>{scan.projects.length}</strong><span>Projects found</span></div>
        <div><strong>{scan.unorganizedChats.length}</strong><span>Unorganized chats</span></div>
      </section>
      <div className="actions">
        <button className="primary" onClick={organizeNew} disabled={status === 'scanning'}>
          Organize New
        </button>
        <button className="primary" onClick={scanChatGPT} disabled={status === 'scanning'}>
          {status === 'scanning' ? 'Scrolling through chats...' : 'Scan ChatGPT'}
        </button>
        <button className="secondary" onClick={scanChatGPT} disabled={status === 'scanning'} aria-label="Refresh chat count">
          Refresh count
        </button>
      </div>
      {status === 'scanning' && <p className="muted scan-note">Scrolling the ChatGPT sidebar to load all visible chats.</p>}
      {status === 'error' && <p className="error">{errorMessage ?? 'Open ChatGPT in the active tab, then try again.'}</p>}
      {connection === 'disconnected' && <p className="error">Refresh the ChatGPT page after reloading the extension, then reopen this panel.</p>}
      {preview && <section className="preview">
        <h2>Organization Preview</h2>
        <p className="muted">{preview.conversationsScanned === 0 ? 'Everything is already organized.' : `${preview.conversationsScanned} new chats reviewed.`}</p>
        {preview.conversationsScanned > 0 && preview.assignments.length === 0 && <p className="error">No conversations received a safe classification.</p>}
        {preview.assignments.map((assignment) => <div className="assignment" key={assignment.conversationId}>
          <strong>{assignment.conversationId}</strong>
          <span>{assignment.action === 'NEEDS_REVIEW' ? 'Needs review' : `${assignment.action === 'CREATE_NEW' ? 'New Project' : 'Use'}: ${assignment.project ?? 'Unassigned'}`}</span>
        </div>)}
        {preview.assignments.some((assignment) => assignment.action !== 'NEEDS_REVIEW' && assignment.confidence >= 0.7) && !result && <button className="primary" onClick={applyOrganization}>Apply Organization</button>}
        {result && <><p className={result.moved > 0 ? 'success' : 'error'}>{result.moved > 0 ? `Moved ${result.moved} chats.` : 'No chats were moved.'} Created {result.created} Projects. Skipped {result.skipped}. Failed {result.failed.length}.</p>{result.failed.map((failure) => <p className="error" key={failure}>{failure}</p>)}</>}
      </section>}
      {status === 'idle' && scan.projects.length > 0 && (
        <section className="project-list">
          <h2>Existing Projects</h2>
          {scan.projects.map((project) => <div className="project" key={project.id}>{project.name}</div>)}
        </section>
      )}
    </main>
  );
}
