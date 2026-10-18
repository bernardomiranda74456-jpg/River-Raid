import { chromium } from 'playwright';
const file = process.argv[2]; const fast = +(process.argv[3] || 5); const maxMs = +(process.argv[4] || 180000);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(`http://localhost:8787/index.html?file=${file}&mode=retro&bot=1&fast=${fast}`, { waitUntil: 'load' });
await page.waitForTimeout(800); await page.keyboard.press('KeyK');
const t0 = Date.now(); let result = null; let lastDeaths = 0; const deathSpots = [];
while (Date.now() - t0 < maxMs) {
  await page.waitForTimeout(300);
  result = await page.evaluate(() => { const g = window.__game; const lv = g.level; return { state: g.state, lvState: lv?.state, hero: lv ? [Math.round(lv.hero.x), Math.round(lv.hero.y)] : null, wp: g.bot.i, total: g.bot.path?.length, deaths: lv?.deaths, violations: g.bot.violations, log: g.bot.log.slice(-40), time: lv?.time, lives: g.save.progress.lives }; });
  if (result.deaths !== lastDeaths) { deathSpots.push(`death ${result.deaths} near tile ${(result.hero[0] / 16).toFixed(1)},${(result.hero[1] / 16).toFixed(1)} wp=${result.wp} t=${result.time?.toFixed(1)}`); lastDeaths = result.deaths; }
  if (result.lvState === 'goal' || result.state === 'results' || result.state === 'gameover' || result.state === 'title' || result.deaths >= 6) break;
}
console.log(JSON.stringify({ ...result, log: undefined }, null, 0)); console.log(deathSpots.join('\n')); console.log(result.log.join('\n'));
await b.close();
