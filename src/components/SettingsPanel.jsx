import { useEffect, useState } from 'react';

import { AI_TIMEOUT_MS, clearAiConfig, DEFAULT_CONFIG, testConnection } from '../engine/aiClient.js';

/**
 * Operator panel. Not part of the player's story — it exists so the demo can be pointed
 * at a provider for a live session, and so the engine state is inspectable backstage.
 */
export default function SettingsPanel({ open, onClose, config, onSave, session, aiEnabled }) {
  const [draft, setDraft] = useState(config);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setStatus('');
    }
  }, [open, config]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleTest = async () => {
    setTesting(true);
    setStatus('Testing…');
    try {
      const ok = await testConnection(draft);
      setStatus(ok ? 'Connection OK — the model answered.' : 'Connected, but the reply was not the expected JSON.');
    } catch (error) {
      setStatus(`Failed: ${error?.message || 'unknown error'} (${AI_TIMEOUT_MS / 1000}s timeout, one retry)`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <aside className="drawer" role="dialog" aria-label="Session settings">
      <div className="drawer__head">
        <h2>Session</h2>
        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </div>

      <section className="drawer__section">
        <h3>Engine</h3>
        <dl className="stats stats--tight">
          <div>
            <dt>Mode</dt>
            <dd>
              {session.usingFallback ? 'Scripted fallback' : aiEnabled ? 'Live AI' : 'Local engine'}
            </dd>
          </div>
          <div>
            <dt>Round</dt>
            <dd>
              {Math.min(session.round + 1, session.totalRounds)}/{session.totalRounds}
            </dd>
          </div>
          <div>
            <dt>Tension</dt>
            <dd>{session.tension}</dd>
          </div>
          <div>
            <dt>Replays</dt>
            <dd>{session.replayCount}</dd>
          </div>
        </dl>
        <p className="drawer__note">
          With no key configured, Pluto runs on its local seeded engine — the story still varies every run.
          If a key is set and a call fails once, the session drops silently into the scripted path from that
          round onward. Players never see an error.
        </p>
        {session.status && <p className="drawer__note drawer__note--live">{session.status}</p>}
      </section>

      <section className="drawer__section">
        <h3>AI provider (optional)</h3>
        <label className="field">
          <span>Endpoint (OpenAI-compatible chat completions)</span>
          <input
            type="url"
            value={draft.baseUrl}
            spellCheck={false}
            onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
            placeholder={DEFAULT_CONFIG.baseUrl}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input
            type="text"
            value={draft.model}
            spellCheck={false}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            placeholder={DEFAULT_CONFIG.model}
          />
        </label>
        <label className="field">
          <span>API key (kept in this browser only)</span>
          <input
            type="password"
            value={draft.apiKey}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
            placeholder="sk-…"
          />
        </label>

        <div className="drawer__actions">
          <button type="button" className="btn btn--small" onClick={() => onSave(draft)}>
            Save
          </button>
          <button type="button" className="btn btn--small" onClick={handleTest} disabled={testing || !draft.apiKey}>
            {testing ? 'Testing…' : 'Test'}
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => {
              clearAiConfig();
              const cleared = { ...DEFAULT_CONFIG };
              setDraft(cleared);
              onSave(cleared);
              setStatus('Key cleared from this browser.');
            }}
          >
            Clear
          </button>
        </div>
        {status && <p className="drawer__note">{status}</p>}
        <p className="drawer__warn">
          Client-side keys are visible in devtools. Use a provider-side spend cap and never commit a key —
          if this is ever demoed beyond one room, a thin proxy is required.
        </p>
      </section>
    </aside>
  );
}
