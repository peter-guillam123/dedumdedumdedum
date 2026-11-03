// The lesson player: a list of nine lessons, and each lesson as a run of
// steps. Every exercise can be skipped; progress is saved on the device.
import { LESSONS } from "../lessons.js";
import { getScanner, getPassage, getLibrary, getPlay } from "../data.js";
import { analyse } from "../passage.js";
import { titleCase } from "../notes.js";
import { tokenize } from "../scan.js";
import { el, renderLine, renderKey, beatWords, announce, sharedIndent } from "../render.js";
import { createMarker, explain } from "../marker.js";
import * as beat from "../beat.js";
import { load, save, update } from "../store.js";

const root = document.getElementById("lesson-root");
let scanner;
let library = [];

// tiny formatter: *italic*, **bold**
function rich(text) {
  const span = el("span");
  // curly quotes: an opening quote after a space or bracket, otherwise a closing one or apostrophe
  const curled = String(text).replace(/(^|[\s(])'/g, "$1\u2018").replace(/'/g, "\u2019");
  const parts = curled.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  for (const p of parts) {
    if (p.startsWith("**")) span.append(el("b", {}, p.slice(2, -2)));
    else if (p.startsWith("*")) span.append(el("i", {}, p.slice(1, -1)));
    else if (p) span.append(p);
  }
  return span;
}
const paras = (list = []) => list.map((t) => el("p", {}, rich(t)));

// ------------------------------------------------------------------ the list

function renderList() {
  const done = new Set(load("learn:done", []));
  document.title = "Learn · dedumdedumdedum";
  const next = LESSONS.find((l) => !done.has(l.id)) || LESSONS[0];
  root.replaceChildren(
    el("h1", {}, "Learn"),
    el("p", { class: "lede" }, "Nine short lessons, about five minutes each. Every one asks you to do something: tap, mark, count, choose. Say the lines out loud as you go. It's the only way this works."),
    el("p", {}, el("a", { class: "btn btn--red", href: `?l=${next.id}` }, done.size ? `Carry on: lesson ${LESSONS.indexOf(next) + 1}` : "Start lesson 1")),
    el(
      "ol",
      { class: "lesson-list" },
      LESSONS.map((l, k) =>
        el(
          "li",
          {},
          el(
            "a",
            { class: `card lesson-card${done.has(l.id) ? " is-done" : ""}`, href: `?l=${l.id}` },
            el("span", { class: "lesson-num", "aria-hidden": "true" }, String(k + 1)),
            el("span", { class: "lesson-text" }, el("span", { class: "lesson-title" }, l.title), el("span", { class: "lesson-blurb" }, l.blurb)),
            done.has(l.id) ? el("span", { class: "lesson-done" }, "Done") : null,
          ),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------ a lesson

let current = null; // {lesson, index, answered:Set}

function openLesson(id, stepIndex = null) {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) return renderList();
  const saved = load(`learn:step:${id}`, 0);
  current = { lesson, index: stepIndex ?? Math.min(saved, lesson.steps.length - 1), answered: new Set() };
  renderStep(false);
}

function go(delta) {
  beat.stop();
  const n = current.lesson.steps.length;
  current.index = Math.max(0, Math.min(n - 1, current.index + delta));
  save(`learn:step:${current.lesson.id}`, current.index);
  renderStep(true);
}

async function renderStep(focus) {
  const { lesson, index } = current;
  const step = lesson.steps[index];
  const n = lesson.steps.length;
  const num = LESSONS.indexOf(lesson) + 1;
  document.title = `${lesson.title} · Learn`;
  const card = el("section", { class: "card step", "aria-labelledby": "step-title" });
  const head = el("div", { class: "lesson-head" },
    el("p", { class: "eyebrow" }, el("a", { href: "learn.html" }, "Lessons"), ` · Lesson ${num} of ${LESSONS.length}`),
    el("h1", { class: "lesson-h1" }, lesson.title),
    el("div", { class: "progress", role: "progressbar", "aria-label": "Progress through this lesson", "aria-valuemin": "1", "aria-valuemax": String(n), "aria-valuenow": String(index + 1), "aria-valuetext": `Step ${index + 1} of ${n}` },
      el("span", { style: `width:${((index + 1) / n) * 100}%` })),
  );
  const title = el("h2", { id: "step-title", tabindex: "-1" }, step.title || (step.type === "takeaway" ? "What to take away" : ""));
  card.append(title);
  const nav = el("div", { class: "step-nav" });
  const back = el("button", { type: "button", class: "btn btn--ghost", onclick: () => go(-1), disabled: index === 0 }, "Back");
  const isExercise = ["mark", "count", "choice", "spot", "reline", "vp", "tap"].includes(step.type);
  const nextLabel = index === n - 1 ? null : isExercise && !current.answered.has(index) ? "Skip" : "Next";
  const next = nextLabel ? el("button", { type: "button", class: "btn", onclick: () => go(1) }, nextLabel) : null;
  nav.append(back, el("span", { class: "small step-count" }, `${index + 1} / ${n}`), next || el("span"));
  root.replaceChildren(head, card, nav);
  const markAnswered = () => {
    current.answered.add(index);
    if (next) next.textContent = "Next";
  };
  try {
    await STEP[step.type](card, step, markAnswered);
  } catch (e) {
    console.error(e);
    card.append(el("p", {}, "Sorry, this step didn't load. Try the next one."));
  }
  if (step.type === "takeaway") {
    update("learn:done", [], (d) => (d.includes(lesson.id) ? d : [...d, lesson.id]));
  }
  if (focus) title.focus();
}

// ------------------------------------------------------------------ steps

async function textOf(ref) {
  const { items } = await getPassage(ref.play, ref.a, ref.s, ref.from, ref.to);
  return items.filter((x) => !x.sd).flatMap((x) => x.lines.map((l) => l.text));
}

async function scanRef(ref, force) {
  const [text] = await textOf(ref);
  return scanner.scanLine(text, force ? { force } : {});
}

async function citeFor(ref) {
  const play = await getPlay(ref.play);
  const sc = play.scenes.find((s) => s.a === ref.a && s.s === ref.s);
  const { items } = await getPassage(ref.play, ref.a, ref.s, ref.from, ref.to);
  const names = [...new Set(items.filter((x) => !x.sd).map((x) => titleCase(x.who)))];
  const who = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  const scene = ref.s === 0 ? `Act ${ref.a}, Prologue` : `Act ${ref.a} Scene ${ref.s}`;
  return `${play.title}, ${scene} \u00b7 ${who}`;
}

function hearButton(scan, lineNode, label = "Hear the heartbeat") {
  const b = el("button", { type: "button", class: "btn btn--ghost btn--small" }, label);
  b.addEventListener("click", () => {
    if (beat.isPlaying()) return beat.stop();
    const syls = [...lineNode.querySelectorAll(".syl")];
    b.textContent = "Stop";
    beat.play(beat.stepsFromScan(scan), {
      onStep: (k) => syls.forEach((x, j) => x.classList.toggle("is-now", j === k)),
      onEnd: () => {
        b.textContent = label;
        syls.forEach((x) => x.classList.remove("is-now"));
      },
    });
  });
  return b;
}

const STEP = {
  async text(card, step) {
    card.append(...paras(step.body));
    if (step.example) {
      const scan = scanner.scanLine(step.example);
      const line = renderLine(scan);
      card.append(el("div", { class: "verse example" }, line), el("div", { class: "btn-row" }, hearButton(scan, line)));
    }
    if (step.pulse) {
      const words = [];
      for (let i = 0; i < step.pulse; i++) words.push(el("span", { class: "de" }, "de"), el("span", { class: "dum" }, "DUM"));
      const row = el("p", { class: "big-mark pulse-row", "aria-hidden": "true" }, words);
      const b = el("button", { type: "button", class: "btn btn--small" }, "Play de-DUM x 5");
      b.addEventListener("click", () => {
        if (beat.isPlaying()) return beat.stop();
        b.textContent = "Stop";
        beat.pulse(step.pulse, {
          onStep: (k) => words.forEach((w, j) => w.classList.toggle("is-now", j === k)),
          onEnd: () => (b.textContent = "Play de-DUM x 5"),
        });
      });
      card.append(row, el("div", { class: "btn-row" }, b));
    }
    if (step.key) card.append(renderKey());
  },

  async line(card, step) {
    card.append(...paras(step.body));
    const scan = await scanRef(step.ref, step.force);
    const line = renderLine(scan);
    card.append(el("div", { class: "verse example" }, line), el("p", { class: "cite" }, await citeFor(step.ref)), el("div", { class: "btn-row" }, hearButton(scan, line)));
  },

  async passage(card, step) {
    card.append(...paras(step.body));
    const { items } = await getPassage(step.ref.play, step.ref.a, step.ref.s, step.ref.from, step.ref.to);
    const box = el("div", { class: "example" });
    if (step.plain) {
      const lines = items.filter((x) => !x.sd).flatMap((x) => x.lines);
      box.append(el("div", { class: "printed" }, lines.map((l) => el("div", {}, l.text.replace(/--/g, " – ")))));
    } else {
      const a = analyse(scanner, items.filter((x) => !x.sd));
      let lastWho = null;
      a.speeches.forEach((sp) => {
        if (sp.who && sp.who !== lastWho && a.speeches.length > 1) box.append(el("p", { class: "who" }, titleCase(sp.who)));
        lastWho = sp.who;
        sp.lines.forEach((ln) => {
          if (ln.shared) box.append(el("div", { class: "verse", style: sharedIndent(ln.shared) }, renderLine(ln.shared.joined, { wordFrom: ln.shared.wordFrom, wordTo: ln.shared.wordTo })));
          else if (ln.scan) box.append(el("div", { class: "verse" }, renderLine(ln.scan)));
          else box.append(el("div", { class: "printed" }, ln.text));
        });
      });
    }
    card.append(box, el("p", { class: "cite" }, await citeFor(step.ref)));
  },

  async mark(card, step, done) {
    card.append(...paras(step.body));
    const scan = await scanRef(step.ref, step.force);
    const m = createMarker(scan, { label: "The line" });
    const res = el("div", { "aria-live": "polite" });
    const check = el("button", { type: "button", class: "btn" }, "Check");
    const again = el("button", { type: "button", class: "btn btn--ghost", hidden: true }, "Try again");
    check.addEventListener("click", () => {
      if (!m.marks.size) {
        res.replaceChildren(el("div", { class: "feedback feedback--info" }, "Tap the syllables you lean on first. Say it out loud."));
        return;
      }
      const r = m.check();
      done();
      check.hidden = true;
      again.hidden = false;
      const good = r.right >= r.total - 1;
      const line = renderLine(scan);
      res.replaceChildren(
        el("div", { class: `feedback ${good ? "feedback--good" : "feedback--bad"}` }, r.perfect ? "Spot on." : `${r.right} of ${r.total}.`, ...explain(r, scan).map((t) => el("p", {}, t))),
        ...paras(step.after),
        el("div", { class: "verse example" }, line),
        el("div", { class: "btn-row" }, hearButton(scan, line)),
      );
    });
    again.addEventListener("click", () => {
      m.reset();
      res.replaceChildren();
      check.hidden = false;
      again.hidden = true;
    });
    card.append(m.node, el("p", { class: "cite" }, await citeFor(step.ref)), el("div", { class: "btn-row" }, check, again), res);
  },

  async count(card, step, done) {
    card.append(...paras(step.body));
    const [text] = await textOf(step.ref);
    card.append(el("div", { class: "verse example plain-verse" }, text), el("p", { class: "cite" }, await citeFor(step.ref)));
    const res = el("div", { "aria-live": "polite" });
    const group = el("div", { class: "choices choices--row", role: "group", "aria-label": "Number of syllables" });
    step.options.forEach((n) => {
      const b = el("button", { type: "button", class: "choice-btn" }, String(n));
      b.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((x) => x.classList.remove("is-right", "is-wrong"));
        const ok = n === step.answer;
        b.classList.add(ok ? "is-right" : "is-wrong");
        if (ok) {
          done();
          const scan = scanner.scanLine(text);
          const line = renderLine(scan);
          res.replaceChildren(el("div", { class: "feedback feedback--good" }, `Yes, ${n}.`), ...paras(step.after), el("div", { class: "verse example" }, line), el("div", { class: "btn-row" }, hearButton(scan, line)));
        } else {
          res.replaceChildren(el("div", { class: "feedback feedback--bad" }, n < step.answer ? "Count again: there are more." : "Count again: there are fewer.", el("p", {}, "Tap a finger for each syllable as you say it.")));
        }
      });
      group.append(b);
    });
    card.append(group, res);
  },

  async choice(card, step, done) {
    card.append(...paras(step.body));
    if (step.ref) {
      const lines = await textOf(step.ref);
      card.append(el("div", { class: "example printed" }, lines.map((t) => el("div", {}, t.replace(/--/g, " – ")))), el("p", { class: "cite" }, await citeFor(step.ref)));
    }
    card.append(el("p", { class: "prompt" }, rich(step.prompt)));
    const res = el("div", { "aria-live": "polite" });
    const group = el("div", { class: "choices", role: "group", "aria-label": "Choose an answer" });
    step.options.forEach((o) => {
      const b = el("button", { type: "button", class: "choice-btn" }, o.text);
      b.addEventListener("click", () => {
        b.classList.add(o.ok ? "is-right" : "is-wrong");
        if (o.ok) done();
        res.replaceChildren(el("div", { class: `feedback ${o.ok ? "feedback--good" : "feedback--bad"}` }, o.ok ? "Yes." : "Not quite.", el("p", {}, o.why)));
      });
      group.append(b);
    });
    card.append(group, res);
  },

  async spot(card, step, done) {
    card.append(...paras(step.body));
    const { items } = await getPassage(step.ref.play, step.ref.a, step.ref.s, step.ref.from, step.ref.to);
    card.append(el("p", { class: "prompt" }, step.prompt));
    const box = el("div", { class: "example spot" });
    const buttons = [];
    let lastWho = null;
    const speeches = items.filter((x) => !x.sd);
    speeches.forEach((sp) => {
      if (speeches.length > 1 && sp.who !== lastWho) box.append(el("p", { class: "who" }, titleCase(sp.who)));
      lastWho = sp.who;
      sp.lines.forEach((ln) => {
        const row = el("div", { class: "spot-line" });
        tokenize(ln.text).forEach((t, k) => {
          if (!t.word) return;
          if (row.childNodes.length) row.append(" ");
          const b = el("button", { type: "button", class: "word-btn", "aria-pressed": "false" }, t.text);
          b.dataset.word = t.word.replace(/^'|'$/g, "");
          b.addEventListener("click", () => b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")));
          buttons.push(b);
          row.append(el("span", { class: "word-wrap" }, b, t.punct ? t.punct.replace("–", " –") : ""));
        });
        box.append(row);
      });
    });
    card.append(box, el("p", { class: "cite" }, await citeFor(step.ref)));
    const res = el("div", { "aria-live": "polite" });
    const check = el("button", { type: "button", class: "btn" }, "Check");
    check.addEventListener("click", () => {
      const picked = buttons.filter((b) => b.getAttribute("aria-pressed") === "true");
      if (!picked.length) {
        res.replaceChildren(el("div", { class: "feedback feedback--info" }, "Tap a word first."));
        return;
      }
      // which buttons are answers
      const isAnswer = new Set();
      for (const a of step.answers) {
        const hits = buttons.filter((b) => b.dataset.word === a);
        (step.first ? hits.slice(0, 1) : hits).forEach((b) => isAnswer.add(b));
      }
      const foundWords = new Set(picked.filter((b) => isAnswer.has(b)).map((b) => b.dataset.word));
      const wrong = picked.filter((b) => !isAnswer.has(b));
      buttons.forEach((b) => {
        b.classList.remove("is-right", "is-wrong", "is-missed");
        if (isAnswer.has(b)) b.classList.add(b.getAttribute("aria-pressed") === "true" ? "is-right" : "is-missed");
        else if (b.getAttribute("aria-pressed") === "true") b.classList.add("is-wrong");
      });
      const all = step.answers.every((a) => foundWords.has(a));
      done();
      res.replaceChildren(
        el("div", { class: `feedback ${all && !wrong.length ? "feedback--good" : all ? "feedback--info" : "feedback--bad"}` },
          all && !wrong.length ? "Yes." : all ? "You found it, and a bit more besides." : "Not quite. The answer is highlighted."),
        ...paras(step.after),
      );
    });
    card.append(el("div", { class: "btn-row" }, check), res);
  },

  async reline(card, step, done) {
    card.append(...paras(step.body));
    const lines = await textOf(step.ref);
    const words = [];
    const realBreaks = new Set();
    lines.forEach((t, li) => {
      tokenize(t).forEach((tok) => tok.word && words.push(tok));
      if (li < lines.length - 1) realBreaks.add(words.length - 1); // break after this word index
    });
    const breaks = new Set();
    const box = el("div", { class: "reline" });
    const counts = el("div", { class: "reline-counts", "aria-live": "polite" });
    function draw() {
      box.replaceChildren();
      let line = el("div", { class: "reline-line" });
      box.append(line);
      words.forEach((w, k) => {
        line.append(el("span", { class: "reline-word" }, w.text + (w.punct ? w.punct.replace("–", " –") : "")));
        if (k < words.length - 1) {
          const on = breaks.has(k);
          const gap = el("button", { type: "button", class: `gap${on ? " is-on" : ""}`, "aria-pressed": String(on), "aria-label": `Line break after ‘${w.text}’` }, on ? "↵" : "");
          gap.addEventListener("click", () => {
            if (breaks.has(k)) breaks.delete(k);
            else breaks.add(k);
            draw();
            box.querySelectorAll(".gap")[k]?.focus();
          });
          line.append(gap);
          if (on) {
            line = el("div", { class: "reline-line" });
            box.append(line);
          }
        }
      });
      // syllable counts per line made so far
      const segs = [];
      let cur = [];
      words.forEach((w, k) => {
        cur.push(w.text + (w.punct || ""));
        if (breaks.has(k) || k === words.length - 1) {
          segs.push(cur.join(" "));
          cur = [];
        }
      });
      counts.replaceChildren(el("p", { class: "small" }, "Syllables per line: ", segs.map((s) => scanner.scanLine(s, { short: true }).count).join(" · ")));
    }
    draw();
    const res = el("div", { "aria-live": "polite" });
    const check = el("button", { type: "button", class: "btn" }, "Check");
    check.addEventListener("click", () => {
      const right = [...breaks].filter((k) => realBreaks.has(k)).length;
      const extra = [...breaks].filter((k) => !realBreaks.has(k)).length;
      done();
      const perfect = right === realBreaks.size && !extra;
      res.replaceChildren(
        el("div", { class: `feedback ${perfect ? "feedback--good" : "feedback--bad"}` }, perfect ? "All four lines back where they belong." : `${right} of ${realBreaks.size} breaks right${extra ? `, and ${extra} extra` : ""}.`,
          el("p", {}, "Each line has about ten syllables and five beats. Once your ear expects that, you can hear where a line ends even without seeing it.")),
        el("div", { class: "example printed" }, lines.map((t) => el("div", {}, t))),
      );
    });
    const show = el("button", { type: "button", class: "btn btn--ghost" }, "Show me");
    show.addEventListener("click", () => {
      breaks.clear();
      realBreaks.forEach((k) => breaks.add(k));
      draw();
      done();
    });
    card.append(box, counts, el("p", { class: "cite" }, await citeFor(step.ref)), el("div", { class: "btn-row" }, check, show), res);
  },

  async vp(card, step, done) {
    card.append(...paras(step.body));
    const lines = await textOf(step.ref);
    const run = lines.join(" ").replace(/\[[^\]]*\]\s*/g, "").replace(/--/g, " – ").replace(/\s+/g, " ");
    card.append(el("div", { class: "example runon" }, run));
    const res = el("div", { "aria-live": "polite" });
    const group = el("div", { class: "choices choices--row", role: "group", "aria-label": "Verse or prose" });
    ["verse", "prose"].forEach((f) => {
      const b = el("button", { type: "button", class: "choice-btn" }, f === "verse" ? "Verse" : "Prose");
      b.addEventListener("click", async () => {
        const ok = f === step.form;
        b.classList.add(ok ? "is-right" : "is-wrong");
        done();
        const shown = el("div", { class: "example" });
        if (step.form === "verse") lines.forEach((t) => shown.append(el("div", { class: "verse" }, renderLine(scanner.scanLine(t)))));
        else shown.append(el("div", { class: "printed" }, lines.map((t) => el("div", {}, t.replace(/--/g, " – ")))));
        res.replaceChildren(el("div", { class: `feedback ${ok ? "feedback--good" : "feedback--bad"}` }, ok ? "Yes." : "Not this time.", el("p", {}, step.why)), el("p", { class: "small" }, "As printed:"), shown, el("p", { class: "cite" }, await citeFor(step.ref)));
      });
      group.append(b);
    });
    card.append(group, res);
  },

  async tap(card, step, done) {
    card.append(...paras(step.body));
    const pad = el("button", { type: "button", class: "tap-pad", "aria-label": "Tap on each DUM" }, "DUM");
    const start = el("button", { type: "button", class: "btn" }, "Start");
    const res = el("div", { "aria-live": "polite" });
    let times = [];
    let taps = [];
    let running = false;
    const hit = () => {
      if (!running) return;
      taps.push(performance.now());
      pad.classList.remove("is-hit");
      void pad.offsetWidth;
      pad.classList.add("is-hit");
    };
    pad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      hit();
    });
    pad.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        hit();
      }
    });
    const onKey = (e) => {
      if (running && e.key === " " && document.activeElement !== pad) {
        e.preventDefault();
        hit();
      }
    };
    document.addEventListener("keydown", onKey);
    start.addEventListener("click", () => {
      if (running) return;
      times = [];
      taps = [];
      running = true;
      start.disabled = true;
      res.replaceChildren(el("p", { class: "small" }, "Listen for two bars, then join in…"));
      pad.focus();
      // two feet to listen to, then ten to tap
      beat.pulse(12, {
        gap: 0.36,
        onStep: (k) => {
          if (k >= 4 && k % 2 === 1) times.push(performance.now());
          pad.classList.toggle("is-cue", k >= 0 && k % 2 === 1);
        },
        onEnd: () => {
          running = false;
          start.disabled = false;
          start.textContent = "Again";
          pad.classList.remove("is-cue");
          // score: each DUM matched to the nearest tap
          let good = 0;
          let close = 0;
          for (const t of times) {
            const d = Math.min(...taps.map((x) => Math.abs(x - t)), Infinity);
            if (d <= 130) good++;
            else if (d <= 230) close++;
          }
          done();
          res.replaceChildren(
            el("div", { class: `feedback ${good >= 7 ? "feedback--good" : "feedback--info"}` }, `${good} of ${times.length} on the beat${close ? `, ${close} close` : ""}.`,
              el("p", {}, good >= 7 ? "You've got the heartbeat." : "Keep going: try saying 'de-DUM' out loud as you tap.")),
          );
        },
      });
    });
    card.append(el("div", { class: "tap-wrap" }, pad), el("div", { class: "btn-row" }, start), res,
      el("p", { class: "small" }, "Rather not tap in time? Skip this step: nothing later depends on it."));
    // stop listening for space when the step changes
    const obs = new MutationObserver(() => {
      if (!document.body.contains(card)) {
        document.removeEventListener("keydown", onKey);
        obs.disconnect();
      }
    });
    obs.observe(root, { childList: true });
  },

  async takeaway(card, step) {
    card.append(el("ul", { class: "takeaways" }, step.points.map((p) => el("li", {}, rich(p)))));
    if (step.try && step.try.length) {
      card.append(el("h3", {}, "Try it on a speech"));
      card.append(el("div", { class: "btn-row" }, step.try.map((t) => el("a", { class: "btn btn--ghost btn--small", href: `room.html?lib=${t.lib}` }, t.label))));
    }
    const k = LESSONS.indexOf(current.lesson);
    const nextLesson = LESSONS[k + 1];
    card.append(
      el("div", { class: "btn-row", style: "margin-top:1.4rem" },
        nextLesson
          ? el("a", { class: "btn btn--red", href: `?l=${nextLesson.id}` }, `Next: ${nextLesson.title}`)
          : el("a", { class: "btn btn--red", href: "room.html" }, "Go to the rehearsal room"),
        el("a", { class: "btn btn--ghost", href: "learn.html" }, "All lessons"),
      ),
    );
    if (step.final) card.append(el("p", { class: "small", style: "margin-top:1rem" }, "That's the course. Keep your ear in with Today's line, or the games in Play."));
    announce("Lesson complete.");
  },
};

// ------------------------------------------------------------------ start

async function main() {
  [scanner, library] = await Promise.all([getScanner(), getLibrary()]);
  const route = () => {
    const id = new URLSearchParams(location.search).get("l");
    if (id) openLesson(id);
    else renderList();
  };
  window.addEventListener("popstate", route);
  route();
}

main().catch((e) => {
  console.error(e);
  root.replaceChildren(el("h1", {}, "Learn"), el("p", {}, "Sorry, the lessons didn't load. Try refreshing the page."));
});
