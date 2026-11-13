// FoodTrip planner. The iPhone app's Planner.swift is this file in Swift: change one, change the other
// (the shared test vectors are in scripts/planner-vectors.json; `node scripts/test-planner.mjs` checks this file).
// Deterministic: the same city, dates, meals, budget and seed always give the same plan.
(function (root) {
  "use strict";
  const B = 1, L = 2, D = 4, S = 8;
  const SLOTS = [
    { key: "breakfast", bit: B, label: "Breakfast", time: "09:00", mins: 60 },
    { key: "lunch", bit: L, label: "Lunch", time: "12:30", mins: 75 },
    { key: "snack", bit: S, label: "Afternoon treat", time: "15:30", mins: 30 },
    { key: "dinner", bit: D, label: "Dinner", time: "19:00", mins: 120 },
  ];
  // meals per day -> which slots
  const MEALS = { 1: ["dinner"], 2: ["lunch", "dinner"], 3: ["breakfast", "lunch", "dinner"], 4: ["breakfast", "lunch", "snack", "dinner"] };
  // estimated cost per person, by price tier and slot (food, tax and tip; no drinks)
  const COST = {
    breakfast: [0, 14, 26, 45, 70],
    lunch: [0, 16, 32, 60, 110],
    snack: [0, 8, 14, 22, 30],
    dinner: [0, 20, 45, 90, 220],
  };
  // the order slots are filled in: the big meal first, so the budget goes where it matters
  const FILL = ["dinner", "lunch", "breakfast", "snack"];

  function cost(place, slot) { return COST[slot][place.p] || COST[slot][2]; }

  // mulberry32: a small seeded random, identical in Swift
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function km(a, b) {
    const R = 6371, r = Math.PI / 180;
    const dLa = (b.la - a.la) * r, dLo = (b.lo - a.lo) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.la * r) * Math.cos(b.la * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function dayCount(start, end) {
    const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
    const b = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10));
    return Math.max(1, Math.min(14, Math.round((b - a) / 86400000) + 1));
  }

  function addDays(iso, n) {
    const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
    return d.toISOString().slice(0, 10);
  }

  // opts: {start, end, meals (1-4), budget (per person per day, dollars), seed, locked: {"<day>-<slot>": placeId}}
  function plan(city, opts) {
    const days = dayCount(opts.start, opts.end);
    const slots = MEALS[opts.meals] || MEALS[3];
    const budget = Math.max(10, opts.budget || 100);
    const rand = rng(opts.seed || 1);
    const locked = opts.locked || {};
    const byId = new Map(city.places.map((p) => [p.id, p]));
    const jitter = new Map(city.places.map((p) => [p.id, rand() * 14]));
    const used = new Set(Object.values(locked));
    const cuisineUses = new Map();
    const out = [];

    // the least the meals after this one can cost: the cheapest free place for each, a different place per slot
    const reserveFor = (rest) => {
      const taken = new Set();
      let total = 0;
      for (const slot of rest) {
        const bit = SLOTS.find((s) => s.key === slot).bit;
        let best = null;
        for (const p of city.places) {
          if (!(p.m & bit) || used.has(p.id) || taken.has(p.id)) continue;
          if (!best || cost(p, slot) < cost(best, slot)) best = p;
        }
        if (best) { taken.add(best.id); total += cost(best, slot); }
      }
      return total;
    };

    for (let d = 0; d < days; d++) {
      const stops = {};
      let spent = 0, anchor = null;
      const today = new Set();
      const order = FILL.filter((s) => slots.includes(s));
      order.forEach((slot, i) => {
        const bit = SLOTS.find((s) => s.key === slot).bit;
        // keep enough budget for the cheapest version of every meal still to fill
        const reserve = reserveFor(order.slice(i + 1));
        const left = budget - spent - reserve;
        const lockedId = locked[d + "-" + slot];
        let pick = lockedId && byId.get(lockedId);
        if (!pick) {
          let best = null, bestScore = -Infinity, cheapest = null;
          for (const p of city.places) {
            if (!(p.m & bit) || used.has(p.id)) continue;
            const c = cost(p, slot);
            if (!cheapest || c < cost(cheapest, slot) || (c === cost(cheapest, slot) && p.r > cheapest.r)) cheapest = p;
            if (c > left) continue;
            let s = p.r + jitter.get(p.id);
            s -= 12 * (cuisineUses.get(p.cu) || 0);
            if (today.has(p.cu)) s -= 25;
            // 2.5 points a km, up to 36 km: capping it lower let a place 30 km out score like one 12 km out
            if (anchor) s -= Math.min(90, 2.5 * km(anchor, p));
            // a splurge-sized budget should get a splurge: favour using what's there at dinner
            if (slot === "dinner") s += 6 * (c / Math.max(left, 1));
            if (s > bestScore) { bestScore = s; best = p; }
          }
          pick = best || cheapest;
        }
        if (!pick) return;
        used.add(pick.id);
        today.add(pick.cu);
        cuisineUses.set(pick.cu, (cuisineUses.get(pick.cu) || 0) + 1);
        const c = cost(pick, slot);
        spent += c;
        if (!anchor) anchor = pick;
        stops[slot] = { slot, place: pick, cost: c, locked: !!lockedId };
      });
      const list = SLOTS.filter((s) => stops[s.key]).map((s) => Object.assign(stops[s.key], { time: s.time, mins: s.mins, label: s.label }));
      out.push({ index: d, date: addDays(opts.start, d), stops: list, spent, over: spent > budget, missing: slots.filter((s) => !stops[s]) });
    }
    const total = out.reduce((t, d) => t + d.spent, 0);
    return { city: { id: city.id, name: city.name, st: city.st, tz: city.tz }, days: out, total, budget, perDayBudget: budget, meals: opts.meals, start: opts.start, end: addDays(opts.start, days - 1) };
  }

  // the next-best place for one stop, keeping the rest of the plan
  function alternatives(city, planned, dayIndex, slot, n) {
    const bit = SLOTS.find((s) => s.key === slot).bit;
    const used = new Set();
    planned.days.forEach((d) => d.stops.forEach((s) => used.add(s.place.id)));
    const day = planned.days[dayIndex];
    const others = day.stops.filter((s) => s.slot !== slot);
    const left = planned.budget - others.reduce((t, s) => t + s.cost, 0);
    const anchor = others.length ? others[others.length - 1].place : null;
    return city.places
      .filter((p) => p.m & bit && !used.has(p.id))
      .map((p) => ({ p, s: p.r - (cost(p, slot) > left ? 40 : 0) - (anchor ? Math.min(90, 2.5 * km(anchor, p)) : 0) }))
      .sort((a, b) => b.s - a.s || (a.p.id < b.p.id ? -1 : 1))
      .slice(0, n || 5)
      .map((x) => x.p);
  }

  const PRICE = ["", "$", "$$", "$$$", "$$$$"];
  root.FoodTripPlanner = { plan, alternatives, cost, km, dayCount, addDays, SLOTS, MEALS, COST, PRICE };
})(typeof window !== "undefined" ? window : globalThis);
