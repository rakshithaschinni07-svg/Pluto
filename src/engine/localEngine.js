/**
 * Local story engine.
 *
 * This is Pluto's always-available generator. It runs when no API key is configured,
 * and it is what the AI adapter mirrors when it is working. Because it is seeded,
 * three consecutive runs of the same genre produce materially different openings —
 * the Phase 8 replayability test — without any network call.
 */

import { GENRES, getGenre } from './genres.js';
import { createRng } from './seed.js';

export const TOTAL_ROUNDS = 4;

export const ROUND_LABELS = ['Arrival', 'Friction', 'Reveal', 'The Choice'];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** TOTAL_ROUNDS as a word ("four"), so UI copy follows the constant if it changes to 3. */
export function roundsWord({ capitalise = false } = {}) {
  const word = NUMBER_WORDS[TOTAL_ROUNDS] ?? String(TOTAL_ROUNDS);
  return capitalise ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Option archetypes. Each pushes a different axis so every round has real texture. */
const OPTION_ARCHETYPES = [
  {
    key: 'bold',
    lines: [
      'Push straight in. Ask the question nobody has been willing to say out loud.',
      'Move before the moment closes — {place} will not offer this twice.',
      'Force the issue, plainly, and watch who flinches.',
      'Go at it head-on, and let the consequences catch up later.',
    ],
    tags: { tensionDelta: 2, profileAxis: { bold_cautious: 1 } },
  },
  {
    key: 'wary',
    lines: [
      'Hold back. Watch {figure} for one more minute before committing.',
      'Say nothing yet, and map the room properly first.',
      'Take the safe line and keep your exit behind you.',
      'Slow it down. There is something you have not been told.',
    ],
    tags: { tensionDelta: -1, profileAxis: { bold_cautious: -1 } },
  },
  {
    key: 'curious',
    lines: [
      'Follow the detail that does not fit — {object} is a thread worth pulling.',
      'Ask the question that makes everyone uncomfortable, then listen.',
      'Chase the discrepancy. Nobody engineers a coincidence that obvious.',
      'Go looking for {object}, even though you were told not to.',
    ],
    tags: { tensionDelta: 1, profileAxis: { curious_decisive: 1 }, grantsClue: true },
  },
  {
    key: 'social',
    lines: [
      'Get {figure} on your side first. You cannot do this alone.',
      'Trade something real with {figure} and build a debt you can call in.',
      'Find the person in the room who is also scared, and stand next to them.',
      'Make {figure} an ally, even if it costs you honesty.',
    ],
    tags: { tensionDelta: 0, profileAxis: { lone_social: -1 }, grantsAlly: true },
  },
  {
    key: 'commit',
    lines: [
      'Choose now, with what you have. Waiting has its own price.',
      'Stop gathering and start deciding — {place} rewards neither patience nor doubt.',
      'Commit to the version you can defend, and let the rest fall.',
      'Cut the options down to one and walk through the door.',
    ],
    tags: { tensionDelta: 1, profileAxis: { curious_decisive: -1 } },
  },
];

const TENSION_TIERS = [
  { min: 7, label: 'Critical', note: 'The room has stopped pretending.' },
  { min: 4, label: 'Charged', note: 'Every sentence now costs something.' },
  { min: 2, label: 'Watchful', note: 'People are choosing their words.' },
  { min: -99, label: 'Calm', note: 'Still civil. Still deniable.' },
];

export function tensionTier(tension) {
  return TENSION_TIERS.find((t) => tension >= t.min) || TENSION_TIERS[TENSION_TIERS.length - 1];
}

function fill(template, slots) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) =>
    slots[key] !== undefined && slots[key] !== null ? String(slots[key]) : m,
  );
}

function titleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Join fragments without lowercase sentence starts — slot values are lowercase by
 * design (they read correctly mid-sentence), so capitalise after sentence breaks.
 */
function sentenceCase(text) {
  return String(text).replace(/(^|[.!?]\s+)([a-z])/g, (match, lead, letter) => lead + letter.toUpperCase());
}

