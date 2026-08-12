import { useState } from 'react';
import type { ScanResult } from '../adapters/chatgpt/types';
import type { OrganizationPreview, OrganizationResult } from '../core/organizer';

export default function App() {
  const [scan, setScan] = useState<ScanResult>({ projects: [], unorganizedChats: [] });
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle');
  const [preview, setPreview] = useState<OrganizationPreview | undefined>();
  const [result, setResult] = useState<OrganizationResult | undefined>();

  async function scanChatGPT() {
    setStatus('scanning');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith('https://chatgpt.com/')) throw new Error('Open ChatGPT to scan.');
      let result: ScanResult;
      try {
        result = await chrome.tabs.sendMessage<{ type: string }, ScanResult>(tab.id, { type: 'SCAN_CHATGPT' });
      } catch {
        throw new Error('ChatGPT is still loading. Refresh the ChatGPT tab and try again.');
      }
      setScan(result);
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      console.error(error);
    }
  }

  async function organizeNew() {
    setStatus('scanning');
    setPreview(undefined);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith('https://chatgpt.com/')) throw new Error('Open ChatGPT to organize.');
      const result = await chrome.tabs.sendMessage<{ type: string }, OrganizationPreview>(tab.id, { type: 'ORGANIZE_PREVIEW' });
      setPreview(result);
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      console.error(error);
    }
  }

  async function applyOrganization() {
    if (!preview) return;
    setStatus('scanning');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith('https://chatgpt.com/')) throw new Error('Open ChatGPT to organize.');
      const applied = await chrome.tabs.sendMessage<{ type: string; preview: OrganizationPreview }, OrganizationResult>(tab.id, { type: 'ORGANIZE_APPLY', preview });
      setResult(applied);
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      console.error(error);
    }
  }

  return (
    <main className="panel">
      <header>
        <div className="eyebrow">CHAT ORGANIZER</div>
        <h1>Organize your chats</h1>
        <p className="muted">Your Projects are the source of truth. Nothing is stored by us.</p>
      </header>
      <section className="connection"><span className="dot" /> Connected to ChatGPT</section>
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
      {status === 'error' && <p className="error">Open ChatGPT in the active tab, then try again.</p>}
      {preview && <section className="preview">
        <h2>Organization Preview</h2>
        <p className="muted">{preview.conversationsScanned === 0 ? 'Everything is already organized.' : `${preview.conversationsScanned} new chats reviewed.`}</p>
        {preview.assignments.map((assignment) => <div className="assignment" key={assignment.conversationId}>
          <strong>{assignment.conversationId}</strong>
          <span>{assignment.action === 'NEEDS_REVIEW' ? 'Needs review' : `${assignment.action === 'CREATE_NEW' ? 'New Project' : 'Use'}: ${assignment.project ?? 'Unassigned'}`}</span>
        </div>)}
        {preview.assignments.some((assignment) => assignment.action !== 'NEEDS_REVIEW' && assignment.confidence >= 0.7) && !result && <button className="primary" onClick={applyOrganization}>Apply Organization</button>}
        {result && <p className="success">Moved {result.moved} chats. Skipped {result.skipped}. Failed {result.failed.length}.</p>}
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
