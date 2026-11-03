// Today's line: one line a day. Mark the beats, spot the twist, share.
import { getScanner } from "../data.js";
import { createMarker, explain } from "../marker.js";
import { el, renderLine, renderKey, beatWords, announce } from "../render.js";
import { titleCase } from "../notes.js";
import * as beat from "../beat.js";
import { load, save } from "../store.js";

const $ = (id) => document.getElementById(id);
const SHARE_URL = "https://peter-guillam123.github.io/dedumdedumdedum/today.html";
const STORE = "today:v1";

const TWISTS = {
  regular: "Nothing: it's regular all the way through",
  "starts-on-beat": "It starts on the beat, not after it",
  feminine: "There's an extra light syllable at the end",
  squeeze: "A word squeezes to fit the rhythm",
  stretch: "A word stretches to fit the rhythm",
  "sound-ed": "An -ed ending is sounded as a syllable",
  midstop: "A new sentence starts in the middle",
  opposites: "It turns on a pair of opposites",
  backwards: "The whole line runs DUM-de, back to front",
};
const ANSWER = {
  regular: "There's no twist: it's regular all the way through.",
  "starts-on-beat": "It starts on the beat.",
  feminine: "There's an extra light syllable at the end.",
  squeeze: "A word squeezes to fit.",
  stretch: "A word stretches to fit.",
  "sound-ed": "An -ed ending is sounded.",
  midstop: "A new sentence starts in the middle.",
  opposites: "It turns on a pair of opposites.",
  backwards: "The whole line runs back to front.",
};

// ------------------------------------------------------------------ dates (UK time)

function londonNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => +parts.find((p) => p.type === t).value;
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

function dayNumber(start) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const t = londonNow();
  return Math.round((Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(sy, sm - 1, sd)) / 864e5) + 1;
}

function dateOfDay(start, n) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const d = new Date(Date.UTC(sy, sm - 1, sd) + (n - 1) * 864e5);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}

