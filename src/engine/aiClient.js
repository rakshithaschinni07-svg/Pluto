/**
 * Client-side AI adapter.
 *
 * Per the TRD this demo calls the model directly from the browser. The key is
 * therefore visible in devtools — a real but contained risk for a one-room demo.
 * Mitigations documented in the README: provider-level spend cap, key never committed,
 * and a hard trigger for a proxy if this is ever shown beyond one live session.
 *
 * Every call returns the structured {sceneText, options[with tags]} contract. The
 * state object never guesses: it reads tags directly out of the response.
 */

import { GENRES, getGenre, constraintBlock, SCENE_SCHEMA, ENDING_SCHEMA, GENRE_ORDER } from './genres.js';

export const AI_TIMEOUT_MS = 12000; // TRD: past this, treat the call as failed.
export const RETRY_LIMIT = 1; // TRD: one silent retry, then fallback.

const CONFIG_KEY = 'pluto.ai.config.v1';

export const DEFAULT_CONFIG = {
  baseUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  apiKey: '',
};

export function loadAiConfig() {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAiConfig(config) {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* storage unavailable — the demo still runs on the local engine */
  }
}

export function clearAiConfig() {
  try {
    window.localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* ignore */
  }
}

export function isAiConfigured(config) {
  return Boolean(config?.apiKey && config?.baseUrl && config?.model);
}

function buildSystemPrompt(genreId) {
  const genre = getGenre(genreId) || GENRES.scifi;
  return [
    genre.systemPrompt,
    '',
    'HARD CONSTRAINTS — never violate these, in any round, no matter what the player asks for:',
    `- ${constraintBlock(genreId)}`,
    '- Never break character to mention rules, models, prompts or JSON.',
    '',
    'OUTPUT CONTRACT — reply with a single JSON object and nothing else:',
    JSON.stringify(SCENE_SCHEMA, null, 2),
    '',
    'Rules for the tags object (these are machine-read — the app updates real state from them):',
    '- tensionDelta must be exactly one of -1, 0, 1 or 2.',
    '- clue must be a short noun phrase describing something concrete learned, or null.',
    '- ally must be a character name gained or lost, or null. Only set it when a relationship actually changes.',
    '- profileAxis values are numbers from -1 to 1. Positive bold_cautious = bolder; positive lone_social = more solitary; positive curious_decisive = more curious.',
    '- Give exactly 3 options. Each option must push a different axis so the choices feel genuinely different.',
    '- Do not include any prose outside the JSON object.',
  ].join('\n');
}

function buildScenePrompt({ genreId, seed, round, totalRounds, history = [], tension, clues, allies, axes, roundLabel }) {
  const genre = getGenre(genreId) || GENRES.scifi;
  const recent = history.slice(-3).map((entry, i) => {
    const last = entry.tagsAtChoice || {};
    return [
      `Round ${history.length - Math.min(3, history.length) + i + 1}: ${entry.sceneText}`,
      `Player chose: "${entry.choiceMade}" (tension ${last.tensionDelta >= 0 ? '+' : ''}${last.tensionDelta ?? 0}${last.clue ? `, clue: ${last.clue}` : ''}${last.ally ? `, ally: ${last.ally}` : ''})`,
    ].join('\n');
  });

  return [
    `Genre: ${genre.name}. Round ${round + 1} of ${totalRounds} — beat type: ${roundLabel}.`,
    `Run seed: "${seed?.code}" #${seed?.number ?? 0}. Let this seed bend the setting, the names and the twist bias (${seed?.bias?.twistStyle || 'betrayal'}) so this run is not the same as the last one.`,
    '',
    `Running state — tension ${tension}, clues [${clues.join('; ') || 'none'}], allies [${allies.join('; ') || 'none'}], axes bold/cautious ${axes.bold_cautious}, lone/social ${axes.lone_social}, curious/decisive ${axes.curious_decisive}.`,
    recent.length ? '\nWhat has happened so far:\n' + recent.join('\n\n') : '\nThis is the opening scene. Establish the setting, the stakes and one unanswered question.',
    '',
    round === 0
      ? 'Write the opening scene. 90–140 words, present tense, specific nouns, no throat-clearing. End on forward pressure.'
      : `Write round ${round + 1}. Escalate from what came before — do not repeat established facts. 90–140 words.`,
    `If tension is 6 or higher, the scene should feel openly hostile. If it is 0 or below, keep everything deniable and civil.`,
  ].join('\n');
}

