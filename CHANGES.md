# Latest changes

- **API removed.** No AI client, key, endpoint or scripted fallback — Pluto is fully offline on the local seeded engine. The Session panel now only shows run info.
- **Shorter lore.** Scenes are ~35–50 words (were 80–120); the opener is a single beat; endings are ~40 words. Faster rounds for tight team slots.
- **Choices change the picture, loudly.** Stronger camera/colour grade per stance (incl. hue shift), a colour flash + big stance stamp when you choose, and a "Your path" trail of past decisions.

---

# Changes in this version

## Bug fixes
- **Typecheck** (`npm run typecheck`) failed on the `./styles.css` import. Added `src/vite-env.d.ts`.
- **AI cancellation** (`aiClient.js`): aborting a request (e.g. pressing Replay mid-generation) was not
  recognised as a cancel and was treated as an AI failure. Cancels and timeouts are now reported distinctly.
- **AI prompt round numbers** were off by one (history was labelled 0-based, the current round 1-based).
- **Test connection** reported success for any JSON reply; it now requires `{"ok": true}`.
- **Free-text choices** matched keywords as substrings ("go" in "good", "ask" in "task"). Now whole-word.
- **Double submit**: a double-tap, or key press + click, could commit two decisions. Now ignored while pending.
- **Ctrl/Cmd/Alt + number** (browser tab shortcuts) was picking story options. Now ignored.

## Robustness
- Providers that reject `max_tokens`, `temperature` or `response_format` (e.g. newer OpenAI models) no longer
  cause a silent drop to the scripted fallback: the client adapts the request and retries.
- If a run ever errors out, the app now shows a "Start over" banner instead of an endless skeleton.

## Accessibility / polish
- Typewriter reveal respects `prefers-reduced-motion` (shows full text instantly).
- `Esc` closes the Session drawer.
- "Four rounds/decisions" copy now follows `TOTAL_ROUNDS`, so changing it to 3 updates the UI text.
- Seed tooltip no longer claims a seed can be replayed (there is no way to enter one).
- README: removed a garbled sentence about `VITE_*` variables.

## Note
`dist/` and `node_modules/` are not included. Run `npm install && npm run build` to regenerate them.
