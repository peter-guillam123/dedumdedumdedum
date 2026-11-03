#!/usr/bin/env python3
"""Turn the MIT (Moby) Shakespeare texts into small JSON files for the site.

Usage:
    python3 tools/build_corpus.py CACHE_DIR

CACHE_DIR holds (or will be filled with) the MIT full.html files, one per play,
named <id>.html. Missing files are downloaded from the TheMITTech/shakespeare
repository on GitHub. The text is public domain.

Writes:
    data/plays/<id>.json   one file per play
    data/plays.json        list of plays with titles and characters
    data/speeches.json     index of speeches of six lines or more
    tools/out/vocab.txt    every word form, with counts (for build_dict.py)
"""
import html
import json
import os
import re
import sys
import urllib.request
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "https://raw.githubusercontent.com/TheMITTech/shakespeare/master/{}/full.html"

PLAYS = [
    # id, short title, genre
    ("allswell", "All's Well That Ends Well", "comedy"),
    ("asyoulikeit", "As You Like It", "comedy"),
    ("comedy_errors", "The Comedy of Errors", "comedy"),
    ("cymbeline", "Cymbeline", "comedy"),
    ("lll", "Love's Labour's Lost", "comedy"),
    ("measure", "Measure for Measure", "comedy"),
    ("merry_wives", "The Merry Wives of Windsor", "comedy"),
    ("merchant", "The Merchant of Venice", "comedy"),
    ("midsummer", "A Midsummer Night's Dream", "comedy"),
    ("much_ado", "Much Ado About Nothing", "comedy"),
    ("pericles", "Pericles", "comedy"),
    ("taming_shrew", "The Taming of the Shrew", "comedy"),
    ("tempest", "The Tempest", "comedy"),
    ("troilus_cressida", "Troilus and Cressida", "comedy"),
    ("twelfth_night", "Twelfth Night", "comedy"),
    ("two_gentlemen", "The Two Gentlemen of Verona", "comedy"),
    ("winters_tale", "The Winter's Tale", "comedy"),
    ("1henryiv", "Henry IV, Part 1", "history"),
    ("2henryiv", "Henry IV, Part 2", "history"),
    ("henryv", "Henry V", "history"),
    ("1henryvi", "Henry VI, Part 1", "history"),
    ("2henryvi", "Henry VI, Part 2", "history"),
    ("3henryvi", "Henry VI, Part 3", "history"),
    ("henryviii", "Henry VIII", "history"),
    ("john", "King John", "history"),
    ("richardii", "Richard II", "history"),
    ("richardiii", "Richard III", "history"),
    ("cleopatra", "Antony and Cleopatra", "tragedy"),
    ("coriolanus", "Coriolanus", "tragedy"),
    ("hamlet", "Hamlet", "tragedy"),
    ("julius_caesar", "Julius Caesar", "tragedy"),
    ("lear", "King Lear", "tragedy"),
    ("macbeth", "Macbeth", "tragedy"),
    ("othello", "Othello", "tragedy"),
    ("romeo_juliet", "Romeo and Juliet", "tragedy"),
    ("timon", "Timon of Athens", "tragedy"),
    ("titus", "Titus Andronicus", "tragedy"),
]

TOKEN = re.compile(
    r"<h3>(?P<head>.*?)</h3>"
    r"|<A NAME=speech\d+><b>(?P<speaker>.*?)</b></a>"
    r"|<A NAME=(?P<id>\d+\.\d+\.\d+)>(?P<line>.*?)</A>"
    r"|<i>(?P<sd>.*?)</i>",
    re.I | re.S,
)
WORD = re.compile(r"[A-Za-z][A-Za-z']*|'[A-Za-z]+")


def fetch(cache, pid):
    path = os.path.join(cache, pid + ".html")
    if not os.path.exists(path):
        with urllib.request.urlopen(SRC.format(pid)) as r, open(path, "wb") as f:
            f.write(r.read())
    with open(path, encoding="iso-8859-1") as f:
        return f.read()


def clean(s):
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s).replace("\r", "")


def classify(lines):
    """Verse or prose for one speech, from how the lines are printed.

    In this edition every verse line starts with a capital. Prose runs on, so
    its continuation lines usually start lower case. Returns 'v', 'p' or None
    (a single line, which we can't judge from print alone)."""
    if len(lines) < 2:
        return None
    rest = [t.lstrip() for _, t, _ in lines[1:]]
    lower = sum(1 for t in rest if t[:1].islower())
    if lower >= max(1, len(rest) * 0.25):
        return "p"
    if lower == 0:
        # Short prose speeches can start every line with a capital by chance;
        # long lines give them away.
        vowels = [len(re.findall(r"[aeiouy]+", t.lower())) for _, t, _ in lines]
        return "p" if sum(vowels) / len(vowels) > 14 else "v"
    return "v" if lower / len(rest) < 0.25 else "p"


