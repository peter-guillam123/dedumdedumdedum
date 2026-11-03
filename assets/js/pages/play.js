// Play: four quick games that train the ear.
//   Verse or prose?   hear the difference without the page's help
//   Put the lines back  find where each ten-syllable line ends
//   Mark the beat     tap the syllables that take a beat (untimed)
//   Tap the heartbeat tap along in time (timed)
import { getScanner, getSpeechIndex, getSpeech, getPlays, citation } from "../data.js";
import { analyse } from "../passage.js";
import { lineNotes, titleCase, LESSONS } from "../notes.js";
import { el, renderLine, renderNote, announce, beatWords } from "../render.js";
import { createMarker, explain } from "../marker.js";
import * as beat from "../beat.js";
import { load, save } from "../store.js";

const $ = (id) => document.getElementById(id);
const GAMES = {
  "verse-prose": {
    title: "Verse or prose?",
    blurb: "A passage with its line breaks taken out. Read it aloud and decide: verse or prose?",
    lesson: "verse-prose",
  },
  relineate: {
    title: "Put the lines back",
    blurb: "A few lines of verse run together. Find where each line ends, by ear and by counting.",
    lesson: "line-end",
  },
  mark: {
    title: "Mark the beat",
    blurb: "Five lines a round. Tap the syllables that take a beat. No clock.",
    lesson: "ten",
  },
  tap: {
    title: "Tap the heartbeat",
    blurb: "Tap along in time as the line plays. A rhythm game, with a clock.",
    lesson: "heartbeat",
  },
};

const state = { scanner: null, games: null, plays: [], game: null, run: 0 };

// ------------------------------------------------------------------ helpers

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
function shuffle(xs) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const playTitle = (id) => (state.plays.find((p) => p.id === id) || { title: id }).title;
const roman = (n) => ["", "I", "II", "III", "IV", "V"][n] || String(n);
const where = (p, a, s) => `${playTitle(p)}, Act ${roman(a)} ${s === 0 ? "Prologue" : `Scene ${s}`}`;
const cleanText = (t) => t.replace(/\[[^\]]*\]/g, " ").replace(/\s*--\s*/g, " – ").replace(/\s+/g, " ").trim();

function stats(g) {
  return load(`play:${g}`, { played: 0, right: 0, streak: 0, best: 0 });
}
function record(g, ok, score) {
  const s = stats(g);
  s.played++;
  if (ok) {
    s.right++;
    s.streak++;
  } else s.streak = 0;
  if (score != null) s.best = Math.max(s.best || 0, score);
  else s.best = Math.max(s.best || 0, s.streak);
  save(`play:${g}`, s);
  return s;
}
function scoreLine(g) {
  const s = stats(g);
  if (!s.played) return "No games yet on this device.";
  if (g === "mark" || g === "tap") return `Played ${s.played}. Best score ${s.best}%.`;
  return `Played ${s.played}, right ${s.right}. Streak ${s.streak} (best ${s.best}).`;
}

function lessonLink(key) {
  const L = LESSONS[key];
  return el("a", { href: `learn.html?l=${key}` }, `Lesson ${L.n}: ${L.title}`);
}
function roomLink(item) {
  const href = item.lib ? `room.html?lib=${item.lib}` : `room.html?p=${item.p}&a=${item.a}&s=${item.s}&n=${item.start || item.n}`;
  return el("a", { href }, "Open this speech in the rehearsal room");
}

function header(g, ...extra) {
  return el(
    "div",
    { class: "game-head" },
    el("h2", { id: "game-title", tabindex: "-1" }, GAMES[g].title),
    el("p", {}, GAMES[g].blurb),
    el("p", { class: "small", id: "score-line" }, scoreLine(g)),
    ...extra,
  );
}
function refreshScore(g) {
  const s = $("score-line");
  if (s) s.textContent = scoreLine(g);
}

