// Checks the lessons against the texts: answers that depend on the scanner
// or on the words of a passage must still hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScanner, tokenize } from "../assets/js/scan.js";
import { LESSONS } from "../assets/js/lessons.js";

const sc = createScanner(JSON.parse(readFileSync(new URL("../data/dict.json", import.meta.url))));
const library = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url)));
const lines = (ref) => {
  const play = JSON.parse(readFileSync(new URL(`../data/plays/${ref.play}.json`, import.meta.url)));
  const scene = play.scenes.find((s) => s.a === ref.a && s.s === ref.s);
  const out = [];
  for (const it of scene.items) if (typeof it !== "string") for (const [n, t] of it.l) if (n >= ref.from && n <= ref.to) out.push(t);
  return out;
};

for (const lesson of LESSONS) {
  test(`lesson: ${lesson.title}`, () => {
    for (const step of lesson.steps) {
      if (step.ref) assert.ok(lines(step.ref).length, `${step.title}: no text at ${JSON.stringify(step.ref)}`);
      if (step.type === "count") assert.equal(sc.scanLine(lines(step.ref)[0]).count, step.answer, step.title);
      if (step.force) assert.equal(sc.scanLine(lines(step.ref)[0]).syllables.length === step.force.length || sc.scanLine(lines(step.ref)[0], { force: step.force }).checked, true, step.title);
      if (step.type === "spot") {
        const words = lines(step.ref).flatMap((t) => tokenize(t).filter((x) => x.word).map((x) => x.word.replace(/^'|'$/g, "")));
        for (const a of step.answers) assert.ok(words.includes(a), `${step.title}: '${a}' not in passage`);
      }
      if (step.type === "choice") assert.ok(step.options.some((o) => o.ok), `${step.title}: no right answer`);
      for (const t of step.try || []) assert.ok(library.some((e) => e.id === t.lib), `unknown library id ${t.lib}`);
    }
  });
}
