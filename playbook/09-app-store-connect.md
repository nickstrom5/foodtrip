# App Store Connect setup, step by step

What Nick does in the browser and Xcode to get FoodTrip from this repository to the App Store. The listing text is in
`06-app-store-listing.md`. Tick each box as it is done.

## Before you start

- [ ] getfoodtrip.app loads over HTTPS (DNS records in Cloudflare, then "Enforce HTTPS" in the repo's Pages settings).
      Apple checks the privacy and support URLs.
- [ ] hello@getfoodtrip.app receives mail (Cloudflare Email Routing → forward to your inbox; the Good Walk runbook,
      `../../dogwalk/playbook/10-site-and-email-runbook.md`, has the steps). The privacy page and the review notes name it.
- [x] A support page exists (`docs/support.html`, linked from the footer and in `sitemap.xml`).
- [ ] USPTO search for "FOODTRIP" (see `05-naming.md`).

## 1. Identifier (developer.apple.com → Certificates, Identifiers & Profiles → Identifiers)

- [ ] Register an App ID: explicit, bundle ID `app.getfoodtrip.foodtrip`, description "FoodTrip".
- [ ] Capabilities: none to tick. In-App Purchase is on by default; the app uses no App Groups, push or iCloud.

## 2. Create the app record (App Store Connect → Apps → +)

- [ ] Platform iOS, name `FoodTrip: Restaurant Planner`, primary language English (U.S.), bundle ID from step 1,
      SKU `foodtrip-ios`, full access.
- [ ] If the name is refused, try `FoodTrip - Restaurant Trips`, then tell Claude so the listing file is updated.

## 3. Agreements, tax and banking (App Store Connect → Business)

- [ ] The Paid Apps agreement is active. It already is if Good Walk's purchases are live; without it the in-app
      purchase never loads and the paywall shows the fallback price.

## 4. In-app purchase (the app → Monetization → In-App Purchases → +)

- [ ] Type **Non-Consumable**. Reference name `Unlimited Trips`. Product ID `app.getfoodtrip.foodtrip.unlimited`
      (it must match `Store.unlimitedID` exactly; it can never be changed or reused).
- [ ] Price: **$1.99** (USD base, let Apple set the other storefronts).
- [ ] Family Sharing: on (the local `Products.storekit` says so too; turn both off together if you'd rather not).
- [ ] Localization (English U.S.): display name `Unlimited Trips`, description
      `Plan as many food trips as you like. Pay once.`
- [ ] Review screenshot: the paywall (`-screen paywall`, 1320 × 2868).
- [ ] Review notes: "Shown after 5 free trips. See the app's review notes."
- [ ] The first in-app purchase is submitted **with** the app version: on the version page, under "In-App Purchases
      and Subscriptions", select it before submitting.

## 5. App Privacy (the app → App Privacy)

- [ ] Privacy policy URL: https://getfoodtrip.app/privacy.html
- [ ] "Do you or your third-party partners collect data from this app?" → **No**. The label reads "Data Not Collected".
      This matches `PrivacyInfo.xcprivacy` (no collected data types, no tracking) and `docs/privacy.html`. Purchases are
      handled by Apple and are not data the developer collects.

## 6. App information

- [ ] Subtitle, categories (Food & Drink, Travel), age rating questionnaire: from `06-app-store-listing.md`.
- [ ] Content rights: the app contains third-party content it has the right to use (public records; honors named as
      facts; Overture Maps data under its open licenses, credited on the Eats Ranked site). Answer "Yes, … and I have the
      rights".

## 7. Version 1.0 page

- [ ] Screenshots (6.9-inch), promotional text, description, keywords, support and marketing URLs, review notes and
      contact details: from `06-app-store-listing.md`.
- [ ] Copyright `2026 Nicholas Soderstrom`.
- [ ] Export compliance is answered by the build (`ITSAppUsesNonExemptEncryption` is false in `project.yml`).

## 8. Build and TestFlight

- [ ] `xcodegen generate`, open `FoodTrip.xcodeproj`, select "Any iOS Device", Product → Archive, Distribute App →
      App Store Connect. The team is already set in `project.yml`. Bump `CURRENT_PROJECT_VERSION` for each upload.
- [ ] Install from TestFlight on a real iPhone and check the things the simulator could not:
  - [ ] Plan a trip; "Reserve" opens OpenTable with the right date, time and party size.
  - [ ] "Add to calendar" asks for add-only access; the event lands at the city's local time.
  - [ ] "Add all to calendar" adds one event per meal.
  - [ ] Share sends a getfoodtrip.app link that opens to the same plan.
  - [ ] Plan 5 trips; the 6th shows the paywall with the real price from the App Store.
  - [ ] Buy with a sandbox account: the paywall closes and planning continues. Delete and reinstall, then
        "Restore purchase": unlocked again.
  - [ ] Decline the purchase: saved trips still open, swap and shuffle still work.

## 9. Submit

- [ ] Select the build and the in-app purchase on the version page, choose manual release, submit for review.
- [ ] After release: put the App Store link and the Smart App Banner (`<meta name="apple-itunes-app" content="app-id=…">`)
      on `docs/index.html` in place of "iPhone app coming soon", and add the app to the portfolio's `src/data/apps.json`.
