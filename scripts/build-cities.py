#!/usr/bin/env python3
"""Build FoodTrip's city data from the Eats Ranked apps' bundled data.

Reads ../<st>-eats/<App>/Resources/places.json (or Resources/Data/index.json + places-*.json) and Chicago's
../chi-eats/site/restaurants.json, keeps the places worth planning a trip around (a MICHELIN distinction, a James Beard
honor, a hand-checked Eats Ranked pick, or for Chicago a well-reviewed independent), and writes:

  docs/data/cities.json        the city list (web)
  docs/data/<city-id>.json     one city's places (web, loaded on demand)
  FoodTrip/Resources/cities.json   everything in one file (bundled in the iPhone app)

No network. Run from the foodtrip/ folder:  python3 scripts/build-cities.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.dirname(ROOT)
MIN_PICKS = 20      # a city needs this many places to plan a few days without repeats
MAX_PICKS = 160     # per city, best first
NYC = {"Manhattan", "Brooklyn", "Queens", "Bronx", "The Bronx", "Staten Island"}

STATES = {
    "ak": "AK", "al": "AL", "ar": "AR", "az": "AZ", "ca": "CA", "co": "CO", "ct": "CT", "dc": "DC", "de": "DE", "fl": "FL",
    "ga": "GA", "hi": "HI", "ia": "IA", "id": "ID", "in": "IN", "ks": "KS", "ky": "KY", "la": "LA", "ma": "MA", "md": "MD",
    "me": "ME", "mi": "MI", "mn": "MN", "mo": "MO", "ms": "MS", "mt": "MT", "nc": "NC", "nd": "ND", "ne": "NE", "nh": "NH",
    "nj": "NJ", "nm": "NM", "nv": "NV", "ny": "NY", "oh": "OH", "ok": "OK", "or": "OR", "pa": "PA", "ri": "RI", "sc": "SC",
    "sd": "SD", "tn": "TN", "tx": "TX", "ut": "UT", "va": "VA", "vt": "VT", "wa": "WA", "wi": "WI", "wv": "WV", "wy": "WY",
}

TZ = {"AK": "America/Anchorage", "HI": "Pacific/Honolulu", "AZ": "America/Phoenix",
      **{k: "America/Los_Angeles" for k in ["CA", "NV", "OR", "WA"]},
      **{k: "America/Denver" for k in ["CO", "ID", "MT", "NM", "UT", "WY"]},
      **{k: "America/Chicago" for k in ["AL", "AR", "IA", "IL", "KS", "LA", "MN", "MO", "MS", "ND", "NE", "OK", "SD", "TN", "TX", "WI"]}}
TZ_CITY = {("Knoxville", "TN"): "America/New_York", ("Chattanooga", "TN"): "America/New_York", ("El Paso", "TX"): "America/Denver"}

# meal slots, as a bitmask: 1 breakfast, 2 lunch, 4 dinner, 8 snack (coffee, pastry, a treat between meals)
B, L, D, S = 1, 2, 4, 8
MEALS = {
    "Breakfast & Diner": B | L,
    "Coffee & Café": B | S,
    "Bakery & Sweets": B | S,
    "Desserts": S,
    "Ice Cream & Desserts": S,
    "Hot Dogs & Sausages": L | S,
    "Burgers": L | D,
    "Pizza": L | D,
    "Chicken & Wings": L | D,
    "Steakhouse": D,
    "Bar & Pub": D,
}
# price tier estimate when the source has none (1 under $20 a person, 2 $20-40, 3 $40-80, 4 $80+)
CHEAP = {"Coffee & Café", "Bakery & Sweets", "Desserts", "Ice Cream & Desserts", "Hot Dogs & Sausages", "Burgers",
         "Chicken & Wings", "Mexican", "Pizza", "Breakfast & Diner"}
PRICEY = {"Steakhouse", "Seafood"}


def meals_for(cuisine, price):
    m = MEALS.get(cuisine, L | D)
    if price >= 4:
        m &= D          # tasting menus are dinner
    return m or D


def est_price(cuisine, mi, jbf_flags):
    if cuisine == "BBQ":
        return 2            # even the starred Texas joints sell by the pound
    if mi >= 3:
        return 4
    if cuisine in CHEAP:
        return 1            # a recommended bakery or taqueria is still a bakery or taqueria
    if mi == 1:
        return 3
    if mi == 2:
        return 2            # Bib Gourmand is MICHELIN's good-value list
    if cuisine in PRICEY or jbf_flags & 2:
        return 3
    return 2


MICHELIN = {1: "MICHELIN Recommended", 2: "Bib Gourmand", 3: "1 MICHELIN Star", 4: "2 MICHELIN Stars", 5: "3 MICHELIN Stars"}


def jbf_label(h):
    if h & 1:
        return "James Beard America's Classic"
    if h & 2:
        return "James Beard winner"
    if h & 4:
        return "James Beard finalist"
    if h & 8:
        return "James Beard semifinalist"
    return None


def rank(mi, h, hc, oldest):
    s = {5: 100, 4: 96, 3: 92, 2: 80, 1: 66}.get(mi, 0)
    s = max(s, 88 if h & 2 else 0, 86 if h & 1 else 0, 78 if h & 4 else 0, 72 if h & 8 else 0)
    if hc:
        s = max(s, 58) + 2
    if oldest:
        s += 4
    return s


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def tag_bit(header, name):
    """the bit for a named guide tag: a list (bit = 1 << index) or a dict of name -> bit"""
    t = header.get("tags") or header.get("guides")
    if isinstance(t, list) and name in t:
        return 1 << t.index(name)
    if isinstance(t, dict):
        return t.get(name, 0)
    return 0


def state_places(st):
    """(place dict, city name, cuisine name, oldest bit) for every place in one state's bundled data"""
    head = glob.glob(f"{SRC}/{st}-eats/*/Resources/places.json")
    if head:
        d = json.load(open(head[0]))
        cities, cuis, ob = d.get("cities") or [], d.get("cuisines") or [], tag_bit(d, "oldest")
        for p in d["places"]:
            yield p, cities, cuis, ob
        return
    idx = glob.glob(f"{SRC}/{st}-eats/*/Resources/Data/index.json")
    if not idx:
        return
    ix = json.load(open(idx[0]))
    cuis, ob = ix.get("cuisines") or [], tag_bit(ix, "oldest")
    for f in sorted(glob.glob(os.path.join(os.path.dirname(idx[0]), "places-*.json"))):
        d = json.load(open(f))
        if not isinstance(d, dict) or "places" not in d:
            continue
        for p in d["places"]:
            yield p, d.get("cities") or ix.get("cities") or [], cuis, ob


