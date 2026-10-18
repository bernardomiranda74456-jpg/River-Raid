// Renderiza faixas para WAV em audio-preview/ e imprime análise. Uso: node tools/render-audio.mjs [song,...] [modes]
import { chromium } from 'playwright'; import fs from 'fs';
const [,, songsArg = '', modesArg = 'retro,hd', loopsArg = '1'] = process.argv;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage(); page.on('pageerror', (e) => console.log('PAGEERROR', e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
await page.goto('http://localhost:8787/tools/render.html'); 
const all = await page.evaluate(async () => { const m = await import('../src/audio/music/index.js'); return Object.keys(m.SONGS); });
const songs = songsArg ? songsArg.split(',') : all; fs.mkdirSync('audio-preview', { recursive: true });
if (songsArg === 'sfx') { await page.goto('http://localhost:8787/tools/render.html'); const r = await page.evaluate(() => window.renderSfx()); fs.writeFileSync('audio-preview/sfx-all.wav', Buffer.from(r.wav, 'base64')); console.log('audio-preview/sfx-all.wav', r.count, 'efeitos; mudos:', JSON.stringify(r.silent)); await b.close(); process.exit(0); }
for (const s of songs) for (const mode of modesArg.split(',')) {
  await page.goto(`http://localhost:8787/tools/render.html?song=${s}&mode=${mode}&loops=${loopsArg}`);
  const r = await page.evaluate(() => window.renderSong());
  const file = `audio-preview/${s}-${mode}.wav`; fs.writeFileSync(file, Buffer.from(r.wav, 'base64'));
  const { wav, ...info } = r; console.log(file, JSON.stringify(info)); await page.locator('canvas').screenshot({ path: `audio-preview/${s}-${mode}.png` });
}
await b.close();
