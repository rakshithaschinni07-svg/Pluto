import { useEffect, useState } from 'react';

import SceneArt from './SceneArt.jsx';
import Skeleton from './Skeleton.jsx';
import Typewriter from './Typewriter.jsx';
import Tilt from './Tilt.jsx';
import { moodGrade, moodStyle } from '../engine/artMood.js';
import { ROUND_LABELS, tensionTier } from '../engine/localEngine.js';

const ACT_NUMERALS = ['I', 'II', 'III', 'IV'];

export default function StoryScreen({ session, onChoose, onFreeText }) {
  const { current, pending, round, totalRounds, tension, clues, allies, genreId, history = [], lastTone = 'arrival' } = session;
  const [textDone, setTextDone] = useState(false);
  const [freeTextOpen, setFreeTextOpen] = useState(false);
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    setTextDone(false);
    setFreeTextOpen(false);
    setFreeText('');
  }, [current]);

  const tier = tensionTier(tension);
  const showSkeleton = pending || !current;
  const beatLabel = ROUND_LABELS[Math.min(round, ROUND_LABELS.length - 1)];
  const showOptions = !pending && current && textDone;
  const grade = moodGrade(lastTone);
  const actProgress = totalRounds > 1 ? round / (totalRounds - 1) : 0;

  // Number keys pick an option — handy when the demo is being driven from a keyboard.
  useEffect(() => {
    if (!showOptions) return undefined;
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const index = Number(event.key) - 1;
      const option = current.options[index];
      if (option) onChoose(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showOptions, current, onChoose]);

  return (
    <section className={`screen screen--story depth-${Math.min(round, totalRounds - 1)}`}>
      <div className="story-meta">
        <div className="story-meta__round">
          <span className="story-meta__index">
            {Math.min(round + 1, totalRounds)}<span className="story-meta__slash">/</span>{totalRounds}
          </span>
          <span className="story-meta__label">{beatLabel}</span>
        </div>

        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalRounds} aria-valuenow={round}>
          {Array.from({ length: totalRounds }, (_, i) => (
            <span key={i} className={`progress__dot ${i < round ? 'is-done' : ''} ${i === round ? 'is-now' : ''}`} />
          ))}
        </div>

        <div className={`tension tension--${tier.label.toLowerCase()}`} title={tier.note}>
          <span className="tension__label">{tier.label}</span>
          <span className="tension__bar">
            <span className="tension__fill" style={{ width: `${Math.max(6, Math.min(100, ((tension + 3) / 12) * 100))}%` }} />
          </span>
        </div>
      </div>

      {/* The artwork re-frames itself from the stance of the last choice: camera, grade,
          weather and company all change because of the option that was picked. */}
      <Tilt className="art-frame" max={4} style={moodStyle(lastTone, tension, actProgress)}>
        <div className="art-frame__stage">
          <SceneArt
            genreId={genreId}
            variant="panel"
            mood={lastTone}
            allyCount={allies.length}
            clueCount={clues.length}
          />
        </div>
        <div className="art-frame__scrim" />
        <div className="art-frame__sweep" key={`sweep-${round}-${lastTone}`} />
        {lastTone !== 'arrival' && (
          <>
            <div className="art-frame__flash" data-mood={lastTone} key={`flash-${round}-${lastTone}`} />
            <div className="art-frame__stamp" key={`stamp-${round}-${lastTone}`} aria-hidden="true">
              {grade.label}
            </div>
          </>
        )}
        <div className="art-frame__caption">
          <span className="art-frame__act">Act {ACT_NUMERALS[Math.min(round, ACT_NUMERALS.length - 1)]}</span>
          <span className="art-frame__place">{beatLabel}</span>
          {lastTone !== 'arrival' && (
            <span className="art-frame__mood" title={grade.blurb}>
              <span className="art-frame__mood-dot" aria-hidden="true" />
              {grade.label}
            </span>
          )}
        </div>
      </Tilt>

      {history.length > 0 && (
        <div className="trail" aria-label="Your decisions so far">
          <span>Your path</span>
          {history.map((h, i) => (
            <span key={`${h.round}-${i}`} style={{ display: 'contents' }}>
              {i > 0 && <span className="trail__arrow">→</span>}
              <span className="trail__step">{moodGrade(h.tone).label}</span>
            </span>
          ))}
        </div>
      )}

      <div className="story-body">
        {showSkeleton ? (
          <Skeleton seed={`${genreId}-${round}`} lines={5} showOptions={false} />
        ) : (
          <Typewriter
            text={current.sceneText}
            onComplete={() => setTextDone(true)}
            key={`${genreId}-${round}-${current.sceneText?.slice(0, 24)}`}
          />
        )}
      </div>

      {(clues.length > 0 || allies.length > 0) && (
        <div className="tray" aria-label="What you have gathered">
          {clues.length > 0 && (
            <div className="tray__group">
              <span className="tray__label">Clues</span>
              <div className="tray__chips">
                {clues.map((clue) => (
                  <span key={clue} className="chip chip--clue">
                    {clue}
                  </span>
                ))}
              </div>
            </div>
          )}
          {allies.length > 0 && (
            <div className="tray__group">
              <span className="tray__label">Allies</span>
              <div className="tray__chips">
                {allies.map((ally) => (
                  <span key={ally} className="chip chip--ally">
                    {ally}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`options ${showOptions ? 'is-visible' : ''}`}>
        {showSkeleton && (
          <Skeleton seed={`${genreId}-${round}-opt`} lines={1} showOptions />
        )}
        {showOptions &&
          current.options.map((option, index) => (
            <Tilt
              key={option.id}
              as="button"
              type="button"
              className="option"
              style={{ '--stagger': `${index * 90}ms` }}
              onClick={() => onChoose(option)}
              max={5}
            >
              <span className="option__index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="option__text">{option.text}</span>
              {option.tags?.clue && <span className="option__hint option__hint--clue">clue</span>}
              {option.tags?.ally && <span className="option__hint option__hint--ally">ally</span>}
            </Tilt>
          ))}
      </div>

      {showOptions && (
        <div className="freeform">
          {!freeTextOpen ? (
            <button type="button" className="freeform__toggle" onClick={() => setFreeTextOpen(true)}>
              Something else…
            </button>
          ) : (
            <form
              className="freeform__form"
              onSubmit={(event) => {
                event.preventDefault();
                if (freeText.trim().length < 3) return;
                onFreeText(freeText);
                setFreeText('');
                setFreeTextOpen(false);
              }}
            >
              <label className="sr-only" htmlFor="freeform-input">
                Describe what you do instead
              </label>
              <input
                id="freeform-input"
                autoFocus
                className="freeform__input"
                value={freeText}
                maxLength={140}
                placeholder="Say what you actually do…"
                onChange={(event) => setFreeText(event.target.value)}
              />
              <button type="submit" className="freeform__submit" disabled={freeText.trim().length < 3}>
                Go
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