def build_states(out):
    for st, abbr in STATES.items():
        n = 0
        for p, cities, cuis, ob in state_places(st):
            mi, h, hc = p.get("mi") or 0, p.get("h") or 0, p.get("hc") == 1
            if not (mi or h or hc) or p.get("la") is None or p.get("lo") is None:
                continue
            if (p.get("ch") or 0) >= 5:
                continue
            c = p.get("c")
            city = cities[c] if isinstance(c, int) and c < len(cities) else None
            if not city:
                continue
            hood = None
            if st == "dc":                      # DC's data names neighborhoods, not cities
                city, hood = "Washington", city
            elif st == "ny" and city in NYC:    # one New York City, boroughs as neighborhoods
                city, hood = "New York City", city
            cu = cuis[p["cu"]] if isinstance(p.get("cu"), int) and p["cu"] < len(cuis) else "American & Other"
            oldest = bool(ob and (p.get("g") or 0) & ob)
            price = est_price(cu, mi, h)
            honor = MICHELIN.get(mi) or jbf_label(h) or ("Open since 1960 or earlier" if oldest else "Eats Ranked pick")
            why = p.get("dish") or p.get("note") or p.get("jbf")
            out.setdefault((city, abbr), []).append({
                "id": f"{st}-{p['id']}", "n": p.get("aka") and p["n"] or p["n"], "a": p.get("a") or "", "z": p.get("z") or "",
                "la": round(p["la"], 5), "lo": round(p["lo"], 5), "cu": cu, "p": price, "pe": 1, "m": meals_for(cu, price),
                "hl": honor, "w": why, "r": rank(mi, h, hc, oldest), "hd": hood,
            })
            n += 1
        if n:
            print(f"  {st}: {n} places", file=sys.stderr)


