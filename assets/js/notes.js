// Turns what the scanner found into notes an actor can use.
// Every note says what's there, why it might matter, and offers choices.
// Never one right answer. No DOM.

const q = (s) => `‘${s}’`;
const clean = (s) => String(s).replace(/^'|'$/g, "").replace(/[^\w'À-ſ-]/g, "");

// Syllables of a word with the beat shown in capitals: DIS-con-TENT
export function stressWord(scan, k, beats) {
  const w = scan.words[k];
  return w.syllables
    .map((si) => {
      const s = scan.syllables[si];
      const on = beats ? s.beat : "PCS".includes(s.cls);
      return on ? s.text.toUpperCase() : s.text.toLowerCase();
    })
    .join("-");
}

function sylText(scan, i) {
  const s = scan.syllables[i];
  const w = scan.words[s.word];
  return w.syllables.length === 1 ? w.text : s.text;
}

export const LESSONS = {
  heartbeat: { n: 1, title: "The heartbeat" },
  ten: { n: 2, title: "Ten syllables, five beats" },
  "verse-prose": { n: 3, title: "Verse or prose?" },
  "line-end": { n: 4, title: "The end of the line" },
  breaks: { n: 5, title: "When the rhythm breaks" },
  squeeze: { n: 6, title: "Squeeze and stretch" },
  opposites: { n: 7, title: "Opposites" },
  "thou-you": { n: 8, title: "Thou and you" },
  together: { n: 9, title: "Putting it together" },
};

// One line's notes, most useful first.
// a: result of analyse(); i: index into a.flat
export function lineNotes(a, i) {
  const { s, l } = a.flat[i];
  const sp = a.speeches[s];
  const ln = sp.lines[l];
  const notes = [];
  const add = (n) => notes.push(n);

  if (sp.form === "prose") {
    if (l === 0) {
      add({
        key: "prose", label: "Prose", lesson: "verse-prose", rank: 1,
        text: "This speech is prose. The line breaks on the page are the printer's, not Shakespeare's, so ignore them: think in sentences. Prose isn't a lesser mode. It's often quicker, wittier, more private or more broken than verse.",
        choices: [
          "Read it through once only stopping at full stops. Where does each sentence go?",
          "Ask why this character is in prose here. Who are they talking to? What has changed?",
        ],
      });
    }
  }

  // a piece of a shared line is judged as part of the whole line, not alone
  const scan = ln.shared ? null : ln.scan;
  if (ln.shared) {
    const others = [...new Set(ln.shared.with.filter((w) => w && w !== sp.who))];
    const names = others.length ? others.map(titleCase).join(" and ") : "another speaker";
    add({
      key: "shared", label: "Shared line", lesson: "breaks", rank: 1,
      text: `This line is split with ${names}: together the pieces make one line of verse. So the verse leaves no room for a gap. The cue is picked up at once.`,
      choices: [
        "Come in right on the cue, almost on top of the other actor.",
        "If you do leave a gap, know you're breaking the rhythm, and make the silence mean something.",
      ],
    });
  }
  if (scan) {
    const f = (type) => scan.features.filter((x) => x.type === type);
    const shared = ln.shared;

    if (scan.kind === "short") {
      const beats = scan.syllables.filter((x) => x.beat).length;
      const missing = Math.max(1, 5 - beats);
      add({
        key: "short", label: "Short line", lesson: "breaks", rank: 1,
        text: `Only ${beats} beat${beats === 1 ? "" : "s"} here, where you'd expect five. That leaves about ${missing} beat${missing === 1 ? "" : "s"} of silence. Shakespeare is giving you time: for a look, a move, a reaction, a thought you don't say.`,
        choices: [
          "Take the silence before the line: something stops you.",
          "Take it after: let the line land, and wait.",
          "Fill it with an action the text implies.",
        ],
      });
    }

    for (const x of f("trochaic")) {
      add({
        key: "trochaic", label: "Back to front", lesson: "breaks", rank: 1,
        text: "The whole line runs DUM-de, DUM-de: the pattern turned upside down. Every beat comes first. Lines like this hammer.",
        choices: [
          "Give every beat full weight, and let each one land harder.",
          "Or let each one get quieter, as if the words are running out.",
        ],
      });
    }

    for (const x of f("inversion")) {
      const sy = scan.syllables[x.at];
      const word = scan.words[sy.word].text;
      if (x.first) {
        add({
          key: "inversion", label: "Starts on the beat", lesson: "breaks", rank: 2,
          text: `The line opens DUM-de instead of de-DUM: ${q(clean(word))} lands on the beat straight away. It's the most common twist in Shakespeare's verse, and it gives the start of a line a kick.`,
          choices: [
            `Come in on ${q(clean(word))} with no run-up: full energy from the first word.`,
            "Use it as a jolt: something has just struck you.",
          ],
        });
      } else {
        const afterPause = sy.word > 0 && /[.,;:!?–]/.test(scan.words[sy.word - 1].punct);
        add({
          key: "inversion", label: afterPause ? "Turns after the pause" : "Stumble in the rhythm", lesson: "breaks", rank: 2,
          text: afterPause
            ? `After the pause the rhythm flips: ${q(clean(word))} arrives on the beat, DUM-de. It often marks a new impulse.`
            : `The rhythm turns over mid-line: ${q(clean(word))} wants the stress where the pattern expects a light syllable. Something is pushing against the line.`,
          choices: afterPause
            ? [`Take the pause, then hit ${q(clean(word))} as a fresh thought.`, `Or don't pause: let ${q(clean(word))} burst out of what came before.`]
            : ["Let the stumble show: it's often a sign of strain or feeling.", "Or smooth it, and let the sense lead."],
        });
      }
    }

    if (scan.kind === "feminine" || scan.kind === "double") {
      const last = scan.syllables[scan.syllables.length - 1];
      const lw = scan.words[last.word];
      const what = lw.syllables.length > 1 ? `the end of ${q(clean(lw.text))}` : q(clean(lw.text));
      add({
        key: "feminine", label: "Extra syllable at the end", lesson: "breaks", rank: 2,
        text: `After the fifth beat comes one more light syllable: ${what}. An ending like this can leave the line open, unresolved, still thinking.`,
        choices: [
          "Let it fall away: the thought isn't finished.",
          "Lift it slightly, as if the next line is already on its way.",
        ],
      });
    }

    if (scan.kind === "alexandrine") {
      add({
        key: "alexandrine", label: "Six beats", lesson: "squeeze", rank: 2,
        text: "Six beats instead of five. The line runs long: it can feel stately, or as if the feeling won't fit the pattern.",
        choices: ["Keep it on one breath and let it overflow.", "Look for a squeeze: two syllables that run together may make it a five-beat line."],
      });
    }
    if (scan.kind === "tetrameter" && sp.meter === "pentameter") {
      add({
        key: "four", label: "Four beats", lesson: "squeeze", rank: 2,
        text: "This line only finds four beats. Either a word needs stretching, or there's a gap here for a pause.",
        choices: ["Try a pause where the missing beat would be.", "Try sounding a syllable you'd normally swallow."],
      });
    }
    if (sp.meter === "tetrameter" && l === 0) {
      add({
        key: "tetra", label: "Four-beat lines", lesson: "breaks", rank: 1,
        text: "These lines have four beats, not five, and most start on the beat: DUM-de DUM-de DUM-de DUM. Shakespeare gives this chanting rhythm to witches, fairies, spells and songs. It isn't how people talk, and that's the point.",
        choices: ["Lean into the chant: it's a spell.", "Or speak it plainly and let the rhythm do the strangeness for you."],
      });
    }
    if (scan.kind === "rough") {
      add({
        key: "rough", label: "Rough line", lesson: "breaks", rank: 2,
        text: scan.checked
          ? "This line doesn't sit in the pattern, and that's the point. Rough lines often come at moments of strain. Don't smooth it."
          : "This line doesn't sit easily in the pattern, and our reading is a guess. Say it aloud and tap the syllables to fix our marks. Rough lines often come at moments of strain, so don't rush to smooth it.",
        choices: [],
      });
    }
    for (const x of f("headless")) {
      add({
        key: "headless", label: "No upbeat", lesson: "breaks", rank: 3,
        text: "The line starts straight on a beat, with no light syllable before it. It arrives abruptly.",
        choices: ["Come in hard on the first word."],
      });
    }

    for (const x of f("extra")) {
      const sy = scan.syllables[x.at];
      const word = scan.words[sy.word].text;
      add({
        key: "extra", label: "An extra syllable", lesson: "squeeze", rank: 3,
        text: `There's one more light syllable than the pattern expects, around ${q(clean(word))}. Let it slip by quickly. Don't give it weight.`,
        choices: ["Say it fast and light.", "Or run two syllables together, as Shakespeare's actors would have done."],
      });
    }

    for (const x of f("squeeze")) {
      const w = scan.words[x.word];
      add({
        key: "squeeze", label: "Squeeze", lesson: "squeeze", rank: 3,
        text: x.shown && !/one beat|two beats/.test(x.shown)
          ? `Say ${q(clean(w.text))} as ${q(x.shown)} to keep the rhythm: ${w.syllables.length} syllable${w.syllables.length === 1 ? "" : "s"}, not ${w.syllables.length + 1}.`
          : `Run ${q(clean(w.text))} together a little: ${w.syllables.length} syllable${w.syllables.length === 1 ? "" : "s"}, not ${w.syllables.length + 1}.`,
        choices: [],
      });
    }
    for (const x of f("elide")) {
      const w = scan.words[x.word];
      const next = scan.words[x.word + 1];
      add({
        key: "elide", label: "Run together", lesson: "squeeze", rank: 3,
        text: next
          ? `${q(clean(w.text) + " " + clean(next.text))} runs together as ${q(x.shown + clean(next.text))}, which saves a syllable.`
          : `${q(clean(w.text))} runs into the next word.`,
        choices: [],
      });
    }
    for (const x of f("sound-ed")) {
      const w = scan.words[x.word];
      add({
        key: "sound-ed", label: "Sound the -ed", lesson: "squeeze", rank: 2,
        text: `Say ${q(clean(w.text))} with the ending sounded: ${q(x.shown)}, ${w.syllables.length} syllables. The extra syllable fills out the line. Many editions mark it with an accent.`,
        choices: [],
      });
    }
    for (const x of f("stretch")) {
      add({
        key: "stretch", label: "Stretch", lesson: "squeeze", rank: 2,
        text: `${q(clean(scan.words[x.word].text))} stretches by a syllable here: ${stressWord(scan, x.word, true)}. Elizabethan speakers often sounded endings like -tion and -ious in full. Give the ending its time.`,
        choices: [],
      });
    }
    for (const x of f("shift")) {
      add({
        key: "shift", label: "Different stress", lesson: "squeeze", rank: 3,
        text: `The rhythm wants ${stressWord(scan, x.word, true)}, not the stress we'd use today. Some words were said differently then, and Shakespeare shifted others to suit the line.`,
        choices: ["Try it his way and see if it sounds natural in context.", "If it sounds wrong to you, keep the modern stress and let the rhythm bend."],
      });
    }

    const lights = f("light").filter((x) => !shared);
    if (lights.length) {
      const words = lights.map((x) => q(sylText(scan, x.at)));
      add({
        key: "light", label: lights.length === 1 ? "Light beat" : "Light beats", lesson: "ten", rank: 4,
        text: `The pattern puts a beat on ${list(words)}, ${lights.length === 1 ? "a small syllable" : "small syllables"} you wouldn't normally stress. Not every beat is equal. Don't punch ${lights.length === 1 ? "it" : "them"}: the line moves faster here, on to the next real stress.`,
        choices: lights.length === 1
          ? ["Keep it light.", `Or give ${words[0]} a touch of weight if the meaning wants a contrast.`]
          : ["Keep them light and let the line run on."],
      });
    }
    const heavies = f("heavy");
    if (heavies.length) {
      const words = heavies.map((x) => q(sylText(scan, x.at)));
      add({
        key: "heavy", label: "Weight off the beat", lesson: "ten", rank: 4,
        text: `${capital(list(words))} ${heavies.length === 1 ? "is a strong word" : "are strong words"} sitting off the beat, next to a stressed one. Two heavy syllables side by side slow a line down.`,
        choices: ["Give both their weight and let the line slow."],
      });
    }

    for (const x of f("midstop")) {
      const w = scan.words[x.word];
      if (x.strong) {
        add({
          key: "midstop", label: "New thought mid-line", lesson: "line-end", rank: 2,
          text: `A sentence ends after ${q(clean(w.text))} and a new one starts in the same line. The verse doesn't leave room for a long gap: the new thought arrives quickly, as if it's only just occurred to you.`,
          choices: ["Pick up the new thought straight away.", "Take a short beat, knowing the line doesn't give you much time."],
        });
      } else {
        add({
          key: "hinge", label: "Pause inside the line", lesson: "line-end", rank: 5,
          text: `The line turns after ${q(clean(w.text))}. Use the pause as a hinge between the two halves.`,
          choices: [],
        });
      }
    }
    for (const x of f("runon")) {
      if (shared) continue;
      const w = scan.words[x.word];
      add({
        key: "runon", label: "Runs on", lesson: "line-end", rank: 4,
        text: `No punctuation at the end: the sense carries on into the next line. Don't stop or breathe here. But don't throw ${q(clean(w.text))} away either: a tiny lift on the last word keeps the shape of the verse without breaking the thought.`,
        choices: ["Carry on through, with a lift on the last word.", "Try a tiny suspension, not a pause, and see what it gives you."],
      });
    }
    for (const x of f("monosyllables")) {
      add({
        key: "mono", label: "All one-syllable words", lesson: "ten", rank: 3,
        text: "Every word in this line is one syllable. Lines like this tend to go slowly, each word placed with care.",
        choices: ["Don't rush. Give each word its own moment."],
      });
    }
    for (const x of f("repeat")) {
      add({
        key: "repeat", label: "Repetition", lesson: "together", rank: 3,
        text: `${q(x.word)} comes more than once. Each time should do something new: build, sink, mock, plead.`,
        choices: ["Make each one bigger than the last.", "Or make each one smaller, as if it's draining away."],
      });
    }
  }

  // passage-level things that touch this line
  for (const x of a.antitheses) {
    if (x.a.i !== i && x.b.i !== i) continue;
    if (x.b.i === i && x.a.i !== i) continue; // note it once, on the first line
    add({
      key: "opposites", label: "Opposites", lesson: "opposites", rank: 2,
      text: x.kind === "negation"
        ? `${q(clean(x.a.text))} and ${q("not " + clean(x.b.text))}: the line argues with itself. Point the contrast so we hear both sides.`
        : `${q(clean(x.a.text))} and ${q(clean(x.b.text))} pull against each other. Point the contrast: let us hear both sides. This is how Shakespeare's characters think, in opposites.`,
      choices: ["Lift the second word of the pair a little more than the first.", "Let the contrast carry the argument rather than the volume."],
    });
  }
  for (const x of a.rhymes) {
    if (x.a !== i) continue;
    add({
      key: "rhyme", label: x.gap === 1 ? "Rhyming couplet" : "Rhyme", lesson: "together", rank: 2,
      text: x.gap === 1
        ? `${q(clean(x.words[0]))} rhymes with ${q(clean(x.words[1]))}. A couplet often rounds off a scene, a speech or a thought. It can sound wise, final, or a little too neat.`
        : `${q(clean(x.words[0]))} rhymes with ${q(clean(x.words[1]))}, two lines down. Rhyme in Shakespeare is a choice he made, so it's worth asking why.`,
      choices: x.gap === 1 ? ["Land it: let the rhyme close the thought.", "Undercut it: as if the character knows it's too neat."] : [],
    });
  }
  for (const x of a.switches) {
    if (x.at.i !== i) continue;
    const who = x.who ? titleCase(x.who) : "The speaker";
    add({
      key: "switch", label: `${capital(x.from)} to ${x.to}`, lesson: "thou-you", rank: 1,
      text: `${who} switches from ${q(x.prev.text.toLowerCase())} to ${q(x.at.text.toLowerCase())}. ${x.to === "thou" ? "Thou is closer: tenderness, intimacy, or contempt." : "You is cooler: formal, distant, or polite."} A switch marks a change in the relationship, even if only for a moment. (It can also mean they've turned to address someone else.)`,
      choices: x.to === "thou" ? ["Play it as a step closer.", "Or as a put-down."] : ["Play it as a step back.", "Or as a mask going on."],
    });
  }
  for (const x of a.contrasts || []) {
    if (x.b.i !== i) continue;
    add({
      key: "contrast", label: "Thou meets you", lesson: "thou-you", rank: 1,
      text: `${titleCase(x.a.who)} says ${q(x.a.text.toLowerCase())}; ${titleCase(x.b.who)} answers with ${q(x.b.text.toLowerCase())}. They're not on the same terms. One reaches in, the other keeps their distance (or the other way round).`,
      choices: ["Play the gap between them."],
    });
  }
  for (const x of a.sounds) {
    if (x.i !== i) continue;
    add({
      key: "sound", label: "Sound pattern", lesson: "together", rank: 4,
      text: `Hear the run of ${q(x.sound)} sounds: ${list(x.words.map((w) => clean(w)))}. Enjoy them. The sounds are doing some of the work.`,
      choices: [],
    });
  }
  for (const n of notes) n.short = n.short || shortFor(n, scan);
  return notes.sort((x, y) => x.rank - y.rank);
}

// One-line versions, for when a note has already been explained above.
function shortFor(n, scan) {
  const quoted = (n.text.match(/\u2018[^\u2019]+\u2019/g) || []);
  const w = quoted[0] || "";
  switch (n.key) {
    case "runon": return `Runs on: carry the sense over, with a lift on ${w}.`;
    case "light": return `Light beat${quoted.length > 1 ? "s" : ""} on ${quoted.slice(0, -1).join(", ") || w}${quoted.length > 2 ? "" : ""}: keep ${quoted.length > 2 ? "them" : "it"} small.`;
    case "heavy": return `${w} is weighty off the beat: it slows the line.`;
    case "inversion": return `${n.label}: ${w} takes the beat.`;
    case "feminine": return `Extra light syllable at the end: leaves the line open.`;
    case "opposites": return `${quoted.slice(0, 2).join(" against ")}: point the contrast.`;
    case "midstop": return `New thought mid-line after ${w}: pick it up quickly.`;
    case "hinge": return `Turns after ${w}.`;
    case "short": return "Short line: there's silence to fill.";
    case "shared": return "Shared line: pick up the cue at once.";
    default: return n.text.split(/(?<=[.!?])\s/)[0];
  }
}

// A short overview of the whole passage: what to look at first.
export function passageNotes(a) {
  const sum = a.summary;
  const out = [];
  if (sum.form === "verse") {
    const k = sum.kinds;
    const parts = [];
    if (k.regular) parts.push(`${k.regular} regular`);
    if (k.feminine || k.double) parts.push(`${(k.feminine || 0) + (k.double || 0)} with an extra syllable at the end`);
    if (k.short) parts.push(`${k.short} short`);
    if (k.shared) parts.push(`${k.shared} piece${k.shared === 1 ? "" : "s"} of shared lines`);
    const other = (k.alexandrine || 0) + (k.rough || 0) + (k.tetrameter || 0);
    if (other) parts.push(`${other} irregular`);
    out.push(sum.meter === "tetrameter"
      ? `Verse in short, chanting four-beat lines: ${sum.verseLines} lines.`
      : `Verse: ${sum.verseLines} line${sum.verseLines === 1 ? "" : "s"} of iambic pentameter (${parts.join(", ")}).`);
  } else if (sum.form === "prose") {
    out.push(`Prose: ${sum.thoughts} sentence${sum.thoughts === 1 ? "" : "s"}. Think in sentences, not lines.`);
  } else {
    out.push("A mix of verse and prose. Watch where it switches, and ask why.");
  }
  out.push(`${sum.thoughts} thought${sum.thoughts === 1 ? "" : "s"} (sentences)${sum.questions ? `, ${sum.questions} of them question${sum.questions === 1 ? "" : "s"}` : ""}.`);
  if (a.shared.length) out.push(`${a.shared.length} shared line${a.shared.length === 1 ? "" : "s"}: pick up those cues fast.`);
  if (a.antitheses.length) out.push(`${a.antitheses.length} pair${a.antitheses.length === 1 ? "" : "s"} of opposites to point.`);
  if (a.switches.length || (a.contrasts || []).length) out.push("Watch the thou and you: someone's terms change.");
  if (a.rhymes.some((r) => r.gap === 1)) out.push("There's rhyme: notice where it lands.");
  const judged = a.speeches.find((s) => s.judged);
  if (judged && judged.judged.unsure) out.push("We're not sure if this is verse or prose. Read it aloud: can you feel a steady de-DUM?");
  return out;
}

function list(xs) {
  if (xs.length <= 1) return xs.join("");
  return xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
}
function capital(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function titleCase(s) {
  if (!s) return "";
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
