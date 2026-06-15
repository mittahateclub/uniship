// UniShip visual-verification harness (reusable). Replaces the old one-off shootN.mjs scripts.
//
// Prereqs: npm run build && npm run start  (server on :3000)
// Usage:   node .claude/shots/verify.mjs [routes...] [flags]
//   routes : space-separated paths, e.g. /user/results /user/calendar  (default: a small user set)
//   --admin        log in as uniadmin (abc@gmail.com) instead of student (xyz@gmail.com)
//   --mobile       390px iPhone viewport (default 1440x900 desktop)
//   --light        switch to light theme before each shot (default dark)
//   --skel         CPU-throttle + poll for `.skeleton`, capture the loading state
//   --full         full-page screenshots
// Output: .claude/shots/out/<sanitized-route>.png   (this dir is gitignored)
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const routes = args.filter((a) => !a.startsWith('--'));
const has = (f) => flags.has(f);
const ROUTES = routes.length ? routes : ['/user/dashboard', '/user/results', '/user/applications', '/user/calendar', '/user/practice'];
const CREDS = has('--admin') ? ['abc@gmail.com', '123456'] : ['xyz@gmail.com', '123456'];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
if (has('--mobile')) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
else await page.setViewport({ width: 1440, height: 950 });

// Firebase keeps sockets open — use domcontentloaded + sleep, never networkidle0.
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await sleep(1200);
await page.type('#login-email', CREDS[0]);
await page.type('#login-password', CREDS[1]);
await page.click('.login-btn');
await page.waitForFunction(() => /\/(dashboard|user|uniadmin)/.test(location.pathname), { timeout: 30000 });
await sleep(2200);

let client;
if (has('--skel')) {
  client = await page.target().createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
}
const setTheme = (t) => page.evaluate((th) => document.documentElement.setAttribute('data-theme', th), t);
const name = (r) => r.replace(/^\//, '').replace(/[^\w.-]+/g, '-') || 'root';

for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  if (has('--skel')) {
    let ok = false;
    for (let i = 0; i < 45; i++) {
      if (await page.evaluate(() => !!document.querySelector('.skeleton')).catch(() => false)) { ok = true; break; }
      await sleep(50);
    }
    if (!ok) { console.log('[verify] no skeleton:', route); continue; }
  } else {
    await sleep(2800);
  }
  if (has('--light')) { await setTheme('light'); await sleep(400); }
  await page.screenshot({ path: OUT + name(route) + '.png', fullPage: has('--full') });
  console.log('[verify] shot', route);
}

if (client) await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await ctx.close();
await browser.close();
console.log('[verify] done →', OUT);
