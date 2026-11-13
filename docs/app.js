// FoodTrip web app: the form, the itinerary, reservations, calendar and share. The planning itself is planner.js.
(function () {
  "use strict";
  const P = window.FoodTripPlanner;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const cache = new Map();
  let cities = [], current = null, plan = null;
  const state = { city: "", start: "", end: "", meals: 3, budget: 120, party: 2, seed: 1, locked: {} };

  // ---- dates
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function nextWeekend() {
    const d = new Date();
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    const e = new Date(d); e.setDate(d.getDate() + 2);
    return [iso(d), iso(e)];
  }
  const fmtDay = (s) => new Date(s + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const fmtShort = (s) => new Date(s + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const fmtTime = (hm) => { const [h, m] = hm.split(":").map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

  // wall-clock time in a city's time zone -> UTC milliseconds
  function utcMs(date, hm, tz) {
    const [y, mo, d] = date.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
    const want = Date.UTC(y, mo - 1, d, h, mi);
    let t = want;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(t)).map((p) => [p.type, p.value]));
      const seen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
      t += want - seen;
    }
    return t;
  }
  const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  // ---- links
  const cityLine = () => `${current.name}, ${current.st}`;
  const placeAddr = (p) => [p.a, current.name, current.st, p.z].filter(Boolean).join(", ");
  function openTable(p, day, stop) {
    const q = new URLSearchParams({ term: `${p.n} ${current.name}`, covers: String(state.party), dateTime: `${day.date}T${stop.time}` });
    return `https://www.opentable.com/s?${q}`;
  }
  const otherWays = (p) => `https://www.google.com/search?${new URLSearchParams({ q: `${p.n} ${p.a} ${cityLine()} reservations` })}`;
  const maps = (p) => `https://maps.apple.com/?${new URLSearchParams({ q: p.n, ll: `${p.la},${p.lo}`, address: placeAddr(p) })}`;
  function gcal(p, day, stop) {
    const s = utcMs(day.date, stop.time, current.tz), e = s + stop.mins * 60000;
    const q = new URLSearchParams({ action: "TEMPLATE", text: `${stop.label}: ${p.n}`, dates: `${stamp(s)}/${stamp(e)}`, details: details(p, day, stop), location: placeAddr(p) });
    return `https://calendar.google.com/calendar/render?${q}`;
  }
  const details = (p, day, stop) => [p.hl, `${p.cu} · ${P.PRICE[p.p]} · about $${stop.cost} a person`, p.w, `Book: ${openTable(p, day, stop)}`, "Planned with FoodTrip · getfoodtrip.app"].filter(Boolean).join("\n");
  const needsBooking = (stop) => (stop.slot === "dinner" || stop.slot === "lunch") && stop.place.p >= 2;

  // ---- calendar file
  function icsText(only) {
    const fold = (l) => { const out = []; while (l.length > 74) { out.push(l.slice(0, 74)); l = " " + l.slice(74); } out.push(l); return out.join("\r\n"); };
    const t = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FoodTrip//getfoodtrip.app//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${t(`FoodTrip: ${cityLine()}`)}`];
    const now = stamp(Date.now());
    plan.days.forEach((day) => day.stops.forEach((stop) => {
      if (only && only !== stop) return;
      const s = utcMs(day.date, stop.time, current.tz), p = stop.place;
      lines.push("BEGIN:VEVENT", `UID:${p.id}-${day.date}-${stop.slot}@getfoodtrip.app`, `DTSTAMP:${now}`, `DTSTART:${stamp(s)}`, `DTEND:${stamp(s + stop.mins * 60000)}`,
        `SUMMARY:${t(`${stop.label}: ${p.n}`)}`, `LOCATION:${t(placeAddr(p))}`, `GEO:${p.la};${p.lo}`, `DESCRIPTION:${t(details(p, day, stop))}`, "END:VEVENT");
    }));
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---- url state (so a plan can be shared and reopened exactly)
  function writeHash() {
    const q = new URLSearchParams({ c: state.city, s: state.start, e: state.end, m: state.meals, b: state.budget, n: state.party, r: state.seed });
    const lk = Object.entries(state.locked).map(([k, v]) => `${k}:${v}`).join(",");
    if (lk) q.set("lk", lk);
    history.replaceState(null, "", "#" + q);
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (!q.get("c")) return false;
    // a mangled link falls back to the form's own dates instead of leaving it half filled
    const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") && !isNaN(Date.parse(v + "T12:00:00Z")) && P.addDays(v, 0) === v ? v : null);
    state.city = q.get("c"); state.start = day(q.get("s")) || state.start; state.end = day(q.get("e")) || state.end;
    if (state.end < state.start) state.end = state.start;
    state.meals = Math.min(4, Math.max(1, +q.get("m") || 3)); state.budget = Math.min(400, Math.max(30, +q.get("b") || 120));
    state.party = Math.min(20, Math.max(1, +q.get("n") || 2)); state.seed = +q.get("r") || 1;
    state.locked = {};
    (q.get("lk") || "").split(",").filter(Boolean).forEach((x) => { const i = x.lastIndexOf(":"); if (i > 0) state.locked[x.slice(0, i)] = x.slice(i + 1); });
    return true;
  }

  // ---- form
  function syncForm() {
    $("city").value = state.city; $("start").value = state.start; $("end").value = state.end;
    $("budget").value = state.budget; $("budget-out").textContent = "$" + state.budget; $("party").textContent = state.party;
    document.querySelectorAll("#meals button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.m === state.meals)));
  }
  function readForm() {
    state.city = $("city").value; state.start = $("start").value; state.end = $("end").value;
    if (state.end < state.start) state.end = state.start;
    if (P.dayCount(state.start, state.end) === 14 && state.end > P.addDays(state.start, 13)) state.end = P.addDays(state.start, 13);
  }
  async function loadCity(id) {
    if (!cache.has(id)) {
      const r = await fetch(`/data/${encodeURIComponent(id)}.json`);
      if (!r.ok) throw new Error("city data " + r.status);
      cache.set(id, await r.json());
    }
    return cache.get(id);
  }

  async function run(scroll) {
    readForm();
    if (!state.city || !state.start) return;
    $("go").disabled = true; $("go").textContent = "Planning…";
    try {
      current = await loadCity(state.city);
      plan = P.plan(current, { start: state.start, end: state.end, meals: state.meals, budget: state.budget, seed: state.seed, locked: state.locked });
      writeHash(); render();
      if (scroll) $("result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    } catch (e) {
      $("result").hidden = false; $("result").innerHTML = `<p class="empty">Couldn't load that city. Check your connection and try again.</p>`;
    } finally {
      $("go").disabled = false; $("go").textContent = "Plan my food trip";
    }
  }

  // ---- render
  function render() {
    const r = $("result"), people = state.party;
    const nDays = plan.days.length;
    const header = `<div class="summary"><div>
        <h2>${nDays} day${nDays > 1 ? "s" : ""} of eating in ${esc(current.name)}</h2>
        <p>${esc(fmtShort(plan.start))}${nDays > 1 ? " – " + esc(fmtShort(plan.end)) : ""} · about $${plan.total.toLocaleString()} a person${people > 1 ? `, $${(plan.total * people).toLocaleString()} for ${people}` : ""}</p>
      </div><div class="actions">
        <button class="btn btn-soft btn-sm" data-act="ics">Add all to calendar</button>
        <button class="btn btn-soft btn-sm" data-act="share">Share plan</button>
        <button class="btn btn-soft btn-sm" data-act="shuffle">Shuffle</button>
        <button class="btn btn-soft btn-sm" data-act="print">Print</button>
      </div></div>`;
    const days = plan.days.map((day) => {
      const stops = day.stops.map((stop) => stopHTML(day, stop)).join("");
      const missing = day.missing.length ? `<p class="empty">No ${day.missing.join(" or ")} pick left in ${esc(current.name)} for this day.</p>` : "";
      return `<article class="day"><div class="day-h"><h3>Day ${day.index + 1} · ${esc(fmtDay(day.date))}</h3>
        <span class="spend">about $${day.spent} a person${day.over ? ` <span class="over">$${day.spent - plan.budget} over budget</span>` : ""}</span></div>${stops}${missing}</article>`;
    }).join("");
    r.innerHTML = header + days + `<p class="note">Prices are estimates for food, tax and tip, per person. Times are a suggestion: book, then edit the calendar event to match. Places change, so check hours before you go.</p>`;
    r.hidden = false;
  }
  function stopHTML(day, stop) {
    const p = stop.place, k = `${day.index}-${stop.slot}`;
    const mich = /MICHELIN|Bib/.test(p.hl);
    const book = needsBooking(stop)
      ? `<a class="btn btn-primary btn-sm" style="width:auto" target="_blank" rel="noopener noreferrer" href="${esc(openTable(p, day, stop))}">Reserve for ${state.party}</a>`
      : `<span class="badge" style="align-self:center;margin:0">Walk in</span>`;
    const more = (needsBooking(stop) ? `<a target="_blank" rel="noopener noreferrer" href="${esc(otherWays(p))}">Other ways to book</a> · ` : "")
      + `<a target="_blank" rel="noopener noreferrer" href="${esc(gcal(p, day, stop))}">Add to Google Calendar</a>`;
    return `<div class="stop" id="stop-${k}"><div class="time">${esc(fmtTime(stop.time))}<small>${esc(stop.label)}</small></div><div>
      <h4>${esc(p.n)}</h4>
      <p class="meta">${esc(p.cu)} · ${P.PRICE[p.p]} · ~$${stop.cost}${p.hd ? " · " + esc(p.hd) : ""}</p>
      <span class="badge${mich ? " mich" : ""}">${esc(p.hl)}</span>
      ${p.w ? `<p class="why">${esc(p.w)}</p>` : ""}
      <div class="actions">${book}
        <a class="btn btn-soft btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(maps(p))}">Directions</a>
        <button class="btn btn-soft btn-sm" data-act="ics-one" data-k="${k}">Add to calendar</button>
        <button class="btn btn-soft btn-sm" data-act="swap" data-k="${k}" aria-expanded="false">Swap</button>
      </div><p class="more">${more}</p></div></div>`;
  }
  function showAlts(btn) {
    const [d, slot] = btn.dataset.k.split("-");
    const box = btn.closest(".stop").querySelector(".alts");
    if (box) { box.remove(); btn.setAttribute("aria-expanded", "false"); return; }
    const alts = P.alternatives(current, plan, +d, slot, 4);
    const div = document.createElement("div");
    div.className = "alts";
    div.innerHTML = alts.length
      ? alts.map((a) => `<button data-act="pick" data-k="${btn.dataset.k}" data-id="${esc(a.id)}">${esc(a.n)} <span>· ${esc(a.cu)} · ${P.PRICE[a.p]} · ~$${P.cost(a, slot)} · ${esc(a.hl)}</span></button>`).join("")
      : `<p class="empty">No other ${slot} picks left in ${esc(current.name)}.</p>`;
    btn.closest(".stop > div").appendChild(div);
    btn.setAttribute("aria-expanded", "true");
  }
  function pick(k, id) {
    // keep everything else exactly as planned
    state.locked = {};
    plan.days.forEach((day) => day.stops.forEach((s) => { state.locked[`${day.index}-${s.slot}`] = s.place.id; }));
    state.locked[k] = id;
    run(false).then(() => { const el = $("stop-" + k); if (el) el.scrollIntoView({ block: "center" }); toast("Swapped"); });
  }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800); }
  async function share() {
    const url = location.href, title = `FoodTrip: ${plan.days.length} days of eating in ${current.name}`;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { prompt("Copy this link", url); }
  }

  // ---- wire up
  $("result").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "ics") download(`foodtrip-${current.id}-${plan.start}.ics`, icsText());
    else if (act === "ics-one") {
      const [d, slot] = b.dataset.k.split("-"); const day = plan.days[+d];
      download(`foodtrip-${slot}-${day.date}.ics`, icsText(day.stops.find((s) => s.slot === slot)));
    } else if (act === "share") share();
    else if (act === "shuffle") { state.seed = (state.seed % 9999) + 1; state.locked = {}; run(false).then(() => toast("New plan")); }
    else if (act === "print") print();
    else if (act === "swap") showAlts(b);
    else if (act === "pick") pick(b.dataset.k, b.dataset.id);
  });
  $("form").addEventListener("submit", (e) => { e.preventDefault(); state.locked = {}; run(true); });
  ["city", "start", "end"].forEach((id) => $(id).addEventListener("change", () => {
    if (id === "start" && $("end").value < $("start").value) $("end").value = $("start").value;
    $("end").min = $("start").value;
    // keep the choice: the meals and people buttons redraw the form from `state`, which used to put the old city and dates back
    readForm();
  }));
  $("budget").addEventListener("input", () => { state.budget = +$("budget").value; $("budget-out").textContent = "$" + state.budget; });
  $("meals").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; readForm(); state.meals = +b.dataset.m; syncForm(); });
  $("party-minus").addEventListener("click", () => { readForm(); state.party = Math.max(1, state.party - 1); syncForm(); });
  $("party-plus").addEventListener("click", () => { readForm(); state.party = Math.min(20, state.party + 1); syncForm(); });

  // a pasted or edited link in an open tab replans too
  window.addEventListener("hashchange", () => { if (cities.length && readHash()) { if (!cities.some((c) => c.id === state.city)) state.city = "chicago-il"; syncForm(); run(false); } });

  (async function init() {
    [state.start, state.end] = nextWeekend();
    $("start").min = iso(new Date());
    try {
      const r = await fetch("/data/cities.json");
      cities = (await r.json()).cities.slice().sort((a, b) => a.name.localeCompare(b.name));
    } catch { $("city").innerHTML = `<option value="">Couldn't load cities</option>`; return; }
    $("city").innerHTML = cities.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}, ${esc(c.st)}</option>`).join("");
    const shared = readHash();
    if (!cities.some((c) => c.id === state.city)) state.city = "chicago-il";
    syncForm();
    $("end").min = state.start;
    if (shared) run(false);
  })();
})();
