# App Store listing

Copy to paste into App Store Connect. Every claim here is true of the build in this repository as of 2026-11-11;
if the app changes (cities, price, free trips), change this file with it.

## Title (30 chars max)

`FoodTrip: Restaurant Planner`

28 chars. "Food Trip" alone is taken by another app, so the title needs the second half. "Restaurant" and "planner"
are what people type. Check that App Store Connect accepts it before anything else: a reserved name doesn't show in search.

## Subtitle (30 chars max)

`Plan where to eat on your trip`

30 chars. The same line as the website's headline.

## Promotional text (170 chars, editable without review)

`Pick a city, your dates, meals a day and a budget. FoodTrip plans every meal from award-winning and hand-checked local restaurants. Your first 5 trips are free.`

## Keywords (100 chars, comma-separated, no spaces, don't repeat title words)

`itinerary,travel,reservation,dining,eat,foodie,vacation,guide,city,meal,budget,dinner,brunch,weekend`

Don't add MICHELIN, James Beard, OpenTable, Resy or Yelp: they are other companies' marks and Apple rejects them as keywords.

## Description

The first three lines show before "more".

```
Going somewhere? FoodTrip plans where to eat.

Pick a city, your dates, how many meals a day and what you want to spend. In a second you have a day-by-day plan: a different restaurant for every meal, inside your budget, with each day's stops close together.

REAL PLACES, NOT ADS
Every restaurant in FoodTrip holds a MICHELIN Guide distinction or a James Beard Foundation honor, or was checked open by hand for Eats Ranked. No restaurant pays to be listed.

MADE FOR YOUR TRIP
• 40 US cities, from New York and Chicago to Austin, New Orleans and Honolulu
• 1 to 4 meals a day: dinner, lunch, breakfast and an afternoon treat
• A food budget per person, per day. Dinner gets the money first
• A different cuisine each meal, and no place twice
• Don't like a pick? Swap it for the next best, or shuffle the whole plan

BOOK IT AND KEEP IT
• Reserve: opens OpenTable for that restaurant with your date, time and party size
• Add one meal or the whole trip to your calendar, at the city's local time
• Directions in Maps
• Share the plan as a link that opens to the same trip at getfoodtrip.app

PRIVATE
No account. No ads. No tracking. FoodTrip collects no data, and your trips stay on your phone. Calendar access is add-only: FoodTrip can't read your calendar.

PRICE
Your first 5 trips are free. After that, one payment of $1.99 unlocks unlimited trips. No subscription. Trips you already planned stay open either way.

GOOD TO KNOW
Prices are estimates for food, tax and tip. Meal times are suggestions. Restaurants change, so check hours and book ahead. Reservations are made with the restaurant or its booking service, not with FoodTrip.

FoodTrip is not affiliated with OpenTable, the MICHELIN Guide or the James Beard Foundation.
```

If the price changes in App Store Connect, the PRICE paragraph changes too (and `Store.fallbackPrice`).

## Screenshots (6.9-inch, 1320 × 2868, in this order)

Capture on an iPhone Pro Max simulator from a Debug build. The `-screen` launch option opens each one with a fixed
Chicago trip (see `CLAUDE.md`). Use a simulator that is not showing the "Apple Account Required" prompt.

| # | Screen | How to get it | Caption |
| --- | --- | --- | --- |
| 1 | Itinerary, Day 1 | `-screen itinerary` | Every meal of your trip, planned |
| 2 | Trip form | launch normally | City, dates, meals, budget. That's it |
| 3 | Itinerary scrolled to a starred dinner | `-screen itinerary`, scroll | Award-winning and hand-checked picks |
| 4 | Swap sheet | `-screen swap` | Not feeling it? Swap any stop |
| 5 | Calendar confirmation | More → Add all to calendar | Book it. Add it to your calendar |

Don't use the paywall as a marketing screenshot. It is the review screenshot for the in-app purchase (`-screen paywall`).

## App Review notes

```
FoodTrip plans restaurant itineraries for a trip. No account or login is needed.

To see the app: on the first screen tap "Plan my food trip". The itinerary opens. On any stop, "Reserve" opens OpenTable in the browser, "…" has Directions and Add to calendar, and "Swap" offers alternatives.

In-app purchase: the first 5 trips are free. Tapping "Plan my food trip" a 6th time shows the paywall for the non-consumable "Unlimited Trips" (app.getfoodtrip.foodtrip.unlimited). "Restore purchase" is on the same screen. Trips already planned remain usable without the purchase.

Calendar: the app requests add-only (write-only) access when the user chooses "Add to calendar". It never reads the calendar.

Data: restaurant data is bundled in the app. It comes from the developer's own Eats Ranked project (public inspection and license records) plus publicly announced MICHELIN Guide and James Beard Foundation honors, named as facts. The app is not affiliated with those organizations or with OpenTable and says so on the itinerary screen. The app makes no network requests other than StoreKit.

Reservations are made on the restaurant's or OpenTable's website, not in the app.

Contact: hello@getfoodtrip.app
```

## Category

Primary **Food & Drink**, secondary **Travel**.

## Age rating

Answer the questionnaire honestly: the app lists bars and pubs by name and cuisine ("Bar & Pub"), so
"Alcohol, Tobacco, or Drug Use or References" is **Infrequent/Mild**. Everything else is None. No web browsing inside
the app (links open Safari), no user-generated content.

## URLs

- Marketing: https://getfoodtrip.app/
- Support: https://getfoodtrip.app/support.html
- Privacy policy: https://getfoodtrip.app/privacy.html