/**
 * Choose the concrete nouns this run will use. Stable per (genre, seed) so a scene
 * that has already been shown never mutates on re-render.
 */
export function buildRunContext(genreId, seed) {
  const genre = getGenre(genreId) || GENRES.scifi;
  const key = seed?.code ? `${seed.code}-${seed.number}` : 'default';
  const rng = createRng('context', genreId, key);
  const n = genre.nouns;
  const [place, place2] = rng.sample(n.places, 2);
  const [figure, figure2] = rng.sample(n.figures, 2);
  const [object, object2] = rng.sample(n.objects, 2);
  const stakes = rng.sample(n.stakes, 3);
  const pressure = rng.pick(n.pressures);
  const hour = rng.pick(n.hours);
  const sensation = rng.pick(n.sensations);

  return {
    genre,
    place,
    place2,
    figure,
    figure2,
    object,
    object2,
    stakes,
    pressure,
    hour,
    sensation,
    twistLens: rng.pick(genre.twistLenses),
    endingTitle: rng.pick(genre.endingTitles),
    bias: seed?.bias || { pace: 'slow-burn', morality: 'grey', twistStyle: 'betrayal' },
  };
}

/**
 * Generate one round of play locally.
 * @returns {{sceneText:string, options:Array, source:'local'}}
 */
export function localScene({ genreId, seed, round, tension = 0, clues = [], allies = [] }) {
  const ctx = buildRunContext(genreId, seed);
  const genre = ctx.genre;
  const rng = createRng('scene', genreId, `${seed?.code}-${seed?.number}`, `round-${round}`);

  const slots = {
    place: ctx.place,
    place2: ctx.place2,
    figure: ctx.figure,
    figure2: ctx.figure2,
    object: ctx.object,
    object2: ctx.object2,
    stake: ctx.stakes[0],
    pressure: ctx.pressure,
    hour: ctx.hour,
    sensation: ctx.sensation,
  };

  const beats = genre.beats[Math.min(round, genre.beats.length - 1)];
  const beat = fill(rng.pick(beats), slots);
  const mood = fill(rng.pick(genre.mood), slots);
  // Threads weave in the run's second location, second figure and second artefact, so
  // the middle of the story opens out instead of restating the same pressure.
  const threads = rng.sample(genre.threads, round >= 1 ? 2 : 1).map((line) => fill(line, slots));
  const closer = round === 0 ? '' : fill(rng.pick(genre.stakesLines), slots);

  const sceneText = sentenceCase([beat, ...threads, mood, closer].filter(Boolean).join(' '));

  // Pick three distinct archetypes; the final round always includes a bold line so the
  // last decision feels like one.
  const pool = [...OPTION_ARCHETYPES];
  const picked = [];
  if (round >= TOTAL_ROUNDS - 1) {
    const boldIndex = pool.findIndex((a) => a.key === 'bold');
    picked.push(pool.splice(boldIndex, 1)[0]);
  }
  while (picked.length < 3 && pool.length) {
    picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  }

  const usedClues = new Set(clues);
  const usedAllies = new Set(allies);

  const options = picked.map((archetype, index) => {
    const text = fill(rng.pick(archetype.lines), slots);
    const tags = {
      tensionDelta: archetype.tags.tensionDelta,
      clue: null,
      ally: null,
      profileAxis: { bold_cautious: 0, lone_social: 0, curious_decisive: 0, ...archetype.tags.profileAxis },
    };

    if (archetype.tags.grantsClue) {
      const candidates = [...genre.nouns.objects, ctx.object2, ctx.object].filter((o) => !usedClues.has(titleCase(o)));
      const clue = rng.pick(candidates.length ? candidates : genre.nouns.objects);
      tags.clue = titleCase(clue);
      usedClues.add(tags.clue);
    }
    if (archetype.tags.grantsAlly) {
      const candidates = [...genre.nouns.figures, ctx.figure2].filter((f) => !usedAllies.has(f));
      tags.ally = rng.pick(candidates.length ? candidates : genre.nouns.figures);
      usedAllies.add(tags.ally);
    }

    return { id: `${round}-${archetype.key}-${index}`, text, tags, tone: archetype.key };
  });

  return { sceneText, options, source: 'local' };
}

