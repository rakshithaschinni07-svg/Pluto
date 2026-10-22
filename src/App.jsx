import { useEffect, useRef, useState } from 'react';

import Backdrop from './components/Backdrop.jsx';
import EndingScreen from './components/EndingScreen.jsx';
import GenreSelect from './components/GenreSelect.jsx';
import ProfileScreen from './components/ProfileScreen.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import StoryScreen from './components/StoryScreen.jsx';
import { getGenre } from './engine/genres.js';
import { roundsWord } from './engine/localEngine.js';
import { useStory } from './hooks/useStory.js';

const NEUTRAL_PALETTE = {
  accent: '#c9c2ff',
  accent2: '#7de2d1',
  deep: '#0d0d0d',
  glow: 'rgba(201, 194, 255, 0.32)',
  tint: 'rgba(201, 194, 255, 0.06)',
};

export default function App() {
  const {
    session,
    startRun,
    chooseOption,
    submitFreeText,
    goToProfile,
    replay,
    dismissNotice,
  } = useStory();

  const rootRef = useRef(null);
  const frameRef = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const genre = getGenre(session.genreId);
  const palette = genre?.palette || NEUTRAL_PALETTE;
  const depth = Math.max(0, Math.min(1, (session.tension + 3) / 12));

  // Pointer + scroll driven parallax. Throttled to one write per frame.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const apply = (px, py, scroll) => {
      root.style.setProperty('--px', px.toFixed(4));
      root.style.setProperty('--py', py.toFixed(4));
      root.style.setProperty('--scroll', scroll.toFixed(4));
    };

    const onPointer = (event) => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        const px = (event.clientX / window.innerWidth - 0.5) * 2;
        const py = (event.clientY / window.innerHeight - 0.5) * 2;
        apply(px, py, Math.min(1, window.scrollY / 600));
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        apply(0, 0, Math.min(1, window.scrollY / 600));
      });
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Always start a fresh screen at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [session.phase]);

  const screenKey = session.phase === 'genre' ? 'genre' : `${session.phase}-${session.round}`;

  // Genre palette + depth land on the root as CSS custom properties.
  const rootStyle = /** @type {import('react').CSSProperties} */ ({
    '--accent': palette.accent,
    '--accent2': palette.accent2,
    '--deep': palette.deep,
    '--glow': palette.glow,
    '--tint': palette.tint,
    '--depth': depth.toFixed(3),
  });

  return (
    <div ref={rootRef} className={`app ${genre ? `app--${genre.id}` : 'app--neutral'}`} style={rootStyle}>
      <Backdrop genreId={session.genreId} tension={session.tension} depth={depth} />
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <button
          type="button"
          className="topbar__brand"
          onClick={() => session.phase !== 'genre' && replay()}
          title={session.phase === 'genre' ? 'Pluto' : 'Back to genre select'}
        >
          <span className="topbar__mark">PLUTO</span>
          <span className="topbar__tag">Choose your genre. Choose your fate.</span>
        </button>

        <div className="topbar__right">
          {genre && (
            <span className="topbar__genre" title={genre.tagline}>
              <span aria-hidden="true">{genre.icon}</span> {genre.name}
            </span>
          )}
          {session.seed && session.phase !== 'genre' && (
            <span className="topbar__seed" title="This run’s seed code — it shows up on your ending card">
              seed {session.seed.code}
            </span>
          )}
          <button
            type="button"
            className="topbar__settings"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
          >
            Session
          </button>
        </div>
      </header>

      <main className="stage">
        {session.error && session.phase !== 'genre' && (
          <div className="banner banner--notice" role="alert">
            <span>{session.error}</span>
            <button type="button" className="btn btn--small" onClick={replay}>
              Start over
            </button>
          </div>
        )}
        <div className="screen-swap" key={screenKey}>
          {session.phase === 'genre' && (
            <GenreSelect
              onSelect={startRun}
              notice={session.notice}
              onDismissNotice={dismissNotice}
              replayCount={session.replayCount}
            />
          )}

          {session.phase === 'playing' && (
            <StoryScreen session={session} onChoose={chooseOption} onFreeText={submitFreeText} />
          )}

          {session.phase === 'ending' && <EndingScreen session={session} onContinue={goToProfile} />}

          {session.phase === 'profile' && (
            <ProfileScreen session={session} onReplay={replay} onNewGenre={replay} />
          )}
        </div>
      </main>

      <footer className="footer">
        <span>Pluto · {roundsWord()} decisions · one twist · no accounts, no camera, no microphone</span>
        <span className="footer__hint">Tip: tap the scene text to skip the typewriter · press 1–3 to pick an option</span>
      </footer>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} session={session} />
    </div>
  );
}
