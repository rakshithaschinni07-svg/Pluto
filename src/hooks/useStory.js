import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GENRES } from '../engine/genres.js';
import { generateSeed } from '../engine/seed.js';
import { TOTAL_ROUNDS, ROUND_LABELS, localScene, localEnding, classifyFreeText } from '../engine/localEngine.js';
import { applyAxes, deriveProfile } from '../engine/profile.js';
import { deriveTone } from '../engine/artMood.js';

/**
 * Simulated thinking time for the local engine. Keeps the shimmer UI honest
 * and stops the demo from feeling like a static page, without adding real dead air.
 */
const LOCAL_LATENCY = [420, 900];

/** Soft replay cap (TRD cost control). Never blocks — it only nudges. */
export const REPLAY_SOFT_CAP = 5;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('cancelled'));
        },
        { once: true },
      );
    }
  });
}

export function initialSession() {
  return {
    phase: 'genre', // genre | playing | ending | profile
    genreId: null,
    seed: null,
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    tension: 0,
    clues: [],
    allies: [],
    axes: { bold_cautious: 0, lone_social: 0, curious_decisive: 0 },
    history: [],
    current: null,
    // Stance of the most recent decision — drives the choice-reactive artwork.
    lastTone: 'arrival',
    pending: false,
    generating: false,
    usingFallback: false,
    mode: 'local',
    status: '',
    ending: null,
    profile: null,
    replayCount: 0,
    notice: null,
    error: null,
  };
}