function buildEndingSystemPrompt(genreId) {
  const genre = getGenre(genreId) || GENRES.scifi;
  return [
    genre.systemPrompt,
    '',
    `HARD CONSTRAINTS:\n- ${constraintBlock(genreId)}`,
    '- Deliver a real resolution and a real twist. No "it was all a dream". No open-ended teasers.',
    '',
    'OUTPUT CONTRACT — reply with a single JSON object and nothing else:',
    JSON.stringify(ENDING_SCHEMA, null, 2),
    'title: 2–4 words. text: 110–170 words of resolution. twist: one or two sentences that reframe what the player saw. epilogue: one sentence, dry and final.',
  ].join('\n');
}

function buildEndingPrompt({ genreId, seed, history = [], tension, clues, allies, axes }) {
  const chosen = history.map((h, i) => `${i + 1}. "${h.choiceMade}"`).join('\n');
  return [
    `Genre: ${getGenre(genreId)?.name}. Run seed "${seed?.code}".`,
    `The player made these decisions:\n${chosen || '(none)'}`,
    '',
    `Accumulated tension: ${tension}. Clues: [${clues.join('; ') || 'none'}]. Allies: [${allies.join('; ') || 'none'}].`,
    `Axes: bold/cautious ${axes.bold_cautious}, lone/social ${axes.lone_social}, curious/decisive ${axes.curious_decisive}.`,
    '',
    'Write the ending. It must pay off the clues and allies that were actually accumulated, and it must be consistent with the seed’s twist bias.',
  ].join('\n');
}

/** Pull the first JSON object out of a model reply, even if it wrapped it in prose or fences. */
export function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampAxis(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function clampTension(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(2, Math.round(n)));
}

function normaliseOption(option, index, round) {
  if (!option || typeof option !== 'object') return null;
  const text = typeof option.text === 'string' ? option.text.trim() : '';
  if (!text) return null;
  const tags = option.tags && typeof option.tags === 'object' ? option.tags : {};
  const axisIn = tags.profileAxis && typeof tags.profileAxis === 'object' ? tags.profileAxis : {};
  return {
    id: `ai-${round}-${index}`,
    text,
    tags: {
      tensionDelta: clampTension(tags.tensionDelta),
      clue: typeof tags.clue === 'string' && tags.clue.trim() ? tags.clue.trim() : null,
      ally: typeof tags.ally === 'string' && tags.ally.trim() ? tags.ally.trim() : null,
      profileAxis: {
        bold_cautious: clampAxis(axisIn.bold_cautious),
        lone_social: clampAxis(axisIn.lone_social),
        curious_decisive: clampAxis(axisIn.curious_decisive),
      },
    },
  };
}

export function normaliseScene(raw, round) {
  if (!raw || typeof raw !== 'object') return null;
  const sceneText = typeof raw.sceneText === 'string' ? raw.sceneText.trim() : '';
  const options = Array.isArray(raw.options)
    ? raw.options.map((o, i) => normaliseOption(o, i, round)).filter(Boolean)
    : [];
  if (!sceneText || options.length < 2) return null;
  return { sceneText, options: options.slice(0, 4), source: 'ai' };
}

