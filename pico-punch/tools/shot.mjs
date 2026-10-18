// Captura screenshot: node tools/shot.mjs <url-query> <out.png> [ações]  — ações: "k:ArrowRight:800,k:KeyZ:100,w:500"
import { chromium } from 'playwright';
const [,, query = '', out = 'shot.png', actions = ''] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:8787/index.html' + query, { waitUntil: 'load' });
await page.waitForTimeout(1200);
for (const a of actions.split(',').filter(Boolean)) {
  const [kind, key, ms] = a.split(':');
  if (kind === 'k') { await page.keyboard.down(key); await page.waitForTimeout(+ms || 100); await page.keyboard.up(key); }
  else if (kind === 'p') { await page.keyboard.press(key); await page.waitForTimeout(+ms || 100); }
  else if (kind === 'w') await page.waitForTimeout(+key);
  else if (kind === 'js') await page.evaluate(key);
}
await page.screenshot({ path: out });
console.log('saved', out); if (errors.length) console.log(errors.join('\n')); else console.log('console clean');
await b.close();
