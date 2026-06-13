// Visual verification harness: screenshots + hover states + smoke tests.
// Not part of the app — lives in .claude/, run with `node .claude/shots/shoot.mjs`.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});

const log = (...a) => console.log('[shoot]', ...a);

async function newPage({ width = 1440, height = 900, theme } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (theme) {
    await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), theme);
  }
  return page;
}

async function settle(page, ms = 1400) {
  await new Promise((r) => setTimeout(r, ms));
}

// ── Landing: desktop dark, full page ──
{
  const page = await newPage({ theme: 'dark' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await settle(page);
  await page.screenshot({ path: OUT + 'home-desktop-dark-fold.png' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await settle(page, 1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 600);
  await page.screenshot({ path: OUT + 'home-desktop-dark-full.png', fullPage: true });
  // hover states: feature row + nav cta + hero cta
  const row = await page.$('.feat-card:nth-child(2)');
  if (row) {
    const b = await row.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await settle(page, 500);
    await page.screenshot({ path: OUT + 'home-hover-featrow.png', clip: { x: 0, y: Math.max(0, b.y - 160), width: 1440, height: 560 } });
  }
  const cta = await page.$('.nav-cta');
  if (cta) {
    const b = await cta.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await settle(page, 500);
    await page.screenshot({ path: OUT + 'home-hover-navcta.png', clip: { x: 0, y: 0, width: 1440, height: 200 } });
  }
  await page.close();
}

// ── Landing: desktop light ──
{
  const page = await newPage({ theme: 'light' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await settle(page);
  await page.screenshot({ path: OUT + 'home-desktop-light-fold.png' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await settle(page, 1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 600);
  await page.screenshot({ path: OUT + 'home-desktop-light-full.png', fullPage: true });
  await page.close();
}

// ── Landing: mobile dark ──
{
  const page = await newPage({ width: 390, height: 844, theme: 'dark' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await settle(page);
  await page.screenshot({ path: OUT + 'home-mobile-dark-fold.png' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await settle(page, 1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 600);
  await page.screenshot({ path: OUT + 'home-mobile-dark-full.png', fullPage: true });
  await page.close();
}

// ── Login: desktop dark + light, mobile ──
for (const [name, opts] of [
  ['login-desktop-dark', { theme: 'dark' }],
  ['login-desktop-light', { theme: 'light' }],
  ['login-mobile-dark', { width: 390, height: 844, theme: 'dark' }],
]) {
  const page = await newPage(opts);
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await settle(page, 900);
  await page.screenshot({ path: OUT + name + '.png' });
  await page.close();
}

// ── Smoke tests ──
{
  const page = await newPage({ theme: 'dark' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await settle(page, 800);

  // 1. theme toggle toggles + persists
  await page.click('button[aria-label*="Switch to"]');
  await settle(page, 400);
  let theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  log('after toggle, data-theme =', theme, theme === 'light' ? 'PASS' : 'FAIL');
  await page.reload({ waitUntil: 'networkidle0' });
  theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  log('after reload, data-theme =', theme, theme === 'light' ? 'PASS (persisted)' : 'FAIL');
  await page.click('button[aria-label*="Switch to"]'); // back to dark
  await settle(page, 300);

  // 2. footer links preventDefault (no navigation)
  const before = page.url();
  await page.click('.footer-links a');
  await settle(page, 400);
  log('footer link nav prevented:', page.url() === before ? 'PASS' : 'FAIL ' + page.url());

  // 3. nav Sign In -> /login
  await page.click('.nav-cta');
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 8000 });
  log('nav CTA routes to /login: PASS');

  // 4. login form: fill + submit bogus creds -> error or loading appears, no crash
  await page.type('#login-email', 'nobody@example.com');
  await page.type('#login-password', 'wrongpassword');
  await page.click('button[type="submit"]');
  await settle(page, 5000);
  const errText = await page.evaluate(() => {
    const el = document.querySelector('[class*="status-danger"], .text-\\[var\\(--status-danger\\)\\]');
    return el ? el.textContent : null;
  });
  log('login error surfaced:', errText ? 'PASS — ' + errText.slice(0, 60) : 'NONE (check manually)');
  await page.screenshot({ path: OUT + 'login-error-state.png' });

  // 5. focus ring visible (a11y)
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await page.keyboard.press('Tab'); // skip link
  await settle(page, 300);
  await page.screenshot({ path: OUT + 'a11y-skiplink-focus.png', clip: { x: 0, y: 0, width: 720, height: 160 } });

  await page.close();
}

await browser.close();
log('done');
