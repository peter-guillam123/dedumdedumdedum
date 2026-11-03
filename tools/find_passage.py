#!/usr/bin/env python3
"""Find a passage in the plays by the start of its first line.

Usage: python3 tools/find_passage.py PLAY "first words" [N_LINES]
Prints act.scene.line references and text, so library entries can cite
exact lines instead of quoting from memory.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
play, words = sys.argv[1], sys.argv[2].lower()
n = int(sys.argv[3]) if len(sys.argv) > 3 else 6
doc = json.load(open(os.path.join(ROOT, "data", "plays", play + ".json")))
for sc in doc["scenes"]:
    flat = []
    for it in sc["items"]:
        if isinstance(it, dict):
            for ln in it["l"]:
                flat.append((it["w"], it["f"], ln[0], ln[1]))
    for i, (who, f, num, text) in enumerate(flat):
        if text.lower().startswith(words):
            print(f"== {play} {sc['a']}.{sc['s']}.{num} {who} ({f})")
            for who2, f2, num2, t2 in flat[i:i + n]:
                print(f"  {num2:>4} {who2[:12]:<12} {t2}")
