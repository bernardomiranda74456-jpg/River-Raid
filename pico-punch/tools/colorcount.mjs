// Conta cores distintas na área do jogo de uma captura (validação do limite de 32 cores do modo retrô).
import { chromium } from 'playwright'; import fs from 'fs';
const [,, file = 'screenshots/dev-l1-retro6.png'] = process.argv;
const b = await chromium.launch(); const page = await b.newPage();
const data = fs.readFileSync(file).toString('base64');
const r = await page.evaluate(async (d) => { const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); const px = ctx.getImageData(0, 0, c.width, c.height).data; const set = new Map(); for (let i = 0; i < px.length; i += 4) { const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]; set.set(k, (set.get(k) || 0) + 1); } const arr = [...set.entries()].sort((a, b2) => b2[1] - a[1]); return { total: arr.length, top: arr.slice(0, 40).map(([k, n]) => '#' + k.toString(16).padStart(6, '0') + ':' + n) }; }, data);
console.log(file, 'cores distintas:', r.total); console.log(r.top.join(' ')); await b.close();
