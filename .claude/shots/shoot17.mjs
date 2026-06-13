// Round 17: detail pages verification.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const log = (...a) => console.log('[shoot17]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await sleep(1200);
await page.type('#login-email', 'xyz@gmail.com');
await page.type('#login-password', '123456');
await page.click('.login-btn');
await page.waitForFunction(() => location.pathname.includes('/dashboard'), { timeout: 30000 });
await sleep(2500);

// Internship detail — open first internship from College Space
await page.goto(BASE + '/user/internships', { waitUntil: 'domcontentloaded' });
await sleep(3000);
const detailHref = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find(x => /\/user\/internships\/.+/.test(x.getAttribute('href')||''));
  return a ? a.getAttribute('href') : null;
});
log('internship detail href:', detailHref);
if (detailHref) {
  await page.goto(BASE + detailHref, { waitUntil: 'domcontentloaded' });
  await sleep(2800);
  await page.screenshot({ path: OUT + 's17-internship-detail.png', fullPage: true });
}

// Result review — open first "Review Questions"
await page.goto(BASE + '/user/results', { waitUntil: 'domcontentloaded' });
await sleep(3000);
const reviewHref = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find(x => /\/user\/results\/review\/.+/.test(x.getAttribute('href')||''));
  return a ? a.getAttribute('href') : null;
});
log('review href:', reviewHref);
if (reviewHref) {
  await page.goto(BASE + reviewHref, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page.screenshot({ path: OUT + 's17-result-review.png', fullPage: true });
}

// Practice solve
await page.goto(BASE + '/user/practice', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.body.innerText.includes('mos algo'), { timeout: 15000 }).catch(()=>{});
await sleep(800);
await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')];
  const t = all.filter(e => e.children.length === 0 && e.textContent.trim() === 'mos algo').pop();
  if (t) t.click();
});
await page.waitForFunction(() => /\/user\/practice\/.+/.test(location.pathname), { timeout: 12000 }).catch(()=>{});
await sleep(7000);
await page.screenshot({ path: OUT + 's17-practice-solve.png' });
log('solve url:', await page.evaluate(()=>location.pathname));

await ctx.close();
await browser.close();
log('done');
