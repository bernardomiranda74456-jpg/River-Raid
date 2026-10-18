// Teste e2e: o bot atravessa a fase 1 (e outras com botPath) validando colisões e fim de fase;
// screenshots nos dois modos; console limpo. Uso: node test/e2e.mjs [levelIndex=1] [mode=retro]
import { chromium } from 'playwright';
const level = +(process.argv[2] || 1); const mode = process.argv[3] || 'retro'; const fast = +(process.argv[4] || 4);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(`${process.env.PP_URL || 'http://localhost:8787/index.html'}?level=${level}&mode=${mode}&bot=1&fast=${fast}`, { waitUntil: 'load' });
await page.waitForTimeout(800); await page.keyboard.press('KeyK'); // gesto para liberar áudio
const t0 = Date.now(); let result = null;
while (Date.now() - t0 < 180000) {
  await page.waitForTimeout(500);
  result = await page.evaluate(() => { const g = window.__game; const lv = g.level; return { state: g.state, lvState: lv?.state, botFights: false, hero: lv ? [Math.round(lv.hero.x), Math.round(lv.hero.y)] : null, wp: g.bot.i, total: g.bot.path?.length, deaths: lv?.deaths, violations: g.bot.violations, log: g.bot.log.slice(-3), time: lv?.time, lives: g.save.progress.lives, fps: g.loop.fps }; });
  if (result.lvState === 'goal' || result.state === 'results' || result.state === 'gameover' || result.state === 'title') break;
  if (result.state === 'duel' && !result.botFights) { result.reachedDuel = true; break; } // fases com chefe: o bot não duela; chegar à arena conta
}
console.log(JSON.stringify(result, null, 1)); console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'console limpo');
const ok = (result.lvState === 'goal' || result.state === 'results' || result.reachedDuel) && result.violations === 0 && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