function untilMidnight() {
  const t = londonNow();
  const left = 24 * 3600 - (t.h * 3600 + t.min * 60 + t.s);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  if (h === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"} and ${m} minute${m === 1 ? "" : "s"}`;
}

// ------------------------------------------------------------------ helpers

function seeded(str) {
  let a = 0;
  for (let i = 0; i < str.length; i++) a = (Math.imul(a, 31) + str.charCodeAt(i)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(xs, rnd) {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The right twist plus three that aren't in the line, in a fixed order per line.
function optionsFor(entry) {
  const rnd = seeded(entry.id);
  const wrong = shuffle(Object.keys(TWISTS).filter((k) => k !== entry.twist && !entry.also.includes(k)), rnd).slice(0, 3);
  return shuffle([entry.twist, ...wrong], rnd);
}

function scanFor(scanner, entry) {
  const forced = scanner.scanLine(entry.text, { force: entry.pattern });
  return forced.checked ? forced : scanner.scanLine(entry.text);
}

function roman(n) {
  return ["", "I", "II", "III", "IV", "V"][n] || String(n);
}

function whereFrom(entry) {
  return [el("b", {}, titleCase(entry.who)), " in ", el("i", {}, entry.title), `, Act ${roman(entry.a)} ${entry.s === 0 ? "Prologue" : `Scene ${entry.s}`}`];
}

function loadResults() {
  const r = load(STORE, null);
  return r && typeof r === "object" && r.days ? r : { days: {} };
}

function streakOf(results, today) {
  const days = results.days;
  let d = days[today] ? today : today - 1;
  let n = 0;
  while (days[d]) {
    n++;
    d--;
  }
  return n;
}

// ------------------------------------------------------------------ main

async function main() {
  const dailyURL = new URL("../../../data/daily.json", import.meta.url);
  const [scanner, daily] = await Promise.all([getScanner(), fetch(dailyURL).then((r) => r.json())]);
  const pool = daily.lines;
  const today = Math.max(1, dayNumber(daily.start));
  const asked = Number(new URLSearchParams(location.search).get("day"));
  const practice = Number.isInteger(asked) && asked >= 1 && asked < today;
  const n = practice ? asked : today;
  const entryOf = (k) => pool[(k - 1) % pool.length];
  const entry = entryOf(n);
  const scan = scanFor(scanner, entry);

  // header
  $("t-date").textContent = dateOfDay(daily.start, n);
  $("t-title").textContent = practice ? `Practice: No. ${n}` : `Today's line: No. ${n}`;
  if (practice) {
    $("t-lede").replaceChildren("A line from an earlier day. It won't count towards your streak. ", el("a", { href: "today.html" }, "Back to today's line"), ".");
  }
  document.title = `${practice ? "Practice" : "Today's line"}: No. ${n} · dedumdedumdedum`;
  $("t-who").replaceChildren(...whereFrom(entry));
  $("t-room").href = `room.html?p=${entry.play}&a=${entry.a}&s=${entry.s}&n=${entry.speech}`;

  const results = loadResults();
  const saved = practice ? null : results.days[n];
  const state = { check: null, answer: null };

  // step 1: marking
  const marker = createMarker(scan, { label: "Today's line" });
  $("t-line").replaceChildren(el("div", {}, marker.node));
  const checkBtn = $("t-check");

  function showCheck(r) {
    state.check = r;
    checkBtn.hidden = true;
    const good = r.right >= r.total - 1;
    const hear = el("button", { type: "button", class: "btn btn--ghost btn--small" }, "Hear the heartbeat");
    const reading = renderLine(scan, { label: "Our reading" });
    hear.addEventListener("click", () => {
      if (beat.isPlaying()) return beat.stop();
      const syls = reading.querySelectorAll(".syl");
      hear.textContent = "Stop";
      beat.play(beat.stepsFromScan(scan), {
        onStep: (k) => syls.forEach((s, j) => s.classList.toggle("is-now", j === k)),
        onEnd: () => {
          hear.textContent = "Hear the heartbeat";
          syls.forEach((s) => s.classList.remove("is-now"));
        },
      });
    });
    $("t-result").replaceChildren(
      el(
        "div",
        { class: `feedback ${good ? "feedback--good" : "feedback--bad"}` },
        r.perfect ? `Spot on: ${r.right} of ${r.total}.` : `${r.right} of ${r.total} syllables right.`,
        ...explain(r, scan).map((t) => el("p", {}, t)),
      ),
      el(
        "div",
        { class: "t-reading" },
        el("h3", {}, "Our reading"),
        el("p", { class: "small" }, `${scan.syllables.length} syllables: ${beatWords(scan)}`),
        renderKey(),
        el("div", { class: "verse" }, reading),
        el("div", { class: "btn-row" }, hear),
      ),
    );
    $("t-step2").hidden = false;
  }

  checkBtn.addEventListener("click", () => {
    if (!marker.marks.size) {
      $("t-result").replaceChildren(el("div", { class: "feedback feedback--info" }, "Tap the syllables you lean on first. Saying the line out loud helps."));
      announce("Tap the syllables you lean on first.");
      return;
    }
    const r = marker.check();
    showCheck(r);
    if (!practice) {
      results.days[n] = { marks: [...marker.marks], right: r.right, total: r.total, dots: dots(r), answer: null };
      save(STORE, results);
    }
    $("t-step2").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  // step 2: the twist
  const opts = optionsFor(entry);
  const optBox = $("t-options");
  const buttons = opts.map((k) => {
    const b = el("button", { type: "button", class: "t-option", dataset: { k } }, el("span", {}, TWISTS[k]), el("span", { class: "t-mark" }, ""));
    b.addEventListener("click", () => answer(k, true));
    return b;
  });
  optBox.replaceChildren(...buttons);

  function answer(k, fresh) {
    if (state.answer) return;
    state.answer = k;
    const right = k === entry.twist;
    buttons.forEach((b) => {
      b.disabled = true;
      const isRight = b.dataset.k === entry.twist;
      const chosen = b.dataset.k === k;
      if (isRight) {
        b.classList.add("is-right");
        b.querySelector(".t-mark").textContent = chosen ? "Your answer: right" : "The answer";
      } else if (chosen) {
        b.classList.add("is-wrong");
        b.querySelector(".t-mark").textContent = "Your answer";
      } else b.classList.add("is-dim");
    });
    $("t-answer").replaceChildren(
      el("div", { class: `feedback ${right ? "feedback--good" : "feedback--bad"}` }, `${right ? "Yes." : "Not this time."} ${ANSWER[entry.twist]}`, el("p", {}, entry.explain)),
    );
    if (fresh && !practice && results.days[n]) {
      results.days[n].answer = k;
      results.days[n].twist = right;
      save(STORE, results);
    }
    showFinal();
    if (fresh) $("t-step3").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // step 3: the result
  function dots(r) {
    return r.result.map((x) => (x.ok ? "●" : "○")).join("");
  }

  function shareText() {
    const r = state.check;
    const twist = state.answer === entry.twist ? "twist ✓" : "twist ✗";
    return `dedumdedumdedum ${practice ? "practice " : ""}No. ${n}\n${dots(r)} ${r.right}/${r.total} · ${twist}\n${SHARE_URL}`;
  }

  let ticker = null;
  function showFinal() {
    $("t-step3").hidden = false;
    $("t-step3-heading").textContent = practice ? "How you did" : "Your result";
    $("t-share-text").textContent = shareText();
    const stats = $("t-stats");
    stats.replaceChildren();
    if (!practice) {
      const all = Object.values(results.days);
      const played = all.length;
      const avg = played ? Math.round((100 * all.reduce((a, d) => a + d.right / d.total, 0)) / played) : 0;
      const twists = all.filter((d) => d.twist).length;
      const stat = (dt, dd) => el("div", {}, el("dt", {}, dt), el("dd", {}, dd));
      stats.append(stat("Streak", `${streakOf(results, today)} day${streakOf(results, today) === 1 ? "" : "s"}`), stat("Days played", String(played)), stat("Average", `${avg}%`), stat("Twists spotted", `${twists} of ${played}`));
    }
    const tick = () => ($("t-tomorrow").textContent = practice ? "" : `A new line in ${untilMidnight()}, at midnight UK time. Come back tomorrow.`);
    tick();
    clearInterval(ticker);
    if (!practice) ticker = setInterval(tick, 30000);
  }

  $("t-share").addEventListener("click", async () => {
    const text = shareText();
    const btn = $("t-share");
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
      announce("Result copied. Paste it wherever you like.");
      setTimeout(() => (btn.textContent = "Share"), 2500);
    } catch {
      // last resort: select the text so it can be copied by hand
      const range = document.createRange();
      range.selectNodeContents($("t-share-text"));
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      announce("Your result is selected. Copy it to share.");
    }
  });

  // restore a day already played
  if (saved && Array.isArray(saved.marks)) {
    saved.marks.forEach((si) => marker.buttons[si] && marker.buttons[si].click());
    const r = marker.check();
    showCheck(r);
    if (saved.answer) answer(saved.answer, false);
  }

  // yesterday, and earlier days
  if (n > 1) {
    const y = entryOf(n - 1);
    const yScan = scanFor(scanner, y);
    $("t-yesterday").replaceChildren(
      el(
        "details",
        {},
        el("summary", {}, `${practice ? "The day before" : "Yesterday's line"}: No. ${n - 1}`),
        el("p", { class: "t-who" }, ...whereFrom(y)),
        el("div", { class: "verse" }, renderLine(yScan, { label: "Yesterday's line" })),
        el("p", {}, el("b", {}, "The twist: "), ANSWER[y.twist]),
        el("p", {}, el("a", { href: `today.html?day=${n - 1}` }, "Have a go at it")),
      ),
    );
  }
  const practiceBox = $("t-practice");
  if (today > 1) {
    const sel = el("select", { id: "t-day" });
    for (let k = today - 1; k >= 1; k--) {
      sel.append(el("option", { value: String(k), selected: k === n && practice ? "" : null }, `No. ${k} · ${dateOfDay(daily.start, k)}`));
    }
    practiceBox.replaceChildren(
      el(
        "div",
        { class: "card" },
        el("h3", { style: "margin-top:0" }, "Try an earlier day"),
        el("p", { class: "small" }, "Practice lines don't count towards your streak."),
        el(
          "div",
          { class: "t-practice-row" },
          el("div", {}, el("label", { for: "t-day" }, "Day"), sel),
          el("button", { type: "button", class: "btn btn--ghost", onclick: () => (location.href = `today.html?day=${sel.value}`) }, "Play it"),
        ),
      ),
    );
  } else {
    practiceBox.replaceChildren(el("p", { class: "small" }, "This is the first line. Earlier days will appear here from tomorrow, for practice."));
  }
}

main().catch((e) => {
  console.error(e);
  $("t-line").textContent = "Sorry, today's line didn't load. Try refreshing the page.";
});
