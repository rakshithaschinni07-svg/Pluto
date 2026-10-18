# Pluto

**Choose your genre. Choose your fate.** Pick one of four genres, make four decisions
in an AI-generated story, and reach a twist ending plus a rule-based explorer profile
you can download as a card. Runs entirely in the browser — no camera, no microphone,
no account, no database, no server.

Built to the six-document spec (PRD · TRD · App Flow · UI/UX · Schema · Implementation Plan).

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5199
```

```bash
npm run build      # production build into dist/
npm run typecheck  # tsc over the JSX sources
npm run preview    # serve the built output
```

No key, no configuration and no network are required to play. Pluto ships with a local
seeded story engine, so the demo cannot fail to load.

---

## What happens in a run

```
Genre select → seed generated → opening scene
   → Round 1 → Round 2 → Round 3 → Round 4
   → Ending (auto-transition, no user action)
   → Explorer profile + shareable ending card
   → Download PNG / copy summary → Replay
```

Target playthrough: four rounds plus reading, inside the 8-minute window. Round count
is a single constant (`TOTAL_ROUNDS` in `src/engine/localEngine.js`); per the TRD the
4 → 3 decision is deferred to timing data, not assumed.

---

## Architecture

| Path | Role |
| --- | --- |
| `src/engine/genres.js` | Genre presentation, palettes, **hard tone guardrails**, noun + prose banks |
| `src/engine/seed.js` | Run-seed generation + deterministic PRNG (stable re-renders) |
| `src/engine/localEngine.js` | Seeded story generator — scenes, options, endings, tension tiers |
| `src/engine/scripts.js` | Hand-authored scripted story per genre, used by the fallback path |
| `src/engine/aiClient.js` | Client-side AI adapter: strict structured output, 12s timeout, one silent retry |
| `src/engine/profile.js` | Rule-based explorer profile (pure arithmetic, never AI-guessed) |
| `src/engine/endingCard.js` | Canvas PNG export + copyable text summary fallback |
| `src/hooks/useStory.js` | Session state, optimistic pre-fetch, retry → fallback orchestration |

No routing, no persistence — a single in-memory session object, exactly as the schema doc
specifies.

### Structured output, not parsing prose

Every scene arrives as:

```json
{
  "sceneText": "…",
  "options": [
    {
      "text": "…",
      "tags": {
        "tensionDelta": 1,
        "clue": "…",
        "ally": "…",
        "profileAxis": { "bold_cautious": 1, "lone_social": 0, "curious_decisive": -1 }
      }
    }
  ]
}
```

State never guesses. Tension, clues, allies and the three profile axes are read directly
out of those tags. Outputs are normalised and range-clamped before they touch state, so a
malformed response degrades into the fallback path rather than corrupting the session.

### The fallback is a first-class path

Per the TRD, error handling returns an *outcome*, not another chance to fail:

- First AI failure → automatic silent retry (nothing shown).
- Second failure, or a call past 12s → the session switches into the scripted story for
  that genre **from the current round onward**, styled identically to generated content.

`src/engine/scripts.js` holds one complete path per genre (opening, four rounds, ending
and twist), written to the same mature standard as the generated content, because it may
be exactly what a room full of people sees. The topbar badge stays deliberately neutral
during a fallback so the room cannot tell.

### Local engine

With no key configured — or before AI is switched on — Pluto runs on its local seeded
generator. Each genre has banks of settings, figures, artefacts, pressures and beat
templates; the run seed selects and combines them, so three consecutive runs of the same
genre produce materially different openings. This is what makes the replayability test
passable without spending a token.

---

## AI provider setup (optional)

Open **Session** in the topbar, then:

| Field | Value |
| --- | --- |
| Endpoint | `https://api.openai.com/v1/chat/completions` (any OpenAI-compatible chat endpoint) |
| Model | e.g. `gpt-4o-mini` |
| API key | your key — stored only in this browser's `localStorage` |

**Key exposure is a known, documented risk.** Client-side calls put the key in the
network tab. Mitigations in place for v1:

1. Use a key with a hard provider-level spending/rate cap — worst case is a capped bill.
2. The key is never committed — `.gitignore` excludes `.env*`, and nothing here reads one.
3. If this is ever shown beyond a single live session, a thin proxy becomes mandatory.
   That is the trigger condition, flagged rather than deferred indefinitely.

`Test` in the Session panel verifies the endpoint answers with the expected JSON shape.

There is deliberately no build-time key (no `VITE_*` variable), so a build can never leak one.

---

## Tone guardrails

Negative constraints are re-sent with **every** generation so the model cannot drift over
a long session:

- **Sci-fi** — no graphic violence; existential and moral stakes over gore.
- **Mystery** — no gore, no graphic violence; suspense over shock.
- **Fantasy** — no graphic violence; dark themes allowed but never explicit.
- **Cybercrime** — **no real, actionable hacking details, commands, exploits, payloads or
  tools**. Dramatise the tension and social cost of the act, never the method.

Plus global constraints in `genres.js`: no gore, no explicit content, no slurs, no
self-harm methods.

---

## Phase 8 test plan (explicit pass/fail)

| Test | Pass condition |
| --- | --- |
| Replayability | Three consecutive same-genre runs produce materially different opening text and seed codes |
| Latency | A full 4-round playthrough completes inside ~9 minutes; if consistently over, cut `TOTAL_ROUNDS` to 3 |
| Fallback | Simulating AI failure (bad key/endpoint) transitions seamlessly — no error text, no dead screen |
| Tone | Five replays per genre contain no violations of the guardrail list above |
| Mobile | Tap-to-skip works on scene text; option buttons are comfortably tappable |
| Cost/rate | Soft replay cap warns after 5 replays in a session; provider spend cap verified provider-side |

To exercise the fallback path deliberately: set an endpoint that fails (or an invalid key)
in the Session panel, start a run, and confirm rounds continue with no visible error —
only the subtly coloured engine pip changes.

---

## Accessibility & polish

- Tap anywhere on scene text (or press Enter/Space) to skip the typewriter; a visible
  "tap to skip" hint makes it discoverable on mobile.
- Number keys `1`–`3` pick an option.
- Skeleton/shimmer loading blocks are sized to approximate scene length — never a spinner,
  never a blank screen.
- `prefers-reduced-motion` disables the parallax, tilt and reveal animations.

## Out of scope in v1

Accounts, persistence, deployment, monetisation, ambient audio, extra genres and the
free-text "Something else…" option is included as a local best-effort rather than an
AI path (it is a nice-to-have in the PRD and works without a key).
