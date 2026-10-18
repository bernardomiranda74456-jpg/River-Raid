// Exporta texturas HD geradas (sprites/tiles) para uma folha PNG para revisão visual.
// node tools/texdump.mjs out.png "hero:idle0,hero:punch1,tile:mountain:g1,tile:mountain:bush" [normals]
import { chromium } from 'playwright'; import fs from 'fs';
const [,, out = 'screenshots/texdump.png', list = 'hero:idle0', normals = ''] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8787/index.html?mode=hd', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const dataUrl = await page.evaluate(async ({ list, normals }) => {
  const g = window.__game; const hd = g.bank.hd; const items = list.split(',');
  const canvases = items.map((it) => { const p = it.split(':'); let e; if (p[0] === 'tile') { hd.tile(p[1], p[2]); e = hd.tiles[p[1] + '|' + p[2]]; } else { hd.sprite(p[0], p[1]); e = hd.sprites[p[0] + '|' + p[1]]; } if (!e) return null; return (normals ? e.n : e.d).source.resource; });
  const pad = 8; const cw = canvases.reduce((a, c) => a + (c ? c.width : 32) + pad, 0); const ch = Math.max(...canvases.map((c) => (c ? c.height : 32)));
  const sheet = document.createElement('canvas'); sheet.width = cw; sheet.height = ch + 20; const ctx = sheet.getContext('2d'); ctx.fillStyle = '#304050'; ctx.fillRect(0, 0, cw, ch + 20); let x = 0;
  canvases.forEach((c, i) => { if (c) ctx.drawImage(c, x, 0); ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(items[i].slice(0, 18), x, ch + 14); x += (c ? c.width : 32) + pad; });
  return sheet.toDataURL('image/png');
}, { list, normals });
fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('saved', out); await b.close();
