// Round 5: light mode + compact hero card + glass nav.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot5]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sweep(page) {
  const total = await page.evaluate(() => document.body.scrollHeight);
  const vh = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y <= total; y += Math.round(vh * 0.7)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(200);
  }
  await sleep(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
}

for (const [name, opts] of [
  ['v5-desktop-dark', { width: 1440, height: 900, theme: 'dark' }],
  ['v5-desktop-light', { width: 1440, height: 900, theme: 'light' }],
  ['v5-mobile-dark', { width: 390, height: 844, theme: 'dark' }],
  ['v5-mobile-light', { width: 390, height: 844, theme: 'light' }],
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: opts.width, height: opts.height });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), opts.theme);
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1500);
  await page.screenshot({ path: OUT + name + '-fold.png' });
  await sweep(page);
  await page.screenshot({ path: OUT + name + '-full.png', fullPage: true });
  await page.close();
}

// glass nav over content (scrolled) — both themes
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), theme);
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1200);
  await page.evaluate(() => window.scrollTo(0, 700));
  await sleep(900);
  await page.screenshot({ path: OUT + 'v5-glassnav-' + theme + '.png', clip: { x: 0, y: 0, width: 1440, height: 260 } });
  await page.close();
}

await browser.close();
log('done');
