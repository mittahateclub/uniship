// Round 6: nav theme toggle + Linear login.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot6]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Landing: inline toggle present in nav, fixed toggle absent; toggle works + persists
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1500);

  const counts = await page.evaluate(() => ({
    inline: document.querySelectorAll('.nav-theme-btn').length,
    fixed: document.querySelectorAll('button.fixed[aria-label*="Switch to"]').length,
  }));
  log('landing toggles — inline:', counts.inline, 'fixed:', counts.fixed,
    counts.inline === 1 && counts.fixed === 0 ? 'PASS' : 'FAIL');

  await page.screenshot({ path: OUT + 'v7-landing-nav-dark.png', clip: { x: 0, y: 0, width: 1440, height: 120 } });

  await page.click('.nav-theme-btn');
  await sleep(600);
  const theme1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.screenshot({ path: OUT + 'v7-landing-nav-light.png', clip: { x: 0, y: 0, width: 1440, height: 120 } });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(900);
  const theme2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  log('nav toggle:', theme1, '— persisted after reload:', theme2, theme1 === 'light' && theme2 === 'light' ? 'PASS' : 'FAIL');
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.close();
}

// 2. Login: both themes, desktop + mobile; fixed toggle present there
for (const [name, opts] of [
  ['v7-login-dark', { width: 1440, height: 900, theme: 'dark' }],
  ['v7-login-light', { width: 1440, height: 900, theme: 'light' }],
  ['v7-login-mobile-dark', { width: 390, height: 844, theme: 'dark' }],
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: opts.width, height: opts.height });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), opts.theme);
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await sleep(1200);
  await page.screenshot({ path: OUT + name + '.png' });
  await page.close();
}

// 3. Login smoke: fixed toggle exists, form still submits and errors
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await sleep(1000);
  const fixedCount = await page.evaluate(() => document.querySelectorAll('button.fixed[aria-label*="Switch to"]').length);
  log('login fixed toggle present:', fixedCount === 1 ? 'PASS' : 'FAIL (' + fixedCount + ')');

  await page.type('#login-email', 'nobody@example.com');
  await page.type('#login-password', 'wrongpassword');
  await page.click('.login-btn');
  await sleep(5000);
  const err = await page.evaluate(() => document.querySelector('.login-error')?.textContent || null);
  log('login error surfaced:', err ? 'PASS — ' + err.slice(0, 50) : 'NONE');
  await page.screenshot({ path: OUT + 'v7-login-error.png' });

  // focus ring on input
  await page.focus('#login-email');
  await sleep(300);
  await page.screenshot({ path: OUT + 'v7-login-focus.png', clip: { x: 420, y: 200, width: 600, height: 500 } });
  await page.close();
}

await browser.close();
log('done');
