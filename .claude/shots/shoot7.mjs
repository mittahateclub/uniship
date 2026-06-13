// Round 7: glass readability, split login, consistent toggle.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot7]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Landing nav readability: top strip at fold AND scrolled over content, both themes
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), theme);
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1500);
  await page.screenshot({ path: OUT + `v8-nav-${theme}-top.png`, clip: { x: 0, y: 0, width: 1440, height: 110 } });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(1200);
  await page.screenshot({ path: OUT + `v8-nav-${theme}-scrolled.png`, captureBeyondViewport: false });
  await page.close();
}

// Login: split layout, both themes + mobile
for (const [name, opts] of [
  ['v8-login-dark', { width: 1440, height: 900, theme: 'dark' }],
  ['v8-login-light', { width: 1440, height: 900, theme: 'light' }],
  ['v8-login-mobile-dark', { width: 390, height: 844, theme: 'dark' }],
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: opts.width, height: opts.height });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), opts.theme);
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await sleep(1200);
  await page.screenshot({ path: OUT + name + '.png' });
  await page.close();
}

// Toggle consistency smoke: exactly one toggle on landing + login, none floating
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1200);
  let c = await page.evaluate(() => ({
    total: document.querySelectorAll('button[aria-label*="Switch to"]').length,
    inNav: document.querySelectorAll('nav .nav-theme-btn').length,
  }));
  log('landing toggles:', JSON.stringify(c), c.total === 1 && c.inNav === 1 ? 'PASS' : 'FAIL');

  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await sleep(1000);
  c = await page.evaluate(() => ({
    total: document.querySelectorAll('button[aria-label*="Switch to"]').length,
    inChrome: document.querySelectorAll('.login-chrome .login-theme-btn').length,
  }));
  log('login toggles:', JSON.stringify(c), c.total === 1 && c.inChrome === 1 ? 'PASS' : 'FAIL');

  // toggle works on login + persists
  await page.click('.login-theme-btn');
  await sleep(400);
  const t1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(800);
  const t2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  log('login toggle ->', t1, 'persisted ->', t2, t1 === 'light' && t2 === 'light' ? 'PASS' : 'FAIL');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.close();
}

await browser.close();
log('done');
