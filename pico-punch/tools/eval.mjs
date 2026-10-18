// Avalia JS na página do jogo e imprime o resultado. node tools/eval.mjs "<query>" "<js>" [screenshot.png] [waitMs]
import { chromium } from 'playwright';
const [,, query = '?level=1&mode=hd', js = '1', shot = '', wait = '1500'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); }); page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8787/index.html' + query, { waitUntil: 'load' }); await page.waitForTimeout(+wait);
const r = await page.evaluate(js); console.log(JSON.stringify(r, null, 1));
if (shot) { await page.waitForTimeout(300); const clip = process.env.CLIP ? (([x, y, width, height]) => ({ x, y, width, height }))(process.env.CLIP.split(',').map(Number)) : undefined; await page.screenshot({ path: shot, clip }); console.log('saved', shot); }
console.log(errs.length ? errs.slice(0, 8).join('\n') : 'console clean'); await b.close();
