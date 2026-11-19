// QA: how well do plans hold together in every city? Plans four typical trips per city with docs/planner.js and reports
// days whose stops are more than 20 km apart, days missing a meal, and days over budget, with the worst days listed.
//   node scripts/check-spread.mjs
import fs from "node:fs";
import vm from "node:vm";

const here = new URL("..", import.meta.url).pathname;
vm.runInThisContext(fs.readFileSync(here + "docs/planner.js", "utf8"));
const P = globalThis.FoodTripPlanner;
const index = JSON.parse(fs.readFileSync(here + "docs/data/cities.json", "utf8")).cities;
const TRIPS = [[3, 120, 3, 1], [3, 120, 5, 2], [4, 200, 3, 3], [2, 80, 4, 4]]; // meals, budget, days, seed
const rows = [];
const missingByCity = {};
let days = 0, wide = 0, missing = 0, over = 0;
for (const c of index) {
  const city = JSON.parse(fs.readFileSync(here + `docs/data/${c.id}.json`, "utf8"));
  let worst = 0, worstDay = "";
  for (const [meals, budget, n, seed] of TRIPS) {
    const plan = P.plan(city, { start: "2026-12-04", end: P.addDays("2026-12-04", n - 1), meals, budget, seed });
    for (const d of plan.days) {
      days++;
      if (d.missing.length) { missing++; missingByCity[c.id] = (missingByCity[c.id] || 0) + 1; }
      if (d.over) over++;
      let m = 0;
      for (const a of d.stops) for (const b of d.stops) m = Math.max(m, P.km(a.place, b.place));
      if (m > 20) wide++;
      if (m > worst) { worst = m; worstDay = d.stops.map((s) => `${s.place.n}${s.place.hd ? " (" + s.place.hd + ")" : ""}`).join(" → "); }
    }
  }
  rows.push([Math.round(worst), c.id, worstDay]);
}
rows.sort((a, b) => b[0] - a[0]);
console.log(`${days} days planned in ${index.length} cities: ${wide} with stops more than 20 km apart, ${missing} missing a meal, ${over} over budget`);
console.log("widest days:");
for (const r of rows.slice(0, 5)) console.log(`  ${r[0]} km  ${r[1]}  ${r[2].slice(0, 120)}`);
const thin = Object.entries(missingByCity).sort((a, b) => b[1] - a[1]);
console.log(`cities with a missing meal on some day (${thin.length}): ${thin.slice(0, 12).map(([c, n]) => `${c} ${n}`).join(", ")}`);
