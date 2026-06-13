// Round 15: refinement batch verification.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const log = (...a) => console.log('[shoot15]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Login: password toggle
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await page.type('#login-password', 'secret123');
  await page.screenshot({ path: OUT + 's15-login-hidden.png', clip: { x: 820, y: 360, width: 420, height: 200 } });
  const t1 = await page.$eval('#login-password', el => el.type);
  await page.click('.login-eye');
  await sleep(250);
  const t2 = await page.$eval('#login-password', el => el.type);
  log('password toggle:', t1, '->', t2, (t1==='password'&&t2==='text') ? 'PASS' : 'FAIL');
  await page.screenshot({ path: OUT + 's15-login-shown.png', clip: { x: 820, y: 360, width: 420, height: 200 } });
  await page.close();
}

// Authed pages
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await sleep(1200);
await page.type('#login-email', 'xyz@gmail.com');
await page.type('#login-password', '123456');
await page.click('.login-btn');
await page.waitForFunction(() => location.pathname.includes('/dashboard'), { timeout: 30000 });
await sleep(2500);
// sidebar icons (fill weight)
await page.screenshot({ path: OUT + 's15-sidebar.png', clip: { x: 0, y: 55, width: 240, height: 430 } });
// cmdk
await page.evaluate(() => document.dispatchEvent(new CustomEvent('open-cmdk')));
await sleep(700);
await page.screenshot({ path: OUT + 's15-cmdk.png', clip: { x: 360, y: 120, width: 720, height: 520 } });
await page.keyboard.press('Escape');
await sleep(300);

async function shoot(name, path, full=false) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page.screenshot({ path: OUT + name + '.png', fullPage: full });
}
await shoot('s15-profile', '/user/profile');
await shoot('s15-calendar', '/user/calendar');
// select a non-today date in calendar to test number visibility
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => /^\d+$/.test(b.querySelector('span')?.textContent?.trim() || ''));
  // click a date that's not today (pick the 20th of month)
  const target = btns.find(b => b.querySelector('span')?.textContent?.trim() === '20');
  if (target) target.click();
});
await sleep(600);
await page.screenshot({ path: OUT + 's15-calendar-selected.png' });
await shoot('s15-export', '/user/resume/download');

await ctx.close();
await browser.close();
log('done');
