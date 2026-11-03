// Run with: node --test tests/
// Locks in readings of famous lines that any verse teacher would agree on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScanner, splitSyllables, tokenize } from "../assets/js/scan.js";
import { analyse, parsePasted, judgeForm } from "../assets/js/passage.js";

const sc = createScanner(JSON.parse(readFileSync(new URL("../data/dict.json", import.meta.url))));
// beats as a string of / and x, one per syllable
const beats = (t, o) => sc.scanLine(t, o).syllables.map((s) => (s.beat ? "/" : "x")).join("");
const has = (t, type) => sc.scanLine(t).features.some((f) => f.type === type);

test("regular lines", () => {
  assert.equal(beats("But soft, what light through yonder window breaks?"), "x/x/x/x/x/");
  assert.equal(beats("It is the east, and Juliet is the sun."), "x/x/x/x/x/");
  assert.equal(beats("If music be the food of love, play on;"), "x/x/x/x/x/");
  assert.equal(beats("Shall I compare thee to a summer's day?"), "x/x/x/x/x/");
});

test("feminine endings", () => {
  assert.equal(beats("To be, or not to be, that is the question:"), "x/x/x/x/x/x");
  assert.equal(beats("I come to bury Caesar, not to praise him."), "x/x/x/x/x/x");
  assert.ok(has("Be not afeard; the isle is full of noises,", "feminine"));
});

test("inverted first foot", () => {
  assert.equal(beats("Now is the winter of our discontent"), "/xx/x/x/x/");
  assert.ok(sc.scanLine("Now is the winter of our discontent").features.some((f) => f.type === "inversion" && f.first));
  assert.equal(beats("Gallop apace, you fiery-footed steeds,"), "/xx/x/x/x/");
});

test("trochaic lines", () => {
  assert.ok(has("Never, never, never, never, never!", "trochaic"));
  const witches = analyse(sc, [{ who: "Witch", form: "v", lines: [
    { n: 1, text: "Eye of newt and toe of frog," }, { n: 2, text: "Wool of bat and tongue of dog," },
    { n: 3, text: "Adder's fork and blind-worm's sting," }, { n: 4, text: "Lizard's leg and owlet's wing," } ] }]);
  assert.equal(witches.speeches[0].meter, "tetrameter");
  assert.equal(witches.speeches[0].lines[0].scan.syllables.map((s) => (s.beat ? "/" : "x")).join(""), "/x/x/x/");
});

test("squeezes and stretches", () => {
  const l = sc.scanLine("The brightest heaven of invention,");
  assert.equal(l.count, 10);
  assert.ok(l.features.some((f) => f.type === "stretch"));
  const m = sc.scanLine("The oppressor's wrong, the proud man's contumely,");
  assert.ok(m.features.some((f) => f.type === "elide"));
  assert.equal(sc.scanLine("O'er the smooth enamell'd green").count, 7);
});

test("short and shared lines", () => {
  const a = analyse(sc, [
    { who: "LADY MACBETH", form: "v", lines: [{ n: 19, text: "I heard the owl scream and the crickets cry." }, { n: 20, text: "Did not you speak?" }] },
    { who: "MACBETH", form: "v", lines: [{ n: 21, text: "When?" }] },
    { who: "LADY MACBETH", form: "v", lines: [{ n: 22, text: "Now." }] },
    { who: "MACBETH", form: "v", lines: [{ n: 23, text: "As I descended?" }] },
  ]);
  assert.equal(a.shared.length, 1);
  assert.equal(a.shared[0].length, 4);
});

test("verse or prose from pasted text", () => {
  const prose = parsePasted(`What a piece of work is a man! how noble in reason!
how infinite in faculty! in form and moving how
express and admirable! in action how like an angel!`);
  assert.equal(judgeForm(sc, prose[0].lines).form, "prose");
  const verse = parsePasted(`Friends, Romans, countrymen, lend me your ears;
I come to bury Caesar, not to praise him.
The evil that men do lives after them;
The good is oft interred with their bones;`);
  assert.equal(judgeForm(sc, verse[0].lines).form, "verse");
});

test("pasted play-script layout", () => {
  const s = parsePasted(`QUEEN GERTRUDE
Hamlet, thou hast thy father much offended.

HAMLET
Mother, you have my father much offended.`);
  assert.equal(s.length, 2);
  assert.equal(s[1].who, "Hamlet");
  const a = analyse(sc, s);
  assert.equal(a.contrasts.length, 1);
});

test("opposites and rhymes", () => {
  const a = analyse(sc, [{ who: "Viola", form: "v", lines: [
    { n: 1, text: "O time! thou must untangle this, not I;" }, { n: 2, text: "It is too hard a knot for me to untie!" }] }]);
  assert.equal(a.rhymes.length, 1);
  const b = analyse(sc, [{ who: "Witches", form: "v", lines: [{ n: 1, text: "Fair is foul, and foul is fair:" }] }]);
  assert.ok(b.antitheses.length >= 1);
  const c = analyse(sc, [{ who: "Hamlet", form: "v", lines: [{ n: 1, text: "To be, or not to be, that is the question:" }] }]);
  assert.ok(c.antitheses.some((x) => x.kind === "negation"));
});

test("syllable splitting for display", () => {
  assert.deepEqual(splitSyllables("winter", 2), ["win", "ter"]);
  assert.deepEqual(splitSyllables("discontent", 3), ["dis", "con", "tent"]);
  assert.deepEqual(splitSyllables("brightest", 2), ["bright", "est"]);
  assert.deepEqual(splitSyllables("players", 2), ["play", "ers"]);
  assert.equal(splitSyllables("consummation", 4).join(""), "consummation");
});

test("tokens keep contractions and drop stage directions", () => {
  const t = tokenize("'Tis nobler [Aside] i' the mind--to suffer").map((x) => x.word);
  assert.deepEqual(t, ["'tis", "nobler", "i'", "the", "mind", "to", "suffer"]);
});