export function useStory() {
  const sessionRef = useRef(initialSession());
  const [session, setSession] = useState(sessionRef.current);
  const abortRef = useRef(null);

  const commit = useCallback((patch) => {
    const next = typeof patch === 'function' ? patch(sessionRef.current) : { ...sessionRef.current, ...patch };
    sessionRef.current = next;
    setSession(next);
    return next;
  }, []);

  useEffect(() => () => abortRef.current?.abort?.(), []);

  const startAbort = useCallback(() => {
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, []);

  /** Generate one round with the local seeded engine. Never throws at the caller. */
  const generateScene = useCallback(async (snapshot, round, signal) => {
    const { genreId, seed, tension, clues, allies } = snapshot;
    await sleep(LOCAL_LATENCY[0] + Math.random() * (LOCAL_LATENCY[1] - LOCAL_LATENCY[0]), signal);
    return { data: localScene({ genreId, seed, round, tension, clues, allies }), mode: 'local', usingFallback: false };
  }, []);

  const generateEnding = useCallback(async (snapshot, signal) => {
    const { genreId, seed, tension, clues, allies, history } = snapshot;
    const choices = history.map((h) => h.choiceMade);
    await sleep(LOCAL_LATENCY[0], signal);
    return localEnding({ genreId, seed, clues, allies, tension, choices });
  }, []);

  const buildProfile = useCallback((snapshot, ending) => {
    return deriveProfile(snapshot.axes, {
      rounds: snapshot.history.length,
      clues: snapshot.clues,
      allies: snapshot.allies,
      tension: snapshot.tension,
      usingFallback: snapshot.usingFallback,
      mode: snapshot.mode,
      genre: GENRES[snapshot.genreId]?.name || null,
      seedCode: snapshot.seed?.code || '—',
      endingTitle: ending?.title,
    });
  }, []);

  /** Begin a new run for a genre. */
  const startRun = useCallback(
    async (genreId) => {
      const signal = startAbort().signal;
      const fresh = {
        ...initialSession(),
        phase: 'playing',
        genreId,
        seed: generateSeed(genreId, String(sessionRef.current.replayCount)),
        replayCount: sessionRef.current.replayCount,
        notice: sessionRef.current.notice,
        pending: true,
        generating: true,
        status: '',
      };
      commit(fresh);

      try {
        const { data, mode, usingFallback } = await generateScene(fresh, 0, signal);
        commit(() => ({
          ...sessionRef.current,
          current: data,
          pending: false,
          generating: false,
          mode,
          usingFallback,
          status: '',
        }));
      } catch (error) {
        if (error?.message !== 'cancelled') {
          commit({ pending: false, generating: false, error: 'Could not begin the story.' });
        }
      }
    },
    [commit, generateScene, startAbort],
  );

  /**
   * Commit a choice. The next scene starts generating immediately — before the render
   * cycle — which is the optimistic pre-fetch from the TRD.
   */
  const chooseOption = useCallback(
    async (option) => {
      if (!option?.tags) return;
      // A double-tap, or a key press plus a click, must not commit two decisions.
      if (sessionRef.current.pending || sessionRef.current.phase !== 'playing') return;
      const signal = startAbort().signal;
      const snapshot = sessionRef.current;
      const round = snapshot.round;

      const nextTension = Math.max(-3, snapshot.tension + (option.tags.tensionDelta ?? 0));
      const nextClues = option.tags.clue ? [...snapshot.clues, option.tags.clue] : snapshot.clues;
      const nextAllies = option.tags.ally
        ? snapshot.allies.includes(option.tags.ally)
          ? snapshot.allies
          : [...snapshot.allies, option.tags.ally]
        : snapshot.allies;
      const nextAxes = applyAxes(snapshot.axes, option.tags.profileAxis);

      const tone = deriveTone(option);

      const entry = {
        round,
        roundLabel: ROUND_LABELS[Math.min(round, ROUND_LABELS.length - 1)],
        sceneText: snapshot.current?.sceneText,
        options: snapshot.current?.options,
        choiceMade: option.text,
        tagsAtChoice: option.tags,
        tone,
      };

      const isFinalRound = round >= snapshot.totalRounds - 1;

      const advanced = {
        ...snapshot,
        tension: nextTension,
        clues: nextClues,
        allies: nextAllies,
        axes: nextAxes,
        lastTone: tone,
        history: [...snapshot.history, entry],
        round: isFinalRound ? round : round + 1,
        current: isFinalRound ? snapshot.current : null,
        pending: true,
        generating: true,
        status: '',
        error: null,
      };

      commit(advanced);

      // Start the request NOW — not after the next render. This is the optimistic
      // pre-fetch: generation overlaps the transition instead of following it.
      const pendingScene = isFinalRound ? null : generateScene(advanced, advanced.round, signal);
      const pendingEnding = isFinalRound ? generateEnding(advanced, signal) : null;

      if (isFinalRound) {
        commit((s) => ({ ...s, phase: 'ending' }));
      }

      try {
        if (pendingEnding) {
          const ending = await pendingEnding;
          const profile = buildProfile(advanced, ending);
          commit(() => ({
            ...sessionRef.current,
            ending,
            profile,
            pending: false,
            generating: false,
            mode: 'local',
          }));
        } else if (pendingScene) {
          const { data, mode, usingFallback } = await pendingScene;
          commit(() => ({
            ...sessionRef.current,
            current: data,
            pending: false,
            generating: false,
            mode,
            usingFallback,
            status: '',
          }));
        }
      } catch (error) {
        if (error?.message !== 'cancelled') {
          commit({ pending: false, generating: false, error: 'The story could not continue.' });
        }
      }
    },
    [buildProfile, commit, generateEnding, generateScene, startAbort],
  );

  /** Absorb a free-text "something else" answer.  */
  const submitFreeText = useCallback(
    async (text) => {
      const trimmed = String(text || '').trim();
      if (trimmed.length < 3) return;
      await chooseOption(classifyFreeText(trimmed));
    },
    [chooseOption],
  );

  const goToProfile = useCallback(() => {
    commit({ phase: 'profile' });
  }, [commit]);

  const replay = useCallback(() => {
    abortRef.current?.abort?.();
    const replayCount = sessionRef.current.replayCount + 1;
    const notice =
      replayCount >= REPLAY_SOFT_CAP
        ? 'Taking a break? Try a different genre — every one has its own twist.'
        : null;
    commit({ ...initialSession(), replayCount, notice });
  }, [commit]);

  const dismissNotice = useCallback(() => commit({ notice: null }), [commit]);

  const value = useMemo(
    () => ({
      session,
      startRun,
      chooseOption,
      submitFreeText,
      goToProfile,
      replay,
      dismissNotice,
    }),
    [
      session,
      startRun,
      chooseOption,
      submitFreeText,
      goToProfile,
      replay,
      dismissNotice,
    ],
  );

  return value;
}
