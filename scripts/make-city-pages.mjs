// Writes the static pages search engines can read: docs/cities/<city-id>.html (a sample 3-day plan and the city's other
// picks), docs/cities/index.html (every city) and docs/sitemap.xml. The plan on each page is made by docs/planner.js, so
// it is the same plan the web app gives for 3 meals a day at $120 with seed 1.
//   node scripts/make-city-pages.mjs        (after scripts/build-cities.py; don't edit docs/cities/ by hand)
import fs from "node:fs";
import vm from "node:vm";

const here = new URL("..", import.meta.url).pathname;
const SITE = "https://getfoodtrip.app";
const TODAY = new Date().toISOString().slice(0, 10);
vm.runInThisContext(fs.readFileSync(here + "docs/planner.js", "utf8"));
const P = globalThis.FoodTripPlanner;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const fmtTime = (hm) => { const [h, m] = hm.split(":").map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const SAMPLE = { meals: 3, budget: 120, seed: 1, days: 3 };

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests">`;
const STYLE = `<style>
  :root { --bg: #FBF6EF; --surface: #fff; --fg: #241B14; --muted: rgba(36,27,20,.72); --accent: #D9472B; --accent-ink: #B5361D; --on-accent: #fff; --line: rgba(40,28,18,.12);
    --herb: #2F6B4F; --herb-bg: #E3EFE7; --gold: #8A5A00; --gold-bg: #FBEFD3; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root { --bg: #17130F; --surface: #221C17; --fg: #F6EEE5; --muted: rgba(246,238,229,.74); --accent: #F0684B; --accent-ink: #FF8A70; --on-accent: #1A0D08;
    --line: rgba(255,240,225,.12); --herb: #7CC39D; --herb-bg: rgba(124,195,157,.14); --gold: #F2C46B; --gold-bg: rgba(242,196,107,.13); color-scheme: dark; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 56px; }
  header.top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 16px 0; }
  .brand { font-weight: 800; font-size: 20px; letter-spacing: -.02em; color: var(--fg); text-decoration: none; }
  nav a { margin-left: 16px; font-size: 15px; } nav a:first-child { margin-left: 0; }
  a { color: var(--accent-ink); }
  a:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 2px; }
  .crumbs { font-size: 14px; color: var(--muted); margin: 8px 0 0; }
  h1 { font-size: clamp(30px, 6vw, 42px); line-height: 1.1; letter-spacing: -.03em; margin: 12px 0; }
  h2 { font-size: 24px; letter-spacing: -.02em; margin: 36px 0 8px; }
  h3 { font-size: 18px; margin: 0; }
  .lede { font-size: 18px; color: var(--muted); }
  .btn { display: inline-block; background: var(--accent); color: var(--on-accent); font-weight: 700; text-decoration: none; border-radius: 999px; padding: 12px 22px; margin: 8px 0; }
  .stop { background: var(--surface); border-radius: 16px; padding: 14px 16px; margin: 10px 0; }
  .when { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 0 0 2px; }
  .meta { color: var(--muted); font-size: 15px; margin: 2px 0 6px; }
  .badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--herb-bg); color: var(--herb); }
  .badge.mich { background: var(--gold-bg); color: var(--gold); }
  .why { font-size: 15px; color: var(--muted); margin: 6px 0 0; }
  ul.more { padding-left: 20px; } ul.more li { margin: 4px 0; } ul.more span { color: var(--muted); }
  ul.cities { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
  ul.cities a { display: block; background: var(--surface); border-radius: 14px; padding: 12px 14px; text-decoration: none; font-weight: 650; }
  ul.cities span { display: block; font-weight: 400; font-size: 14px; color: var(--muted); }
  .note { font-size: 14px; color: var(--muted); }
  footer { border-top: 1px solid var(--line); margin-top: 44px; padding-top: 16px; font-size: 14px; color: var(--muted); }
</style>`;

function head({ title, description, path, type = "article" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CSP}
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${SITE}${path}">
<meta name="theme-color" content="#FBF6EF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17130F" media="(prefers-color-scheme: dark)">
<meta property="og:site_name" content="FoodTrip">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="FoodTrip: plan where to eat on your trip.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${STYLE}`;
}
const TOP = `<header class="top"><a class="brand" href="/">FoodTrip</a><nav aria-label="Site"><a href="/">Plan a trip</a><a href="/cities/">Cities</a><a href="/support.html">Support</a></nav></header>`;
const FOOT = `<footer><p>Restaurant data from <a href="https://eatsranked.com/" rel="noopener">Eats Ranked</a>: public records, MICHELIN Guide and James Beard Foundation honors. FoodTrip is not affiliated with the MICHELIN Guide, the James Beard Foundation or OpenTable.</p>
<p><a href="/">FoodTrip</a> · <a href="/cities/">Cities</a> · <a href="/support.html">Support</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · © 2026 FoodTrip</p></footer>`;

// keep a title inside 60 characters: drop the brand, then the "3-Day" detail, for long city names
function cityTitle(name) {
  for (const t of [`Where to Eat in ${name}: 3-Day Food Itinerary | FoodTrip`, `Where to Eat in ${name}: 3-Day Food Itinerary`, `Where to Eat in ${name}: Food Itinerary`]) if (t.length <= 60) return t;
  return `Where to Eat in ${name}`;
}
// 140-160 characters, built from true counts
function cityDescription(c, counts, full) {
  const honors = [counts.michelin && `${counts.michelin} with a MICHELIN Guide distinction`, counts.beard && `${counts.beard} with a James Beard honor`].filter(Boolean).join(", ");
  const base = `A 3-day ${c.label || c.name} food itinerary from ${c.places.length} picks${honors ? `: ${honors}` : ""}.`;
  // only promise breakfast where the sample plan has one every day
  const tails = full ? [" Breakfast, lunch and dinner, planned around your budget.", " Three meals a day, planned around your budget."] : [" Lunch and dinner every day, planned around your budget."];
  for (const tail of [...tails, " Planned around your budget.", ""]) {
    const d = base + tail;
    if (d.length <= 160) return d.length >= 140 ? d : (d + " Free to use, no account.").slice(0, 160);
  }
  return base.slice(0, 157) + "…";
}

const index = JSON.parse(fs.readFileSync(here + "docs/data/cities.json", "utf8")).cities;
fs.rmSync(here + "docs/cities", { recursive: true, force: true });
fs.mkdirSync(here + "docs/cities", { recursive: true });
const made = [];

// two Portlands: a name shared by two cities carries its state in the title, heading and description
const shared = new Set(index.map((c) => c.name).filter((n, i, all) => all.indexOf(n) !== i));

for (const ci of index) {
  const c = JSON.parse(fs.readFileSync(here + `docs/data/${ci.id}.json`, "utf8"));
  const label = shared.has(c.name) ? `${c.name}, ${c.st}` : c.name;
  const plan = P.plan(c, { start: "2026-01-02", end: P.addDays("2026-01-02", SAMPLE.days - 1), ...SAMPLE });
  const counts = { michelin: c.places.filter((p) => /MICHELIN|Bib/.test(p.hl)).length, beard: c.places.filter((p) => /James Beard/.test(p.hl)).length };
  const path = `/cities/${c.id}.html`;
  const title = cityTitle(label);
  const full = plan.days.every((d) => d.missing.length === 0);
  const description = cityDescription({ ...c, label }, counts, full);
  const inPlan = new Set();
  const days = plan.days.map((day) => {
    const stops = day.stops.map((s) => {
      inPlan.add(s.place.id);
      const p = s.place;
      return `<div class="stop"><p class="when">${fmtTime(s.time)} · ${esc(s.label)}</p><h3>${esc(p.n)}</h3>
<p class="meta">${esc(p.cu)} · ${P.PRICE[p.p]} · about $${s.cost} a person${p.hd ? " · " + esc(p.hd) : ""}${p.a ? " · " + esc(p.a) : ""}</p>
<span class="badge${/MICHELIN|Bib/.test(p.hl) ? " mich" : ""}">${esc(p.hl)}</span>${p.w ? `<p class="why">${esc(p.w)}</p>` : ""}</div>`;
    }).join("\n");
    const missing = day.missing.length ? `<p class="note">FoodTrip has no ${day.missing.join(" or ")} pick left in ${esc(c.name)} for this day.</p>` : "";
    return `<h2>Day ${day.index + 1}: about $${day.spent} a person</h2>\n${stops}${missing}`;
  }).join("\n");
  const rest = c.places.filter((p) => !inPlan.has(p.id)).slice(0, 40);
  const more = rest.map((p) => `<li>${esc(p.n)} <span>· ${esc(p.cu)} · ${P.PRICE[p.p]} · ${esc(p.hl)}</span></li>`).join("\n");
  const honorLine = [counts.michelin && `${counts.michelin} hold a MICHELIN Guide distinction`, counts.beard && `${counts.beard} carry a James Beard Foundation honor`].filter(Boolean).join(" and ");
  const planLink = `/#${new URLSearchParams({ c: c.id, m: SAMPLE.meals, b: SAMPLE.budget, n: 2, r: SAMPLE.seed })}`;
  const stopsFlat = plan.days.flatMap((d) => d.stops);
  const json = [
    { "@context": "https://schema.org", "@type": "Article", headline: title.replace(" | FoodTrip", ""), description, datePublished: "2026-11-12", dateModified: TODAY,
      mainEntityOfPage: SITE + path, image: SITE + "/og.png", author: { "@type": "Organization", name: "FoodTrip", url: SITE + "/" }, publisher: { "@type": "Organization", name: "FoodTrip", url: SITE + "/", logo: { "@type": "ImageObject", url: SITE + "/icon-512.png" } } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "FoodTrip", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Cities", item: SITE + "/cities/" }, { "@type": "ListItem", position: 3, name: c.name, item: SITE + path }] },
    { "@context": "https://schema.org", "@type": "ItemList", name: `A 3-day food itinerary for ${c.name}`, numberOfItems: stopsFlat.length, itemListElement: stopsFlat.map((s, i) => ({ "@type": "ListItem", position: i + 1,
      item: { "@type": "Restaurant", name: s.place.n, servesCuisine: s.place.cu, address: { "@type": "PostalAddress", ...(s.place.a ? { streetAddress: s.place.a } : {}), addressLocality: c.name, addressRegion: c.st, ...(s.place.z ? { postalCode: s.place.z } : {}), addressCountry: "US" } } })) },
  ];
  const html = `${head({ title, description, path })}
${json.map(ld).join("\n")}
</head>
<body>
<div class="wrap">
${TOP}
<main>
<p class="crumbs"><a href="/">FoodTrip</a> › <a href="/cities/">Cities</a> › ${esc(c.name)}</p>
<h1>Where to eat in ${esc(label)}: a 3-day food itinerary</h1>
<p class="lede">Three days of ${full ? "breakfast, lunch and dinner" : "lunch and dinner, with breakfast where FoodTrip has a pick,"} in ${esc(c.name)}, ${esc(c.st)}, at about $${SAMPLE.budget} a person a day. FoodTrip built it from its ${c.places.length} picks in the city${honorLine ? `, of which ${honorLine}` : ""}.</p>
<p><a class="btn" href="${esc(planLink)}">Plan ${esc(c.name)} for your dates and budget</a></p>
${days}
<p class="note">About $${plan.total} a person for the three days. Prices are estimates for food, tax and tip, without drinks. Times are suggestions: check each restaurant's hours and book ahead.</p>
<h2>${rest.length ? `${rest.length} more places to eat in ${esc(c.name)}` : `More about ${esc(c.name)}`}</h2>
${rest.length ? `<p>The planner swaps any stop for one of these, and uses them when your dates, meals or budget are different.</p>\n<ul class="more">\n${more}\n</ul>` : ""}
<h2>How this plan was made</h2>
<p>Every place on this page holds a MICHELIN Guide distinction or a James Beard Foundation honor, or was checked by hand for <a href="https://eatsranked.com/" rel="noopener">Eats Ranked</a>. Chains are left out and no restaurant pays to be listed. For each day FoodTrip picks dinner first, then lunch and breakfast, keeps to the budget, uses a different cuisine each meal and keeps the day's stops close together. No place appears twice.</p>
<p>This is one plan out of many. <a href="${esc(planLink)}">Open it in the planner</a> to set your own dates, meals a day, budget and party size, swap any stop, reserve a table and add the meals to your calendar. See <a href="/cities/">every city FoodTrip covers</a>.</p>
</main>
${FOOT}
</div>
</body>
</html>
`;
  fs.writeFileSync(here + `docs/cities/${c.id}.html`, html);
  made.push({ c, path, title, description, counts });
}

// the cities index
{
  const title = "Food Itineraries by City: Where to Eat in 40+ US Cities";
  const description = `Sample 3-day food itineraries for ${made.length} US cities, from New York and Chicago to Austin and Honolulu, built from award-winning and hand-checked restaurants.`;
  const items = made.slice().sort((a, b) => a.c.name.localeCompare(b.c.name));
  const html = `${head({ title, description, path: "/cities/", type: "website" })}
${ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "FoodTrip", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Cities", item: SITE + "/cities/" }] })}
${ld({ "@context": "https://schema.org", "@type": "ItemList", name: "FoodTrip cities", numberOfItems: items.length, itemListElement: items.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: `${m.c.name}, ${m.c.st}`, url: SITE + m.path })) })}
</head>
<body>
<div class="wrap">
${TOP}
<main>
<p class="crumbs"><a href="/">FoodTrip</a> › Cities</p>
<h1>Where to eat, city by city</h1>
<p class="lede">FoodTrip plans food trips in ${items.length} US cities. Each page below is a sample 3-day itinerary, with every other pick in that city listed under it.</p>
<p><a class="btn" href="/">Plan a trip for your dates</a></p>
<h2>Cities</h2>
<ul class="cities">
${items.map((m) => `<li><a href="${m.path}">${esc(m.c.name)}, ${esc(m.c.st)}<span>${m.c.places.length} places</span></a></li>`).join("\n")}
</ul>
<p class="note">A city is listed once FoodTrip has enough picks there to fill a few days without repeating a place. More are added as Eats Ranked covers more of the country.</p>
</main>
${FOOT}
</div>
</body>
</html>
`;
  fs.writeFileSync(here + "docs/cities/index.html", html);
}

// sitemap: the fixed pages, the cities index and every city
const fixed = ["/", "/cities/", "/support.html", "/privacy.html", "/terms.html"].filter((p) => p.endsWith("/") || fs.existsSync(here + "docs" + p));
const urls = [...fixed, ...made.map((m) => m.path)];
fs.writeFileSync(here + "docs/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
// the city links for the home page (pasted between the CITY-LINKS markers by this script)
const home = fs.readFileSync(here + "docs/index.html", "utf8");
const links = made.slice().sort((a, b) => a.c.name.localeCompare(b.c.name)).map((m) => `<li><a href="${m.path}">${esc(m.c.name)}</a></li>`).join("\n");
const marked = home.replace(/(<!-- CITY-LINKS -->)[\s\S]*?(<!-- \/CITY-LINKS -->)/, `$1\n${links}\n$2`);
if (marked !== home) fs.writeFileSync(here + "docs/index.html", marked);
const bad = made.filter((m) => m.title.length > 60 || m.description.length > 160 || m.description.length < 120);
console.log(`${made.length} city pages, ${urls.length} sitemap urls${bad.length ? `, ${bad.length} with title/description out of range: ${bad.map((m) => m.c.id + " " + m.title.length + "/" + m.description.length).join(", ")}` : ""}`);
