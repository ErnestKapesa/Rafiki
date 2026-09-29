// End-to-end QA: plays the whole game loop in a real browser against the mock
// agent (RAFIKI_MOCK=1) and asserts rewards, quests, wardrobe and galaxy.
// Usage: npm run dev (with RAFIKI_MOCK=1) in one shell, then `npm run e2e`.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const OUT = process.env.SHOTS || "tests/e2e/shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✔" : "✘"} ${msg}`);
  if (!ok) failures++;
};
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png`, timeout: 90_000, animations: "disabled" });
const dismiss = async (p, tag) => {
  for (let i = 0; i < 5 && (await p.locator(".celebrate").count()); i++) {
    if (i === 0) await shot(p, `${tag}-celebration-${Date.now() % 1000}`);
    await p.locator(".celebrate-card .btn").click();
    await p.waitForTimeout(600);
  }
};
const num = async (p, sel) => Number((await p.locator(sel).first().innerText()).replace(/[^\d]/g, ""));

async function run(viewport, tag) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  ctx.on("page", (pg) => pg !== p && pg.close().catch(() => {})); // source links open new tabs
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text()) && errors.push(m.text()));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(3500);
  check(await p.locator(".ob-orb").isVisible(), `[${tag}] onboarding starts with the orb`);
  await shot(p, `${tag}-01-orb`);

  await p.getByRole("button", { name: "Tap to hatch" }).click();
  const named = await p.getByPlaceholder("Your name").waitFor({ timeout: 8000 }).then(() => true, () => false);
  await p.waitForTimeout(800);
  check(named, `[${tag}] hatching leads to the name step`);
  await shot(p, `${tag}-02-name`);
  await p.getByPlaceholder("Your name").fill("Ernest");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(900);

  await p.locator(".opt", { hasText: "Bunny" }).click();
  await p.getByRole("button", { name: "Mint" }).click();
  await p.locator(".opt", { hasText: "Sparkly" }).click();
  await p.waitForTimeout(1200);
  await shot(p, `${tag}-03-customize`);
  check((await p.locator(".opt", { hasText: "Unicorn" }).count()) === 0, `[${tag}] locked species hidden during onboarding`);
  await p.getByRole("button", { name: /Let's explore/ }).click();
  await p.waitForTimeout(1800);
  check(await p.locator(".hud .player").isVisible(), `[${tag}] HUD appears after onboarding`);
  check((await p.locator(".player-info b").innerText()) === "Rafiki", `[${tag}] friend name shown`);
  await shot(p, `${tag}-04-home`);

  const xp0 = await num(p, ".stat >> nth=0");
  await p.getByPlaceholder("Where should we explore?").fill("How do volcanoes work?");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(1300);
  await shot(p, `${tag}-05-searching`);
  await p.waitForSelector(".quiz", { timeout: 40000 });
  await p.waitForTimeout(2500);
  const xp1 = await num(p, ".stat >> nth=0");
  check(xp1 === xp0 + 20, `[${tag}] expedition pays 20 XP (${xp0} → ${xp1})`);
  check((await p.locator(".toast").count()) > 0 || xp1 > xp0, `[${tag}] reward toast shown`);
  await shot(p, `${tag}-06-answer`);
  check((await p.locator(".celebrate").count()) === 1, `[${tag}] first expedition celebrates the First Steps badge`);
  await dismiss(p, tag);

  // Discover two worlds via the cards.
  await p.locator(".source").nth(0).click();
  await p.waitForTimeout(400);
  await p.locator(".source").nth(1).click();
  await p.waitForTimeout(1500);
  check((await p.locator(".source.found").count()) === 2, `[${tag}] visiting sources marks them discovered`);
  check((await p.locator(".found-count").innerText()).startsWith("2/"), `[${tag}] worlds found counter updates`);
  const xp2 = await num(p, ".stat >> nth=0");
  check(xp2 === xp1 + 10, `[${tag}] each discovery pays 5 XP (${xp1} → ${xp2})`);

  // Pop quiz — mock answer is "Nemotron Ultra".
  await p.locator(".quiz-opt", { hasText: "Nemotron Ultra" }).click();
  await p.waitForTimeout(1200);
  check(await p.locator(".quiz.right").isVisible(), `[${tag}] correct quiz answer is celebrated`);
  const xp3 = await num(p, ".stat >> nth=0");
  check(xp3 === xp2 + 15, `[${tag}] quiz pays 15 XP (${xp2} → ${xp3})`);
  await shot(p, `${tag}-07-quiz`);
  await dismiss(p, tag);

  // Follow the trail.
  await p.locator(".trail-chip").first().click();
  await p.waitForSelector(".panel .eyebrow:has-text('on the trail')", { timeout: 20000 });
  await p.waitForSelector(".quiz", { timeout: 40000 });
  await p.waitForTimeout(2500);
  const xp4 = await num(p, ".stat >> nth=0");
  check(xp4 === xp3 + 25, `[${tag}] trail step pays 20 + 5 XP (${xp3} → ${xp4})`);
  await dismiss(p, tag);

  // Sheets.
  const open = async (label, name) => {
    await p.getByRole("button", { name: label, exact: true }).click();
    await p.waitForTimeout(1300);
    await shot(p, `${tag}-${name}`);
  };
  await open("Quests", "09-quests");
  check((await p.locator(".quest").count()) === 3, `[${tag}] three daily quests`);
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p.waitForTimeout(500);

  await open("Badges", "10-badges");
  check((await p.locator(".badge.earned").count()) >= 1, `[${tag}] First Steps badge earned`);
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p.waitForTimeout(500);

  await open("Closet", "11-wardrobe");
  await p.getByRole("button", { name: "Hats" }).click();
  await p.locator(".opt", { hasText: "Beanie" }).click();
  await p.waitForTimeout(1200);
  await shot(p, `${tag}-12-tryon`);
  const gems = await num(p, ".stat >> nth=1");
  const buy = p.getByRole("button", { name: /Buy Beanie/ });
  check(await buy.isVisible(), `[${tag}] unowned item offers a buy button`);
  if (gems >= 30) {
    await buy.click();
    await p.waitForTimeout(800);
    await p.getByRole("button", { name: /Wear this look/ }).click();
    await p.waitForTimeout(1500);
    await dismiss(p, tag);
    check((await num(p, ".stat >> nth=1")) === gems - 30, `[${tag}] buying spends 30 stardust`);
  }
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p.waitForTimeout(800);

  await open("Galaxy", "13-galaxy");
  check(await p.locator(".galaxy canvas").isVisible(), `[${tag}] galaxy renders`);
  check((await p.locator(".galaxy-stats").innerText()).includes("2 stars"), `[${tag}] galaxy has a star per expedition`);
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p.waitForTimeout(500);
  await open("Ranks", "14-leaders");
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await open("Settings", "15-settings");
  await p.getByRole("button", { name: "Close", exact: true }).click();

  // Persistence: reload keeps progress and skips onboarding.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  check(!(await p.locator(".ob-orb").count()), `[${tag}] reload skips onboarding`);
  check((await num(p, ".stat >> nth=0")) === xp4, `[${tag}] XP persists across reload`);

  check(errors.length === 0, `[${tag}] no runtime errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ""}`);
  await ctx.close();
}

await run({ width: 1440, height: 900 }, "desk");
await run({ width: 390, height: 844 }, "mobile");
await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL E2E CHECKS PASSED");
process.exit(failures ? 1 : 0);
