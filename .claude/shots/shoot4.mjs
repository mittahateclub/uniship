// Round 4: Linear-style landing verification.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot4]', ...a);
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

// Desktop
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1500);
  await page.screenshot({ path: OUT + 'lin-desktop-fold.png' });
  await sweep(page);
  await page.screenshot({ path: OUT + 'lin-desktop-full.png', fullPage: true });

  // hover: feature card
  await page.evaluate(() => {
    document.querySelector('.feat-grid .feat-card:nth-child(2)').scrollIntoView({ block: 'center' });
  });
  await sleep(800);
  let b = await (await page.$('.feat-grid .feat-card:nth-child(2)')).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await sleep(500);
  await page.screenshot({ path: OUT + 'lin-hover-card.png' });

  // hover: nav CTA
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(700);
  b = await (await page.$('.nav-cta')).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await sleep(400);
  await page.screenshot({ path: OUT + 'lin-hover-navcta.png', clip: { x: 0, y: 0, width: 1440, height: 400 } });

  // nav anchor smoke: click "Features" -> scrolls to section
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await page.click('.nav-links button:nth-child(2)');
  await sleep(1600);
  const y = await page.evaluate(() => window.scrollY);
  log('nav Features anchor scrolled to y =', Math.round(y), y > 500 ? 'PASS' : 'FAIL');
  await page.close();
}

// Mobile
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1500);
  await page.screenshot({ path: OUT + 'lin-mobile-fold.png' });
  await sweep(page);
  await page.screenshot({ path: OUT + 'lin-mobile-full.png', fullPage: true });
  await page.close();
}

await browser.close();
log('done');
