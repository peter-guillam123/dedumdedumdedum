#!/usr/bin/env python3
"""Build the pronunciation file the scanner uses.

Usage:
    python3 tools/build_dict.py CMUDICT_PATH

CMUDICT_PATH is the CMU Pronouncing Dictionary (cmudict.dict from
github.com/cmusphinx/cmudict, BSD licence). We keep only the word forms that
appear in the plays (tools/out/vocab.txt, written by build_corpus.py), and
work out forms the dictionary lacks: archaic endings (-est, -eth, -'st, -'d),
possessives and hyphen-free compounds.

Writes data/dict.json:
    {"r": [rhyme endings...], "w": {word: "stress[:rhyme]"}}
stress is one digit per syllable from CMU (1 primary, 2 secondary, 0 none);
variants are joined with "|". rhyme is an index into "r" in base 36.
Also writes tools/out/missing.txt: words we still can't pronounce, by count.
"""
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOWEL = re.compile(r"[AEIOU]")


def load_cmu(path):
    d = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.split("#")[0].strip()
            if not line:
                continue
            word, *ph = line.split()
            word = re.sub(r"\(\d+\)$", "", word)
            d.setdefault(word, []).append(ph)
    return d


def stress(ph):
    return "".join(p[-1] for p in ph if VOWEL.match(p))


def rhyme(ph):
    """Phonemes from the last stressed vowel to the end, stress marks removed."""
    idx = None
    for i, p in enumerate(ph):
        if VOWEL.match(p) and p[-1] in "12":
            idx = i
    if idx is None:
        idx = next((i for i, p in enumerate(ph) if VOWEL.match(p)), 0)
    return " ".join(re.sub(r"\d", "", p) for p in ph[idx:])


def british(w, cmu):
    """American spellings of a British word, if the dictionary has one."""
    swaps = [("our", "or"), ("ise", "ize"), ("ised", "ized"), ("ence", "ense"), ("lled", "led"),
             ("lling", "ling"), ("ller", "ler"), ("tre", "ter"), ("gue", "g"), ("ae", "e")]
    for a, b in swaps:
        if a in w:
            cand = w.replace(a, b)
            if cand in cmu:
                return cmu[cand]
    return None


def guess(word, cmu):
    """Pronunciations for a word the dictionary lacks, built from its parts."""
    w = word
    b = british(w, cmu)
    if b:
        return b
    # possessive or plural with apostrophe
    for suf in ("'s", "s'"):
        if w.endswith(suf) and w[: -len(suf)] in cmu:
            base = cmu[w[: -len(suf)]]
            out = []
            for ph in base:
                last = ph[-1]
                extra = ["IH0", "Z"] if last in ("S", "Z", "SH", "ZH", "CH", "JH") else ["Z"]
                out.append(ph + extra)
            return out
    # wish'd, lov'd: silent ending
    if w.endswith("'d"):
        stem = w[:-2]
        undoubled = stem[:-1] if len(stem) > 3 and stem[-1] == stem[-2] else None
        for cand in (stem + "ed", stem + "d", stem + "ied" if stem.endswith("i") else None,
                     undoubled + "ed" if undoubled else None, british(stem + "ed", cmu) and stem + "ed"):
            if cand and cand not in cmu and british(cand, cmu):
                cmu[cand] = british(cand, cmu)
            if cand and cand in cmu:
                return [ph for ph in cmu[cand] if not (ph[-2:] in (["AH0", "D"], ["IH0", "D"]) and not stem.endswith(("t", "d")))] or cmu[cand]
        if stem in cmu:
            return [ph + ["D"] for ph in cmu[stem]]
    # know'st, lov'st, wouldst, couldst
    if w.endswith("'st") and w[:-3] in cmu:
        return [ph + ["S", "T"] for ph in cmu[w[:-3]]]
    if w.endswith("st") and w[:-2] in cmu and w[:-2] in ("would", "could", "should", "did", "had", "might", "must", "wilt", "shalt"):
        return [ph + ["S", "T"] for ph in cmu[w[:-2]]]
    # speakest, loveth, goeth, knowest
    for suf, ph_suf in (("est", ["AH0", "S", "T"]), ("eth", ["AH0", "TH"]), ("st", ["AH0", "S", "T"]), ("th", ["AH0", "TH"])):
        if w.endswith(suf):
            stem = w[: -len(suf)]
            for cand in (stem, stem + "e"):
                if len(cand) > 1 and cand in cmu:
                    return [ph + ph_suf for ph in cmu[cand]]
            if stem.endswith("i") and stem[:-1] + "y" in cmu:  # triest, crieth
                return [ph + ph_suf for ph in cmu[stem[:-1] + "y"]]
    # un-, -less, -ness, -ly, -ful prefixes and suffixes on known words
    for pre, ph_pre in (("un", ["AH0", "N"]),):
        if w.startswith(pre) and w[len(pre):] in cmu:
            return [ph_pre + ph for ph in cmu[w[len(pre):]]]
    for suf, ph_suf in (("less", ["L", "AH0", "S"]), ("ness", ["N", "AH0", "S"]), ("ly", ["L", "IY0"]),
                        ("ful", ["F", "AH0", "L"]), ("s", ["Z"])):
        if w.endswith(suf) and w[: -len(suf)] in cmu:
            return [ph + ph_suf for ph in cmu[w[: -len(suf)]]]
    # compounds written as one word: split where both halves are known
    for i in range(3, len(w) - 2):
        a, b = w[:i], w[i:]
        if a in cmu and b in cmu and len(a) > 2 and len(b) > 2:
            return [cmu[a][0] + [re.sub(r"1$", "2", p) if VOWEL.match(p) else p for p in cmu[b][0]]]
    return None


