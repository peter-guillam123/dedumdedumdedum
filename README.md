# dedumdedumdedum

A free web tool that teaches you to speak Shakespeare's verse: hear the
rhythm, tell verse from prose, and work out what to do with a line.

- **Learn**: nine short lessons, each with something to do.
- **Play**: four games to train your ear.
- **Rehearsal room**: any speech, scanned line by line, with notes,
  choices and rehearsal exercises. A library of 37 checked speeches, a
  search of all 37 plays, or paste your own.
- **Today's line**: one line a day, with a score to share.

It runs entirely in the browser: no build step, no accounts, no tracking.
The [About page](about.html) explains how it works.

## Running it

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Tests

```bash
node --test tests/*.test.mjs
```

## Rebuilding the data

The data in `data/` is built by scripts in `tools/` and committed. See
`CLAUDE.md` for the order to run them in.

## Credits

Texts: the MIT Shakespeare (Moby edition, public domain).
Pronunciations: the CMU Pronouncing Dictionary (BSD licence).
Fonts: EB Garamond and Atkinson Hyperlegible (SIL Open Font Licence).
