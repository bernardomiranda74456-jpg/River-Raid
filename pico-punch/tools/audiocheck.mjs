import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8787/index.html?level=1&mode=retro'); await page.waitForTimeout(1200);
await page.keyboard.press('KeyZ'); await page.waitForTimeout(1500);
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight'); await page.keyboard.press('KeyX'); await page.waitForTimeout(800);
console.log(await page.evaluate(() => { const a = window.__game.audio; return { ctx: a.ctx?.state, ready: a.ready, playing: a.seq?.playing, ticks: a.seq?.tickCount, song: a.music.current, worklet: !!a.psgMusic?.node, hdVoices: a.hdMusic?.voices.length }; }));
console.log(errs.length ? errs.join('\n') : 'console clean'); await b.close();