# Words the dictionary lacks, by hand: Shakespeare's vocabulary and the names
# actors meet most. Variants separated by "|" (most likely first).
EXTRA = {
    "entreat": "01", "entreats": "01", "offence": "01", "offences": "010", "signior": "10",
    "alack": "01", "whereof": "01", "whereon": "01", "whereto": "01", "whereat": "01",
    "forsooth": "01", "nought": "1", "revenged": "01|010", "beshrew": "01", "afeard": "01",
    "beauteous": "100|10", "ope": "1", "scurvy": "10", "sufferance": "100", "requite": "01",
    "sinews": "10", "piteous": "100|10", "ingratitude": "0100", "waked": "1", "awaked": "01",
    "chid": "1", "lechery": "100", "knavery": "100", "kinsmen": "10", "meed": "1",
    "prophesy": "102", "rend": "1", "avaunt": "01", "worser": "10", "prate": "1",
    "frighted": "10", "weal": "1", "fantastical": "0100", "amain": "01", "worthily": "100",
    "gaoler": "10", "rheum": "1", "dignities": "100", "welkin": "10", "afore": "01",
    "villany": "100", "villanies": "100", "hie": "1", "yond": "1", "wot": "1", "choler": "10",
    "cuckold": "10", "varlet": "10", "nuncle": "10", "holp": "1", "jove": "1", "jove's": "1",
    "jesu": "10", "heigh": "1", "ducats": "10", "wherefore": "10", "therefore": "10",
    "yonder": "10", "anon": "01", "withal": "01", "perchance": "01", "betwixt": "01",
    "mayst": "1", "mightst": "1", "wouldst": "1", "couldst": "1", "shouldst": "1", "didst": "1",
    "hadst": "1", "canst": "1", "dost": "1", "doth": "1", "hath": "1", "hast": "1", "art": "1",
    "wilt": "1", "shalt": "1", "thine": "1", "thee": "1", "thy": "1", "ere": "1", "oft": "1",
    "sirrah": "10", "contumely": "100|1000", "aught": "1", "naught": "1", "belike": "01",
    "haply": "10", "methought": "01", "howsoever": "2010", "whither": "10", "thither": "10",
    "hither": "10", "whence": "1", "thence": "1", "hence": "1", "ay": "1", "nay": "1", "yea": "1",
    "maid": "1", "maiden": "10", "sith": "1", "eke": "1", "fie": "1", "pish": "1", "tush": "1",
    "adieu": "01", "dotage": "10", "orisons": "100", "bodkin": "10", "fardels": "10",
    "quietus": "010", "thews": "1", "mought": "1", "anointed": "010", "cozen": "10",
    "cozenage": "100", "mountebank": "100", "bawd": "1", "wench": "1", "coxcomb": "10",
    "alarum": "010", "alarums": "010", "entreated": "010", "entreating": "010",
    # names
    "antipholus": "0100", "cassio": "100|10", "troilus": "100|10", "marcius": "100|10",
    "cassius": "100|10", "proteus": "100|10", "caius": "10", "northumberland": "0100",
    "pyramus": "100", "andronicus": "0100", "plantagenet": "0100", "desdemona": "2010",
    "lucentio": "0100|010", "dromio": "100|10", "tranio": "100|10", "pericles": "100",
    "bassanio": "0100|010", "diomed": "100", "aufidius": "0100", "petruchio": "0100|010",
    "coriolanus": "20100", "laertes": "010", "cressid": "10", "cressida": "100",
    "hortensio": "0100|010", "pisanio": "0100|010", "casca": "10", "thersites": "010",
    "lepidus": "100", "thisby": "10", "gremio": "100|10", "patroclus": "010", "thurio": "100|10",
    "apemantus": "2010", "grumio": "100|10", "catesby": "10", "cawdor": "10", "poins": "1",
    "aumerle": "01", "publius": "100|10", "nerissa": "010", "enobarbus": "2010", "volsces": "10",
    "cominius": "0100", "vincentio": "0100|010", "corioli": "0100", "titinius": "0100",
    "lucilius": "0100", "gratiano": "2010|201", "topas": "10", "polixenes": "0100",
    "saturnine": "100", "trinculo": "100", "anjou": "10", "menenius": "0100", "parolles": "01",
    "dumain": "01", "leonatus": "2010", "biondello": "2010", "mercutio": "0100|010",
    "benvolio": "0100|010", "tybalt": "10", "capulet": "100", "montague": "100", "verona": "010",
    "romeo": "100|10", "juliet": "100|10", "banquo": "10", "macduff": "01", "duncan": "10",
    "malcolm": "10", "fleance": "10", "dunsinane": "201|100", "birnam": "10", "glamis": "1|10",
    "ophelia": "010", "polonius": "0100", "horatio": "0100|010", "claudius": "100|10",
    "gertrude": "10", "elsinore": "102", "fortinbras": "100", "rosencrantz": "10",
    "guildenstern": "100", "yorick": "10", "iago": "010|01", "othello": "010", "emilia": "0100|010",
    "brabantio": "0100|010", "roderigo": "2010", "bianca": "010", "lear": "1", "cordelia": "0100|010",
    "goneril": "100", "regan": "10", "edmund": "10", "edgar": "10", "gloucester": "10",
    "kent": "1", "prospero": "100", "miranda": "010", "ariel": "100|10", "caliban": "100",
    "ferdinand": "100", "sycorax": "100", "gonzalo": "010", "viola": "100", "olivia": "0100|010",
    "orsino": "010", "malvolio": "0100|010", "sebastian": "0100|010", "rosalind": "100",
    "celia": "100|10", "orlando": "010", "jaques": "10", "touchstone": "12", "arden": "10",
    "portia": "100|10", "shylock": "10", "antonio": "0100|010", "jessica": "100", "lorenzo": "010",
    "beatrice": "100|10", "benedick": "100", "hero": "10", "claudio": "100|10", "titania": "0100|010",
    "oberon": "100", "lysander": "010", "demetrius": "0100", "hermia": "100|10", "helena": "100",
    "isabella": "2010", "angelo": "100", "lucio": "100|10", "hermione": "0100", "leontes": "010",
    "paulina": "010", "perdita": "100", "katherine": "100|10", "katharina": "2010", "baptista": "010",
    "bolingbroke": "100", "gaunt": "1", "harry": "10", "hal": "1", "falstaff": "10",
    "hotspur": "10", "brutus": "10", "caesar": "10", "antony": "100", "octavius": "0100|010",
    "calpurnia": "0100|010", "cleopatra": "2010", "egypt": "10", "rome": "1", "roman": "10",
}


