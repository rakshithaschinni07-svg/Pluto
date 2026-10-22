/**
 * Choice-driven artwork.
 *
 * Every option a player picks carries a *stance*. That stance re-frames the scene
 * artwork: the camera pushes in or pulls back, the colour grade shifts, and the art
 * itself gains or loses elements (an ally on the pavement, a clue lit up, speed lines,
 * a fog bank). So the picture is never decoration — it changes because of the choice
 * that was just made.
 */

export const MOOD_KEYS = ['arrival', 'bold', 'wary', 'curious', 'social', 'commit'];

/**
 * Camera + grade per stance.
 * zoom / pan feed the art frame's transform; the rest feed its CSS filter.
 */
export const MOOD_GRADES = {
  arrival: {
    label: 'Arrival',
    blurb: 'You take the scene in before anyone notices you.',
    zoom: 1,
    panX: 0,
    panY: 0,
    sat: 1,
    bright: 1,
    hue: 0,
    contrast: 1,
  },
  bold: {
    label: 'Bold',
    blurb: 'You went straight at it. The frame closes in and the colour runs hot.',
    zoom: 1.42,
    panX: -4,
    panY: -3,
    sat: 1.6,
    bright: 1.12,
    hue: -14,
    contrast: 1.28,
  },
  wary: {
    label: 'Wary',
    blurb: 'You held back and watched. The frame pulls away and the dark takes over.',
    zoom: 0.8,
    panX: 3,
    panY: 2,
    sat: 0.45,
    bright: 0.7,
    hue: 28,
    contrast: 1.1,
  },
  curious: {
    label: 'Curious',
    blurb: 'You followed the detail that did not fit — and something lit up.',
    zoom: 1.2,
    panX: -2,
    panY: -1.4,
    sat: 1.3,
    bright: 1.1,
    hue: -38,
    contrast: 1.1,
  },
  social: {
    label: 'Social',
    blurb: 'You brought someone in. Company moves differently in this light.',
    zoom: 1.12,
    panX: 1.6,
    panY: 0.6,
    sat: 1.38,
    bright: 1.08,
    hue: 18,
    contrast: 1.04,
  },
  commit: {
    label: 'Decisive',
    blurb: 'You stopped gathering and chose. The light goes somewhere specific.',
    zoom: 1.3,
    panX: 0,
    panY: -2.6,
    sat: 1.4,
    bright: 1.1,
    hue: 0,
    contrast: 1.24,
  },
};

export function moodGrade(mood) {
  return MOOD_GRADES[mood] || MOOD_GRADES.arrival;
}

const ID_TONES = { bold: 'bold', wary: 'wary', curious: 'curious', ally: 'social', social: 'social', commit: 'commit' };

/**
 * Work out the stance behind an option. Order matters:
 * explicit tone → option id (scripted options encode theirs) → tension/axis tags
 * (which is all we get back from a live AI response).
 */
export function deriveTone(option) {
  if (!option) return 'arrival';
  if (option.tone && MOOD_GRADES[option.tone]) return option.tone;

  const suffix = String(option.id || '').split('-').pop();
  if (ID_TONES[suffix]) return ID_TONES[suffix];

  const tags = option.tags || {};
  if (tags.ally) return 'social';
  if (tags.clue) return 'curious';

  const delta = Number(tags.tensionDelta) || 0;
  if (delta >= 2) return 'bold';
  if (delta <= -1) return 'wary';

  const ax = tags.profileAxis || {};
  const bold = Number(ax.bold_cautious) || 0;
  const lone = Number(ax.lone_social) || 0;
  const curious = Number(ax.curious_decisive) || 0;
  const scored = [
    { key: 'bold', score: bold },
    { key: 'wary', score: -bold },
    { key: 'social', score: -lone },
    { key: 'curious', score: curious },
    { key: 'commit', score: -curious },
  ].sort((a, b) => b.score - a.score);

  return scored[0].score > 0 ? scored[0].key : 'commit';
}

/** Camera + grade as CSS custom properties for the art frame. */
export function moodStyle(mood, tension = 0, act = 0) {
  const g = moodGrade(mood);
  const intensity = Math.max(0, Math.min(1, (tension + 3) / 12));
  return {
    '--zoom': String(g.zoom),
    '--pan-x': `${g.panX}%`,
    '--pan-y': `${g.panY}%`,
    '--sat': String(g.sat),
    '--bright': String(g.bright),
    '--contrast': String(g.contrast),
    '--hue': `${g.hue}deg`,
    '--act': String(act),
    '--intensity': String(intensity),
  };
}
