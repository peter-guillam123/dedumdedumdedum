// Passage analysis: everything that needs more than one line to see.
// Verse or prose, shared lines, thoughts (sentences), opposites, thou and you,
// rhymes and sound patterns. Builds on scan.js. No DOM.

import { tokenize, OPPOSITES } from "./scan.js";

const THOU = new Set("thou thee thy thine thyself thou'rt thou'lt".split(" "));
const YOU = new Set("you your yours yourself yourselves ye you'll you're you'ld you'd".split(" "));

// Very common words only count as opposites within one line.
const COMMON = new Set("is be in out up down here there now then come go more less all much little old new".split(" "));
// Words not worth flagging as "X ... not X".
const NOT_NEG = new Set("i me my we us our you your he him his she her it they them their the a an and of to in on at by for with as that this is are was were have has had do did will would shall should can could may might must not no nor so but or if than then what who how which when where".split(" "));

const stem = (w) =>
  w.toLowerCase()
    .replace(/'s$/, "")
    .replace(/(?<=\w{3})(?:ing|ed|'d|es|s)$/, "")
    .replace(/(?<=\w{3})e$/, "");

const OPP = new Map();
for (const [a, b] of OPPOSITES) {
  const sa = stem(a), sb = stem(b);
  if (!OPP.has(sa)) OPP.set(sa, new Set());
  if (!OPP.has(sb)) OPP.set(sb, new Set());
  OPP.get(sa).add(sb);
  OPP.get(sb).add(sa);
}

// Read pasted text into speeches. Accepts plain lines, or play-script layout
// with speaker names on their own line ("HAMLET" or "Hamlet.") or before a
// colon ("HAMLET: To be...").
export function parsePasted(raw) {
  const speeches = [];
  let cur = null;
  const start = (who) => {
    cur = { who, form: null, lines: [] };
    speeches.push(cur);
  };
  const lines = String(raw).replace(/\r/g, "").split("\n");
  for (let line of lines) {
    const t = line.trim();
    if (!t) continue;
    // stage directions
    if (/^[[(].*[\])]$/.test(t) || /^(enter|exit|exeunt|re-enter|flourish|alarum)\b/i.test(t)) continue;
    // speaker on its own line
    if (/^[A-Z][A-Z .'-]{1,30}\.?$/.test(t) && !/[a-z]/.test(t) && t.split(/\s+/).length <= 4) {
      start(titleCase(t.replace(/\.$/, "")));
      continue;
    }
    const m = t.match(/^([A-Z][A-Za-z .'-]{1,28})[:.]\s+(.+)$/);
    if (m && m[1] === m[1].toUpperCase() && /[A-Z]{2}/.test(m[1])) {
      start(titleCase(m[1]));
      line = m[2];
    }
    if (!cur) start(null);
    const indent = /^\s{4,}/.test(line) ? 1 : 0;
    cur.lines.push({ n: cur.lines.length + 1, text: line.trim(), indent });
  }
  // number lines through the whole passage
  let n = 1;
  for (const s of speeches) for (const l of s.lines) l.n = n++;
  return speeches.filter((s) => s.lines.length);
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Decide whether a block of lines is verse or prose when the source didn't say.
export function judgeForm(scanner, lines) {
  const texts = lines.map((l) => l.text);
  if (!texts.length) return { form: "verse", why: [] };
  const why = [];
  const rest = texts.slice(1);
  const lower = rest.filter((t) => /^[a-z]/.test(t.trim())).length;
  const scans = texts.map((t) => scanner.scanLine(t, { short: false }));
  const counts = scans.map((s) => s.count || 0);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const fits = scans.filter((s) => s.count >= 9 && s.count <= 12 && s.cost <= 2.6).length;
  if (rest.length && lower / rest.length > 0.25) {
    why.push("lower-case");
    return { form: "prose", why, mean };
  }
  if (mean > 15) {
    why.push("long-lines");
    return { form: "prose", why, mean };
  }
  const shortish = counts.filter((c) => c >= 5 && c <= 8).length;
  if (counts.length >= 3 && shortish / counts.length >= 0.6) {
    why.push("short-lines");
    return { form: "verse", meter: "tetrameter", why, mean };
  }
  if (fits / texts.length >= 0.5 || (texts.length <= 2 && mean <= 12)) {
    why.push("ten-beats");
    return { form: "verse", why, mean };
  }
  why.push("irregular");
  return { form: mean > 12.5 ? "prose" : "verse", why, mean, unsure: true };
}

// speeches: [{who, form, lines:[{n, text, indent}]}]
export function analyse(scanner, speeches, opts = {}) {
  const out = { speeches: [], shared: [], thoughts: [], antitheses: [], address: [], switches: [], rhymes: [], sounds: [] };
  // 1. form and metre per speech, then scan. Short-line verse (the witches,
  // the fairies) is judged across the whole passage, since their speeches are short.
  const allCounts = [];
  for (const sp of speeches) {
    if (sp.form === "p") continue;
    for (const l of sp.lines) allCounts.push(scanner.scanLine(l.text).count || 0);
  }
  const passageTetra = allCounts.length >= 4 && allCounts.filter((c) => c >= 5 && c <= 8).length / allCounts.length >= 0.6;
  for (const sp of speeches) {
    let form = sp.form === "v" ? "verse" : sp.form === "p" ? "prose" : sp.form;
    let meter = "pentameter";
    let judged = null;
    if (!form) {
      judged = judgeForm(scanner, sp.lines);
      form = judged.form;
      if (judged.meter) meter = judged.meter;
    } else if (form === "verse" && sp.lines.length >= 3) {
      const counts = sp.lines.map((l) => scanner.scanLine(l.text).count || 0);
      const shortish = counts.filter((c) => c >= 5 && c <= 8).length;
      if (shortish / counts.length >= 0.6) meter = "tetrameter";
    }
    if (form === "verse" && passageTetra) {
      const counts = sp.lines.map((l) => scanner.scanLine(l.text).count || 0);
      if (counts.reduce((x, y) => x + y, 0) / counts.length <= 9) meter = "tetrameter";
    }
    const lines = sp.lines.map((l) => {
      const base = { n: l.n, text: l.text, indent: l.indent || 0 };
      if (form === "verse") base.scan = scanner.scanLine(l.text, { tetra: meter === "tetrameter" });
      else base.tokens = tokenize(l.text);
      return base;
    });
    out.speeches.push({ who: sp.who, form, meter, judged, lines });
  }
  // a flat list of lines with their speech, for the passes below
  const flat = [];
  out.speeches.forEach((sp, s) => sp.lines.forEach((ln, l) => flat.push({ s, l, sp, ln })));
  const wordsOf = (ln) => (ln.scan ? ln.scan.words.map((w) => ({ text: w.text, word: w.word, punct: w.punct })) : ln.tokens.filter((t) => t.word).map((t) => ({ text: t.text, word: t.word, punct: t.punct })));
  flat.forEach((f) => (f.words = wordsOf(f.ln)));

  // 2. shared lines: short last line of one speech + short first line(s) of the next
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i];
    if (!a.ln.scan || a.sp.form !== "verse" || a.sp.meter !== "pentameter") continue;
    if (a.l !== a.sp.lines.length - 1) continue;
    if (a.ln.scan.count > 8) continue;
    const group = [a];
    let total = a.ln.scan.count;
    let j = i + 1;
    while (j < flat.length && group.length < 4) {
      const b = flat[j];
      if (b.l !== 0 || !b.ln.scan || b.s === a.s) break;
      const c = b.ln.scan.count;
      if (c > 8 || total + c > 12) break;
      group.push(b);
      total += c;
      if (b.sp.lines.length > 1) break; // the next speech carries on; stop here
      j++;
    }
    const hinted = group.slice(1).some((g) => g.ln.indent);
    if (group.length > 1 && (total >= 9 || (hinted && total >= 7))) {
      // trim a trailing piece if the group overshoots and the shorter one fits
      out.shared.push(group.map((g) => ({ s: g.s, l: g.l })));
      const joined = group.map((g) => g.ln.text).join(" ");
      const scan = scanner.scanLine(joined, { short: false });
      // hand the joint scan back to each part, word by word
      let w0 = 0;
      group.forEach((g, k) => {
        const nw = g.ln.scan.words.length;
        const words = scan.words.slice(w0, w0 + nw);
        const sylIdx = words.flatMap((w) => w.syllables);
        g.ln.shared = {
          group: out.shared.length - 1, part: k, of: group.length, joined: scan,
          from: sylIdx.length ? sylIdx[0] : 0, to: sylIdx.length ? sylIdx[sylIdx.length - 1] + 1 : 0,
          wordFrom: w0, wordTo: w0 + nw,
          with: group.filter((_, q) => q !== k).map((x) => x.sp.who),
        };
        w0 += nw;
      });
      i = i + group.length - 1;
    }
  }
  // 3. thoughts: sentences across lines
  let cur = null;
  flat.forEach((f, idx) => {
    f.words.forEach((w, k) => {
      if (!cur || cur.s !== f.s) {
        if (cur) out.thoughts.push(cur);
        cur = { s: f.s, from: { i: idx, w: k }, to: null, words: [], question: false };
      }
      cur.words.push(w.text + (w.punct === "\u2013" ? " \u2013" : w.punct || ""));
      cur.to = { i: idx, w: k };
      if (/[.!?]/.test(w.punct)) {
        cur.question = w.punct.includes("?");
        out.thoughts.push(cur);
        cur = null;
      }
    });
  });
  if (cur) out.thoughts.push(cur);
  out.thoughts.forEach((t) => {
    t.text = t.words.join(" ").replace(/\s+([,;:.!?])/g, "$1");
    t.lines = [t.from.i, t.to.i];
    delete t.words;
  });

  // 4. opposites: within a line, or across the next two lines of the same speech
  const seenPairs = new Set();
  flat.forEach((f, i) => {
    for (let j = i; j < Math.min(flat.length, i + 3); j++) {
      const g = flat[j];
      if (g.s !== f.s) break;
      f.words.forEach((a, ka) => {
        g.words.forEach((b, kb) => {
          if (j === i && kb <= ka) return;
          const sa = stem(a.word), sb = stem(b.word);
          let kind = null;
          if (OPP.has(sa) && OPP.get(sa).has(sb)) {
            if (j !== i && (COMMON.has(a.word) || COMMON.has(b.word))) return;
            kind = "opposite";
          }
          // be / not be, kind / unkind
          else if (sa.length > 2 && (sb === "un" + sa || sa === "un" + sb || sb === "in" + sa || sa === "in" + sb)) kind = "opposite";
          else if (sa === sb && sa.length > 1 && !NOT_NEG.has(a.word)) {
            // "not to be": look up to two words back for the negative
            const neg = (ws, k) => ws.slice(Math.max(0, k - 2), k).some((x) => x.word === "not" || x.word === "no" || x.word === "nor");
            if (neg(g.words, kb) !== neg(f.words, ka)) kind = "negation";
          }
          if (!kind) return;
          const key = `${i}:${ka}-${j}:${kb}`;
          const pair = `${sa}|${sb}|${i}`;
          if (seenPairs.has(pair)) return;
          seenPairs.add(pair);
          seenPairs.add(key);
          out.antitheses.push({ kind, a: { i, w: ka, text: a.text }, b: { i: j, w: kb, text: b.text } });
        });
      });
    }
  });

  // 5. thou and you, by speaker
  const lastForm = {};
  flat.forEach((f, i) => {
    f.words.forEach((w, k) => {
      const form = THOU.has(w.word) ? "thou" : YOU.has(w.word) ? "you" : null;
      if (!form) return;
      const who = f.sp.who || "_";
      out.address.push({ i, w: k, form, who, text: w.text });
      if (lastForm[who] && lastForm[who].form !== form) {
        out.switches.push({ who: f.sp.who, from: lastForm[who].form, to: form, at: { i, w: k, text: w.text }, prev: lastForm[who] });
      }
      lastForm[who] = { form, i, w: k, text: w.text };
    });
  });

  // 5b. two speakers addressing each other differently: she says thou, he says you
  const firstForm = out.speeches.map((sp, s) => {
    const hit = out.address.find((ad) => flat[ad.i].s === s);
    return hit ? { ...hit, s } : null;
  });
  for (let s = 1; s < firstForm.length; s++) {
    const a = firstForm[s - 1], b = firstForm[s];
    if (a && b && a.who !== b.who && a.form !== b.form) {
      out.contrasts = out.contrasts || [];
      out.contrasts.push({ a, b });
    }
  }
  out.contrasts = out.contrasts || [];

  // 6. rhymes: consecutive verse lines (couplets), and alternate lines
  flat.forEach((f, i) => {
    if (f.sp.form !== "verse") return;
    const endA = lastWord(f.words);
    if (!endA) return;
    for (const gap of [1, 2]) {
      const g = flat[i + gap];
      if (!g || g.sp.form !== "verse") continue;
      const endB = lastWord(g.words);
      if (!endB || endA.word === endB.word) continue;
      const ra = scanner.rhymeOf(endA.word), rb = scanner.rhymeOf(endB.word);
      if (ra && rb && ra === rb && ra.length >= 2) {
        if (gap === 2) {
          const mid = flat[i + 1] && lastWord(flat[i + 1].words);
          if (mid && scanner.rhymeOf(mid.word) === ra) continue; // part of a triple; skip
        }
        out.rhymes.push({ a: i, b: i + gap, gap, words: [endA.text, endB.text] });
      }
    }
  });

  // couplets win over alternate rhymes that share a line with them
  const inCouplet = new Set(out.rhymes.filter((r) => r.gap === 1).flatMap((r) => [r.a, r.b]));
  out.rhymes = out.rhymes.filter((r) => r.gap === 1 || (!inCouplet.has(r.a) && !inCouplet.has(r.b)));

  // 7. sound patterns: three or more beats in a line that start with the same sound
  flat.forEach((f, i) => {
    if (!f.ln.scan) return;
    const sc = f.ln.scan;
    const groups = {};
    sc.words.forEach((w, k) => {
      const first = w.syllables[0];
      if (first === undefined) return;
      const stressed = w.syllables.some((si) => sc.syllables[si].beat && "PCSM".includes(sc.syllables[si].cls));
      if (!stressed) return;
      const snd = initialSound(w.word);
      if (!snd) return;
      (groups[snd] = groups[snd] || []).push(k);
    });
    for (const [snd, ks] of Object.entries(groups)) {
      if (ks.length >= 3) out.sounds.push({ i, sound: snd, words: ks.map((k) => sc.words[k].text) });
    }
  });

  out.flat = flat.map((f) => ({ s: f.s, l: f.l }));
  out.summary = summarise(out);
  return out;
}

function lastWord(words) {
  for (let k = words.length - 1; k >= 0; k--) if (words[k].word) return words[k];
  return null;
}

function initialSound(w) {
  const x = w.toLowerCase().replace(/^'/, "");
  if (/^[aeiouy]/.test(x) || /^h[aeiou]/.test(x) && /^(hour|honou?r|heir|honest)/.test(x)) return null;
  const rules = [
    [/^kn/, "n"], [/^wr/, "r"], [/^gn/, "n"], [/^ps/, "s"], [/^wh/, "w"], [/^ph/, "f"],
    [/^ch/, "ch"], [/^sh/, "sh"], [/^th/, "th"], [/^c[eiy]/, "s"], [/^c/, "k"], [/^q/, "k"],
    [/^x/, "z"], [/^g[eiy]/, null], [/^s[ck]/, "sk"], [/^st/, "st"], [/^sp/, "sp"],
  ];
  for (const [re, snd] of rules) if (re.test(x)) return snd;
  return x[0];
}

function summarise(a) {
  const verse = a.speeches.filter((s) => s.form === "verse");
  const prose = a.speeches.filter((s) => s.form === "prose");
  const lines = verse.flatMap((s) => s.lines);
  const kinds = {};
  for (const l of lines) if (l.scan) kinds[l.scan.kind] = (kinds[l.scan.kind] || 0) + 1;
  return {
    form: verse.length && prose.length ? "mixed" : verse.length ? "verse" : "prose",
    meter: verse.some((s) => s.meter === "tetrameter") ? "tetrameter" : "pentameter",
    lines: a.speeches.reduce((n, s) => n + s.lines.length, 0),
    verseLines: lines.length,
    kinds,
    thoughts: a.thoughts.length,
    questions: a.thoughts.filter((t) => t.question).length,
  };
}