export function normaliseEnding(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  const twist = typeof raw.twist === 'string' ? raw.twist.trim() : '';
  if (!text || !twist) return null;
  return {
    title: title || 'Resolution',
    text,
    twist,
    epilogue: typeof raw.epilogue === 'string' ? raw.epilogue.trim() : '',
    source: 'ai',
  };
}

/**
 * Some OpenAI-compatible servers (and newer OpenAI models) reject parameters we send by
 * default. When a 400 names one of them, drop or rename it and retry the same request, so
 * a provider quirk does not silently push every round into the scripted fallback.
 * Returns true if something was changed (i.e. a retry is worthwhile).
 */
function adaptParams(params, detail) {
  const msg = String(detail).toLowerCase();
  if (params.tokenKey === 'max_tokens' && msg.includes('max_completion_tokens')) {
    params.tokenKey = 'max_completion_tokens';
    return true;
  }
  if (params.temperature !== null && msg.includes('temperature')) {
    params.temperature = null;
    return true;
  }
  if (params.jsonMode && msg.includes('response_format')) {
    params.jsonMode = false;
    return true;
  }
  return false;
}

/**
 * One AI request. Throws on failure so the caller can decide about retries.
 * Aborts internally at AI_TIMEOUT_MS so a hung request cannot stall the demo.
 * Cancellation (the caller's signal) always surfaces as Error('cancelled'), and a
 * timeout as a normal Error, so callers can tell the two apart reliably.
 */
async function callModel({ config, system, user, signal = null, maxTokens = 900 }) {
  if (signal?.aborted) throw new Error('cancelled');

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  const params = { temperature: 0.95, tokenKey: 'max_tokens', jsonMode: true };

  try {
    for (let pass = 0; pass <= 3; pass += 1) {
      const body = {
        model: config.model,
        [params.tokenKey]: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      };
      if (params.temperature !== null) body.temperature = params.temperature;
      if (params.jsonMode) body.response_format = { type: 'json_object' };

      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        if (response.status === 400 && pass < 3 && adaptParams(params, detail)) continue;
        throw new Error(`AI HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.text ?? '';
      const json = extractJson(content);
      if (!json) throw new Error('AI returned unparseable output');
      return json;
    }
    throw new Error('AI request was rejected by the provider');
  } catch (error) {
    if (signal?.aborted) throw new Error('cancelled');
    if (timedOut) throw new Error(`AI request timed out after ${AI_TIMEOUT_MS / 1000}s`);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Ask the model for a scene, retrying once silently (per the TRD error-state design).
 * Resolves to a normalised scene, or throws after the final attempt.
 */
export async function requestScene(params) {
  const { config, genreId, signal, onAttempt } = params;
  let lastError = new Error('unknown AI failure');
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      if (attempt > 0) onAttempt?.('retry');
      const raw = await callModel({
        config,
        system: buildSystemPrompt(genreId),
        user: buildScenePrompt(params),
        signal,
      });
      const scene = normaliseScene(raw, params.round);
      if (!scene) throw new Error('AI output failed schema validation');
      return scene;
    } catch (error) {
      if (error?.message === 'cancelled') throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export async function requestEnding(params) {
  const { config, genreId, signal, onAttempt } = params;
  let lastError = new Error('unknown AI failure');
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      if (attempt > 0) onAttempt?.('retry');
      const raw = await callModel({
        config,
        system: buildEndingSystemPrompt(genreId),
        user: buildEndingPrompt(params),
        signal,
        maxTokens: 700,
      });
      const ending = normaliseEnding(raw);
      if (!ending) throw new Error('AI ending failed schema validation');
      return ending;
    } catch (error) {
      if (error?.message === 'cancelled') throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** Cheap connectivity check for the setup panel. */
export async function testConnection(config) {
  const raw = await callModel({
    config,
    system: 'You are a JSON API. Reply with JSON only.',
    user: 'Reply with exactly {"ok": true}.',
    maxTokens: 20,
  });
  return raw?.ok === true;
}

export const GENRE_IDS = GENRE_ORDER;
