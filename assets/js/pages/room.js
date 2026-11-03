// The rehearsal room: choose a speech, see it scanned, open any line for
// notes and choices, change our marks, and try the rehearsal views.
import { getScanner, getLibrary, getPlays, getSpeechIndex, getPassage, getSpeech, getSpeechAround, citation } from "../data.js";
import { analyse, parsePasted } from "../passage.js";
import { lineNotes, passageNotes, titleCase } from "../notes.js";
import { isGlueWord, tokenize } from "../scan.js";
import { el, renderLine, renderNote, renderKey, chip, beatWords, announce, sharedIndent } from "../render.js";
import { createMarker, explain } from "../marker.js";
import * as beat from "../beat.js";
import { load, save } from "../store.js";

const $ = (id) => document.getElementById(id);
const LEVELS = { 1: "Start here", 2: "Next step", 3: "Stretch" };
const KINDS = { verse: "Verse", prose: "Prose", dialogue: "Dialogue", rhyme: "Rhyme", chant: "Chant" };

const state = {
  scanner: null,
  key: null, // identifies the passage, for saved marks
  lib: null,
  meta: null, // {play, scene}
  items: [], // speeches and stage directions, as loaded
  a: null, // analysis
  view: "beats",
  feet: load("room:feet", false),
  tryFirst: load("room:try", false),
  open: new Set(),
  overrides: {}, // flat index -> {syllable index: beat}
  tried: {}, // flat index -> check result
};

// ------------------------------------------------------------------ choosing

function showPane(name) {
  document.querySelectorAll("#chooser > .seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pane === name)));
  ["library", "find", "paste"].forEach((p) => ($(`pane-${p}`).hidden = p !== name));
  if (name === "find") setupFind();
}

let libFilter = "all";
async function setupLibrary() {
  const lib = await getLibrary();
  const filters = [["all", "All"], ["1", "Start here"], ["verse", "Verse"], ["prose", "Prose"], ["dialogue", "Two voices"], ["rhyme", "Rhyme and chant"]];
  const fbox = $("lib-filters");
  fbox.replaceChildren(
    ...filters.map(([k, label]) =>
      el("button", { type: "button", "aria-pressed": String(k === libFilter), onclick: () => { libFilter = k; setupLibrary(); } }, label),
    ),
  );
  const list = $("lib-list");
  const shown = lib.slice().sort((x, y) => x.level - y.level).filter((e) => {
    if (libFilter === "all") return true;
    if (libFilter === "1") return e.level === 1;
    if (libFilter === "rhyme") return e.kind === "rhyme" || e.kind === "chant";
    return e.kind === libFilter;
  });
  list.replaceChildren(
    ...shown.map((e) =>
      el(
        "li",
        {},
        el(
          "button",
          { type: "button", class: "card lib-card", onclick: () => openLibrary(e.id) },
          el("span", { class: "lib-card__title" }, e.title),
          el("span", { class: "lib-card__who" }, `${e.who} · ${playTitle(e.play)}`),
          el("span", { class: "lib-card__about" }, e.about.split(". ")[0] + "."),
          el("span", { class: "badges" }, el("span", { class: `badge badge--${e.level}` }, LEVELS[e.level]), el("span", { class: "badge" }, KINDS[e.kind])),
        ),
      ),
    ),
  );
}

let playsCache = [];
function playTitle(id) {
  const p = playsCache.find((x) => x.id === id);
  return p ? p.title : id;
}

let findReady = false;
async function setupFind() {
  if (findReady) return;
  findReady = true;
  const plays = await getPlays();
  const sel = $("find-play");
  plays
    .slice()
    .sort((a, b) => a.title.replace(/^(The|A) /, "").localeCompare(b.title.replace(/^(The|A) /, "")))
    .forEach((p) => sel.append(el("option", { value: p.id }, p.title)));
  const who = $("find-who");
  sel.addEventListener("change", () => {
    who.replaceChildren(el("option", { value: "" }, "Choose a character"));
    const p = plays.find((x) => x.id === sel.value);
    who.disabled = !p;
    if (p) p.characters.forEach((c) => who.append(el("option", { value: c }, titleCase(c))));
    showResults();
  });
  who.addEventListener("change", showResults);
  let t;
  $("find-q").addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(showResults, 150);
  });
  $("find-status").textContent = "Loading the index…";
  await getSpeechIndex();
  $("find-status").textContent = "";
}

