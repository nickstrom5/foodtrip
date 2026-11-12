# FoodTrip

**Plan where to eat on your trip.** Pick a city, your dates, how many meals a day and a budget. FoodTrip plans every
meal, then helps you book it and put it on your calendar. A website (getfoodtrip.app) and an iPhone app that give the
same plan for the same inputs.

- `docs/` — **the public site and web app**, served by GitHub Pages at the domain in `docs/CNAME`. Static: `index.html`,
  `app.js` (form, itinerary, links, calendar file, share link), `planner.js` (the planning), `data/` (one JSON per city).
  No build step, no third-party scripts, no tracking.
- `FoodTrip/` — the iPhone app (SwiftUI, iOS 17+). `Models/Planner.swift` is `docs/planner.js` in Swift.
- `FoodTripTests/` — unit tests, including one that proves the app's plans equal the website's.
- `scripts/` — `build-cities.py` (data), `test-planner.mjs` (web planner checks + the shared test vectors),
  `make-city-pages.mjs` (the static city pages and sitemap), `qa-site.py` (SEO and link checks on every page),
  `make-assets.py` and `make-brand.swift` (colors, icons).
- `playbook/` — internal notes, not served. `05-naming.md` is the name and domain check.

## What it does

1. **Inputs:** city (42 US cities), arrive and leave dates (up to 14 days), 1–4 meals a day, a food budget per person per
   day, party size.
2. **Plan:** for each day, dinner is chosen first, then lunch, breakfast and an afternoon treat, each from places that suit
   that meal. A pick has to fit what is left of the day's budget after setting aside the cheapest option for every meal
   still to fill. Higher-ranked places win; a cuisine already used is penalised (more so the same day); places far from
   the day's dinner are penalised. No place is used twice. If nothing fits, the cheapest place is used and the day says
   how far over budget it is.
3. **Itinerary:** a day-by-day list with a suggested time per meal, the honor behind each pick and an estimated cost.
4. **Act on it:** Reserve (OpenTable search with the date, time and party size filled in), other ways to book (a web
   search for the restaurant's own booking page), directions, add one meal or every meal to the calendar, swap a stop for
   the next-best alternative, shuffle the whole plan, share a link that reopens the same plan.

Reservations are links out. FoodTrip does not hold a booking itself: that needs a partner agreement with OpenTable, Resy
or Tock (see "Next").

## Price

Website: free. iPhone app: the first **5 trips are free**, then a one-time **$1.99** unlock
(`app.getfoodtrip.foodtrip.unlimited`, non-consumable, StoreKit 2, `FoodTrip/Services/Store.swift`). A "trip" is a press
of "Plan my food trip"; swaps, shuffles and reopening a saved trip are free and stay available without the unlock. The
count is kept in `UserDefaults`, so deleting the app resets it.

## Data

`python3 scripts/build-cities.py` reads the Eats Ranked apps' bundled data in the sibling folders (`../<st>-eats/`,
`../chi-eats/`) and keeps the places worth a trip: a MICHELIN distinction, a James Beard honor, a hand-checked Eats
Ranked pick, or (Chicago only) a well-reviewed independent. Chains are dropped. A city needs 19 places and 8 dinner
places to be listed. It writes `docs/data/` and `FoodTrip/Resources/cities.json`.

Two things in the data are estimates, and the app says so:

- **Price tier.** Only Chicago has a real one. Elsewhere it is estimated from the honor and the cuisine (`est_price`).
- **Meal times.** There are no opening hours in the data. A cuisine decides which meals a place suits (`MEALS`), and the
  itinerary uses fixed times (9:00, 12:30, 3:30, 7:00) in the city's time zone.

## Run it

```bash
python3 scripts/build-cities.py
```

```bash
node scripts/test-planner.mjs
```

```bash
python3 -m http.server 4330 --directory docs
```

```bash
xcodegen generate
```

```bash
xcodebuild test -project FoodTrip.xcodeproj -scheme FoodTrip -destination 'platform=iOS Simulator,name=iPhone 18 Pro' CODE_SIGNING_ALLOWED=NO
```

After changing `docs/planner.js`, run `test-planner.mjs` (it rewrites `scripts/planner-vectors.json`), make the same
change in `Planner.swift`, and run the app tests: `testMatchesTheWebsitePlanner` fails until the two agree.

## Next

- Publish: create the GitHub repository, turn on Pages for `docs/`, point getfoodtrip.app at it (the Good Walk runbook,
  `../dogwalk/playbook/10-site-and-email-runbook.md`, is the same steps). Set up hello@getfoodtrip.app, which the privacy
  page names.
- App Store Connect: create the app and the `unlimited` in-app purchase at $1.99, then TestFlight. The purchase has only
  been exercised through the paywall screen; a real purchase needs the product to exist in App Store Connect or a run
  from Xcode with `Products.storekit`.
- Opening hours and real price tiers, so times and costs stop being estimates.
- Real booking (an OpenTable or Resy affiliate/partner link) and a map of each day.
- More cities: the threshold is 19 picks, so each new Eats Ranked guide adds some.
