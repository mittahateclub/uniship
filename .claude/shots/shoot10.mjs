// Round 10: redesigned user pages verification.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot10]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await sleep(1500);
await page.type('#login-email', 'xyz@gmail.com');
await page.type('#login-password', '123456');
await page.click('.login-btn');
await page.waitForFunction(() => location.pathname.includes('/dashboard'), { timeout: 30000 });
await sleep(3000);
log('login PASS');
await page.screenshot({ path: OUT + 's10-dashboard.png' });

for (const [name, path] of [
  ['s10-internships', '/user/internships'],
  ['s10-applications', '/user/applications'],
  ['s10-results', '/user/results'],
  ['s10-practice', '/user/practice'],
  ['s10-testportal', '/user/test-portal'],
]) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await sleep(3200);
  await page.screenshot({ path: OUT + name + '.png' });
  log('shot', name);
}

// Results: open analysis modal (smoke the redesigned modal)
await page.goto(BASE + '/user/results', { waitUntil: 'domcontentloaded' });
await sleep(3200);
const opened = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /View Analysis/.test(b.textContent));
  if (btn) { btn.click(); return true; }
  return false;
});
if (opened) {
  await sleep(3500);
  await page.screenshot({ path: OUT + 's10-results-modal.png' });
  log('analysis modal shot');
}

// light theme spot-check on dashboard
await page.goto(BASE + '/user/dashboard', { waitUntil: 'domcontentloaded' });
await sleep(2500);
await page.click('.theme-btn-chrome');
await sleep(700);
await page.screenshot({ path: OUT + 's10-dashboard-light.png' });

await ctx.close();
await browser.close();
log('done');
