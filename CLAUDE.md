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
- Data is built by Python scripts in `tools/` and committed:
  - `python3 tools/build_corpus.py CACHE_DIR` (downloads MIT texts if absent)
  - `python3 tools/build_dict.py CMUDICT_PATH`
- Tests: `node --test tests/`. `node tests/corpus-check.mjs` reports how the
  scanner does across whole plays; `node tests/show.mjs < lines.txt` prints
  scans.
- Own look (not Guardian). British English, sentence case, no em dashes.