def parse(pid, raw):
    scenes = []
    scene = None
    act_label = None
    speech = None
    cont = None
    for m in TOKEN.finditer(raw):
        if m.group("head") is not None:
            head = clean(m.group("head")).strip()
            if re.match(r"ACT\s", head, re.I):
                act_label = head
                continue
            scene = {"head": head, "items": []}
            scenes.append(scene)
            speech = None
            cont = None
        elif m.group("speaker") is not None:
            if scene is None:
                scene = {"head": "", "items": []}
                scenes.append(scene)
            speech = {"who": clean(m.group("speaker")).strip(), "lines": []}
            scene["items"].append(speech)
            cont = None
        elif m.group("id") is not None:
            a, s, n = (int(x) for x in m.group("id").split("."))
            text = clean(m.group("line"))
            indent = 1 if re.match(r"^\s{4,}", text) else 0
            text = re.sub(r"\s+", " ", text).strip()
            if speech is None:
                if not cont:
                    continue
                speech = {"who": cont, "lines": [], "cont": 1}
                scene["items"].append(speech)
            scene.setdefault("act", a)
            scene.setdefault("scene", s)
            speech["lines"].append((n, text, indent))
        elif m.group("sd") is not None and scene is not None:
            sd = re.sub(r"\s+", " ", clean(m.group("sd"))).strip()
            if sd:
                scene["items"].append(sd)
                # A direction mid-speech splits it; the same speaker carries on.
                if speech is not None:
                    cont = speech["who"]
                    speech = None
    out = []
    for sc in scenes:
        if "act" not in sc:
            continue
        items = []
        for it in sc["items"]:
            if isinstance(it, str):
                items.append(it)
            elif it["lines"]:
                form = classify(it["lines"])
                sp = {
                    "w": it["who"],
                    "f": form,
                    "l": [[n, t, ind] if ind else [n, t] for n, t, ind in it["lines"]],
                }
                if it.get("cont"):
                    sp["c"] = 1
                items.append(sp)
        # A one-line speech takes the form of its neighbours when they agree.
        speeches = [x for x in items if isinstance(x, dict)]
        for i, sp in enumerate(speeches):
            if sp["f"] is None:
                prev = next((speeches[j]["f"] for j in range(i - 1, -1, -1) if speeches[j]["f"]), None)
                nxt = next((speeches[j]["f"] for j in range(i + 1, len(speeches)) if speeches[j]["f"]), None)
                sp["f"] = prev if prev == nxt else (prev or nxt)
        loc = re.sub(r"^(SCENE\s+[IVXLC]+\.?|PROLOGUE\.?)\s*", "", sc["head"], flags=re.I).strip()
        out.append({"a": sc["act"], "s": sc["scene"], "head": sc["head"], "loc": loc, "items": items})
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    cache = sys.argv[1]
    os.makedirs(cache, exist_ok=True)
    os.makedirs(os.path.join(ROOT, "data", "plays"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "tools", "out"), exist_ok=True)
    vocab = Counter()
    index = []
    plays = []
    for pid, title, genre in PLAYS:
        scenes = parse(pid, fetch(cache, pid))
        who = Counter()
        for sc in scenes:
            for it in sc["items"]:
                if isinstance(it, dict):
                    who[it["w"]] += len(it["l"])
                    for _, t, *rest in it["l"]:
                        vocab.update(w.lower() for w in WORD.findall(t))
            for k, it in enumerate(sc["items"]):
                if isinstance(it, dict) and len(it["l"]) >= 6:
                    first = it["l"][0][1]
                    if len(first) > 60:
                        first = first[:58].rsplit(" ", 1)[0] + "…"
                    index.append([pid, sc["a"], sc["s"], it["l"][0][0], it["w"], first, len(it["l"]), it["f"]])
        doc = {"id": pid, "title": title, "genre": genre, "scenes": scenes}
        with open(os.path.join(ROOT, "data", "plays", pid + ".json"), "w") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        plays.append({"id": pid, "title": title, "genre": genre,
                      "characters": [w for w, _ in who.most_common() if who[w] >= 4]})
    with open(os.path.join(ROOT, "data", "plays.json"), "w") as f:
        json.dump(plays, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ROOT, "data", "speeches.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ROOT, "tools", "out", "vocab.txt"), "w") as f:
        for w, c in vocab.most_common():
            f.write(f"{w}\t{c}\n")
    print(f"{len(plays)} plays, {len(index)} speeches of 6+ lines, {len(vocab)} word forms")


if __name__ == "__main__":
    main()
