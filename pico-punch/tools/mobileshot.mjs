// Screenshot emulando celular (toque) para validar botões virtuais e escala.
import { chromium, devices } from 'playwright';
const [,, query = '?level=1&mode=retro', out = 'screenshots/dbg-mobile.png'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['Pixel 5'], viewport: { width: 851, height: 393 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8787/index.html' + query, { waitUntil: 'load' }); await page.waitForTimeout(1500);
const jump = page.locator('#tjump'); await jump.dispatchEvent('pointerdown', { pointerId: 1 }); await page.waitForTimeout(150); await jump.dispatchEvent('pointerup', { pointerId: 1 }); await page.waitForTimeout(300);
console.log(await page.evaluate(() => { const g = window.__game; const c = g.app.canvas; return { inner: [window.innerWidth, window.innerHeight], dpr: window.devicePixelRatio, canvas: [c.width, c.height, c.style.width, c.style.height], res: g.app.renderer.resolution, rw: [g.app.renderer.width, g.app.renderer.height], scale: g.retro.scale, screen: [g.retro.screen.x, g.retro.screen.y, g.retro.screen.width, g.retro.screen.height], vis: window.visualViewport && [window.visualViewport.width, window.visualViewport.scale] }; }));
await page.screenshot({ path: out }); console.log('saved', out, errs.length ? errs.join('\n') : 'console clean'); await b.close();
