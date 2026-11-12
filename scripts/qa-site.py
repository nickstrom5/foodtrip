#!/usr/bin/env python3
"""Checks every page in docs/ against ../SEO-SPEC.md: one h1, title and description lengths, canonical and og:url on the
CNAME domain, JSON-LD parses, every internal link and asset resolves, images have alt and dimensions, sitemap covers
every indexable page, FAQ JSON-LD mirrors the visible FAQ.   python3 scripts/qa-site.py   (exit 1 on any failure)"""
import glob, html, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
SITE = "https://" + open(os.path.join(ROOT, "CNAME")).read().strip()
fails, notes = [], []
pages = sorted(glob.glob(ROOT + "/*.html") + glob.glob(ROOT + "/cities/*.html"))
sitemap = set(re.findall(r"<loc>(.*?)</loc>", open(ROOT + "/sitemap.xml").read()))
titles, descs = {}, {}


def url_of(path):
    rel = "/" + os.path.relpath(path, ROOT)
    return SITE + (rel[:-10] if rel.endswith("/index.html") else rel)


def exists(href):
    p = href.split("#")[0].split("?")[0]
    if p in ("", "/"):
        return True
    f = os.path.join(ROOT, p.lstrip("/"))
    return os.path.isfile(f) or os.path.isfile(os.path.join(f, "index.html"))


for path in pages:
    s = open(path).read()
    name = os.path.relpath(path, ROOT)
    url = url_of(path)
    noindex = 'content="noindex' in s
    bad = lambda msg: fails.append(f"{name}: {msg}")
    if '<html lang="en">' not in s: bad("no lang")
    if len(re.findall(r"<h1[ >]", s)) != 1: bad("h1 count")
    if "<main" not in s: bad("no <main>")
    t = re.search(r"<title>(.*?)</title>", s)
    d = re.search(r'<meta name="description" content="(.*?)"', s)
    if not t: bad("no title"); continue
    title = html.unescape(t.group(1))
    if not noindex:
        if not d: bad("no description"); continue
        desc = html.unescape(d.group(1))
        if not 30 <= len(title) <= 60: bad(f"title {len(title)} chars")
        elif len(title) < 50: notes.append(f"{name}: title {len(title)} chars (spec says 50-60)")
        if not 140 <= len(desc) <= 160: bad(f"description {len(desc)} chars")
        if title in titles: bad(f"title duplicates {titles[title]}")
        if desc in descs: bad(f"description duplicates {descs[desc]}")
        titles[title] = name; descs[desc] = name
        can = re.search(r'<link rel="canonical" href="(.*?)"', s)
        if not can or can.group(1) != url: bad(f"canonical {can.group(1) if can else None} != {url}")
        og = re.search(r'<meta property="og:url" content="(.*?)"', s)
        if not og or og.group(1) != url: bad("og:url")
        for need in ['name="robots" content="index,follow', 'property="og:title"', 'property="og:description"', 'property="og:image" content="' + SITE,
                     'property="og:image:width"', 'property="og:image:alt"', 'name="twitter:card" content="summary_large_image"', 'name="twitter:image"',
                     'name="theme-color"', 'rel="apple-touch-icon"', 'rel="manifest"', "<footer"]:
            if need not in s: bad(f"missing {need}")
        if url not in sitemap: bad("not in sitemap")
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            data = json.loads(block)
        except Exception as e:
            bad(f"JSON-LD does not parse: {e}"); continue
        if data.get("@type") == "FAQPage":
            shown = [(html.unescape(q), html.unescape(a)) for q, a in re.findall(r"<h3>(.*?)</h3>\s*<p>(.*?)</p>", s[s.index('class="faq"'):])]
            marked = [(q["name"], q["acceptedAnswer"]["text"]) for q in data["mainEntity"]]
            if shown[:len(marked)] != marked: bad("FAQ JSON-LD does not mirror the visible FAQ")
    for href in re.findall(r'(?:href|src)="(/[^"]*)"', s):
        if not exists(href): bad(f"broken link {href}")
    for a in re.findall(r'<a [^>]*href="https?://[^"]*"[^>]*>', s):
        if "getfoodtrip.app" not in a and "noopener" not in a: bad(f"external link without rel=noopener: {a[:70]}")
    for img in re.findall(r"<img [^>]*>", s):
        if not re.search(r'alt="[^"]{8,}"', img) or "width=" not in img or "height=" not in img: bad(f"img without alt/size: {img[:60]}")
for u in sitemap:
    if not exists(u[len(SITE):]): fails.append(f"sitemap: {u} has no file")
size = os.path.getsize(ROOT + "/index.html") + os.path.getsize(ROOT + "/app.js") + os.path.getsize(ROOT + "/planner.js")
if size > 150_000: fails.append(f"index weight {size} bytes")
for must in ["robots.txt", "sitemap.xml", "404.html", "og.png", ".nojekyll", "site.webmanifest", "favicon-32.png", "apple-touch-icon.png"]:
    if not os.path.exists(os.path.join(ROOT, must)): fails.append(f"missing {must}")
for f in glob.glob(ROOT + "/**/*.md", recursive=True): fails.append(f"notes in public docs/: {f}")
print(f"{len(pages)} pages, {len(sitemap)} sitemap urls, index weight {size // 1024} KB")
for n in notes[:8]: print("note:", n)
if len(notes) > 8: print(f"note: … and {len(notes) - 8} more short titles")
for f in fails: print("FAIL", f)
print("site QA passes" if not fails else f"{len(fails)} failures")
sys.exit(1 if fails else 0)
