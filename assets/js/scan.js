// The scanner: works out where the beats fall in a line of Shakespeare.
//
// It never claims to be right. It finds the most likely reading of a line as
// iambic pentameter (de-DUM x 5), notes where the line bends the pattern, and
// leaves the actor free to disagree. No DOM here: it runs in the browser and
// in Node (for tests).
//
// How it works, briefly:
// 1. Split the line into words and punctuation.
// 2. For each word, list the ways it can be said (syllable count and where
//    its stress falls), using the CMU dictionary plus Shakespeare's habits:
//    o'er, heav'n, belovèd, th'.
// 3. Try every combination against the metre and score each one: a stressed
//    syllable off the beat costs a lot, a "the" on the beat costs a little,
//    a reversed first foot costs almost nothing because Shakespeare does it
//    all the time.
// 4. Keep the cheapest reading, and describe what it did.

// ---------------------------------------------------------------- word classes

// Syllable classes, strongest to weakest.
//   P  main stress of a longer word       ("WIN" in winter)
//   S  secondary stress                   ("CON" in consummation)
//   C  content word of one syllable       (love, death, sleep)
//   M  middling word of one syllable      (not, all, what, now)
//   Q  unknown                            (a word we couldn't look up)
//   F  function word                      (in, my, is, you)
//   u  unstressed, but can take a beat    ("ty" in majesty)
//   f  very light                         (the, a, and, of)
//   U  unstressed, next to a stress       ("ter" in winter)

const VERY_WEAK = new Set("a an the th' and of to as at o' i' a' 'em 'n an' wi'".split(" "));
const WEAK = new Set(`in on by for from with or nor but if than that is am are was were be been
  has have had hath do does did doth dost shall will would should can could may might must art
  wilt shalt canst i me my we us our you your ye thou thee thy he him his she her it its they them
  their 'tis 'twas 'twere 'twill 'twould 'gainst 'mongst 'twixt let which whom whose till sir o
  since though while whilst lest till until whether
  there where's there's here's that's what's who's it's he's she's i'll we'll you'll he'll she'll
  they'll i'm i've we're you're they're i'd you'd he'd i'ld you'ld he'ld we'ld they'ld thou'rt
  thou'lt is't on't in't was't will't were't by'r ha' should'st would'st 'tween`.split(/\s+/));
const MIDDLING = new Set(`not no all this these those what who how when why now then here more
  most too such own one some each both yet still so thus well up out down off through o'er e'er
  oh ay nay yea mine thine none ere oft whence hence thence where`.split(/\s+/));
// Longer words that behave like function words: their stress is soft.
const SOFT_POLY = new Set(`upon unto into onto against about before within without beneath between
  among unless until because whereas although ourselves yourself myself himself herself itself
  themselves thyself whereof whereon whereto wherein thereof therein whilst amongst`.split(/\s+/));

// Contractions and archaic forms, as class strings (one letter per syllable).
const FORMS = {
  "th'": "", "i'": "f", "o'": "f", "a'": "f", "wi'": "f", "ha'": "F", "'em": "f",
  "'tis": "F", "'twas": "F", "'twere": "F", "'twill": "F", "'twould": "F", "'twixt": "C",
  "'gainst": "F", "'mongst": "F", "'tween": "F", "'scape": "C", "'scaped": "C", "'twere": "F",
  "o'er": "M", "e'er": "M", "ne'er": "C", "e'en": "C", "ta'en": "C", "fall'n": "C", "stol'n": "C",
  "swoll'n": "C", "whate'er": "uP", "whene'er": "uP", "where'er": "uP", "howe'er": "uP",
  "whoe'er": "uP", "what'er": "uP", "i'll": "F", "i'ld": "F", "you'ld": "F", "we'ld": "F",
  "he'ld": "F", "they'ld": "F", "she'ld": "F", "thou'rt": "F", "thou'lt": "F", "by'r": "F",
  "l'envoy": "PU", "o": "F", "oh": "M", "upon't": "uP", "is't": "F", "on't": "F", "in't": "F",
  "was't": "F", "will't": "F", "were't": "F", "do't": "C", "see't": "C", "know't": "C",
  "heav'n": "C", "heav'ns": "C", "e'er't": "M", our: "F", "soe'er": "uP",
};

// Little words that take stress when they finish a phrase: "play on", "go to".
const PARTICLES = new Set("on in off up out down forth back away by over through along about aside apart upon".split(" "));

