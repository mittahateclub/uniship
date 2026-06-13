// Round 2: stepwise scrolling (real-user-like) so in-view reveals fire,
// hover-state probes, theme persistence without injection.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot2]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage({ width = 1440, height = 900, theme } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  if (theme) await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), theme);
  return page;
}

// Scroll through the whole page in viewport-sized steps so every
// section intersects and reveals, then return to top.
async function sweep(page) {
  const total = await page.evaluate(() => document.body.scrollHeight);
  const vh = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y <= total; y += Math.round(vh * 0.7)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(220);
  }
  await sleep(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(900);
}

// ── Landing full pages, both themes + mobile ──
for (const [name, opts] of [
  ['home2-desktop-dark', { theme: 'dark' }],
  ['home2-desktop-light', { theme: 'light' }],
  ['home2-mobile-dark', { width: 390, height: 844, theme: 'dark' }],
]) {
  const page = await newPage(opts);
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1200);
  await sweep(page);
  await page.screenshot({ path: OUT + name + '-full.png', fullPage: true });
  await page.close();
}

// ── Hover states + computed-style probes (desktop dark) ──
{
  const page = await newPage({ theme: 'dark' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1200);
  await sweep(page);

  // nav CTA hover: computed text color must be the ink, not blue
  const cta = await page.$('.nav-cta');
  let b = await cta.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await sleep(600);
  const ctaColors = await page.evaluate(() => {
    const el = document.querySelector('.nav-cta');
    const cs = getComputedStyle(el);
    const after = getComputedStyle(el, '::after');
    return { color: cs.color, afterBg: after.backgroundColor, afterTransform: after.transform };
  });
  log('nav-cta hover colors:', JSON.stringify(ctaColors));
  await page.screenshot({ path: OUT + 'home2-hover-navcta.png', clip: { x: 900, y: 0, width: 540, height: 120 } });

  // feature row hover (row 2 — "Mock Tests & Assessments")
  const row = await page.$('.feat-cards .feat-card:nth-child(2)');
  b = await row.boundingBox();
  await page.evaluate((yy) => window.scrollTo(0, yy - 300), b.y);
  await sleep(700);
  b = await row.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await sleep(600);
  await page.screenshot({ path: OUT + 'home2-hover-featrow.png', clip: { x: 0, y: b.y - 120, width: 1440, height: 420 } });

  // hero CTA magnetic + fill hover
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  const hcta = await page.$('.hero-cta');
  b = await hcta.boundingBox();
  await page.mouse.move(b.x + b.width / 2 + 8, b.y + b.height / 2 + 4, { steps: 6 });
  await sleep(600);
  await page.screenshot({ path: OUT + 'home2-hover-herocta.png', clip: { x: Math.max(0, b.x - 200), y: Math.max(0, b.y - 120), width: 700, height: 320 } });
  await page.close();
}

// ── Theme persistence (no injection: toggle on the real page, reload) ──
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(800);
  const start = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');
  await page.click('button[aria-label*="Switch to"]');
  await sleep(300);
  const toggled = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(600);
  const persisted = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  log(`theme: start=${start} toggled=${toggled} persisted=${persisted}`, toggled === persisted ? 'PASS' : 'FAIL');
  // restore
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.close();
}

await browser.close();
log('done');
