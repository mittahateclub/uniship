// Round 9: full protected-app coverage after the view sweep.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot9]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.type('#login-email', email);
  await page.type('#login-password', password);
  await page.click('.login-btn');
  await page.waitForFunction(() => location.pathname.includes('/dashboard'), { timeout: 30000 });
  await sleep(3000);
}

async function shoot(page, name, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await sleep(3200);
  await page.screenshot({ path: OUT + name + '.png' });
  log('shot', name);
}

// Student
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  try {
    await login(page, 'xyz@gmail.com', '123456');
    log('user login PASS');
    await page.screenshot({ path: OUT + 's9-u-dashboard.png' });
    await shoot(page, 's9-u-applications', '/user/applications');
    await shoot(page, 's9-u-calendar', '/user/calendar');
    await shoot(page, 's9-u-testportal', '/user/test-portal');
    await shoot(page, 's9-u-practice', '/user/practice');
    await shoot(page, 's9-u-results', '/user/results');
    await shoot(page, 's9-u-profile', '/user/profile');
  } catch (e) {
    log('USER ERROR:', e.message);
  }
  await ctx.close();
}

// Uniadmin
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  try {
    await login(page, 'abc@gmail.com', '123456');
    log('admin login PASS');
    await page.screenshot({ path: OUT + 's9-a-dashboard.png' });
    await shoot(page, 's9-a-manage', '/uniadmin/manage');
    await shoot(page, 's9-a-create-test', '/uniadmin/create-test');
    await shoot(page, 's9-a-proctoring', '/uniadmin/proctoring');
    await shoot(page, 's9-a-profile', '/uniadmin/profile');
    await shoot(page, 's9-a-practice', '/uniadmin/practice');
  } catch (e) {
    log('ADMIN ERROR:', e.message);
  }
  await ctx.close();
}

await browser.close();
log('done');
