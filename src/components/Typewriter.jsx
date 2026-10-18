import { useCallback, useEffect, useRef, useState } from 'react';

const BASE_SPEED = 12; // ms per character — fast enough for a demo, slow enough to feel authored.

/**
 * Typewriter reveal with an explicit, discoverable skip.
 *
 * Per the App Flow doc, tapping anywhere on the text instantly completes it. The hint
 * is visible (not just implied) because mobile users will not guess it exists.
 */
export default function Typewriter({ text = '', speed = BASE_SPEED, onComplete, className = '' }) {
  const [count, setCount] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const timerRef = useRef(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    setSkipped(false);
    setCount(0);

    // Reduced-motion users get the full text at once instead of a character-by-character reveal.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCount(text.length);
      return undefined;
    }

    // Longer scenes type at a slightly quicker cadence so nothing drags.
    const pace = text.length > 620 ? speed * 0.65 : speed;
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i += 1;
      if (i >= text.length) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
        setCount(text.length);
      } else {
        setCount(i);
      }
    }, pace);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [text, speed]);

  const done = count >= text.length;

  useEffect(() => {
    if (done && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [done, onComplete]);

  const skip = useCallback(() => {
    if (done) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setCount(text.length);
    setSkipped(true);
  }, [done, text.length]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const tag = event.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skip]);

  return (
    <div
      className={`typewriter ${done ? 'is-done' : 'is-typing'} ${className}`}
      onClick={skip}
      onKeyDown={(event) => {
        if (event.key === 'Enter') skip();
      }}
      role="button"
      tabIndex={0}
      aria-label={done ? 'Scene text' : 'Scene text — activate to reveal it all at once'}
      title={done ? '' : 'Tap to skip'}
    >
      <p className="scene-text">
        {text.slice(0, count)}
        {!done && <span className="caret" aria-hidden="true" />}
      </p>
      {!done && (
        <span className="skip-hint" aria-hidden="true">
          tap to skip
        </span>
      )}
      {skipped && <span className="sr-only">Scene revealed in full.</span>}
    </div>
  );
}