def count_syllables(word):
    """Syllables from spelling alone (mirrors guessSyllables in scan.js)."""
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return max(1, len(re.findall(r"[aeiouy]+", w)))
    w = re.sub(r"(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$", lambda m: m.group(0)[0], w)
    w = re.sub(r"^y", "", w)
    n = len(re.findall(r"[aeiouy]+", w))
    n += 0.5 * len(re.findall(r"(?<![tsxc])(?:ia|io)|eo|ua|uo|iu", w))
    if re.search(r"[^aeiouy]re$", word.lower()):
        n += 1  # sepulchre, theatre
    return max(1, int(n + 0.5))


SUFFIX_PATS = [("ments", "0"), ("ment", "0"), ("ness", "0"), ("less", "0"), ("fully", "00"), ("ful", "0"),
               ("ly", "0"), ("ers", "0"), ("er", "0"), ("ings", "0"), ("ing", "0"), ("est", "0"), ("eth", "0"),
               ("ed", None), ("es", None), ("s", ""), ("ance", "0"), ("ence", "0"), ("ous", "0")]


def derive(word, known):
    """Stress pattern built from a known stem plus a suffix, or by English rules."""
    w = word.replace("'", "")
    for suf, pat in SUFFIX_PATS:
        if not w.endswith(suf) or len(w) - len(suf) < 3:
            continue
        stem = w[: -len(suf)]
        cands = [stem, stem + "e", stem[:-1] + "y" if stem.endswith("i") else None,
                 stem[:-1] if len(stem) > 3 and stem[-1] == stem[-2] else None]
        for c in cands:
            if c and c in known:
                base = known[c].split("|")[0].split(":")[0]
                if pat is None:
                    pat = "0" if stem[-1:] in ("t", "d") or (suf == "es" and stem[-1:] in "sxz") or stem.endswith(("ch", "sh")) else ""
                return base + pat
    n = count_syllables(w)
    if n <= 1:
        return "1"
    if re.search(r"(tion|sion|cian|tions|sions)$", w):
        p = "0" * (n - 2) + "10"
    elif re.search(r"(ity|ities|ical|ous|ent|ence|ant|ance|ary|ory)$", w) and n >= 3:
        p = "0" * (n - 3) + "100"
    elif re.search(r"^(a|be|de|re|en|em|im|in|un|con|com|dis|mis|ex|pre|pro|per)", w) and n == 2:
        p = "01"
    else:
        p = "1" + "0" * (n - 1)
    if n >= 4 and p[0] == "0" and p[1] == "0":
        p = "2" + p[1:]
    return p


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    cmu = load_cmu(sys.argv[1])
    vocab = Counter()
    with open(os.path.join(ROOT, "tools", "out", "vocab.txt")) as f:
        for line in f:
            w, c = line.rstrip("\n").split("\t")
            vocab[w] = int(c)
    finals = line_finals()
    rhymes = {}
    out = {}
    missing = Counter()
    for word, count in vocab.items():
        if word in EXTRA:
            out[word] = EXTRA[word]
            continue
        key = word.strip("'") if word.strip("'") in cmu else word
        prons = cmu.get(key) or cmu.get(word.replace("'", "")) or guess(word.strip("'") if not word.endswith("'d") else word, cmu)
        if not prons:
            missing[word] = count
            continue
        pats = []
        for ph in prons:
            s = stress(ph)
            if s and s not in pats:
                pats.append(s)
        if not pats:
            missing[word] = count
            continue
        out[word] = "|".join(pats)
        if word in finals:
            r = rhyme(prons[0])
            if r not in rhymes:
                rhymes[r] = len(rhymes)
            out[word] += ":" + base36(rhymes[r])
    # second pass: build what we can for the words still missing (not names)
    derived = 0
    for word in list(missing):
        if word[:1].isupper() or "'" in word.strip("'"):
            continue
        p = derive(word, {**out, **EXTRA})
        if p:
            out[word] = p
            derived += 1
            del missing[word]
    print(f"{derived} more words built from their parts or by rule")
    doc = {"r": list(rhymes), "w": out}
    with open(os.path.join(ROOT, "data", "dict.json"), "w") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ROOT, "tools", "out", "missing.txt"), "w") as f:
        for w, c in missing.most_common():
            f.write(f"{w}\t{c}\n")
    covered = sum(c for w, c in vocab.items() if w in out)
    total = sum(vocab.values())
    print(f"{len(out)} words kept, {len(missing)} missing; {covered / total:.2%} of running words covered")


def line_finals():
    """Words that end a line somewhere in the plays: the only ones that need a rhyme."""
    finals = set()
    pdir = os.path.join(ROOT, "data", "plays")
    for name in os.listdir(pdir):
        with open(os.path.join(pdir, name)) as f:
            play = json.load(f)
        for sc in play["scenes"]:
            for it in sc["items"]:
                if isinstance(it, dict):
                    for ln in it["l"]:
                        words = re.findall(r"[A-Za-z][A-Za-z']*", ln[1])
                        if words:
                            finals.add(words[-1].lower())
    return finals


def base36(n):
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    s = ""
    while True:
        n, r = divmod(n, 36)
        s = chars[r] + s
        if n == 0:
            return s


if __name__ == "__main__":
    main()
