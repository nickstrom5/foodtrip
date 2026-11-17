// Design pass: full-page screenshots of every page template at phone and desktop width, light and dark, plus one
// contact sheet per page (the four shots side by side) to review by eye. Uses the Playwright install in ../../portfolio.
//   python3 -m http.server 4330 --directory docs   (or the "foodtrip" preview), then:
//   node scripts/design-shots.mjs [outDir]          (default: $TMPDIR/foodtrip-shots)
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/nicksoderstrom/Developer/portfolio/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:4330";
const OUT = process.argv[2] || path.join(os.tmpdir(), "foodtrip-shots");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["plan", "/#c=chicago-il&s=2026-12-04&e=2026-12-06&m=3&b=120&n=2&r=1"],
  ["plan-thin", "/#c=omaha-ne&s=2026-12-04&e=2026-12-05&m=4&b=60&n=2&r=1"],
  ["cities", "/cities/"],
  ["city", "/cities/chicago-il.html"],
  ["city-thin", "/cities/omaha-ne.html"],
  ["support", "/support.html"],
  ["privacy", "/privacy.html"],
  ["terms", "/terms.html"],
  ["404", "/404.html"],
];
const CONTEXTS = [
  ["phone-light", { width: 375, height: 812 }, "light"],
  ["phone-dark", { width: 375, height: 812 }, "dark"],
  ["desktop-light", { width: 1280, height: 800 }, "light"],
  ["desktop-dark", { width: 1280, height: 800 }, "dark"],
];

const browser = await chromium.launch();
const problems = [];
for (const [ctxName, viewport, colorScheme] of CONTEXTS) {
  const ctx = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`${ctxName}: page error ${e.message}`));
  for (const [name, url] of PAGES) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    if (name.startsWith("plan")) await page.waitForSelector(".day", { timeout: 5000 }).catch(() => problems.push(`${name}: no plan rendered`));
    // a full-page shot doesn't scroll, so lazy images below the fold would never load: load them all first
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = "eager")));
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
    const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src.slice(-40)));
    if (broken.length) problems.push(`${name} ${ctxName}: images not loaded ${broken.join(", ")}`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(300);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (wide > 0) problems.push(`${name} ${ctxName}: ${wide}px horizontal overflow`);
    await page.screenshot({ path: path.join(OUT, `${name}--${ctxName}.png`), fullPage: true });
  }
  await ctx.close();
}

// one contact sheet per page: the four shots in a row, scaled to the same height budget
const sheet = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
for (const [name] of PAGES) {
  // inline as data: a page set with setContent may not load file:// images
  const src = (c) => "data:image/png;base64," + fs.readFileSync(path.join(OUT, `${name}--${c}.png`)).toString("base64");
  const imgs = CONTEXTS.map(([c]) => `<figure><img src="${src(c)}"><figcaption>${c}</figcaption></figure>`).join("");
  await sheet.setContent(`<style>body{margin:0;background:#888;font:14px sans-serif;display:flex;gap:12px;padding:12px;align-items:flex-start}
    figure{margin:0;background:#fff}figure img{display:block;width:420px;height:auto}figcaption{padding:4px 6px}</style>${imgs}`);
  await sheet.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  // cut the sheet into tiles that stay readable when viewed
  const total = await sheet.evaluate(() => document.documentElement.scrollHeight);
  const width = await sheet.evaluate(() => Math.max(...[...document.querySelectorAll("figure")].map((f) => f.getBoundingClientRect().right)) + 12);
  for (let y = 0, i = 0; y < total; y += 1400, i++)
    await sheet.screenshot({ path: path.join(OUT, `tile--${name}-${i}.png`), fullPage: true, clip: { x: 0, y, width, height: Math.min(1400, total - y) } });
}
await browser.close();
console.log(`${PAGES.length * CONTEXTS.length} shots and ${PAGES.length} sheets in ${OUT}`);
for (const p of problems) console.log("PROBLEM", p);
