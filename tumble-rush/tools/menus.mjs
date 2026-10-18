// Screenshots of menu, skins, settings, results and the mobile layout.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const port = 8790;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const out = path.join(root, 'screenshots'); fs.mkdirSync(out, { recursive: true });
const logs = [];
async function run(ctxOpts, prefix, mobile) {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${prefix} ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[${prefix} pageerror] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 60000 }); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, `${prefix}-menu.png`) });
  await page.click('#btn-skins'); await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, `${prefix}-skins.png`) }); await page.click('#btn-skins-back');
  await page.click('#btn-settings'); await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, `${prefix}-settings.png`) }); await page.click('#btn-settings-back');
  if (mobile) {
    await page.evaluate(() => { const g = window.__game; g.settings.applyPreset('low'); g.testDt = 1 / 20; g.skipRender = true; });
    await page.click('#btn-play');
    await page.evaluate(() => new Promise((res) => { const g = window.__game; const target = g.frame + 160; const chk = () => (g.frame >= target ? res() : setTimeout(chk, 100)); chk(); }));
    await page.evaluate(() => { const g = window.__game; g.testDt = 0.00001; g.skipRender = false; g.settings.applyPreset('medium'); g.ui.touch.enabled = true; g.ui.showHud(true); });
    await page.evaluate(() => new Promise((res) => { const g = window.__game; const target = g.frame + 3; const chk = () => (g.frame >= target ? res() : setTimeout(chk, 100)); chk(); }));
    await page.screenshot({ path: path.join(out, `${prefix}-hud.png`) });
  } else {
    await page.evaluate(() => { window.__game.ui.showResults({ won: true, roundReached: 3, podium: [{ name: 'Você', skin: { name: 'Tangerina', colA: '#ff6b35', colB: '#ffd23f', pattern: 1, accent: '#2b2d42', hat: 'cap', eye: '#2d7bd6' } }, { name: 'Pipoca', skin: { colA: '#3fa7ff', colB: '#dff6ff', pattern: 2, accent: '#ffffff', hat: 'headband', eye: '#1b4d8a' } }, { name: 'Bolota', skin: { colA: '#8fd14f', colB: '#2e7d32', pattern: 3, accent: '#ffeb3b', hat: 'antenna', eye: '#5a3d1a' } }], playerRank: 1, eliminatedRound: null }); });
    await page.waitForTimeout(200); await page.screenshot({ path: path.join(out, `${prefix}-results.png`) });
  }
  await ctx.close();
}
await run({ viewport: { width: 1280, height: 720 } }, 'ui', false);
await run({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, 'mobile', true);
console.log('console messages:', logs.length); for (const l of logs) console.log(l);
await browser.close(); server.kill();
