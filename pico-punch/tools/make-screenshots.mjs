// Gera o conjunto final de screenshots em screenshots/ (ambos os modos, momentos-chave).
// Estratégia: a cena é "jogada" sempre em retro (rápido mesmo em GL por software) e, para as
// capturas HD, o modo é trocado (TAB) só no momento da foto — exatamente como o jogador pode fazer.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
async function shot(name, query, prep, mode) {
  if (only && !only.test(name)) return;
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8787/index.html' + query, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  if (prep) await page.evaluate(prep);
  // congela a ação e troca para o modo pedido; aguarda o HD aquecer as texturas
  await page.evaluate((m) => { const g = window.__game; g.bot = null; for (const k in g.input.touch) g.input.touch[k] = false; g.loop.timeScale = 0; if (g.level && g.level.hero) g.level.hero.invuln = 0; if (g.mode !== m) g.setMode(m); }, mode);
  await page.waitForFunction((m) => window.__game.mode === m, mode, { timeout: 60000 }); await page.waitForTimeout(mode === 'hd' ? 3000 : 600);
  await page.evaluate(() => { const g = window.__game; if (g.iris) g.iris = { t: 1, dir: 0, dur: 1 }; }); await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshots/${name}.png` }); console.log(name, errs.length ? 'ERROS: ' + errs.join(' | ') : 'ok'); await page.close();
}
// util: segura "direita" (e opcionalmente outros toques) até o tempo de jogo da fase atingir T segundos
const walk = (T, keys = ['right']) => `new Promise(res => { const g = window.__game; ${keys.map((k) => `g.input.touch.${k} = true;`).join('')} const iv = setInterval(() => { if (g.level && g.level.time >= ${T}) { clearInterval(iv); res(1); } }, 50); setTimeout(() => res(1), 60000); })`;
const until = (cond, after = 0) => `new Promise(res => { const g = window.__game; const iv = setInterval(() => { if (${cond}) { clearInterval(iv); setTimeout(res, ${after}); } }, 100); setTimeout(() => res(1), 240000); })`;
for (const mode of ['retro', 'hd']) {
  await shot(`title-${mode}`, `?mode=${mode}`, null, mode);
  await shot(`l1-monte-agulha-${mode}`, `?level=1&mode=retro&fast=4`, walk(1.8), mode);
  await shot(`l3-lago-espelho-agua-${mode}`, `?level=3&mode=retro&fast=4`, walk(11), mode);
  await shot(`l6-estrada-moto-${mode}`, `?level=6&mode=retro&bot=1&fast=4`, until(`g.level && g.level.time >= 9 && g.level.hero.state !== 'dead'`, 0), mode); // a moto corre sozinha: o bot pilota
  await shot(`l7-ceu-helicoptero-${mode}`, `?level=7&mode=retro&fast=4`, walk(6, ['right', 'jump']), mode);
  await shot(`l4-vila-loja-${mode}`, `?level=4&mode=retro&fast=4`, `new Promise(res => { const g = window.__game; g.level.money = 320; g.input.touch.right = true; const iv = setInterval(() => { const d = g.level.entities.find(e => e.type === 'shop'); if (d && g.level.hero.overlaps(d)) { clearInterval(iv); g.input.touch.right = false; g.input.touch.up = true; setTimeout(() => { g.input.touch.up = false; res(1); }, 600); } }, 50); setTimeout(() => res(1), 40000); })`, mode);
  await shot(`l2-duelo-${mode}`, `?level=2&mode=retro&bot=1&fast=5`, until(`g.state === 'duel'`, 1400), mode);
  await shot(`l2-chefe-ra-rei-${mode}`, `?level=2&mode=retro&bot=1&fast=5&autoduel=1`, until(`g.level && g.level.state === 'boss'`, 0) + `.then(() => { const g = window.__game; g.bot = null; for (const k in g.input.touch) g.input.touch[k] = false; g.loop.timeScale = 1; g.level.hero.invuln = 99; return new Promise(r => setTimeout(r, 1500)); })`, mode);
  await shot(`l8-caverna-lava-${mode}`, `?level=8&mode=retro&fast=4`, walk(4), mode);
  await shot(`l9-cidade-noite-${mode}`, `?level=9&mode=retro&fast=4`, walk(4), mode);
  await shot(`l10-castelo-${mode}`, `?level=10&mode=retro&fast=4`, walk(3), mode);
  await shot(`l5-ruinas-por-do-sol-${mode}`, `?level=5&mode=retro&fast=4`, walk(4), mode);
}
await shot('l1-retro-crt', '?level=1&mode=retro&crt=1&fast=4', walk(1.8), 'retro');
await shot('l1-hd-crt', '?level=1&mode=retro&crt=1&fast=4', walk(1.8), 'hd');
await b.close();
