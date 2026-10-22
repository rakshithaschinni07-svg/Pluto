# Pluto

**Choose your genre. Choose your fate.** Pick one of four genres, make four decisions
in a short, seeded story, and reach a twist ending plus a rule-based explorer profile
you can download as a card. Runs entirely in the browser — no camera, no microphone,
no account, no database, no server.

Built to the six-document spec (PRD · TRD · App Flow · UI/UX · Schema · Implementation Plan).

## Live Demo

[Try Pluto here](https://pluto-ai-1.onrender.com)

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

No key, no configuration and no network are required. Pluto runs entirely on its local
seeded story engine — there is no AI/API integration — so the demo cannot fail to load.

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
| `src/engine/profile.js` | Rule-based explorer profile (pure arithmetic, never AI-guessed) |
| `src/engine/endingCard.js` | Canvas PNG export + copyable text summary fallback |
| `src/hooks/useStory.js` | Session state, optimistic pre-fetch of the next scene |

No routing, no persistence — a single in-memory session object, exactly as the schema doc
specifies.

### Local engine

Pluto runs on its local seeded generator. Each genre has banks of settings, figures, artefacts, pressures and beat
templates; the run seed selects and combines them, so three consecutive runs of the same
genre produce materially different openings. This is what makes the replayability test
passable with no network at all.

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
| Tone | Five replays per genre contain no violations of the guardrail list above |
| Mobile | Tap-to-skip works on scene text; option buttons are comfortably tappable |
| Replay cap | Soft replay cap warns after 5 replays in a session |

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
local best-effort path.
