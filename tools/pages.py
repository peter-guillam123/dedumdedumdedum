#!/usr/bin/env python3
"""Wrap each page's main content in the shared head, header and footer.

Usage: python3 tools/pages.py

Page bodies live in pages/<name>.html with a first-line JSON header:
    <!-- {"title": "...", "description": "...", "script": "room", "nav": "Rehearse"} -->
Output goes to <name>.html at the site root. Edit the body files, not the output.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAV = [("learn.html", "Learn"), ("play.html", "Play"), ("room.html", "Rehearse"), ("today.html", "Today"), ("about.html", "About")]

HEAD = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<link rel="icon" href="assets/img/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/site.css">
<script>try{{var t=JSON.parse(localStorage.getItem("dedum:theme"));if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}}catch(e){{}}</script>
<script type="module" src="assets/js/site.js"></script>
{script}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="site-head__inner">
  <a class="mark" href="./" aria-label="dedumdedumdedum, home"><span class="de">de</span><span class="dum">dum</span><span class="de">de</span><span class="dum">dum</span><span class="de">de</span><span class="dum">dum</span><span class="de">de</span><span class="dum">dum</span></a>
  <nav class="site-nav" aria-label="Main"><ul>
{nav}
  </ul></nav>
</div></header>

<main id="main">
{body}
</main>

<footer class="site-foot"><div class="wrap--wide">
  <p>Made by Chris Moran, with Claude. Texts from the MIT Shakespeare (public domain). <a href="about.html">About this site</a></p>
  <p><label for="theme">Look</label><select id="theme"><option value="auto">Match my device</option><option value="light">Light</option><option value="dark">Dark</option></select></p>
</div></footer>
</body>
</html>
"""


def main():
    src = os.path.join(ROOT, "pages")
    for name in sorted(os.listdir(src)):
        if not name.endswith(".html"):
            continue
        raw = open(os.path.join(src, name), encoding="utf-8").read()
        m = re.match(r"<!--\s*(\{.*?\})\s*-->\n", raw)
        meta = json.loads(m.group(1))
        body = raw[m.end():].rstrip()
        nav = "\n".join(
            f'    <li><a href="{href}"{" aria-current=\"page\"" if label == meta.get("nav") else ""}>{label}</a></li>'
            for href, label in NAV
        )
        script = f'<script type="module" src="assets/js/pages/{meta["script"]}.js"></script>\n' if meta.get("script") else ""
        if meta.get("css"):
            script = f'<link rel="stylesheet" href="assets/css/{meta["css"]}.css">\n' + script
        html = HEAD.format(title=meta["title"], description=meta["description"], script=script, nav=nav, body=body)
        with open(os.path.join(ROOT, name), "w", encoding="utf-8") as f:
            f.write(html)
        print("wrote", name)


if __name__ == "__main__":
    main()
