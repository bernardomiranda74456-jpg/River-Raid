// Quick interactive probe: start a match, then run JS snippets from argv and take screenshots.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const port = 8766;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning', 'log'].includes(m.type())) { const t = `[${m.type()}] ${m.text()}`; logs.push(t); console.log(t); } });
page.on('pageerror', (e) => { const t = `[pageerror] ${e.message}\n${e.stack}`; logs.push(t); console.log(t); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
const out = path.join(root, 'screenshots'); fs.mkdirSync(out, { recursive: true });
const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const st of steps) {
  if (st.wait) await page.waitForTimeout(st.wait);
  if (st.click) await page.click(st.click);
  if (st.eval) { const r = await page.evaluate(st.eval); if (r !== undefined) console.log('eval →', JSON.stringify(r)); }
  if (st.shot) { await page.screenshot({ path: path.join(out, st.shot + '.png') }); console.log('shot', st.shot); }
}
console.log('console messages:', logs.length); for (const l of logs.slice(0, 40)) console.log(l);
await browser.close(); server.kill();
