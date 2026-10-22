import { useEffect } from 'react';

/**
 * Operator panel. Not part of the player's story — it just shows the state of the run
 * backstage. Pluto runs entirely on its local seeded engine: no API, no key, no network.
 */
export default function SettingsPanel({ open, onClose, session }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside className="drawer" role="dialog" aria-label="Session settings">
      <div className="drawer__head">
        <h2>Session</h2>
        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </div>

      <section className="drawer__section">
        <h3>Run</h3>
        <dl className="stats stats--tight">
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
          <div>
            <dt>Seed</dt>
            <dd>{session.seed?.code || '—'}</dd>
          </div>
        </dl>
        <p className="drawer__note">
          Pluto runs fully offline on its seeded local engine — no API, no key, no network. The story
          still varies every run.
        </p>
      </section>
    </aside>
  );
}
