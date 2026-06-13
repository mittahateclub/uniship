// Round 8: protected app verification with real credentials.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname.replace(/^\/(\w):/, '$1:');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
});
const log = (...a) => console.log('[shoot8]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await sleep(800);
  await page.type('#login-email', email);
  await page.type('#login-password', password);
  await page.click('.login-btn');
  await page.waitForFunction(() => location.pathname.includes('/dashboard'), { timeout: 30000 });
  await sleep(2500); // let data load
  return page.url();
}

// ── Student account ──
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  try {
    const url = await login(page, 'xyz@gmail.com', '123456');
    log('user login PASS ->', url);

    await page.screenshot({ path: OUT + 'app-user-dashboard-dark.png' });

    // theme toggle in top chrome works
    const toggles = await page.$$('.theme-btn-chrome');
    log('top-bar toggle count:', toggles.length, toggles.length === 1 ? 'PASS' : 'FAIL');
    await page.click('.theme-btn-chrome');
    await sleep(700);
    await page.screenshot({ path: OUT + 'app-user-dashboard-light.png' });
    await page.click('.theme-btn-chrome'); // back to dark
    await sleep(500);

    for (const [name, path] of [
      ['app-user-internships', '/user/internships'],
      ['app-user-resume', '/user/resume'],
      ['app-user-practice', '/user/practice'],
      ['app-user-results', '/user/results'],
      ['app-user-profile', '/user/profile'],
    ]) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await sleep(3500);
      await page.screenshot({ path: OUT + name + '.png' });
      log('shot', name);
    }

    // mobile dashboard
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE + '/user/dashboard', { waitUntil: 'networkidle0' });
    await sleep(2200);
    await page.screenshot({ path: OUT + 'app-user-dashboard-mobile.png' });
  } catch (e) {
    log('USER FLOW ERROR:', e.message);
    await page.screenshot({ path: OUT + 'app-user-ERROR.png' }).catch(() => {});
  }
  await ctx.close();
}

// ── Uniadmin account ──
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  try {
    const url = await login(page, 'abc@gmail.com', '123456');
    log('uniadmin login PASS ->', url);

    await page.screenshot({ path: OUT + 'app-admin-dashboard-dark.png' });

    for (const [name, path] of [
      ['app-admin-students', '/uniadmin/student-database'],
      ['app-admin-tests', '/uniadmin/tests'],
      ['app-admin-create-event', '/uniadmin/create-event'],
      ['app-admin-analysis', '/uniadmin/analysis'],
    ]) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await sleep(3500);
      await page.screenshot({ path: OUT + name + '.png' });
      log('shot', name);
    }

    // one light-theme admin shot
    await page.click('.theme-btn-chrome');
    await sleep(700);
    await page.screenshot({ path: OUT + 'app-admin-dashboard-light.png' });
  } catch (e) {
    log('ADMIN FLOW ERROR:', e.message);
    await page.screenshot({ path: OUT + 'app-admin-ERROR.png' }).catch(() => {});
  }
  await ctx.close();
}

await browser.close();
log('done');