async function showResults() {
  const idx = await getSpeechIndex();
  const q = $("find-q").value.trim().toLowerCase();
  const pid = $("find-play").value;
  const who = $("find-who").value;
  let rows = idx;
  if (pid) rows = rows.filter((r) => r[0] === pid);
  if (who) rows = rows.filter((r) => r[4] === who);
  if (q) {
    const words = q.split(/\s+/);
    rows = rows.filter((r) => {
      const hay = `${r[5]} ${r[4]} ${playTitle(r[0])}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  const list = $("find-results");
  if (!q && !pid) {
    list.replaceChildren();
    $("find-status").textContent = "";
    return;
  }
  if (!who && !q) rows = rows.slice().sort((a, b) => b[6] - a[6]);
  const shown = rows.slice(0, 40);
  $("find-status").textContent = rows.length ? `${rows.length} speech${rows.length === 1 ? "" : "es"}${rows.length > 40 ? ", showing the first 40" : ""}.` : "No speeches found. Try fewer words.";
  list.replaceChildren(
    ...shown.map((r) =>
      el(
        "li",
        {},
        el(
          "button",
          { type: "button", class: "result", onclick: () => openCorpus(r[0], r[1], r[2], r[3]) },
          el("b", {}, r[5]),
          el("span", {}, `${titleCase(r[4])} · ${playTitle(r[0])} ${r[1]}.${r[2]} · ${r[6]} lines · ${r[7] === "p" ? "prose" : "verse"}`),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------ loading

async function openLibrary(id, push = true) {
  const lib = await getLibrary();
  const e = lib.find((x) => x.id === id);
  if (!e) return;
  const { play, scene, items } = await getPassage(e.play, e.a, e.s, e.from, e.to);
  state.lib = e;
  state.meta = { play, scene, from: e.from, to: e.to };
  if (push) setURL({ lib: id });
  show(`lib:${id}`, items, { eyebrow: `${LEVELS[e.level]} · ${KINDS[e.kind]}`, title: e.title, cite: `${e.who}. ${citation(play, scene, e.from, e.to)}` });
}

async function openCorpus(pid, a, s, n, push = true) {
  const { play, scene, items } = await getSpeech(pid, a, s, n);
  state.lib = null;
  const lines = items[0].lines;
  state.meta = { play, scene, from: lines[0].n, to: lines[lines.length - 1].n };
  if (push) setURL({ p: pid, a, s, n });
  show(`p:${pid}:${a}.${s}.${n}`, items, {
    eyebrow: items[0].form === "p" ? "Prose" : "Verse",
    title: lines[0].text.replace(/\[[^\]]*\]\s*/g, "").replace(/[,;:]$/, ""),
    cite: `${titleCase(items[0].who)}. ${citation(play, scene, state.meta.from, state.meta.to)}`,
  });
}

async function openWhole() {
  const m = state.meta;
  if (!m) return;
  const { play, scene, items } = await getSpeechAround(m.play.id, m.scene.a, m.scene.s, m.from);
  const sp = items.filter((x) => !x.sd);
  const first = sp[0].lines[0].n;
  const lastSp = sp[sp.length - 1];
  const last = lastSp.lines[lastSp.lines.length - 1].n;
  state.lib = null;
  state.meta = { play, scene, from: first, to: last };
  setURL({ p: play.id, a: scene.a, s: scene.s, n: first });
  show(`p:${play.id}:${scene.a}.${scene.s}.${first}`, items, {
    eyebrow: sp[0].form === "p" ? "Prose" : "Verse",
    title: sp[0].lines[0].text.replace(/\[[^\]]*\]\s*/g, "").replace(/[,;:]$/, ""),
    cite: `${titleCase(sp[0].who)}. ${citation(play, scene, first, last)}`,
  });
}

function openPaste(text, push = true) {
  const speeches = parsePasted(text);
  if (!speeches.length) {
    announce("There's nothing to scan yet.");
    return;
  }
  state.lib = null;
  state.meta = null;
  if (push) setURL({ text });
  const first = speeches[0].lines[0].text;
  show(`t:${hash(text)}`, speeches, { eyebrow: "Your speech", title: first.replace(/[,;:]$/, ""), cite: speeches[0].who ? titleCase(speeches[0].who) : "" });
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function setURL(params) {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  history.pushState(params, "", u);
}

function show(key, items, head) {
  beat.stop();
  state.key = key;
  state.items = items;
  const speeches = items.filter((x) => !x.sd);
  state.a = analyse(state.scanner, speeches, { fix: state.lib && state.lib.fix });
  // map each speech in items to its index in the analysis
  let k = 0;
  state.items.forEach((it) => {
    if (!it.sd) it._s = k++;
  });
  state.open = new Set();
  state.overrides = load(`marks:${key}`, {});
  state.tried = {};
  $("chooser").hidden = true;
  $("speech").hidden = false;
  $("speech-eyebrow").textContent = head.eyebrow;
  $("speech-title").textContent = head.title;
  $("speech-cite").textContent = head.cite;
  $("whole-speech").hidden = !state.meta;
  renderAbout();
  renderView();
  $("speech-title").focus();
  document.title = `${head.title} · Rehearsal room`;
}

function backToChooser() {
  beat.stop();
  $("speech").hidden = true;
  $("chooser").hidden = false;
  history.pushState({}, "", location.pathname);
  document.title = "Rehearsal room · dedumdedumdedum";
}

// ------------------------------------------------------------------ the speech

function renderAbout() {
  const box = $("about-box");
  box.replaceChildren();
  const e = state.lib;
  if (e) {
    box.append(el("p", {}, e.about));
    box.append(el("h3", { style: "font-size:1.1rem" }, "What to look for"), el("ul", { class: "overview" }, e.look.map((x) => el("li", {}, x))));
  }
  box.append(el("h3", { style: "font-size:1.1rem" }, "At a glance"), el("ul", { class: "overview" }, passageNotes(state.a).map((x) => el("li", {}, x))));
}

const HELP = {
  beats: () => [
    el("b", {}, "Beats. "),
    "Red dots are beats. Open a line to see what it does, why it might matter, and some ways to play it. ",
    state.tryFirst ? "You're marking each line yourself first: tap the syllables you lean on, then check." : "",
  ],
  thoughts: () => [el("b", {}, "Thoughts. "), "Each card is one sentence. Try to say each one on a single breath. Something changes at every new card: a new idea, a new tactic. Try moving, or looking somewhere new, each time. Opposites are underlined."],
  ends: () => [el("b", {}, "Line ends. "), "The last word of a verse line usually matters. Say the speech, then say only the bold words, in order. Often they tell the story on their own. Then go back to the speech and land each one."],
  breath: () => [el("b", {}, "Breath. "), "One way to plan your breath: breathe at the blue marks, and where you see an arrow, carry on to the next line without one. Faint marks are optional. Your lungs, your choice."],
  words: () => [el("b", {}, "Key words. "), "The bold words carry the meaning; the faint ones are the glue. Say only the bold words, then say the whole thing and notice what you lean on."],
};

function renderView() {
  const view = state.view;
  document.querySelectorAll("#views button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  $("view-help").replaceChildren(...HELP[view]());
  $("t-try-wrap").hidden = view !== "beats";
  $("t-feet-wrap").hidden = view !== "beats";
  $("t-try").checked = state.tryFirst;
  $("t-feet").checked = state.feet;
  $("key-holder").replaceChildren(view === "beats" && state.a.summary.verseLines ? renderKey() : "");
  $("play-all").hidden = view !== "beats" || !state.a.summary.verseLines;
  $("speed").hidden = $("play-all").hidden;
  const box = $("passage");
  box.replaceChildren();
  if (view === "beats") renderBeats(box);
  else if (view === "thoughts") renderThoughts(box);
  else renderLinesView(box, view);
}

function flatIndex(s, l) {
  return state.a.flat.findIndex((f) => f.s === s && f.l === l);
}

function renderBeats(box) {
  const seenKeys = new Set();
  for (const it of state.items) {
    if (it.sd) {
      box.append(el("p", { class: "sd" }, it.sd));
      continue;
    }
    const sp = state.a.speeches[it._s];
    const sec = el("section", { class: "speech", "aria-label": sp.who ? titleCase(sp.who) : "Speech" });
    if (sp.who && !it.cont) sec.append(el("p", { class: "who" }, titleCase(sp.who)));
    if (sp.form === "prose") {
      sec.append(renderProse(it._s));
      box.append(sec);
      continue;
    }
    const ol = el("ol", { class: "lines" });
    sp.lines.forEach((ln, l) => ol.append(renderRow(flatIndex(it._s, l), seenKeys)));
    sec.append(ol);
    box.append(sec);
  }
}

function scanFor(i) {
  const { s, l } = state.a.flat[i];
  const ln = state.a.speeches[s].lines[l];
  if (ln.shared) return { scan: ln.shared.joined, wordFrom: ln.shared.wordFrom, wordTo: ln.shared.wordTo };
  return { scan: ln.scan, wordFrom: 0, wordTo: ln.scan.words.length };
}

function renderRow(i, seenKeys) {
  const { s, l } = state.a.flat[i];
  const ln = state.a.speeches[s].lines[l];
  const open = state.open.has(i);
  const li = el("li", { class: `row${open ? " is-open" : ""}`, dataset: { i } });
  li.append(el("span", { class: "ln", "aria-hidden": "true" }, ln.n));
  const body = el("div", { class: "row__body" });
  const { scan, wordFrom, wordTo } = scanFor(i);
  const notes = lineNotes(state.a, i);
  const hand = state.lib && state.lib.notes && state.lib.notes[ln.n];

  if (state.tryFirst && !state.tried[i]) {
    const m = createMarker(scan, { label: `Line ${ln.n}`, wordFrom, wordTo });
    const res = el("div", { "aria-live": "polite" });
    body.append(
      m.node,
      el("div", { class: "btn-row" },
        el("button", { type: "button", class: "btn btn--small", onclick: () => {
          const r = m.check();
          state.tried[i] = r;
          res.replaceChildren(el("div", { class: `feedback ${r.right >= r.total - 1 ? "feedback--good" : "feedback--bad"}` }, `${r.right} of ${r.total}.`, ...explain(r, scan).map((t) => el("p", {}, t))));
          setTimeout(() => {
            const fresh = renderRow(i, new Set());
            li.replaceWith(fresh);
            fresh.querySelector(".row__line")?.after(res);
          }, 50);
        } }, "Check"),
        el("button", { type: "button", class: "btn btn--ghost btn--small", onclick: () => { state.tried[i] = { skipped: true }; li.replaceWith(renderRow(i, new Set())); } }, "Show me"),
      ),
      res,
    );
    li.append(body);
    return li;
  }

  const overrides = state.overrides[i] || {};
  const line = renderLine(scan, { overrides, feet: state.feet, wordFrom, wordTo, label: `Line ${ln.n}` });
  line.classList.add("row__line");
  line.addEventListener("click", () => toggleRow(i));
  const verse = el("div", { class: "verse", style: sharedIndent(ln.shared) }, line);
  body.append(verse);
  const meta = el("div", { class: "row__meta" });
  const labels = [];
  if (hand) labels.push({ key: "hand", label: "Note" });
  for (const n of notes) if (n.rank <= 3 && !labels.some((x) => x.label === n.label)) labels.push(n);
  const shownChips = labels.slice(0, 3);
  if (shownChips.length) meta.append(el("ul", { class: "chips", "aria-label": "What this line does" }, shownChips.map((n) => (n.key === "hand" ? el("li", { class: "chip chip--squeeze" }, "Note") : chip(n)))));
  const toggle = el("button", { type: "button", class: "row__toggle", "aria-expanded": String(open), "aria-controls": `detail-${i}`, onclick: () => toggleRow(i) }, open ? "Close" : "Open", el("span", { class: "visually-hidden" }, ` line ${ln.n}`));
  meta.append(toggle);
  body.append(meta);

  const detail = el("div", { class: "detail", id: `detail-${i}`, hidden: !open });
  if (open) fillDetail(detail, i, scan, wordFrom, wordTo, notes, hand, seenKeys);
  body.append(detail);
  li.append(body);
  return li;
}

function toggleRow(i) {
  if (state.open.has(i)) state.open.delete(i);
  else state.open.add(i);
  const li = document.querySelector(`.row[data-i="${i}"]`);
  if (li) {
    const fresh = renderRow(i, new Set());
    li.replaceWith(fresh);
    fresh.querySelector(".row__toggle")?.focus();
  }
}

function fillDetail(detail, i, scan, wordFrom, wordTo, notes, hand) {
  const { s, l } = state.a.flat[i];
  const ln = state.a.speeches[s].lines[l];
  const overrides = state.overrides[i] || {};
  const count = scan.syllables.filter((sy) => {
    const w = scan.words[sy.word];
    return scan.words.indexOf(w) >= wordFrom && scan.words.indexOf(w) < wordTo;
  }).length;
  detail.append(
    el("p", { class: "pattern" }, ln.shared ? `Shared line. Together: ${beatWords(scan)}` : `${count} syllables: ${beatWords(scan)}${scan.checked ? " · checked by hand" : ""}`),
  );
  const editing = el("div", { class: "editor", hidden: true });
  const hear = el("button", { type: "button", class: "btn btn--small" }, "Hear it");
  hear.addEventListener("click", () => playRow(i, hear));
  const edit = el("button", { type: "button", class: "btn btn--ghost btn--small", "aria-expanded": "false" }, "Change the marks");
  edit.addEventListener("click", () => {
    editing.hidden = !editing.hidden;
    edit.setAttribute("aria-expanded", String(!editing.hidden));
    if (!editing.hidden) buildEditor(editing, i, scan, wordFrom, wordTo);
  });
  const row = el("div", { class: "btn-row", style: "margin-bottom:.8rem" }, hear, edit);
  if (Object.keys(overrides).length) {
    row.append(el("button", { type: "button", class: "btn btn--ghost btn--small", onclick: () => { delete state.overrides[i]; saveMarks(); refreshRow(i); } }, "Put our marks back"));
  }
  detail.append(row, editing);
  if (hand) detail.append(el("div", { class: "handnote" }, el("b", {}, "Note. "), hand));
  if (!notes.length && !hand) detail.append(el("p", { class: "small" }, "A regular line: five beats, de-DUM all the way. Let the rhythm carry you and put your effort into the meaning."));
  notes.forEach((n) => detail.append(renderNote(n)));
}

function buildEditor(box, i, scan, wordFrom, wordTo) {
  box.replaceChildren(el("p", { class: "small" }, "Tap a syllable to give it a beat or take one away. Your marks are saved on this device."));
  const current = state.overrides[i] || {};
  const verse = el("div", { class: "verse markable" });
  const line = el("div", { class: "vline", style: "padding-top:.2em" });
  scan.words.slice(wordFrom, wordTo).forEach((w, k0) => {
    if (k0 > 0) line.append(" ");
    if (!w.syllables.length) {
      line.append(el("span", { class: "elided" }, w.text));
      return;
    }
    const word = el("span", { class: w.syllables.length > 1 ? "w w--multi" : "w" });
    w.syllables.forEach((si, j) => {
      if (j > 0) word.append(el("span", { class: "sylsep", "aria-hidden": "true" }, "·"));
      const sy = scan.syllables[si];
      const on = si in current ? current[si] : sy.beat;
      const b = el("button", { type: "button", class: "mark-btn", "aria-pressed": String(on), "aria-label": `${sy.text}${w.syllables.length > 1 ? ` in ${w.text}` : ""}` }, sy.text);
      b.addEventListener("click", () => {
        const now = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", String(now));
        const o = (state.overrides[i] = state.overrides[i] || {});
        if (now === sy.beat) delete o[si];
        else o[si] = now;
        if (!Object.keys(o).length) delete state.overrides[i];
        saveMarks();
        // redraw just the line above
        const li = document.querySelector(`.row[data-i="${i}"]`);
        const old = li && li.querySelector(".row__line");
        if (old) {
          const fresh = renderLine(scan, { overrides: state.overrides[i] || {}, feet: state.feet, wordFrom, wordTo, label: `Line ${state.a.speeches[state.a.flat[i].s].lines[state.a.flat[i].l].n}` });
          fresh.classList.add("row__line");
          fresh.addEventListener("click", () => toggleRow(i));
          old.replaceWith(fresh);
        }
        announce(`${sy.text}: ${now ? "beat" : "no beat"}`);
      });
      word.append(b);
    });
    if (w.punct) word.append(w.punct);
    line.append(word);
  });
  verse.append(line);
  box.append(verse);
}

function refreshRow(i) {
  const li = document.querySelector(`.row[data-i="${i}"]`);
  if (li) li.replaceWith(renderRow(i, new Set()));
}

function saveMarks() {
  save(`marks:${state.key}`, state.overrides);
}

function renderProse(s) {
  const wrap = el("div");
  const sp = state.a.speeches[s];
  const thoughts = state.a.thoughts.filter((t) => t.s === s);
  wrap.append(el("div", { class: "prose-block" }, thoughts.map((t) => el("span", { class: "sent" }, t.text))));
  const first = flatIndex(s, 0);
  const notes = [];
  sp.lines.forEach((_, l) => notes.push(...lineNotes(state.a, flatIndex(s, l))));
  const seen = new Set();
  const box = el("div", { class: "prose-notes" });
  notes.filter((n) => (seen.has(n.key + n.text) ? false : seen.add(n.key + n.text))).slice(0, 4).forEach((n) => box.append(renderNote(n)));
  if (first >= 0) wrap.append(box);
  return wrap;
}

// ------------------------------------------------------------------ other views

function wordsOfLine(i) {
  const { s, l } = state.a.flat[i];
  const ln = state.a.speeches[s].lines[l];
  if (ln.scan) return ln.scan.words.map((w) => ({ text: w.text, word: w.word, punct: w.punct, hyphen: w.hyphen }));
  return ln.tokens.filter((t) => t.word).map((t) => ({ text: t.text, word: t.word, punct: t.punct, hyphen: t.hyphen }));
}

function oppSet() {
  const set = new Set();
  for (const x of state.a.antitheses) {
    set.add(`${x.a.i}:${x.a.w}`);
    set.add(`${x.b.i}:${x.b.w}`);
  }
  return set;
}

function renderThoughts(box) {
  const opp = oppSet();
  const ol = el("ol", { class: "thoughts" });
  let lastS = -1;
  for (const t of state.a.thoughts) {
    const li = el("li", { class: "card thought" });
    const sp = state.a.speeches[t.s];
    if (t.s !== lastS && sp.who) li.append(el("span", { class: "who-inline" }, titleCase(sp.who)));
    lastS = t.s;
    for (let i = t.from.i; i <= t.to.i; i++) {
      const words = wordsOfLine(i);
      const w0 = i === t.from.i ? t.from.w : 0;
      const w1 = i === t.to.i ? t.to.w : words.length - 1;
      if (i > t.from.i && sp.form === "verse") li.append(el("span", { class: "slash", "aria-hidden": "true" }, " / "));
      else if (i > t.from.i) li.append(" ");
      for (let k = w0; k <= w1; k++) {
        const w = words[k];
        if (k > w0 && !(words[k - 1] && words[k - 1].hyphen)) li.append(" ");
        li.append(el("span", { class: opp.has(`${i}:${k}`) ? "opp" : null }, w.text));
        if (w.punct) li.append(w.punct === "–" ? " –" : w.punct);
        if (w.hyphen) li.append("-");
      }
    }
    ol.append(li);
  }
  box.append(ol);
}

function renderLinesView(box, view) {
  const ends = [];
  for (const it of state.items) {
    if (it.sd) {
      box.append(el("p", { class: "sd" }, it.sd));
      continue;
    }
    const sp = state.a.speeches[it._s];
    const sec = el("section", { class: "speech" });
    if (sp.who && !it.cont) sec.append(el("p", { class: "who" }, titleCase(sp.who)));
    if (sp.form === "prose" && view === "ends") {
      sec.append(el("p", { class: "small" }, "Prose: no line ends to find here. The line breaks belong to the printer. Try the Thoughts view instead."));
      box.append(sec);
      continue;
    }
    const lines = sp.form === "prose" && view !== "ends" ? proseAsSentences(it._s) : sp.lines.map((_, l) => flatIndex(it._s, l));
    for (const entry of lines) {
      const words = typeof entry === "number" ? wordsOfLine(entry) : entry.words;
      const div = el("div", { class: `plain-line${view !== "breath" ? " faded" : ""}` });
      words.forEach((w, k) => {
        if (k > 0 && !(words[k - 1] && words[k - 1].hyphen)) div.append(" ");
        let key = false;
        if (view === "ends") key = k === words.length - 1;
        if (view === "words") key = !isGlueWord(w.word);
        div.append(el("span", { class: `word${key ? " is-key" : ""}` }, w.text));
        if (w.punct) div.append(w.punct === "–" ? " –" : w.punct);
        if (w.hyphen) div.append("-");
        if (view === "breath" && k < words.length - 1 && /[.!?;:]/.test(w.punct)) div.append(el("span", { class: "breath breath--maybe", title: "optional breath" }, " /"));
      });
      if (view === "breath") {
        const last = words[words.length - 1];
        const p = last ? last.punct : "";
        if (/[.!?;:]/.test(p)) div.append(el("span", { class: "breath", title: "breathe" }, " /", el("span", { class: "visually-hidden" }, " breathe")));
        else if (/,/.test(p)) div.append(el("span", { class: "breath breath--maybe", title: "breathe if you need to" }, " (/)", el("span", { class: "visually-hidden" }, " breathe if you need to")));
        else if (sp.form === "verse") div.append(el("span", { class: "carry", title: "carry on" }, " →", el("span", { class: "visually-hidden" }, " carry on")));
      }
      if (view === "ends" && words.length) ends.push(words[words.length - 1].text);
      sec.append(div);
    }
    box.append(sec);
  }
  if (view === "ends" && ends.length) {
    box.append(
      el("h3", {}, "The last words, in order"),
      el("p", { class: "ends-list" }, ends.flatMap((w, k) => [k ? el("span", { class: "sep", "aria-hidden": "true" }, "·") : "", el("b", {}, w.replace(/[^\w'À-ſ-]/g, ""))])),
    );
  }
}

function proseAsSentences(s) {
  return state.a.thoughts.filter((t) => t.s === s).map((t) => ({ words: tokenize(t.text).filter((x) => x.word) }));
}

// ------------------------------------------------------------------ sound

function playRow(i, btn) {
  if (beat.isPlaying()) {
    beat.stop();
    return;
  }
  const { scan, wordFrom, wordTo } = scanFor(i);
  const overrides = state.overrides[i] || {};
  const li = document.querySelector(`.row[data-i="${i}"]`);
  const syls = [...li.querySelectorAll(".row__line .syl")];
  const indexes = syls.map((x) => +x.dataset.i);
  const steps = beat.stepsFromScan(scan).map((st, si) => {
    const sy = scan.syllables[si];
    const on = si in overrides ? overrides[si] : sy.beat;
    return { ...st, strength: on ? ("fFuU".includes(sy.cls) ? 1 : 2) : 0 };
  }).filter((_, si) => indexes.includes(si));
  btn.textContent = "Stop";
  beat.play(steps, {
    onStep: (k) => syls.forEach((x, j) => x.classList.toggle("is-now", j === k)),
    onEnd: () => {
      btn.textContent = "Hear it";
      syls.forEach((x) => x.classList.remove("is-now"));
    },
  });
}

function playAll() {
  const btn = $("play-all");
  if (beat.isPlaying()) {
    beat.stop();
    return;
  }
  const rows = [...document.querySelectorAll("#passage .row")];
  const steps = [];
  const map = [];
  rows.forEach((li) => {
    const i = +li.dataset.i;
    const { scan } = scanFor(i);
    const syls = [...li.querySelectorAll(".row__line .syl")];
    if (!syls.length) return;
    const overrides = state.overrides[i] || {};
    const all = beat.stepsFromScan(scan);
    syls.forEach((x, j) => {
      const si = +x.dataset.i;
      const sy = scan.syllables[si];
      const on = si in overrides ? overrides[si] : sy.beat;
      steps.push({ ...all[si], strength: on ? ("fFuU".includes(sy.cls) ? 1 : 2) : 0, pause: j === syls.length - 1 ? 1.5 : all[si].pause });
      map.push({ li, x });
    });
  });
  if (!steps.length) return;
  btn.textContent = "Stop";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastLi = null;
  beat.play(steps, {
    onStep: (k) => {
      document.querySelectorAll("#passage .is-now").forEach((n) => n.classList.remove("is-now"));
      if (k < 0) return;
      const { li, x } = map[k];
      x.classList.add("is-now");
      if (li !== lastLi) {
        if (lastLi) lastLi.classList.remove("is-playing");
        li.classList.add("is-playing");
        li.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
        lastLi = li;
      }
    },
    onEnd: () => {
      btn.textContent = "Play the heartbeat";
      document.querySelectorAll("#passage .is-now, #passage .is-playing").forEach((n) => n.classList.remove("is-now", "is-playing"));
    },
  });
}

// ------------------------------------------------------------------ start

function wire() {
  document.querySelectorAll("#chooser > .seg button").forEach((b) => b.addEventListener("click", () => showPane(b.dataset.pane)));
  document.querySelectorAll("#views button").forEach((b) =>
    b.addEventListener("click", () => {
      beat.stop();
      state.view = b.dataset.view;
      renderView();
    }),
  );
  $("t-try").addEventListener("change", (e) => {
    state.tryFirst = e.target.checked;
    save("room:try", state.tryFirst);
    state.tried = {};
    renderView();
  });
  $("t-feet").addEventListener("change", (e) => {
    state.feet = e.target.checked;
    save("room:feet", state.feet);
    renderView();
  });
  $("play-all").addEventListener("click", playAll);
  const speed = $("speed");
  const drawSpeed = () =>
    speed.replaceChildren(
      ...beat.SPEEDS.map((sp) =>
        el("button", { type: "button", "aria-pressed": String(sp.key === beat.getSpeed().key), onclick: () => { beat.setSpeed(sp.key); drawSpeed(); } }, sp.label),
      ),
    );
  drawSpeed();
  $("choose-again").addEventListener("click", backToChooser);
  $("whole-speech").addEventListener("click", openWhole);
  $("copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      announce("Link copied.");
      $("copy-link").textContent = "Link copied";
      setTimeout(() => ($("copy-link").textContent = "Copy a link"), 2000);
    } catch {
      prompt("Copy this link:", location.href);
    }
  });
  $("paste-go").addEventListener("click", () => openPaste($("paste-text").value));
  window.addEventListener("popstate", () => route(false));
}

async function route(push) {
  const q = new URLSearchParams(location.search);
  if (q.get("lib")) return openLibrary(q.get("lib"), push);
  if (q.get("p")) return openCorpus(q.get("p"), +q.get("a"), +q.get("s"), +q.get("n"), push);
  if (q.get("text")) {
    $("paste-text").value = q.get("text");
    return openPaste(q.get("text"), push);
  }
  $("speech").hidden = true;
  $("chooser").hidden = false;
  if (location.hash === "#find") showPane("find");
  else if (location.hash === "#paste") showPane("paste");
}

async function main() {
  wire();
  [state.scanner, playsCache] = await Promise.all([getScanner(), getPlays()]);
  await setupLibrary();
  await route(false);
}

main().catch((e) => {
  console.error(e);
  $("lib-list").replaceChildren(el("li", {}, "Sorry, something didn't load. Try refreshing the page."));
});