def build_chicago(out):
    f = f"{SRC}/chi-eats/site/restaurants.json"
    if not os.path.exists(f):
        return
    d = json.load(open(f))
    cols = d["cols"]
    n = 0
    for row in d["rows"]:
        r = dict(zip(cols, row))
        if r["venue"] or r["lat"] is None or (r["chain_n"] or 1) > 2:
            continue
        mi = {1: 3, 2: 4, 3: 5}.get(r["mich"] or 0, 0) or (2 if r["bib"] else 0)
        jbf = r["jbf"] or ""
        h = (1 if "America's Classic" in jbf else 0) | (2 if " win" in jbf else 0) | (4 if "finalist" in jbf else 0) | (8 if "semifinal" in jbf else 0)
        rating, reviews = r["rating"] or 0, r["reviews"] or 0
        good = rating >= 4.6 and reviews >= 200 and r["dinein"] != 0
        if not (mi or h or jbf or r["icon"] or r["honors"] or good):
            continue
        cu = r["cuisine"] or "American & Other"
        price = r["price"] or est_price(cu, mi, h)
        if mi >= 3:
            price = max(price, 4 if mi >= 4 else 3)
        honor = MICHELIN.get(mi) or jbf_label(h) or (r["honors"] or "").split(";")[0] or (f"{rating:.1f}★ from {reviews:,} reviews" if good else "Chicago icon")
        s = rank(mi, h, bool(r["icon"]), False)
        if not s:
            s = 40 + int((rating - 4.5) * 40) + min(10, reviews // 300)
        out.setdefault(("Chicago", "IL"), []).append({
            "id": f"chi-{r['id']}", "n": r["name"], "a": r["addr"] or "", "z": r["zip"] or "", "la": round(r["lat"], 5),
            "lo": round(r["lon"], 5), "cu": cu, "p": price, "pe": 0 if r["price"] and not r["price_est"] else 1,
            "m": meals_for(cu, price), "hl": honor, "w": r["icon"] or (jbf or None), "r": s, "hd": r["hood"],
        })
        n += 1
    print(f"  chicago: {n} places", file=sys.stderr)


def main():
    out = {}
    build_states(out)
    build_chicago(out)
    cities = []
    for (name, st), places in out.items():
        seen, uniq = set(), []
        for p in sorted(places, key=lambda p: -p["r"]):
            k = (p["n"].lower(), p["a"].lower())
            if k not in seen:
                seen.add(k)
                uniq.append(p)
        # need enough of each meal to fill a few days
        if len(uniq) < MIN_PICKS or sum(1 for p in uniq if p["m"] & D) < 8:
            continue
        uniq = uniq[:MAX_PICKS]
        for p in uniq:
            for k in ("w", "hd"):
                if not p.get(k):
                    p.pop(k, None)
        lat = sum(p["la"] for p in uniq) / len(uniq)
        lon = sum(p["lo"] for p in uniq) / len(uniq)
        tz = TZ_CITY.get((name, st)) or TZ.get(st, "America/New_York")
        cities.append({"id": slug(f"{name}-{st}"), "name": name, "st": st, "tz": tz, "la": round(lat, 4), "lo": round(lon, 4),
                       "count": len(uniq), "places": uniq})
    cities.sort(key=lambda c: (-c["count"], c["name"]))
    gen = "2026-11-11"
    os.makedirs(f"{ROOT}/docs/data", exist_ok=True)
    for old in glob.glob(f"{ROOT}/docs/data/*.json"):
        os.remove(old)
    for c in cities:
        json.dump({"id": c["id"], "name": c["name"], "st": c["st"], "tz": c["tz"], "places": c["places"]},
                  open(f"{ROOT}/docs/data/{c['id']}.json", "w"), separators=(",", ":"), ensure_ascii=False)
    idx = [{k: v for k, v in c.items() if k != "places"} for c in cities]
    json.dump({"generated": gen, "cities": idx}, open(f"{ROOT}/docs/data/cities.json", "w"), separators=(",", ":"), ensure_ascii=False)
    os.makedirs(f"{ROOT}/FoodTrip/Resources", exist_ok=True)
    json.dump({"generated": gen, "cities": cities}, open(f"{ROOT}/FoodTrip/Resources/cities.json", "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"{len(cities)} cities, {sum(c['count'] for c in cities)} places", file=sys.stderr)
    for c in cities[:40]:
        print(f"  {c['name']}, {c['st']}: {c['count']}", file=sys.stderr)


if __name__ == "__main__":
    main()
