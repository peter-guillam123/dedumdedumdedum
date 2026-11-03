// Loading the data files, with small caches (phones have little memory).
import { createScanner } from "./scan.js";

const base = new URL("../../data/", import.meta.url);
let scannerP = null;
let playsP = null;
let indexP = null;
let libraryP = null;
const playCache = new Map(); // id -> promise, at most 4 kept

async function json(path) {
  const r = await fetch(new URL(path, base));
  if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`);
  return r.json();
}

export function getScanner() {
  if (!scannerP) scannerP = json("dict.json").then(createScanner);
  return scannerP;
}

export function getPlays() {
  if (!playsP) playsP = json("plays.json");
  return playsP;
}

export function getSpeechIndex() {
  if (!indexP) indexP = json("speeches.json");
  return indexP;
}

export function getLibrary() {
  if (!libraryP) libraryP = json("library.json");
  return libraryP;
}

export function getPlay(id) {
  if (playCache.has(id)) {
    const p = playCache.get(id);
    playCache.delete(id);
    playCache.set(id, p);
    return p;
  }
  const p = json(`plays/${id}.json`);
  playCache.set(id, p);
  while (playCache.size > 4) playCache.delete(playCache.keys().next().value);
  p.catch(() => playCache.delete(id));
  return p;
}

// A passage of a scene, from line `from` to line `to`, as speeches with
// stage directions kept in between: [{who, form, lines:[{n,text,indent}]}|{sd}]
export async function getPassage(id, act, scene, from, to) {
  const play = await getPlay(id);
  const sc = play.scenes.find((s) => s.a === act && s.s === scene);
  if (!sc) throw new Error("No such scene");
  const out = [];
  let started = false;
  for (const it of sc.items) {
    if (typeof it === "string") {
      if (started && out.length) out.push({ sd: it });
      continue;
    }
    const lines = it.l.filter(([n]) => n >= from && n <= to).map(([n, text, indent]) => ({ n, text, indent: indent || 0 }));
    if (!lines.length) {
      if (it.l[0] && it.l[0][0] > to) break;
      continue;
    }
    started = true;
    out.push({ who: it.w, form: it.f, lines, cont: !!it.c });
  }
  // trailing stage directions aren't useful
  while (out.length && out[out.length - 1].sd) out.pop();
  return { play, scene: sc, items: out };
}

// The whole speech that starts at line n (for "load this speech").
export async function getSpeech(id, act, scene, n) {
  const play = await getPlay(id);
  const sc = play.scenes.find((s) => s.a === act && s.s === scene);
  const sp = sc && sc.items.find((it) => typeof it !== "string" && it.l[0][0] === n);
  if (!sp) throw new Error("No such speech");
  return { play, scene: sc, items: [{ who: sp.w, form: sp.f, lines: sp.l.map(([n, text, indent]) => ({ n, text, indent: indent || 0 })) }] };
}

// The whole speech that contains line n.
export async function getSpeechAround(id, act, scene, n) {
  const play = await getPlay(id);
  const sc = play.scenes.find((s) => s.a === act && s.s === scene);
  const sp = sc && sc.items.find((it) => typeof it !== "string" && it.l.some(([m]) => m === n));
  if (!sp) throw new Error("No such speech");
  return getPassage(id, act, scene, sp.l[0][0], sp.l[sp.l.length - 1][0]);
}

export function citation(play, scene, from, to) {
  const roman = (n) => ["", "I", "II", "III", "IV", "V"][n] || String(n);
  return `${play.title}, Act ${roman(scene.a)} ${scene.s === 0 ? "Prologue" : `Scene ${scene.s}`}${from ? `, lines ${from}${to && to !== from ? "–" + to : ""}` : ""}`;
}