// Words Shakespeare often squeezes into fewer syllables than we'd say.
const SQUEEZABLE = {
  heaven: "heav'n", heavens: "heav'ns", even: "e'en", seven: "sev'n", given: "giv'n",
  driven: "driv'n", spirit: "sprite", spirits: "sprites", devil: "dev'l", devils: "dev'ls",
  evil: "ev'l", power: "pow'r", powers: "pow'rs", flower: "flow'r", flowers: "flow'rs",
  tower: "tow'r", towers: "tow'rs", whether: "whe'er", either: "ei'er", neither: "nei'er",
  being: "being (one beat)", seeing: "seeing (one beat)", doing: "doing (one beat)",
  going: "going (one beat)", dying: "dying (one beat)", lying: "lying (one beat)",
  flying: "flying (one beat)", crying: "crying (one beat)", prison: "pris'n", reason: "reas'n",
  over: "o'er", never: "ne'er", ever: "e'er", hour: "hour (one beat)", fire: "fire (one beat)",
  our: "our (one beat)", prayer: "prayer (one beat)", prayers: "prayers (one beat)",
  desire: "desire (two beats)", romeo: "Rom-yo", juliet: "Jul-yet",
};

// Endings that Shakespeare often sounds as an extra syllable: na-ti-on.
const EXPANDABLE = /[a-z]i(?:ons?|ous|ence|ences|ent|ents|al|als|an|ans|ance|ant|ants|age|ages|er|ers|or|ors)$|^oceans?$/;

// Opposites to listen for (antithesis).
export const OPPOSITES = [
  ["love", "hate"], ["life", "death"], ["live", "die"], ["day", "night"], ["fair", "foul"],
  ["good", "bad"], ["good", "evil"], ["light", "dark"], ["light", "darkness"], ["heaven", "hell"],
  ["high", "low"], ["give", "take"], ["friend", "foe"], ["friends", "foes"], ["joy", "grief"],
  ["joy", "sorrow"], ["mirth", "dirge"], ["delight", "dole"], ["war", "peace"], ["young", "old"],
  ["rich", "poor"], ["king", "beggar"], ["sweet", "sour"], ["sweet", "bitter"], ["hot", "cold"],
  ["fire", "ice"], ["wise", "fool"], ["wise", "foolish"], ["true", "false"], ["truth", "lies"],
  ["first", "last"], ["more", "less"], ["much", "little"], ["all", "nothing"], ["something", "nothing"],
  ["win", "lose"], ["won", "lost"], ["laugh", "weep"], ["smile", "frown"], ["heaven", "earth"],
  ["sleep", "wake"], ["sleeping", "waking"], ["begin", "end"], ["beginning", "end"], ["black", "white"],
  ["dead", "alive"], ["dead", "living"], ["man", "woman"], ["men", "women"], ["lord", "slave"],
  ["master", "servant"], ["old", "new"], ["noble", "base"], ["honest", "false"], ["strong", "weak"],
  ["sick", "well"], ["hope", "despair"], ["fear", "hope"], ["near", "far"], ["come", "go"],
  ["here", "there"], ["now", "then"], ["up", "down"], ["in", "out"], ["less", "more"],
  ["better", "worse"], ["best", "worst"], ["heavy", "light"], ["dear", "cheap"], ["kill", "save"],
  ["night", "morning"], ["sun", "moon"], ["summer", "winter"], ["spring", "winter"], ["east", "west"],
  ["birth", "death"], ["born", "die"], ["cradle", "grave"], ["vice", "virtue"], ["sin", "virtue"],
  ["angel", "devil"], ["saint", "devil"], ["praise", "blame"], ["bless", "curse"], ["kiss", "kill"],
  ["open", "shut"], ["loud", "soft"], ["speak", "silent"], ["speak", "hear"], ["teach", "learn"],
  ["be", "seem"], ["is", "seems"], ["husband", "wife"], ["father", "son"], ["mother", "daughter"],
  ["mortal", "immortal"], ["full", "empty"], ["loved", "hated"], ["rise", "fall"],
];

// Small words that glue a sentence together (for the "key words" view).
export function isGlueWord(w) {
  const x = String(w).toLowerCase();
  return VERY_WEAK.has(x) || WEAK.has(x) || x === "o";
}

// ---------------------------------------------------------------- tokenising

const KEEP_LEADING = /^'(?:tis|twas|twere|twill|twould|twixt|gainst|mongst|tween|scape|scaped|em|a|s)$/i;
const KEEP_TRAILING = /^(?:th|i|o|a|wi|ha|an)'$/i;

