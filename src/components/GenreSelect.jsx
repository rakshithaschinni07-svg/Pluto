import { GENRES, GENRE_ORDER } from '../engine/genres.js';
import { roundsWord } from '../engine/localEngine.js';
import SceneArt from './SceneArt.jsx';
import Tilt from './Tilt.jsx';

export default function GenreSelect({ onSelect, notice, onDismissNotice, replayCount }) {
  return (
    <section className="screen screen--genre">
      <header className="hero">
        <p className="hero__eyebrow">Interactive fiction · {roundsWord()} rounds · one ending</p>
        <h1 className="hero__title">
          <span className="hero__wordmark">PLUTO</span>
        </h1>
        <p className="hero__tagline">Choose your genre. Choose your fate.</p>
        <p className="hero__sub">
          {roundsWord({ capitalise: true })} decisions. A twist you did not pick. An explorer profile built from how you actually chose —
          not how you meant to.
        </p>
      </header>

      {notice && (
        <div className="banner banner--notice" role="status">
          <span>{notice}</span>
          <button type="button" className="banner__dismiss" onClick={onDismissNotice} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="genre-grid">
        {GENRE_ORDER.map((id, index) => {
          const genre = GENRES[id];
          return (
            <Tilt
              key={id}
              as="button"
              type="button"
              className="genre-card"
              style={{
                '--card-accent': genre.palette.accent,
                '--card-accent2': genre.palette.accent2,
                '--card-depth': `${index * 24 + 40}ms`,
              }}
              onClick={() => onSelect(id)}
              max={9}
            >
              <span className="genre-card__art" aria-hidden="true">
                <SceneArt genreId={id} variant="thumb" />
              </span>
              <span className="genre-card__glow" />
              <span className="genre-card__icon" aria-hidden="true">
                {genre.icon}
              </span>
              <span className="genre-card__name">{genre.name}</span>
              <span className="genre-card__tagline">{genre.tagline}</span>
              <span className="genre-card__blurb">{genre.blurb}</span>
              <span className="genre-card__cta">Begin →</span>
            </Tilt>
          );
        })}
      </div>

      <footer className="genre-footer">
        <p>
          Runs entirely in the browser. No camera, no microphone, no account. Every playthrough generates a
          new seed, so the same genre will not tell the same story twice.
        </p>
        {replayCount > 0 && (
          <p className="genre-footer__count">
            Runs this session: <strong>{replayCount + 1}</strong>
          </p>
        )}
      </footer>
    </section>
  );
}