function feedback(ok, title, ...paras) {
  return el("div", { class: `feedback ${ok === true ? "feedback--good" : ok === false ? "feedback--bad" : "feedback--info"}`, tabindex: "-1" }, title, ...paras.filter(Boolean).map((p) => (typeof p === "string" ? el("p", {}, p) : p)));
}
function focusSoon(node) {
  setTimeout(() => node && node.focus && node.focus({ preventScroll: false }), 30);
}

// ------------------------------------------------------------------ hub

function renderHub() {
  const box = $("game");
  box.replaceChildren(
    el(
      "div",
      { class: "game-cards" },
      Object.entries(GAMES).map(([g, G]) =>
        el(
          "a",
          { class: "card door", href: `?g=${g}`, onclick: (e) => { e.preventDefault(); go(g); } },
          el("h3", {}, G.title),
          el("p", {}, G.blurb),
          el("p", { class: "small", style: "margin-top:.6rem" }, scoreLine(g)),
        ),
      ),
    ),
    el("p", { class: "small" }, "New to all this? ", el("a", { href: "learn.html" }, "The lessons"), " explain what each game is training."),
  );
}

// ------------------------------------------------------------------ 1. verse or prose

let NAMES = null;

// Run lines together as one paragraph. A capital that only marks the start
// of a verse line would give the game away, so it goes, unless the word is
// a name (one the plays never write in lower case) or I or O.
function runTogether(lines) {
  if (!NAMES) NAMES = new Set(state.games.names);
  let out = "";
  lines.forEach((t, k) => {
    let text = cleanText(t);
    if (k > 0 && !/[.!?]["']?$/.test(out.trim())) {
      text = text.replace(/^(['"]?)([A-Z][a-z']*)/, (m, q, w) => (w === "I" || /^I'/.test(w) || w === "O" || NAMES.has(w.toLowerCase()) ? m : q + w.toLowerCase()));
    }
    out += (k ? " " : "") + text;
  });
  return out;
}

async function findPassage(form) {
  const idx = await getSpeechIndex();
  const pool = idx.filter((r) => r[7] === form && r[6] >= 6);
  for (let attempt = 0; attempt < 12; attempt++) {
    const r = pick(pool);
    const { play, scene, items } = await getSpeech(r[0], r[1], r[2], r[3]);
    const lines = items[0].lines.filter((l) => cleanText(l.text).length > 0);
    let start = lines[0] && lines[0].indent ? 1 : 0;
    // verse: skip a short opening line (often the end of someone else's line)
    if (form === "v") while (start < 2 && lines[start] && state.scanner.scanLine(lines[start].text).count < 8) start++;
    let len = 4 + Math.floor(Math.random() * 3);
    // end on a full stop if one comes within two more lines
    for (let extra = 0; extra <= 2; extra++) {
      const last = lines[start + len - 1 + extra];
      if (last && /[.!?]['"]?$/.test(cleanText(last.text))) {
        len += extra;
        break;
      }
    }
    const win = lines.slice(start, start + len);
    if (win.length < 4) continue;
    const text = win.map((l) => cleanText(l.text)).join(" ");
    if (text.split(/\s+/).length < 28) continue;
    if (form === "v") {
      const counts = win.map((l) => state.scanner.scanLine(l.text).count);
      const steady = counts.filter((c) => c >= 9 && c <= 12).length;
      if (steady < Math.ceil(win.length * 0.75)) continue;
    }
    return { r, play, scene, who: items[0].who, form, lines: win };
  }
  return null;
}

async function runVerseProse(run) {
  const g = "verse-prose";
  const box = $("game");
  const stage = el("div", { class: "card game-card", "aria-live": "polite" }, el("p", { class: "small" }, "Finding a passage…"));
  box.replaceChildren(header(g), stage);
  const form = Math.random() < 0.5 ? "v" : "p";
  const P = await findPassage(form);
  if (run !== state.run) return;
  if (!P) {
    stage.replaceChildren(el("p", {}, "Sorry, we couldn't find a passage just now. "), el("button", { type: "button", class: "btn", onclick: () => go(g, true) }, "Try again"));
    return;
  }
  const text = runTogether(P.lines.map((l) => l.text));
  const hint = el("p", { class: "small", hidden: true }, "Read it aloud. Can you feel a steady de-DUM, ten syllables at a time? Or does it run like speech, with no pulse underneath?");
  const answer = el("div");
  const choose = (guess) => {
    choices.querySelectorAll("button").forEach((b) => (b.disabled = true));
    choices.querySelectorAll("button")[guess === "v" ? 0 : 1].setAttribute("aria-pressed", "true");
    const ok = guess === P.form;
    record(g, ok);
    refreshScore(g);
    const counts = P.lines.map((l) => state.scanner.scanLine(l.text).count);
    const who = titleCase(P.who);
    const why =
      P.form === "v"
        ? `These lines run ${listCounts(counts)} syllables, and the beat falls on every second one: de-DUM de-DUM. That steady pulse is what your ear picks up. On the page you'd see it too: each verse line starts with a capital, and the right-hand edge is ragged.`
        : `There's no steady de-DUM underneath: the stresses fall wherever the sense puts them. On the page, prose runs to the edge and breaks wherever the line fills up${proseBreak(P.lines)}. Those breaks were the printer's, not Shakespeare's. Ask why ${who} speaks prose here: prose is often quicker, more private, funnier or more broken than verse.`;
    const reveal = el("div", { class: "reveal" });
    if (P.form === "v") {
      P.lines.forEach((l) => {
        const sc = state.scanner.scanLine(l.text);
        reveal.append(el("div", { class: "verse reveal-line" }, renderLine(sc, { label: `Line ${l.n}` }), el("span", { class: "count" }, `${sc.count}`)));
      });
    } else {
      P.lines.forEach((l) => reveal.append(el("div", { class: "prose-line" }, cleanText(l.text))));
    }
    const fb = feedback(ok, ok ? `Yes: ${P.form === "v" ? "verse" : "prose"}.` : `Not this time: it's ${P.form === "v" ? "verse" : "prose"}.`, why);
    answer.replaceChildren(
      fb,
      el("p", { class: "eyebrow", style: "margin-top:1rem" }, P.form === "v" ? "As Shakespeare wrote it, with the beats" : "As it's printed"),
      reveal,
      el("p", { class: "cite" }, `${who}. ${citation(P.play, P.scene, P.lines[0].n, P.lines[P.lines.length - 1].n)}`),
      el("p", { class: "links" }, roomLink({ p: P.r[0], a: P.r[1], s: P.r[2], n: P.r[3] }), el("span", { "aria-hidden": "true" }, " · "), lessonLink("verse-prose")),
      el("div", { class: "btn-row" }, el("button", { type: "button", class: "btn", id: "next", onclick: () => go(g, true) }, "Next passage")),
    );
    announce(ok ? "Right." : "Not this time.");
    focusSoon(fb);
  };
  const choices = el(
    "div",
    { class: "btn-row choices", role: "group", "aria-label": "Your answer" },
    el("button", { type: "button", class: "btn", onclick: () => choose("v") }, "Verse"),
    el("button", { type: "button", class: "btn", onclick: () => choose("p") }, "Prose"),
    el("button", { type: "button", class: "btn btn--ghost", onclick: (e) => { hint.hidden = false; e.target.disabled = true; } }, "Hint"),
  );
  stage.replaceChildren(el("p", { class: "eyebrow" }, "Read it aloud"), el("p", { class: "run-together" }, text), choices, hint, answer);
}

// A printed prose line that breaks mid-phrase, as evidence: "two never / meet"
function proseBreak(lines) {
  for (let k = 0; k < lines.length - 1; k++) {
    const a = cleanText(lines[k].text);
    const b = cleanText(lines[k + 1].text);
    if (/[.,;:!?\u2013]$/.test(a) || !/^[a-z]/.test(b)) continue;
    const end = a.split(" ").slice(-2).join(" ");
    const start = b.split(" ")[0];
    return ` (look: \u2018${end} / ${start}\u2019)`;
  }
  return "";
}

function listCounts(c) {
  return c.length < 2 ? String(c[0]) : c.slice(0, -1).join(", ") + " and " + c[c.length - 1];
}

// ------------------------------------------------------------------ 2. put the lines back

function recent(key, id, keep) {
  const r = load(`play:recent:${key}`, []);
  if (id != null) {
    const next = [id, ...r.filter((x) => x !== id)].slice(0, keep);
    save(`play:recent:${key}`, next);
    return next;
  }
  return r;
}

function runRelineate(run) {
  const g = "relineate";
  const box = $("game");
  const seen = recent("reline");
  const pool = state.games.reline;
  const fresh = pool.filter((p, i) => !seen.includes(i));
  const item = pick(fresh.length ? fresh : pool);
  recent("reline", pool.indexOf(item), 30);

  const words = [];
  const realBreaks = new Set();
  item.lines.forEach((t, li) => {
    const ws = cleanText(t).split(" ");
    ws.forEach((w) => words.push(w));
    if (li < item.lines.length - 1) realBreaks.add(words.length - 1);
  });
  const breaks = new Set();
  let done = false;

  const stage = el("div", { class: "card game-card" });
  const result = el("div", { "aria-live": "polite" });
  box.replaceChildren(header(g), stage);

  const rowsBox = el("div", { class: "reline", role: "group", "aria-label": "The passage. Tap the last word of each line." });
  function rows() {
    const out = [[]];
    words.forEach((w, k) => {
      out[out.length - 1].push(k);
      if (breaks.has(k) && k < words.length - 1) out.push([]);
    });
    return out;
  }
  function draw(focusK) {
    rowsBox.replaceChildren();
    rows().forEach((r) => {
      const text = r.map((k) => words[k]).join(" ");
      const count = state.scanner.scanLine(text).count || 0;
      const line = el("div", { class: "reline-row" });
      const wordsEl = el("div", { class: "reline-words" });
      r.forEach((k) => {
        const last = k === words.length - 1;
        const b = el(
          "button",
          {
            type: "button",
            class: `rw${breaks.has(k) ? " is-end" : ""}`,
            "aria-pressed": last ? null : String(breaks.has(k)),
            "aria-label": last ? `${words[k]} (the end of the passage)` : `${words[k]}: end a line here`,
            disabled: done || last,
            dataset: { k },
            onclick: () => {
              if (breaks.has(k)) breaks.delete(k);
              else breaks.add(k);
              draw(k);
            },
          },
          words[k],
        );
        wordsEl.append(b, " ");
      });
      line.append(wordsEl, el("span", { class: `count${count >= 10 && count <= 11 ? " is-ten" : ""}`, title: "syllables" }, `${count}`, el("span", { class: "visually-hidden" }, " syllables")));
      rowsBox.append(line);
    });
    if (focusK != null) {
      const b = rowsBox.querySelector(`[data-k="${focusK}"]`);
      if (b) b.focus();
    }
    const made = rows().length;
    status.textContent = `${made} line${made === 1 ? "" : "s"} so far, of ${item.lines.length}.`;
  }

  const status = el("p", { class: "small", "aria-live": "polite" });
  const check = el("button", { type: "button", class: "btn" }, "Check");
  const show = el("button", { type: "button", class: "btn btn--ghost" }, "Show me");
  const finish = (gaveUp) => {
    done = true;
    const real = [];
    {
      let start = 0;
      item.lines.forEach((t) => {
        const n = cleanText(t).split(" ").length;
        real.push([start, start + n - 1]);
        start += n;
      });
    }
    const mine = rows().map((r) => [r[0], r[r.length - 1]]);
    const rightLines = real.filter(([a, b]) => mine.some(([x, y]) => x === a && y === b)).length;
    const perfect = !gaveUp && rightLines === real.length && mine.length === real.length;
    record(g, perfect);
    refreshScore(g);
    draw();
    check.hidden = show.hidden = true;
    const reveal = el("div", { class: "reveal" });
    item.lines.forEach((t, i) => {
      const sc = state.scanner.scanLine(t);
      const ok = mine.some(([x, y]) => x === real[i][0] && y === real[i][1]);
      reveal.append(
        el("div", { class: `verse reveal-line${gaveUp ? "" : ok ? " is-ok" : " is-off"}` },
          renderLine(sc, { label: `Line ${i + 1}` }),
          el("span", { class: "count" }, `${sc.count}`),
          gaveUp ? null : el("span", { class: "visually-hidden" }, ok ? "You found this line." : "You didn't find this line."),
        ),
      );
    });
    const counts = item.lines.map((t) => state.scanner.scanLine(t).count);
    const fem = counts.filter((c) => c === 11).length;
    const fb = gaveUp
      ? feedback(null, "Here's how the lines go.")
      : feedback(perfect, perfect ? `All ${real.length} lines right.` : `${rightLines} of ${real.length} lines right.`);
    fb.append(
      el("p", {}, `Each line is ten syllables${fem ? `, or eleven when it ends on an extra light syllable (${fem === 1 ? "one line here does" : `${fem} lines here do`})` : ""}. Count to ten, then listen for the fifth beat: the line ends just after it.`),
    );
    result.replaceChildren(
      fb,
      reveal,
      el("p", { class: "cite" }, `${titleCase(item.who)}. ${where(item.p, item.a, item.s)}`),
      el("p", { class: "links" }, roomLink(item), el("span", { "aria-hidden": "true" }, " · "), lessonLink("line-end")),
      el("div", { class: "btn-row" }, el("button", { type: "button", class: "btn", onclick: () => go(g, true) }, "Next passage")),
    );
    announce(fb.firstChild.textContent);
    focusSoon(fb);
  };
  check.addEventListener("click", () => finish(false));
  show.addEventListener("click", () => finish(true));

  stage.append(
    el("p", { class: "eyebrow" }, `${item.lines.length} lines run together`),
    el("p", { class: "small" }, "Tap the last word of each line to end it there. The number on the right counts the syllables in each line you've made."),
    rowsBox,
    status,
    el("div", { class: "btn-row" }, check, show),
    result,
  );
  draw();
}

// ------------------------------------------------------------------ 3. mark the beat

function scanItem(item) {
  return item.f ? state.scanner.scanLine(item.t, { force: item.f }) : state.scanner.scanLine(item.t);
}
function twistNote(item) {
  const a = analyse(state.scanner, [{ who: item.who, form: "v", lines: [{ n: item.n, text: item.t }] }], { fix: item.f ? { [item.n]: item.f } : null });
  return lineNotes(a, 0).find((n) => ["inversion", "feminine", "trochaic", "light", "heavy"].includes(n.key));
}

function runMark(run) {
  const g = "mark";
  const box = $("game");
  const seen = recent("mark");
  const avail = (lvl) => {
    const p = state.games.mark.filter((m) => m.lvl === lvl);
    const f = p.filter((m) => !seen.includes(m.t));
    return shuffle(f.length >= 3 ? f : p);
  };
  const round = [...avail(1).slice(0, 3), ...avail(2).slice(0, 2)];
  let i = 0;
  let right = 0;
  let total = 0;
  let perfect = 0;
  const stage = el("div", { class: "card game-card" });
  box.replaceChildren(header(g, el("p", { class: "small" }, "Lines 1 to 3 are regular. Lines 4 and 5 have a twist.")), stage);

  function next() {
    if (i >= round.length) return end();
    const item = round[i];
    recent("mark", item.t, 60);
    const scan = scanItem(item);
    const m = createMarker(scan, { label: `Line ${i + 1} of ${round.length}` });
    const result = el("div", { "aria-live": "polite" });
    const check = el("button", { type: "button", class: "btn" }, "Check");
    check.addEventListener("click", () => {
      if (!m.marks.size) {
        result.replaceChildren(feedback(null, "Tap the syllables you lean on first. Saying it out loud helps."));
        return;
      }
      const r = m.check();
      right += r.right;
      total += r.total;
      if (r.perfect) perfect++;
      check.hidden = true;
      const note = item.lvl === 2 ? twistNote(item) : null;
      const fb = feedback(r.right >= r.total - 1, r.perfect ? "Spot on." : `${r.right} of ${r.total} syllables.`, ...explain(r, scan));
      result.replaceChildren(
        fb,
        el("p", { class: "eyebrow", style: "margin-top:1rem" }, "Our reading"),
        el("div", { class: "verse" }, renderLine(scan, { label: "Our reading" })),
        el("p", { class: "pattern" }, beatWords(scan)),
        note ? renderNote(note) : null,
        el("p", { class: "cite" }, `${titleCase(item.who)}. ${where(item.p, item.a, item.s)}`),
        el("div", { class: "btn-row" }, el("button", { type: "button", class: "btn", onclick: () => { i++; next(); } }, i < round.length - 1 ? "Next line" : "See your score")),
      );
      focusSoon(fb);
    });
    stage.replaceChildren(
      el("p", { class: "eyebrow" }, `Line ${i + 1} of ${round.length}${item.lvl === 2 ? " · with a twist" : ""}`),
      el("p", { class: "small" }, "Say it aloud, then tap each syllable that takes a beat."),
      m.node,
      el("div", { class: "btn-row" }, check),
      result,
    );
    const first = stage.querySelector(".mark-btn");
    if (i > 0 && first) first.focus();
  }

  function end() {
    const pct = Math.round((100 * right) / Math.max(1, total));
    record(g, pct >= 90, pct);
    refreshScore(g);
    const fb = feedback(pct >= 90 ? true : pct >= 70 ? null : false, `${pct}%: ${right} of ${total} syllables, ${perfect} of ${round.length} lines perfect.`,
      pct >= 90 ? "Your ear for the beat is in good shape. Try the rehearsal room with a speech of your own." : "The trick is to say each line out loud, quite slowly, and notice which syllables you lean on. Small words (the, of, and) rarely take a full beat.");
    stage.replaceChildren(
      fb,
      el("p", { class: "links" }, lessonLink("ten"), el("span", { "aria-hidden": "true" }, " · "), el("a", { href: "room.html" }, "The rehearsal room")),
      el("div", { class: "btn-row" }, el("button", { type: "button", class: "btn", onclick: () => go(g, true) }, "Another round")),
    );
    announce(fb.firstChild.textContent);
    focusSoon(fb);
  }
  next();
}

// ------------------------------------------------------------------ 4. tap the heartbeat

const TEMPI = [
  ["slow", "Slow", 84],
  ["steady", "Steady", 100],
  ["quick", "Quick", 120],
];

function runTap(run) {
  const g = "tap";
  const box = $("game");
  let tempoKey = load("play:tempo", "steady");
  let showBeats = load("play:tap-beats", true);
  const stage = el("div", { class: "card game-card" });
  box.replaceChildren(
    header(g, el("p", { class: "small" }, "Prefer no clock? ", el("a", { href: "?g=mark", onclick: (e) => { e.preventDefault(); go("mark"); } }, "Mark the beat"), " trains the same thing, untimed.")),
    stage,
  );
  const pool = state.games.mark.filter((m) => m.lvl === 1);
  const item = pick(pool);
  const scan = scanItem(item);

  const tempoSeg = el(
    "div",
    { class: "seg", role: "group", "aria-label": "Speed" },
    TEMPI.map(([k, label]) =>
      el("button", { type: "button", "aria-pressed": String(k === tempoKey), onclick: (e) => {
        tempoKey = k;
        save("play:tempo", k);
        tempoSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
      } }, label),
    ),
  );
  const beatsToggle = el("label", { class: "toggle" }, el("input", { type: "checkbox", checked: showBeats || null, onchange: (e) => { showBeats = e.target.checked; save("play:tap-beats", showBeats); lineBox.classList.toggle("no-marks", !showBeats); } }), " Show the beats");
  const lineBox = el("div", { class: `verse tap-line${showBeats ? "" : " no-marks"}` }, renderLine(scan, { label: "The line" }));
  const countIn = el("p", { class: "count-in", "aria-hidden": "true" }, ["de", "DUM", "de", "DUM"].map((w) => el("span", { class: w === "DUM" ? "ci-dum" : "ci-de" }, w)));
  const tapBtn = el("button", { type: "button", class: "tap-btn", disabled: true, "aria-describedby": "tap-help" }, "Tap");
  const help = el("p", { class: "small", id: "tap-help" }, "Press Start. You'll hear two de-DUMs to count you in, then the line plays. Tap on every DUM: this button, or the space bar.");
  const start = el("button", { type: "button", class: "btn btn--red" }, "Start");
  const result = el("div", { "aria-live": "polite" });

  stage.append(
    el("p", { class: "eyebrow" }, `${titleCase(item.who)} · ${playTitle(item.p)}`),
    lineBox,
    countIn,
    el("div", { class: "btn-row tap-controls" }, tempoSeg, beatsToggle),
    help,
    el("div", { class: "btn-row" }, start),
    tapBtn,
    result,
  );

  let taps = [];
  let expected = [];
  let running = false;

  const onTap = () => {
    if (!running) return;
    taps.push(performance.now());
    tapBtn.classList.remove("is-hit");
    void tapBtn.offsetWidth;
    tapBtn.classList.add("is-hit");
  };
  tapBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onTap();
  });
  const onKey = (e) => {
    if (!running || e.repeat) return;
    if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") {
      e.preventDefault();
      onTap();
    }
  };
  window.addEventListener("keydown", onKey);
  const cleanup = () => window.removeEventListener("keydown", onKey);
  state.cleanup = cleanup;

  start.addEventListener("click", () => {
    if (running) return;
    beat.unlock();
    result.replaceChildren();
    const tempo = TEMPI.find((t) => t[0] === tempoKey)[2];
    const lineSteps = beat.stepsFromScan(scan).map((s) => ({ ...s, pause: 0 }));
    const steps = [{ strength: 0 }, { strength: 2 }, { strength: 0 }, { strength: 2 }, ...lineSteps];
    taps = [];
    running = true;
    start.disabled = true;
    tapBtn.disabled = false;
    tapBtn.focus();
    const syls = [...lineBox.querySelectorAll(".syl")];
    const ci = [...countIn.children];
    lineBox.querySelectorAll(".tap-mark").forEach((n) => n.remove());
    const t0 = performance.now();
    const job = beat.play(steps, {
      tempo,
      onStep: (k) => {
        ci.forEach((c, j) => c.classList.toggle("is-now", j === k));
        syls.forEach((s, j) => s.classList.toggle("is-now", j === k - 4));
      },
      onEnd: () => {
        setTimeout(() => finish(), 250);
      },
    });
    // when each beat actually sounds, straight from the player
    expected = lineSteps.map((st, k) => ({ k, time: t0 + job.at[k + 4] * 1000, beat: st.strength > 0 })).filter((x) => x.beat);
  });

  function finish() {
    running = false;
    tapBtn.disabled = true;
    start.disabled = false;
    start.textContent = "Again";
    lineBox.querySelectorAll(".is-now").forEach((n) => n.classList.remove("is-now"));
    countIn.querySelectorAll(".is-now").forEach((n) => n.classList.remove("is-now"));
    // match each beat to the nearest unused tap
    const used = new Set();
    let good = 0;
    let close = 0;
    let missed = 0;
    const marks = [];
    for (const ex of expected) {
      let bestJ = -1;
      let bestD = Infinity;
      taps.forEach((tt, j) => {
        if (used.has(j)) return;
        const d = Math.abs(tt - ex.time);
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      });
      let kind = "missed";
      if (bestJ >= 0 && bestD <= 220) {
        used.add(bestJ);
        kind = bestD <= 120 ? "good" : "close";
      }
      if (kind === "good") good++;
      else if (kind === "close") close++;
      else missed++;
      marks.push({ k: ex.k, kind, early: bestJ >= 0 && taps[bestJ] < ex.time });
    }
    const extra = taps.length - used.size;
    const n = expected.length;
    const pct = Math.max(0, Math.round((100 * (good + close * 0.5)) / n - extra * 4));
    record(g, pct >= 80, pct);
    refreshScore(g);
    // show how each beat went, under its syllable
    const syls = [...lineBox.querySelectorAll(".syl")];
    for (const m of marks) {
      const s = syls[m.k];
      if (s) s.append(el("span", { class: `tap-mark tap-mark--${m.kind}`, "aria-hidden": "true" }));
    }
    const lateEarly = marks.filter((m) => m.kind === "close");
    const tendency = lateEarly.length >= 2 ? (lateEarly.filter((m) => m.early).length > lateEarly.length / 2 ? " You tend to come in a little early." : " You tend to come in a little late.") : "";
    const fb = feedback(pct >= 80 ? true : pct >= 50 ? null : false, `${pct}%`,
      `${good} on the beat, ${close} close, ${missed} missed${extra > 0 ? `, ${extra} extra tap${extra === 1 ? "" : "s"}` : ""} (out of ${n} beats).${tendency}`,
      pct >= 80 ? "You're feeling the pulse. Try it quicker, or with the beats hidden." : "Say the line along with the heartbeat and tap where your voice leans. The beats are every second syllable.",
    );
    result.replaceChildren(
      fb,
      el("ul", { class: "key tap-key" },
        el("li", {}, el("span", { class: "dot tap-dot--good", "aria-hidden": "true" }), "on the beat"),
        el("li", {}, el("span", { class: "dot tap-dot--close", "aria-hidden": "true" }), "close"),
        el("li", {}, el("span", { class: "dot tap-dot--missed", "aria-hidden": "true" }), "missed"),
      ),
      el("p", { class: "cite" }, `${titleCase(item.who)}. ${where(item.p, item.a, item.s)}`),
      el("p", { class: "links" }, lessonLink("heartbeat"), el("span", { "aria-hidden": "true" }, " · "), roomLink(item)),
      el("div", { class: "btn-row" }, el("button", { type: "button", class: "btn", onclick: () => go(g, true) }, "A new line")),
    );
    announce(`${pct} percent. ${good} on the beat, ${close} close, ${missed} missed.`);
    focusSoon(fb);
  }
}

// ------------------------------------------------------------------ routing

const RUN = { "verse-prose": runVerseProse, relineate: runRelineate, mark: runMark, tap: runTap };

function go(g, again = false) {
  beat.stop();
  if (state.cleanup) {
    state.cleanup();
    state.cleanup = null;
  }
  const valid = g && RUN[g] ? g : null;
  if (!again || valid !== state.game) {
    const u = new URL(location.href);
    if (valid) u.searchParams.set("g", valid);
    else u.searchParams.delete("g");
    if (u.href !== location.href) history.pushState({ g: valid }, "", u);
  }
  show(valid, true);
}

function show(g, focus) {
  state.game = g;
  state.run++;
  document.querySelectorAll("#game-tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.game === g)));
  document.title = g ? `${GAMES[g].title} · Play · dedumdedumdedum` : "Play · dedumdedumdedum";
  if (!g) return renderHub();
  const r = RUN[g](state.run);
  if (focus) {
    Promise.resolve(r).then(() => {
      const t = $("game-title");
      if (t && !document.activeElement?.closest?.(".game-card")) t.focus();
    });
  }
}

async function main() {
  document.querySelectorAll("#game-tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.game)));
  window.addEventListener("popstate", () => {
    beat.stop();
    if (state.cleanup) state.cleanup();
    show(new URLSearchParams(location.search).get("g"), false);
  });
  const gamesURL = new URL("../../../data/games.json", import.meta.url);
  const [scanner, games, plays] = await Promise.all([getScanner(), fetch(gamesURL).then((r) => r.json()), getPlays()]);
  Object.assign(state, { scanner, games, plays });
  const g = new URLSearchParams(location.search).get("g");
  show(RUN[g] ? g : null, false);
}

main().catch((e) => {
  console.error(e);
  $("game").replaceChildren(el("p", {}, "Sorry, the games didn't load. Try refreshing the page."));
});