export function tokenize(text) {
  const clean = String(text)
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
  const re = /([A-Za-zÀ-ſ]+(?:'[A-Za-zÀ-ſ]+)*'?|'[A-Za-zÀ-ſ]+(?:'[A-Za-zÀ-ſ]+)*'?)|(--|—|–|[.,;:!?()"])|(-)|(\s+)/g;
  const tokens = [];
  let m;
  while ((m = re.exec(clean))) {
    if (m[1]) {
      let raw = m[1];
      let pre = "";
      let post = "";
      if (raw.startsWith("'") && !KEEP_LEADING.test(raw.replace(/'$/, ""))) {
        pre = "'";
        raw = raw.slice(1);
      }
      if (raw.endsWith("'") && !KEEP_TRAILING.test(raw)) {
        // possessive plural (lovers') or a closing quote: same sound either way
        post = "'";
        raw = raw.slice(0, -1);
      }
      if (!raw) continue;
      tokens.push({ text: pre + raw + post, word: raw.toLowerCase(), punct: "", hyphen: false, space: false });
    } else if (m[2]) {
      const last = tokens[tokens.length - 1];
      const p = m[2] === "--" || m[2] === "—" || m[2] === "–" ? "–" : m[2];
      if (last) last.punct += p;
      else tokens.push({ text: "", word: null, punct: p, hyphen: false, space: false });
    } else if (m[3]) {
      const last = tokens[tokens.length - 1];
      if (last && last.word) last.hyphen = true;
    } else if (m[4]) {
      const last = tokens[tokens.length - 1];
      if (last) last.space = true;
    }
  }
  return tokens.filter((t) => t.word || t.punct);
}

// ---------------------------------------------------------------- syllables in spelling

// Rough count of syllables from spelling alone, for words we can't look up.
export function guessSyllables(word) {
  let w = word.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return Math.max(1, (w.match(/[aeiouy]+/g) || []).length);
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, (s) => s[0]).replace(/^y/, "");
  const groups = w.match(/[aeiouyà-ÿ]+/g) || [];
  let n = groups.length;
  if (/[^aeiou]le$/.test(word)) n += 0;
  if (/(ia|io|eo|ua|uo|iu)/.test(w)) n += (w.match(/ia|io|eo|ua|uo|iu/g) || []).length * 0.5;
  return Math.max(1, Math.round(n));
}

// Split a word's spelling into n pieces, one per syllable, for display.
const PARTS = "with out in up on to my thy him her it your our them self selves where there here fore of by some thing things times one every any no how ever what so after more over never wise like home ward side be eye brow day night light heart time head land".split(" ");
const PART_SET = new Set(PARTS);
const ONE_BEAT_PARTS = new Set(PARTS.filter((p) => !/^(every|any|ever|after|over|never)$/.test(p)));

export function splitSyllables(text, n) {
  if (n <= 1) return [text];
  const lower = text.toLowerCase();
  // compounds of small words: with|out, where|fore, my|self
  // o'erwhelm, ne'er-do
  const pre = lower.match(/^(o'er|e'er|ne'er)(?=[a-z])/);
  if (pre) return [text.slice(0, pre[1].length), ...splitSyllables(text.slice(pre[1].length), n - 1)];
  if (/^[a-z]+$/.test(lower)) {
    for (let i = 2; i <= lower.length - 2; i++) {
      const a = lower.slice(0, i);
      if (PART_SET.has(a) && PART_SET.has(lower.slice(i))) {
        const na = ONE_BEAT_PARTS.has(a) ? 1 : 2;
        if (na < n) return [...splitSyllables(text.slice(0, i), na), ...splitSyllables(text.slice(i), n - na)];
      }
    }
  }
  const isV = (i) => {
    const c = lower[i];
    if (!c) return false;
    if ("aeiouàáèéìíòóùú".includes(c)) return true;
    return c === "y" && i > 0 && !"aeiou".includes(lower[i - 1]);
  };
  // vowel groups
  let groups = [];
  for (let i = 0; i < lower.length; ) {
    if (isV(i)) {
      let j = i;
      while (j + 1 < lower.length && isV(j + 1)) j++;
      groups.push([i, j]);
      i = j + 1;
    } else i++;
  }
  // silent final e (but not "-le" after a consonant, or the only vowel)
  const last = groups[groups.length - 1];
  if (groups.length > 1 && last && last[0] === last[1] && lower[last[0]] === "e") {
    const atEnd = last[1] === lower.replace(/[^a-zà-ÿ]+$/, "").length - 1;
    const beforeEnd = /e[sd]'?s?$/.test(lower) && last[1] >= lower.length - 3;
    const le = /[^aeiou]le$/.test(lower);
    if ((atEnd && !le) || (beforeEnd && groups.length > n)) groups.pop();
  }
  // split two-vowel groups when we need more
  const splittable = /^(ia|io|eo|ua|uo|ie|ue|oe|ea|iou|eou|ai|oi|yi|ae)$/;
  while (groups.length < n) {
    const k = groups.findIndex(([a, b]) => b > a && splittable.test(lower.slice(a, b + 1)));
    if (k < 0) break;
    const [a, b] = groups[k];
    groups.splice(k, 1, [a, a], [a + 1, b]);
  }
  while (groups.length > n) {
    // a lone "e" inside the word before a consonant is usually silent: abatement, lovely
    const silent = groups.findIndex(([a, b], k) => k > 0 && k < groups.length - 1 && a === b && lower[a] === "e" && !"aeiouy".includes(lower[a + 1] || "a") && !"aeiouy".includes(lower[a - 1]));
    if (silent > 0) {
      groups.splice(silent, 1);
      continue;
    }
    // merge the last two groups
    const b = groups.pop();
    groups[groups.length - 1][1] = b[1];
  }
  if (groups.length < n) {
    // fall back to roughly equal pieces
    if (text.length < n) return [text, ...Array(n - 1).fill("")];
    const out = [];
    for (let i = 0; i < n; i++) out.push(text.slice(Math.round((i * text.length) / n), Math.round(((i + 1) * text.length) / n)));
    return out;
  }
  const blends = /^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|tr|th|sh|ch|ph|wh|gh|qu|sc|sk|sl|sm|sn|sp|st|sw|tw|str|spr|scr|thr|shr|chr)$/;
  const pm = lower.match(/^(dis|mis|un|in|im|con|com|ex|trans|sub|ab|ad|ob|en|em|out|with|up|over|under|for|fore)(?=[^aeiouy'])/);
  const prefixEnd = pm ? pm[1].length : 0;
  const sm = lower.match(/[^aeiouy'](est|eth|ing|ings|ed)$/) || lower.match(/(?:[^aeiouy']|e)(less|ness|ful|ment|ments|ly)$/);
  // "shuffled", "wrinkled": the l (or r) belongs to the last syllable
  if (sm && /[^aeiouy][lr](?:est|eth|ing|ings|ed)$/.test(lower)) sm[1] = "";
  let suffixStart = sm && sm[1] ? lower.length - sm[1].length : 0;
  // attest, not att-est: a doubled consonant splits down the middle
  if (suffixStart > 1 && lower[suffixStart - 1] === lower[suffixStart - 2]) suffixStart = 0;
  const cuts = [];
  for (let k = 0; k < groups.length - 1; k++) {
    const from = groups[k][1] + 1;
    const to = groups[k + 1][0];
    const cons = lower.slice(from, to).replace(/'/g, "");
    let cut;
    if (to - from === 0) cut = from;
    else if (k === 0 && prefixEnd && prefixEnd > groups[0][1] && prefixEnd <= groups[1][0]) cut = prefixEnd;
    else if (k === groups.length - 2 && suffixStart && suffixStart >= from && suffixStart <= groups[k + 1][0]) cut = suffixStart;
    else if (cons.length === 1) cut = "xwy".includes(cons) ? to : from;
    else if (cons === "ck" || cons === "ng") cut = to;
    else if (/^(w|y)/.test(cons)) cut = from + 1;
    else if (/^ck/.test(cons)) cut = from + 2;
    else if (/^gh/.test(cons)) cut = from + (cons.length > 3 ? 3 : 2);
    else if (blends.test(cons)) cut = from;
    else if (cons.length >= 3) {
      // keep the longest cluster that can start a syllable: king-dom, in-stant
      const onset = [3, 2].find((k) => k < cons.length && blends.test(cons.slice(-k))) || 1;
      cut = to - onset;
    } else cut = from + 1;
    cuts.push(cut);
  }
  const out = [];
  let prev = 0;
  for (const c of cuts) {
    out.push(text.slice(prev, c));
    prev = c;
  }
  out.push(text.slice(prev));
  return out;
}

// ---------------------------------------------------------------- the dictionary

export function createScanner(dictDoc) {
  const words = dictDoc.w;
  const rhymes = dictDoc.r;

  function entry(word) {
    const raw = words[word];
    if (!raw) return null;
    const [pats, r] = raw.split(":");
    return { pats: pats.split("|"), rhyme: r !== undefined ? rhymes[parseInt(r, 36)] : null };
  }

  function rhymeOf(word) {
    const w = word.toLowerCase().replace(/^'|'$/g, "");
    const e = entry(w) || entry(w.replace(/'s$/, ""));
    return e ? e.rhyme : null;
  }

  // Turn a CMU stress string ("102") into class letters ("PuS"...).
  function classify(pat, word) {
    if (pat.length === 1) {
      if (VERY_WEAK.has(word)) return "f";
      if (WEAK.has(word)) return "F";
      if (MIDDLING.has(word)) return "M";
      return "C";
    }
    const soft = SOFT_POLY.has(word);
    let out = "";
    for (let i = 0; i < pat.length; i++) {
      const d = pat[i];
      if (d === "1") out += soft ? "S" : "P";
      else if (d === "2") out += "S";
      else {
        const near = pat[i - 1] === "1" || pat[i + 1] === "1";
        out += near && !soft ? "U" : "u";
      }
    }
    return out;
  }

  // Every reasonable way to say a word: [{cls, cost, how, shown}]
  // cls is one class letter per syllable; how names any change from normal speech.
  function variants(word, next) {
    const out = [];
    const add = (cls, cost, how = null, shown = null) => {
      if (!out.some((v) => v.cls === cls)) out.push({ cls, cost, how, shown });
    };
    const w = word.replace(/è/g, "e");
    const accented = word !== w; // belovèd: the è tells you to sound it

    if (w === "the" && next && /^[aeiou]/.test(next) && !/^(?:one|once|eu|uni|use|usu|ewe)/.test(next)) {
      add("f", 0);
      add("", 0.35, "elide", "th'");
      return out;
    }
    if (w === "to" && next && /^[aeiou]/.test(next) && !/^(?:one|once|eu|uni|use|usu)/.test(next)) {
      add("f", 0);
      add("", 0.9, "elide", "t'");
      return out;
    }
    if (/soe'er$/.test(w) && w !== "soe'er") {
      add("u".repeat(Math.max(1, guessSyllables(w.replace(/soe'er$/, "")))) + "uP", 0);
      return out;
    }
    if (w in FORMS) {
      add(FORMS[w], 0, FORMS[w] === "" ? "elide" : null, FORMS[w] === "" ? w : null);
      return out;
    }
    let e = entry(w);
    let base = w;
    if (!e) {
      // possessives and 't contractions of known words
      const m = w.match(/^(.*?)(?:'s|'t|'d|'st|')$/);
      if (m && entry(m[1])) {
        base = m[1];
        e = entry(base);
        if (/'s$/.test(w) && /(?:s|x|z|ch|sh|ce|se|ge)$/.test(base)) {
          e = { pats: e.pats.map((p) => p + "0"), rhyme: e.rhyme };
        }
      } else if (/'d$/.test(w) && entry(w.slice(0, -2) + "ed")) {
        e = entry(w.slice(0, -2) + "ed");
      } else if (/'d$/.test(w) && entry(w.slice(0, -2) + "e")) {
        e = entry(w.slice(0, -2) + "e");
      } else if (/'d$/.test(w) && entry(w.slice(0, -2))) {
        e = entry(w.slice(0, -2));
      }
    }
    if (e) {
      // -ed endings: belovèd (sounded) or lov'd (silent)
      const edStem = /[^aeiou']ed$/.test(w) && !/[td]ed$/.test(w) && !/'d$/.test(word) ? w.slice(0, -2) : null;
      // only when the dictionary says the -ed is silent: the word has no more
      // syllables than its stem (so not "sacred", "hundred", "shuffled")
      const shortest = Math.min(...e.pats.map((p) => p.length));
      const isVerbEd = edStem && /[aeiouy]/.test(edStem) && shortest <= guessSyllables(edStem);
      if (isVerbEd) {
        const pats = e.pats.slice().sort((a, b) => a.length - b.length);
        const silent = pats[0];
        const sounded = pats.find((p) => p.length === silent.length + 1) || silent + "0";
        if (accented) {
          add(classify(sounded, base), 0, "sound-ed", w.replace(/ed$/, "\u00e8d"));
        } else {
          add(classify(silent, base), 0);
          add(classify(sounded, base), e.pats.includes(sounded) ? 0.35 : 0.75, "sound-ed", w.replace(/ed$/, "\u00e8d"));
        }
      } else {
        e.pats.forEach((p, i) => add(classify(p, base), i === 0 ? 0 : 0.1));
      }
      const first = e.pats[0];
      const cls0 = classify(first, base);
      // squeeze: heav'n, ne'er, being as one beat
      const diphthongEnd = (/^[^aeiouy]*(?:our|ours|ayer|ayers|eyer)$/.test(w) && first === "10") || (/[^aeiouy](?:ire|ires|ired|ower|owers|ower'd|owered)$/.test(w) && /10$/.test(first));
      if ((SQUEEZABLE[w] || diphthongEnd) && first.length >= 2) {
        const one = first.length === 2 ? "C" : classify(first.slice(0, -1), base);
        add(one, 0.4, "squeeze", SQUEEZABLE[w] || `${w} (one beat)`);
      }
      // syncope: nat'ral, ev'ry, gen'ral: drop an unstressed syllable after the main stress
      if (first.length >= 3) {
        const k = first.indexOf("1");
        if (k >= 0 && k + 2 < first.length && first[k + 1] === "0") {
          const p2 = first.slice(0, k + 1) + first.slice(k + 2);
          add(classify(p2, base), 0.5, "squeeze", null);
        }
      }
      // expansion: na-ti-on, mar-ri-age
      if (EXPANDABLE.test(w) && first.length >= 2) {
        add(cls0 + "u", 0.8, "stretch", null);
      }
      // stress shift: DES-pised, EX-treme (two-syllable words stressed on the second)
      if (first === "01" && !SOFT_POLY.has(base)) add("PU", 0.9, "shift", null);
      if (first === "10" && !SOFT_POLY.has(base) && /^(?:en|re|ex|com|con|de|di|ob|pro|sin)/.test(w)) add("UP", 1.0, "shift", null);
      return out;
    }
    // unknown word: guess from spelling
    const n = guessSyllables(w);
    if (n === 1) add(VERY_WEAK.has(w) ? "f" : WEAK.has(w) ? "F" : MIDDLING.has(w) ? "M" : "C", 0.1);
    else add("Q".repeat(n), 0.2);
    if (n === 2) {
      add("PU", 0.3);
      add("UP", 0.4);
    }
    if (n >= 3) add("Q".repeat(n - 1), 0.7, "squeeze", null);
    return out;
  }

  // ---------------------------------------------------------------- the metre

  const ON = { P: 0, S: 0.1, C: 0, M: 0.15, Q: 0.3, F: 0.6, u: 0.55, f: 0.9, U: 2.0 };
  const OFF = { P: 2.5, S: 0.5, C: 0.45, M: 0.2, Q: 0.3, F: 0, u: 0, f: 0, U: 0 };

  // Fit a sequence of syllables to the metre. Returns {cost, feet, pattern}.
  // syl: [{cls, wordStart, breakBefore}] ; mode: {feet, short}
  function fit(syl, mode) {
    const n = syl.length;
    const INF = 1e9;
    const maxFeet = 7;
    // best[i][k] = cheapest way to cover syllables 0..i-1 with k feet
    const best = Array.from({ length: n + 1 }, () => Array(maxFeet + 1).fill(INF));
    const back = Array.from({ length: n + 1 }, () => Array(maxFeet + 1).fill(null));
    best[0][0] = 0;
    const on = (i) => ON[syl[i].cls] ?? 0.3;
    const off = (i) => OFF[syl[i].cls] ?? 0.3;
    const atBreak = (i) => i === 0 || syl[i].breakBefore;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < maxFeet; k++) {
        const here = best[i][k];
        if (here >= INF) continue;
        const tryFoot = (len, cost, type) => {
          const j = i + len;
          if (j > n) return;
          if (here + cost < best[j][k + 1]) {
            best[j][k + 1] = here + cost;
            back[j][k + 1] = { i, type };
          }
        };
        // iamb: de-DUM
        tryFoot(2, i + 1 < n ? off(i) + on(i + 1) : INF, "iamb");
        // trochee: DUM-de, cheap at the start of a line or after a pause
        if (i + 1 < n) {
          let c = k === 0 ? 0.3 : syl[i].breakBefore ? 0.5 : 1.7;
          // "In the..." is a light start, not a kick: prefer the light beat
          if ("fFu".includes(syl[i].cls)) c += 0.3;
          if (!syl[i].wordStart) c += 1.0;
          tryFoot(2, c + on(i) + off(i + 1), "trochee");
        }
        // anapest: de-de-DUM (an extra light syllable)
        if (i + 2 < n) {
          const c = syl[i + 1].breakBefore || syl[i + 2].breakBefore ? 0.75 : 1.3;
          tryFoot(3, c + off(i) + off(i + 1) + on(i + 2), "anapest");
        }
        // headless: the line starts on the beat with no "de"
        if (k === 0) tryFoot(1, (mode.tetra ? 0.2 : mode.short ? 0.6 : 1.4) + on(i), "head");
        // a lone beat after a pause (a missing offbeat): rare
        if (k > 0 && syl[i].breakBefore) tryFoot(1, 1.6 + on(i), "single");
      }
    }
    // endings: 0, 1 (feminine) or 2 (double) extra light syllables
    let top = { cost: INF };
    for (let extra = 0; extra <= 2; extra++) {
      const end = n - extra;
      if (end < 1) continue;
      let ec = 0;
      for (let x = end; x < n; x++) ec += off(x);
      ec += extra === 0 ? 0 : extra === 1 ? 0.25 : 1.2;
      for (let k = 1; k <= maxFeet; k++) {
        if (best[end][k] >= INF) continue;
        let fc;
        if (mode.short) fc = 0;
        else if (mode.tetra) fc = k === 4 ? 0 : k === 3 ? 1.2 : k === 5 ? 1.0 : 4;
        else fc = k === 5 ? 0 : k === 6 ? 1.0 : k === 4 ? 1.6 : 5;
        const total = best[end][k] + ec + fc;
        if (total < top.cost) top = { cost: total, end, k, extra };
      }
    }
    if (top.cost >= INF) return null;
    const feet = [];
    let j = top.end;
    let k = top.k;
    while (j > 0) {
      const b = back[j][k];
      feet.unshift({ type: b.type, from: b.i, to: j });
      j = b.i;
      k--;
    }
    if (top.extra) feet.push({ type: top.extra === 1 ? "feminine" : "double", from: top.end, to: n });
    const pattern = Array(n).fill("w");
    for (const f of feet) {
      if (f.type === "iamb") pattern[f.from + 1] = "S";
      else if (f.type === "trochee" || f.type === "head" || f.type === "single") pattern[f.from] = "S";
      else if (f.type === "anapest") pattern[f.from + 2] = "S";
    }
    return { cost: top.cost, feet, pattern: pattern.join(""), nFeet: top.k, extra: top.extra };
  }

  // A hand-checked reading ("x/x/x/x/x/") turned into feet, so the notes
  // can describe it like any other line.
  function forced(p) {
    const feet = [];
    let i = 0;
    const n = p.length;
    while (i < n) {
      const two = p.slice(i, i + 2);
      const three = p.slice(i, i + 3);
      if (i >= n - 2 && /^x+$/.test(p.slice(i)) && feet.length) {
        feet.push({ type: n - i === 1 ? "feminine" : "double", from: i, to: n });
        break;
      }
      if (two === "x/") feet.push({ type: "iamb", from: i, to: (i += 2) });
      else if (three === "xx/") feet.push({ type: "anapest", from: i, to: (i += 3) });
      else if (two === "/x" && p[i + 2] !== "/") feet.push({ type: "trochee", from: i, to: (i += 2) });
      else feet.push({ type: i === 0 ? "head" : "single", from: i, to: (i += 1) });
    }
    const last = feet[feet.length - 1];
    const extra = last && last.type === "feminine" ? 1 : last && last.type === "double" ? 2 : 0;
    const nFeet = feet.length - (extra ? 1 : 0);
    return { cost: 0, feet, pattern: p.replace(/\//g, "S").replace(/x/g, "w"), nFeet, extra };
  }

  // ---------------------------------------------------------------- one line

  function scanLine(text, opts = {}) {
    const tokens = tokenize(text);
    const wordToks = tokens.map((t, i) => ({ t, i })).filter((x) => x.t.word);
    const options = wordToks.map(({ t }, k) => {
      const next = wordToks[k + 1] ? wordToks[k + 1].t.word : null;
      let vs = variants(t.word, next);
      // "play on," "come in.": a particle closing a phrase is stressed
      if (PARTICLES.has(t.word) && (!next || /[.,;:!?\u2013]/.test(t.punct))) {
        vs = vs.map((v) => (v.cls.length === 1 ? { ...v, cls: "C" } : v));
      }
      // a small word closing a phrase takes some stress: "To be, or not"
      if (k < wordToks.length - 1 && /[,;:!?.\u2013]/.test(t.punct) && WEAK.has(t.word) && !PARTICLES.has(t.word)) {
        vs = vs.map((v) => (v.cls === "F" ? { ...v, cls: "M" } : v));
      }
      // a small word ending the line takes some stress: "this, not I"
      if (k === wordToks.length - 1 && !PARTICLES.has(t.word) && wordToks.length > 3) {
        vs = vs.map((v) => (v.cls === "F" ? { ...v, cls: "M" } : v));
      }
      // second half of a hyphenated compound leans on the first: heart-ache
      const prev = wordToks[k - 1];
      if (prev && prev.t.hyphen) {
        vs = vs.map((v) => (v.cls === "C" ? { ...v, cls: "M" } : v));
      }
      return vs;
    });
    // keep the search small: at most 3 readings per word, then cap the product
    options.forEach((o) => {
      o.sort((a, b) => a.cost - b.cost);
      o.splice(3);
    });
    let combos = 1;
    for (const o of options) combos *= o.length;
    while (combos > 2000) {
      const k = options.reduce((m, o, i) => (o.length > options[m].length ? i : m), 0);
      options[k].pop();
      combos = options.reduce((p, o) => p * o.length, 1);
    }
    const total = (choice) => {
      // build the syllable list for this choice
      const syl = [];
      let pendingBreak = false;
      choice.forEach((v, k) => {
        const tok = wordToks[k].t;
        for (let s = 0; s < v.cls.length; s++) {
          syl.push({ cls: v.cls[s], k, s, wordStart: s === 0, breakBefore: s === 0 && pendingBreak });
        }
        if (/[.,;:!?–)]/.test(tok.punct)) pendingBreak = true;
        else if (v.cls.length) pendingBreak = false;
      });
      return syl;
    };
    const n0 = (() => {
      let n = 0;
      for (const o of options) n += o[0].cls.length;
      return n;
    })();
    const isShort = opts.short ?? n0 <= (opts.tetra ? 5 : 7);
    const mode = { short: isShort, tetra: !!opts.tetra };
    let best = null;
    const walk = (k, choice, vcost) => {
      if (best && vcost >= best.cost) return;
      if (k === options.length) {
        const syl = total(choice);
        if (!syl.length) return;
        if (opts.force && syl.length !== opts.force.length) return;
        const f = opts.force ? forced(opts.force) : fit(syl, mode);
        if (!f) return;
        const cost = f.cost + vcost;
        if (!best || cost < best.cost) best = { cost, fit: f, syl, choice: choice.slice() };
        return;
      }
      for (const v of options[k]) {
        choice.push(v);
        walk(k + 1, choice, vcost + v.cost);
        choice.pop();
      }
    };
    walk(0, [], 0);
    if (opts.force && !best) return scanLine(text, { ...opts, force: null });
    const line = describe(text, tokens, wordToks, best, mode);
    if (opts.force) line.checked = true;
    return line;
  }

  function describe(text, tokens, wordToks, best, mode) {
    const line = { text, tokens, syllables: [], words: [], cost: 0, feet: [], kind: "empty", features: [], mode };
    if (!best) return line;
    line.cost = Math.round(best.cost * 100) / 100;
    const pattern = best.fit.pattern;
    // words with their syllables
    let si = 0;
    best.choice.forEach((v, k) => {
      const tok = wordToks[k].t;
      const n = v.cls.length;
      // show belovèd with its accent when we sound the -ed
      const shownText = v.how === "sound-ed" && v.shown ? tok.text.slice(0, -2) + "\u00e8d" : tok.text;
      const pieces = n ? splitSyllables(shownText, n) : [tok.text];
      const word = {
        text: tok.text,
        word: tok.word,
        punct: tok.punct,
        hyphen: tok.hyphen,
        how: v.how,
        shown: v.shown,
        syllables: [],
      };
      for (let s = 0; s < n; s++) {
        const syl = { text: pieces[s] || "", cls: v.cls[s], beat: pattern[si] === "S", word: k, index: si };
        word.syllables.push(si);
        line.syllables.push(syl);
        si++;
      }
      line.words.push(word);
    });
    line.feet = best.fit.feet;
    line.count = line.syllables.length;
    line.pattern = pattern;
    // kind of line
    const f = best.fit;
    if (mode.short) line.kind = "short";
    else if (f.nFeet === 6) line.kind = "alexandrine";
    else if (f.nFeet === 4 && !mode.tetra) line.kind = "tetrameter";
    else line.kind = f.extra === 1 ? "feminine" : f.extra === 2 ? "double" : "regular";
    if (!mode.short && line.cost > 4.2) line.kind = "rough";
    if (!mode.short && f.feet.filter((x) => x.type === "single").length >= 2) line.kind = "rough";
    line.features = features(line, best);
    return line;
  }

  function features(line, best) {
    const out = [];
    const { syllables: syl, words, feet } = line;
    const beats = syl.filter((s) => s.beat);
    feet.forEach((ft, n) => {
      if (ft.type === "trochee") out.push({ type: "inversion", foot: n, at: ft.from, first: n === 0 });
      if (ft.type === "anapest") out.push({ type: "extra", foot: n, at: ft.from });
      if (ft.type === "head" && !/^(Sw)+S?$/.test(line.pattern)) out.push({ type: "headless", at: 0 });
      if (ft.type === "single") out.push({ type: "missing", at: ft.from });
    });
    if (/^(Sw)+S?$/.test(line.pattern) && line.pattern.length >= 7) out.push({ type: "trochaic" });
    else if (line.kind === "feminine" || line.kind === "double") out.push({ type: "feminine", at: syl.length - 1 });
    if (line.kind === "short") out.push({ type: "short", beats: beats.length });
    if (line.kind === "alexandrine") out.push({ type: "alexandrine" });
    if (line.kind === "rough") out.push({ type: "rough" });
    // light beats and heavy offbeats
    syl.forEach((s, i) => {
      if (s.beat && "fFuU".includes(s.cls) && !line.mode.short) out.push({ type: "light", at: i });
      if (!s.beat && "PC".includes(s.cls)) {
        const nb = (syl[i - 1] && syl[i - 1].beat && "PCS".includes(syl[i - 1].cls)) || (syl[i + 1] && syl[i + 1].beat && "PCS".includes(syl[i + 1].cls));
        if (nb) out.push({ type: "heavy", at: i });
      }
    });
    // squeezes, stretches, shifts
    words.forEach((w, k) => {
      if (w.how) out.push({ type: w.how, word: k, shown: w.shown });
    });
    // pauses inside the line, and the line ending
    words.forEach((w, k) => {
      if (k < words.length - 1 && /[.;:!?–]/.test(w.punct)) out.push({ type: "midstop", word: k, strong: /[.!?]/.test(w.punct) });
    });
    const lastWord = words[words.length - 1];
    if (lastWord) {
      if (!/[.,;:!?–)]/.test(lastWord.punct)) out.push({ type: "runon", word: words.length - 1 });
      else if (/[.!?]/.test(lastWord.punct)) out.push({ type: "endstop", word: words.length - 1 });
    }
    // all one-syllable words
    if (words.length >= 8 && words.every((w) => w.syllables.length <= 1)) out.push({ type: "monosyllables" });
    // repeated words in the line
    const seen = {};
    words.forEach((w, k) => {
      const key = w.word.replace(/'s$/, "");
      if (key.length < 3 || VERY_WEAK.has(key) || WEAK.has(key)) return;
      (seen[key] = seen[key] || []).push(k);
    });
    for (const [key, ks] of Object.entries(seen)) if (ks.length > 1) out.push({ type: "repeat", word: key, words: ks });
    // questions
    if (words.some((w) => w.punct.includes("?"))) out.push({ type: "question" });
    return out;
  }

  return { scanLine, variants, rhymeOf, entry, fit };
}
