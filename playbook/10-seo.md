# SEO: what the site has, and what to do after it is live

Built 2026-11-12 to `../../SEO-SPEC.md`. `python3 scripts/qa-site.py` checks all of it and must pass before a push.

## What is there

- **Home** (`docs/index.html`): the planner, then How it works, the iPhone screenshots, Price, Privacy, an 8-question
  FAQ and links to every city page. JSON-LD: `SoftwareApplication` (offers: website $0, Unlimited Trips $1.99),
  `Organization`, `WebSite`, `FAQPage`. The FAQ JSON-LD must mirror the visible FAQ word for word; the QA script
  compares them. Prices must match `FoodTrip/Resources/Products.storekit`.
- **City pages** (`docs/cities/<id>.html`, one per city, plus `docs/cities/index.html`): "Where to eat in <City>: a
  3-day food itinerary". Each shows the plan the web app gives for 3 meals a day at $120 with seed 1, then up to 40
  more picks, with `Article`, `BreadcrumbList` and `ItemList` (of `Restaurant`) JSON-LD. They are the pages meant to
  rank for "where to eat in <city>" and "<city> food itinerary".
- `docs/privacy.html`, `docs/support.html`, `docs/terms.html`, `docs/404.html` (noindex), `robots.txt`,
  `sitemap.xml`, `og.png`, icons, `site.webmanifest`.

## Regenerating

City pages, the home page's city links and `sitemap.xml` are written by `node scripts/make-city-pages.mjs`. Run it
after `scripts/build-cities.py` or any change to `docs/planner.js`, then `python3 scripts/qa-site.py`. Don't edit
`docs/cities/` by hand. The home page's city links sit between the `CITY-LINKS` comment markers.

## Rules the pages follow

- Only true counts: the numbers in each description and intro are computed from the city's data.
- A page only says "breakfast, lunch and dinner" when the sample plan has all three every day.
- Two cities with one name (Portland) carry the state in the title and heading.
- No ratings or review markup: FoodTrip has none, and inventing them breaks search-engine policy.

## After launch (Nick)

- [ ] Google Search Console: add `getfoodtrip.app` as a Domain property (DNS TXT record in Cloudflare), then submit
      `https://getfoodtrip.app/sitemap.xml`.
- [ ] Bing Webmaster Tools: import the site from Search Console and submit the same sitemap.
- [ ] Request indexing for the home page, `/cities/` and three or four of the biggest city pages.
- [ ] When the iPhone app is on the App Store: uncomment the `apple-itunes-app` meta in `docs/index.html` (the ID,
      6833681053, is already filled in), replace "iPhone app coming soon" with the App Store link, and change the
      screenshots section's "coming to the App Store" line.
- [ ] Link to getfoodtrip.app from eatsranked.com and the portfolio; those are the first real inbound links.

## Known gaps

- Fifteen cities have fewer than three breakfast picks; their pages say "lunch and dinner". More breakfast places
  in the Eats Ranked data fixes both the pages and the planner.
- City page titles for short names are under the spec's 50 characters (the QA script notes, doesn't fail, these).
- No IndexNow key yet (Good Walk has one); add it if Bing indexing is slow.
