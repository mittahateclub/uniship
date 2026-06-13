// Round 3: feature-row hover (document-coordinate clip) + reduced-motion render.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot3]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Feature-row hover — keep the row inside the current viewport and clip
// viewport-relative (no fullPage), so coordinates agree.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('theme', 'dark'));
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(1000);
  // bring features into view stepwise so reveals fire
  for (let y = 0; y < 4000; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(180);
  }
  await page.evaluate(() => {
    document.querySelector('.feat-cards .feat-card:nth-child(2)').scrollIntoView({ block: 'center' });
  });
  await sleep(900);
  const b = await (await page.$('.feat-cards .feat-card:nth-child(2)')).boundingBox();
  await page.mouse.move(b.x + 400, b.y + b.height / 2, { steps: 8 });
  await sleep(600);
  await page.screenshot({ path: OUT + 'home3-hover-featrow.png' });
  await page.close();
}

// Reduced motion: everything must render static & visible with no sweep.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => localStorage.setItem('theme', 'dark'));
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await sleep(800);
  // jump straight to the middle WITHOUT stepwise scroll — content must be visible
  await page.evaluate(() => document.getElementById('about').scrollIntoView());
  await sleep(400);
  await page.screenshot({ path: OUT + 'home3-reduced-motion-about.png' });
  const visible = await page.evaluate(() => {
    const el = document.querySelector('.about-body');
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform };
  });
  log('reduced-motion about-body:', JSON.stringify(visible), visible.opacity === '1' ? 'PASS' : 'FAIL');
  await page.close();
}

await browser.close();
log('done');
