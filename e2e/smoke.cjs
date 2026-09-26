/**
 * Web smoke test (optional): opens every main screen of the exported web build on a
 * phone-sized viewport, fails on console errors and saves screenshots to e2e/screenshots.
 *
 *   npx expo export --platform web && node e2e/serve.cjs &   # then:
 *   node e2e/smoke.cjs
 */
const path = require('path');
const fs = require('fs');
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
}

const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const PROFILE = process.env.PROFILE || 'iphone'; // iphone | desktop
const OUT = path.join(__dirname, 'screenshots', PROFILE);
fs.mkdirSync(OUT, { recursive: true });
const CONTEXTS = {
  iphone: { ...playwright.devices['iPhone 14'] },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext(CONTEXTS[PROFILE]);
  const page = await context.newPage();
  const vp = page.viewportSize();
  // Right-hand side of the story card = "next".
  const next = () => page.mouse.click(vp.width / 2 + Math.min(120, vp.width / 4), vp.height / 2);
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('✓', name);
  };
  const expectText = async (text) => {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
  };

  await page.goto(BASE);
  await expectText('Compétition du jour');
  await shot('01-today-locked');

  await page.getByText('Révéler maintenant').first().click();
  await expectText('Le Daily Drop est prêt'.toUpperCase());
  await shot('02-today-revealed');

  await page.goto(`${BASE}/story/2026-09-25`);
  await expectText('TROUBLE IN PARADISE?');
  await shot('03-story-trouble');
  for (let i = 0; i < 3; i++) {
    await next();
    await page.waitForTimeout(500);
  }
  await shot('04-story-next');
  await page.getByLabel('Réagir 😂').click();
  await shot('05-story-reacted');

  await page.goto(`${BASE}/story/2026-09-24`);
  await expectText('BROMANCE');
  await shot('06-story-bromance');

  await page.goto(`${BASE}/story/2026-09-22`);
  await expectText('RECORD BROKEN');
  await shot('06b-story-record');
  // Jump to the last card (the day's battle).
  for (let i = 0; i < 8 && !(await page.getByText('TODAY’S BATTLE').first().isVisible()); i++) {
    await next();
    await page.waitForTimeout(300);
  }
  await expectText('TODAY’S BATTLE');
  await shot('06c-story-battle');

  await page.goto(`${BASE}/story/2026-09-19`);
  await expectText('THE LINK-UP');
  await shot('07-story-linkup');

  await page.goto(`${BASE}/drop`);
  await expectText('Dernier Drop');
  await shot('08-drop-tab');

  await page.goto(`${BASE}/league`);
  await expectText('Classement');
  await shot('09-league');

  await page.goto(`${BASE}/season/2026-08`);
  await expectText('CHAMPION');
  await shot('10-season-recap');

  await page.goto(`${BASE}/me`);
  await expectText('HIPPOLYTE');
  await shot('11-me');

  await page.goto(`${BASE}/player/tom`);
  await expectText('TOM');
  await shot('12-player-tom');

  await page.goto(`${BASE}/people`);
  await expectText('Flora');
  await shot('13-people');

  await page.goto(`${BASE}/history`);
  await expectText('Septembre 2026');
  await shot('14-history');

  await page.goto(`${BASE}/settings`);
  await expectText('Sources de données');
  await shot('15-settings');

  await page.goto(BASE);
  await page.getByText('Simuler le jour suivant').first().click();
  await expectText('Dimanche 27 septembre');
  await shot('16-next-day');

  await browser.close();
  const relevant = errors.filter((e) => !/favicon|DevTools/.test(e));
  if (relevant.length) {
    console.error('Console errors:\n' + relevant.join('\n'));
    process.exit(1);
  }
  console.log(`Web smoke test passed (${PROFILE}).`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