/** Compose an ending from the accumulated story state. Also fully local. */
export function localEnding({ genreId, seed, clues = [], allies = [], tension = 0, choices = [] }) {
  // Composition below is assembled as fragments; sentence-case it once at the end.
  const ctx = buildRunContext(genreId, seed);
  const genre = ctx.genre;
  const rng = createRng('ending', genreId, `${seed?.code}-${seed?.number}`, String(clues.join('|')), String(choices.length));

  const tier = tensionTier(tension);
  const allyLine = allies.length
    ? `${allies[allies.length - 1]} stands with you at the end, which is more than you had any right to expect.`
    : 'You end this the way you began it — with nobody standing directly behind you.';
  const clueLine = clues.length
    ? `It was ${clues[clues.length - 1].toLowerCase()} that finally made the shape of it obvious.`
    : 'You never did find the piece that would have made it simple.';
  const lastChoice = choices.length ? choices[choices.length - 1] : null;
  const choiceLine = lastChoice
    ? `Your last decision — “${truncate(lastChoice, 90)}” — is the one that will be remembered here, and misremembered later.`
    : '';

  const text = sentenceCase([
    `${fill(rng.pick(genre.beats[genre.beats.length - 1]), {
      place: ctx.place,
      figure: ctx.figure,
      object: ctx.object,
      stake: ctx.stakes[1],
      pressure: ctx.pressure,
      sensation: ctx.sensation,
    })}`,
    clueLine,
    allyLine,
    `The tension of the whole affair sits at ${tier.label.toLowerCase()} — ${tier.note.toLowerCase()}`,
    choiceLine,
  ]
    .filter(Boolean)
    .join(' '));

  return {
    title: ctx.endingTitle,
    text,
    twist: ctx.twistLens,
    epilogue: fill(rng.pick(genre.mood), {
      place: ctx.place,
      figure: ctx.figure,
      object: ctx.object,
      sensation: ctx.sensation,
      stake: ctx.stakes[2],
    }),
    source: 'local',
  };
}

function truncate(str, n) {
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/**
 * Free-text "something else" support. Maps arbitrary input to a deterministic
 * archetype so the story can absorb it even with no AI available.
 */
export function classifyFreeText(text) {
  const t = String(text).toLowerCase();
  const rng = createRng('free', t);
  // Whole-word matching: a bare substring test made "go" match "good" and "ask" match "task".
  const has = (words) => new RegExp(`\\b(?:${words})\\b`).test(t);
  if (has('wait|hold|hide|careful|carefully|quiet|quietly|watch|listen')) {
    return optionFromArchetype('wary', text, rng);
  }
  if (has('ask|why|how|find|search|look|investigate|check')) {
    return optionFromArchetype('curious', text, rng);
  }
  if (has('tell|trust|help|together|speak|convince|ally')) {
    return optionFromArchetype('social', text, rng);
  }
  if (has('decide|choose|now|commit|end it|go|move')) {
    return optionFromArchetype('commit', text, rng);
  }
  return optionFromArchetype('bold', text, rng);
}

function optionFromArchetype(key, text, rng) {
  const archetype = OPTION_ARCHETYPES.find((a) => a.key === key) || OPTION_ARCHETYPES[0];
  return {
    id: `free-${key}`,
    text: text.trim(),
    tags: {
      tensionDelta: archetype.tags.tensionDelta,
      clue: null,
      ally: null,
      profileAxis: { bold_cautious: 0, lone_social: 0, curious_decisive: 0, ...archetype.tags.profileAxis },
    },
    tone: key === 'social' ? 'social' : key,
    freeText: true,
    matched: key,
    rngHint: rng.next(),
  };
}
