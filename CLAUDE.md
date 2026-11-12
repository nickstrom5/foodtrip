# FoodTrip — notes for Claude Code sessions

Website + iPhone app that plan where to eat on a trip. Read `README.md` first.

## Build
- The Xcode project is **generated**: `xcodegen generate`. Never commit `FoodTrip.xcodeproj`.
- Targets, Info.plist keys and new top-level folders go in `project.yml`, then regenerate.
- Tests: `xcodebuild test -project FoodTrip.xcodeproj -scheme FoodTrip -destination 'platform=iOS Simulator,name=<an iPhone>' CODE_SIGNING_ALLOWED=NO`
- Web planner checks: `node scripts/test-planner.mjs`. Site preview: `python3 -m http.server 4330 --directory docs`.
- After a data or planner change: `python3 scripts/build-cities.py`, `node scripts/test-planner.mjs`,
  `node scripts/make-city-pages.mjs` (city pages, home-page city links, sitemap), `python3 scripts/qa-site.py` (must pass).

## The one rule
`docs/planner.js` and `FoodTrip/Models/Planner.swift` are the same algorithm and must give the same plan (a shared link
opens the same trip on both). Change both. `scripts/planner-vectors.json` is written by the node script and read by
`PlannerTests.testMatchesTheWebsitePlanner`. Costs, slot times and meal bits are duplicated the same way.

## Public vs private
- `docs/` is the public site (GitHub Pages, getfoodtrip.app). Only site files go there. Notes live in `playbook/`.
- Every page carries the Content-Security-Policy `<meta>`: scripts from `'self'` only, no third-party anything, no
  inline script. `connect-src 'self'` is what lets `app.js` fetch `data/*.json`.
- `docs/data/` and `FoodTrip/Resources/cities.json` are written by `scripts/build-cities.py`. Don't edit them by hand.
- `docs/cities/`, `docs/sitemap.xml` and the home page's `CITY-LINKS` block are written by `scripts/make-city-pages.mjs`.
  SEO rules and the after-launch list are in `playbook/10-seo.md`; the FAQ JSON-LD must mirror the visible FAQ.

## Runtime notes
- No account, no analytics, no network calls in the app except StoreKit. `PrivacyInfo.xcprivacy` declares UserDefaults
  only; it must agree with `docs/privacy.html`.
- Calendar is add-only (`requestWriteOnlyAccessToEvents`): the app never reads the calendar.
- Paywall: 5 free trips, then `app.getfoodtrip.foodtrip.unlimited` ($1.99, non-consumable). `Products.storekit` is the
  local StoreKit configuration and only applies when the scheme is run from Xcode. Launch with `-tripsPlanned 5` to see
  the paywall without planning five trips.
- Screens: launch a Debug build with `-screen itinerary|swap|paywall` to open one screen with a fixed Chicago trip
  (`xcrun simctl launch <device> app.getfoodtrip.foodtrip -screen itinerary`). A Release build ignores it.
- Reserve/Directions/Other ways are links out (`Links`); the website builds the same URLs in `app.js`.
