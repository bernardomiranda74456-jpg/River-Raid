// Gera o conjunto final de screenshots em screenshots/ (ambos os modos, momentos-chave).
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name, query, prep) {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8787/index.html' + query, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  if (prep) await page.evaluate(prep); await page.waitForTimeout(600);
  await page.evaluate(() => { const g = window.__game; if (g.iris) g.iris = { t: 1, dir: 0, dur: 1 }; });
  await page.waitForTimeout(200); await page.screenshot({ path: `screenshots/${name}.png` }); console.log(name, errs.length ? 'ERROS: ' + errs.join(' | ') : 'ok'); await page.close();
}
// util: anda com o herói por N ms de jogo usando o toque virtual
const walk = (ms, extra = '') => `new Promise(res => { const g = window.__game; g.input.touch.right = true; setTimeout(() => { g.input.touch.right = false; ${extra} res(1); }, ${ms}); })`;
for (const mode of ['retro', 'hd']) {
  await shot(`title-${mode}`, `?mode=${mode}`);
  await shot(`l1-monte-agulha-${mode}`, `?level=1&mode=${mode}`, walk(900));
  await shot(`l3-lago-espelho-agua-${mode}`, `?level=3&mode=${mode}&fast=2`, walk(4200));
  await shot(`l6-estrada-moto-${mode}`, `?level=6&mode=${mode}&fast=2`, walk(2500));
  await shot(`l7-ceu-helicoptero-${mode}`, `?level=7&mode=${mode}&fast=2`, `new Promise(res => { const g = window.__game; g.input.touch.right = true; g.input.touch.jump = true; setTimeout(() => { g.input.touch.right = false; g.input.touch.jump = false; res(1); }, 1800); })`);
  await shot(`l4-vila-loja-${mode}`, `?level=4&mode=${mode}`, `new Promise(res => { const g = window.__game; g.level.money = 320; g.input.touch.right = true; setTimeout(() => { g.input.touch.right = false; g.input.touch.up = true; setTimeout(() => { g.input.touch.up = false; res(1); }, 400); }, 1500); })`);
  await shot(`l2-duelo-${mode}`, `?level=2&mode=${mode}&bot=1&fast=5`, `new Promise(res => { const g = window.__game; const iv = setInterval(() => { if (g.state === 'duel') { clearInterval(iv); g.bot = null; for (const k in g.input.touch) g.input.touch[k] = false; setTimeout(res, 1400); } }, 200); setTimeout(() => res(1), 120000); })`);
  await shot(`l2-chefe-ra-rei-${mode}`, `?level=2&mode=${mode}&bot=1&fast=5&autoduel=1`, `new Promise(res => { const g = window.__game; const iv = setInterval(() => { if (g.level && g.level.state === 'boss') { clearInterval(iv); g.bot = null; for (const k in g.input.touch) g.input.touch[k] = false; setTimeout(res, 1200); } }, 200); setTimeout(() => res(1), 150000); })`);
  await shot(`l8-caverna-lava-${mode}`, `?level=8&mode=${mode}&fast=2`, walk(2000));
  await shot(`l9-cidade-noite-${mode}`, `?level=9&mode=${mode}&fast=2`, walk(2000));
  await shot(`l10-castelo-${mode}`, `?level=10&mode=${mode}&fast=2`, walk(1500));
  await shot(`l5-ruinas-por-do-sol-${mode}`, `?level=5&mode=${mode}&fast=2`, walk(2000));
}
await shot('l1-retro-crt', '?level=1&mode=retro&crt=1', walk(900));
await shot('l1-hd-crt', '?level=1&mode=hd&crt=1', walk(900));
await b.close();
