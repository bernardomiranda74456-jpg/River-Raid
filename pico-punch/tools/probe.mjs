// Sonda de estado: executa ações e imprime o estado do herói a cada passo.
import { chromium } from 'playwright';
const [,, query = '?level=1&mode=retro', actions = 'w:500'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text()); }); page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8787/index.html' + query, { waitUntil: 'load' }); await page.waitForTimeout(1200);
const dump = async (label) => console.log(label, await page.evaluate(() => { const g = window.__game, h = g.level?.hero; return h ? `state=${g.state} lv=${g.level.state} hero=(${h.x.toFixed(1)},${h.y.toFixed(1)}) v=(${h.vx.toFixed(0)},${h.vy.toFixed(0)}) hs=${h.state} ground=${h.onGround} frame=${h.frame} lives=${g.save.progress.lives} bot=${g.bot?g.bot.i+':'+Object.keys(g.input.touch).filter(k=>g.input.touch[k]).join('+'):'-'} t=${g.level.time.toFixed(2)} cam=(${g.level.camera.x.toFixed(0)},${g.level.camera.y.toFixed(0)})` : 'no level'; }));
await dump('start');
for (const a of actions.split(',').filter(Boolean)) {
  const [kind, key, ms] = a.split(':');
  if (kind === 'k') { await page.keyboard.down(key); await page.waitForTimeout(+ms || 100); await page.keyboard.up(key); }
  else if (kind === 'w') await page.waitForTimeout(+key);
  await dump(a);
}
await b.close();
