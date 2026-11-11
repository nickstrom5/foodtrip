// Checks docs/planner.js: budgets, no repeats, the meals asked for, determinism; writes scripts/planner-vectors.json
// (the plans Planner.swift must reproduce exactly; FoodTripTests bundles a copy).  node scripts/test-planner.mjs
import fs from "node:fs";
import vm from "node:vm";
const here = new URL("..", import.meta.url).pathname;
vm.runInThisContext(fs.readFileSync(here + "docs/planner.js", "utf8"));
const P = globalThis.FoodTripPlanner;
const index = JSON.parse(fs.readFileSync(here + "docs/data/cities.json", "utf8")).cities;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
const vectors = [];
for (const c of index) {
  const city = JSON.parse(fs.readFileSync(here + `docs/data/${c.id}.json`, "utf8"));
  for (const [meals, budget, days] of [[1, 60, 2], [2, 80, 3], [3, 120, 4], [4, 250, 3], [3, 40, 2]]) {
    const opts = { start: "2026-12-04", end: P.addDays("2026-12-04", days - 1), meals, budget, seed: 7 };
    const plan = P.plan(city, opts);
    const again = P.plan(city, opts);
    ok(JSON.stringify(plan) === JSON.stringify(again), `${c.id} not deterministic`);
    ok(plan.days.length === days, `${c.id} day count`);
    const ids = plan.days.flatMap((d) => d.stops.map((s) => s.place.id));
    ok(new Set(ids).size === ids.length, `${c.id} repeats a place`);
    for (const d of plan.days) {
      for (const s of d.stops) ok(s.place.m & P.SLOTS.find((x) => x.key === s.slot).bit, `${c.id} ${s.place.n} wrong meal`);
    }
    // a smaller city can run out of cheap breakfasts by the last day; the app says so on that day
    const over = plan.days.filter((d) => d.over);
    if (budget >= 120) ok(over.length <= 1 && over.every((d) => d.index === days - 1), `${c.id} m${meals} $${budget} over budget on ${over.map((d) => d.index)}`);
    if (["chicago-il", "austin-tx", "boise-id"].includes(c.id))
      vectors.push({ city: c.id, opts, days: plan.days.map((d) => d.stops.map((s) => `${s.slot}:${s.place.id}`)) });
  }
}
// alternatives skip places already in the plan; a locked stop stays put
const chi = JSON.parse(fs.readFileSync(here + "docs/data/chicago-il.json", "utf8"));
const p0 = P.plan(chi, { start: "2026-12-04", end: "2026-12-05", meals: 3, budget: 150, seed: 3 });
const alt = P.alternatives(chi, p0, 0, "dinner", 3);
ok(alt.length === 3 && !alt.some((a) => p0.days.some((d) => d.stops.some((s) => s.place.id === a.id))), "alternatives");
const p1 = P.plan(chi, { start: "2026-12-04", end: "2026-12-05", meals: 3, budget: 150, seed: 3, locked: { "0-dinner": alt[0].id } });
ok(p1.days[0].stops.find((s) => s.slot === "dinner").place.id === alt[0].id, "locked dinner");
fs.writeFileSync(here + "scripts/planner-vectors.json", JSON.stringify(vectors, null, 1));
const sample = P.plan(chi, { start: "2026-12-04", end: "2026-12-06", meals: 3, budget: 150, seed: 7 });
for (const d of sample.days)
  console.log(d.date, "$" + d.spent, d.stops.map((s) => `${s.label}: ${s.place.n} (${s.place.cu}, ${P.PRICE[s.place.p]}, ${s.place.hd || ""})`).join(" | "));
console.log(fails ? `${fails} failures` : "all planner checks pass", `(${vectors.length} vectors)`);
process.exit(fails ? 1 : 0);
