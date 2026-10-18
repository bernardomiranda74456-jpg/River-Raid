// Captura screenshots do jogo em headless (Chromium + SwiftShader) e verifica o
// console. Uso: node tools/screenshots.mjs [--base http://127.0.0.1:8080/fuga-nos-trilhos/] [--out screenshots] [--only nome]
// Requer um servidor estático servindo a raiz do repositório (ex.: python -m http.server 8080 na pasta River-Raid).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base', 'http://127.0.0.1:8080/fuga-nos-trilhos/');
const OUT = opt('--out', 'screenshots');
const ONLY = opt('--only', null);
const QUALITY = opt('--quality', 'ultra');
const W = parseInt(opt('--w', '1280'), 10), H = parseInt(opt('--h', '720'), 10);
fs.mkdirSync(OUT, { recursive: true });

// Cenários: parâmetros de URL + ações via API de depuração (window.__game.debug())
const SCENARIOS = [
  { name: '01-inicio-manha', url: 'auto=1&tod=8.2&seed=11&quality=' + QUALITY, wait: 2500 },
  { name: '02-alta-velocidade', url: 'auto=1&tod=11&speed=30&seed=7&quality=' + QUALITY, wait: 9000 },
  { name: '03-estacao', url: 'auto=1&tod=14&speed=22&seed=5&quality=' + QUALITY, zone: 'station', wait: 2500 },
  { name: '04-tunel', url: 'auto=1&tod=12&speed=24&seed=3&quality=' + QUALITY, zone: 'tunnel', wait: 3500 },
  { name: '05-por-do-sol-viaduto', url: 'auto=1&tod=17.6&speed=26&seed=9&quality=' + QUALITY, zone: 'viaduct', wait: 3000 },
  { name: '06-noite-chuva', url: 'auto=1&tod=21.5&rain=1&speed=26&seed=4&quality=' + QUALITY, wait: 7000 },
  { name: '07-patio-industrial', url: 'auto=1&tod=16&speed=20&seed=13&quality=' + QUALITY, zone: 'industrial', wait: 3000 },
  { name: '08-jato', url: 'auto=1&tod=10&speed=24&seed=2&quality=' + QUALITY, jet: true, wait: 3500 },
  { name: '09-batida', url: 'auto=1&tod=18.3&speed=28&seed=8&quality=' + QUALITY, crash: true, wait: 1500 },
  { name: '10-menu', url: 'tod=9&seed=6&quality=' + QUALITY, wait: 3000 },
  { name: '11-mobile-retrato', url: 'auto=1&tod=15&speed=22&seed=21&quality=medium', wait: 4000, viewport: { width: 414, height: 896 }, mobile: true },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox', '--no-sandbox'],
});
const report = [];
for (const sc of SCENARIOS) {
  if (ONLY && !sc.name.includes(ONLY)) continue;
  const vp = sc.viewport || { width: W, height: H };
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!sc.mobile, hasTouch: !!sc.mobile, userAgent: sc.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const page = await context.newPage();
  const errors = [], warnings = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const t0 = Date.now();
  try {
    // modo manual: a simulação avança sem renderizar (SwiftShader é lento demais para tempo real)
    await page.goto(BASE + '?manual=1&' + sc.url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180000 });
    const adv = async (sec) => page.evaluate((s) => window.__game.debug().advance(s), sec);
    await adv(0.5);
    if (sc.zone) { await page.evaluate((z) => window.__game.debug().skipTo(z), sc.zone); await adv(1.5); }
    if (sc.jet) await page.evaluate(() => window.__game.debug().jet());
    await adv((sc.wait || 2000) / 1000);
    if (sc.crash) { await page.evaluate(() => window.__game.debug().crash()); await adv(0.7); }
    await page.evaluate(() => window.__game.debug().renderOnce());
    const state = await page.evaluate(() => window.__game.debug().state());
    const file = path.join(OUT, sc.name + '.png');
    await page.screenshot({ path: file, timeout: 180000 });
    report.push({ name: sc.name, ok: true, errors, warnings: warnings.slice(0, 5), state: { zone: state.zone, z: Math.round(state.z), speed: Math.round(state.speed), tod: state.tod.toFixed(1), rain: state.rain.toFixed(2), state: state.state }, ms: Date.now() - t0 });
    console.log(`✔ ${sc.name}  zone=${state.zone} z=${Math.round(state.z)} v=${Math.round(state.speed)} tod=${state.tod.toFixed(1)} rain=${state.rain.toFixed(2)} state=${state.state} errors=${errors.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    for (const e of errors) console.log('   ✖ ' + e.slice(0, 300));
  } catch (e) {
    report.push({ name: sc.name, ok: false, error: e.message, errors });
    console.log(`✖ ${sc.name}: ${e.message.slice(0, 300)}`);
    for (const er of errors) console.log('   ✖ ' + er.slice(0, 300));
    try { await page.screenshot({ path: path.join(OUT, sc.name + '-FAIL.png') }); } catch (e2) { /* noop */ }
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const bad = report.filter((r) => !r.ok || r.errors.length);
console.log(bad.length ? `\n${bad.length} cenário(s) com erro` : '\nTodos os cenários sem erros de console.');
process.exit(bad.length ? 1 : 0);
