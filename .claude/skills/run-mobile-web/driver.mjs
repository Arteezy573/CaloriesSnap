// Playwright skeleton for driving CaloriesSnap on the web target.
// Logs in as the seeded demo user and screenshots the dashboard.
// Copy + extend the marked section for your own interaction.
//
//   node driver.mjs            # screenshots dashboard.png
//
// Requires: playwright installed (npm i playwright && npx playwright install chromium),
// backend on :8000, expo web on :8090, and `python seed.py` already run.

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const OUT = dirname(fileURLToPath(import.meta.url));
const URL = "http://localhost:8090";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function login(page) {
  await page.goto(URL, { waitUntil: "load" });
  await sleep(3500); // first paint / bundle
  if (await page.getByPlaceholder("Email").count()) {
    await page.getByPlaceholder("Email").first().fill("demo@test.com");
    await page.getByPlaceholder("Password").first().fill("Passw0rd!");
    await page.getByText("Log In", { exact: true }).first().click();
    await sleep(4000);
  }
}

// Trash icons ignore hitSlop on web — click the icon center, anchored to
// the topmost calorie <input>. Returns false when no ingredient rows remain.
export async function clickTopTrash(page) {
  let best = null, bestY = 1e9;
  for (const h of await page.locator("input").elementHandles()) {
    const box = await h.boundingBox();
    if (box && box.x > 190 && box.x < 300 && box.width < 90 && box.y < bestY) {
      bestY = box.y;
      best = box;
    }
  }
  if (!best) return false;
  await page.mouse.click(337, best.y + best.height / 2);
  await sleep(500);
  return true;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

  await login(page);

  // ---- your interaction here ----
  await page.screenshot({ path: join(OUT, "dashboard.png") });
  const text = (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 300);
  console.log("dashboard:", text);
  // e.g. open Edit Meal:
  //   await page.getByText("Grilled chicken breast").first().click();
  //   await page.getByText("Edit Meal").first().waitFor();
  // -------------------------------

  await browser.close();
  console.log("DONE");
}

// Run directly (not when imported as a helper).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("FATAL", e); process.exit(1); });
}
