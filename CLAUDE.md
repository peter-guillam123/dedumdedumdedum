# dedumdedumdedum

Kind: Personal

A free web tool that teaches young actors (and anyone else) to speak
Shakespeare's verse: to hear the rhythm, tell verse from prose, and decide
what to do with a line. It teaches by getting you to do things, not just
showing you.

## Shape

- **Learn**: short lessons, each one idea plus an exercise with feedback.
- **Play**: games (verse or prose?, put the lines back, mark the beat, tap
  the heartbeat).
- **Rehearsal room**: paste or pick any speech; it scans every line, offers
  choices rather than rules, and has views based on real rehearsal exercises.
- **Scan of the day**: one line a day, shareable result.
- **About**: what it is, how it's made, and a diary.

## Principles

- Scansion is a reading, not a fact. Always "one way to say it", always
  overrulable.
- Notes offer choices ("you could…"), never one right answer.
- Never invent quotes. Every line of Shakespeare comes from the corpus in
  `data/plays/` (MIT/Moby text, public domain).
- Keyboard, screen reader, reduced motion and phones are the minimum.
  Anything timed has an untimed version.

## How it's built

- Static site, vanilla JS (ES modules), no build step. GitHub Pages via
  GitHub Actions.
- `assets/js/scan.js`: the scanner (no DOM). `assets/js/passage.js`:
  passage analysis (shared lines, thoughts, opposites, thou/you, rhymes).
- Pages: edit the bodies in `pages/*.html` (each starts with a JSON
  comment: title, description, script, css, nav), then run
  `python3 tools/pages.py` to wrap them in the shared head, header and
  footer. Don't edit the root `*.html` files by hand.
- Data is built by scripts in `tools/` and committed. Order matters:
  1. `python3 tools/build_corpus.py CACHE_DIR` (downloads the MIT texts if
     absent; writes `data/plays/`, `plays.json`, `speeches.json`)
  2. `python3 tools/build_dict.py CMUDICT_PATH` (writes `data/dict.json`;
     hand entries for Shakespeare's words and stresses live in `EXTRA`)
  3. `node tools/build_games.mjs` and `node tools/build_daily.mjs` (game
     lines and the daily pool, from the library). Rerun both after
     changing the scanner, `notes.js` or `data/library.json`.
- `data/library.json`: hand-written. `fix` holds hand-checked readings
  ("x/x/x/x/x/") for lines the scanner gets wrong; `notes` holds
  hand-written line notes. Check every claim against the text.
  `python3 tools/find_passage.py PLAY "first words" N` finds line numbers;
  `node tests/review.mjs play:a.s:from-to` prints the scanner's reading.
- Lessons (`assets/js/lessons.js`) cite lines by reference, never by
  quoting. `tests/lessons.test.mjs` checks answers still hold.
- Tests: `node --test tests/*.test.mjs` (the directory form doesn't work).
  `node tests/corpus-check.mjs` reports how the scanner does across whole
  plays; `node tests/show.mjs < lines.txt` prints scans.
- Deploy: `.github/workflows/pages.yml` runs the tests and publishes on
  push to `main`. Pages source must be set to GitHub Actions.
- Own look (not Guardian). British English, sentence case, no em dashes.
