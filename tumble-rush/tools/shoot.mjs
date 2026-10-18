// Headless screenshot + console check harness (Playwright + bundled Chromium / SwiftShader).
// The simulation runs with a fixed dt so results don't depend on SwiftShader speed;
// screenshots are taken at the 'ultra' preset, the simulation at 'low' for speed.
// Usage: node tools/shoot.mjs <round:1|2|3> <prefix> [seconds]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const round = Number(process.argv[2] || 1); const prefix = process.argv[3] || ('r' + round); const seconds = Number(process.argv[4] || 90);
const port = 8700 + round;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message} ${e.stack}`));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
const out = path.join(root, 'screenshots'); fs.mkdirSync(out, { recursive: true });
const ev = (fn, arg) => page.evaluate(fn, arg);
const shotHQ = async (name) => {
  await ev(() => { const g = window.__game; g.testDt = 0.00001; g.skipRender = false; g.settings.applyPreset('high'); });
  // wait until frames were actually rendered with the new settings (first one compiles shaders)
  await ev(() => new Promise((res) => { const g = window.__game; const target = g.frame + 3; const chk = () => (g.frame >= target ? res() : setTimeout(chk, 100)); chk(); }));
  await page.screenshot({ path: path.join(out, `${prefix}-${name}.png`), timeout: 240000 }); console.log('shot', name);
  await ev(() => { const g = window.__game; g.settings.applyPreset('low'); g.testDt = 1 / 20; g.skipRender = true; });
  await page.waitForTimeout(300);
};
const info = () => ev(() => { const g = window.__game; const p = g.player; return { state: g.state, t: g.roundTime.toFixed(1), draws: g.renderer.r.info.render.calls, pos: p.pos.toArray().map((v) => v.toFixed(1)), lava: g.level.lavaY?.toFixed(1), alive: g.chars.chars.filter((c) => !c.eliminated).length, finished: g.qualified.length, pstate: p.state, rank: g.ui && document.getElementById('hud-position').textContent }; });
// run simulation at game-time pace
const simSeconds = async (s) => { const frames = Math.ceil(s * 20); await ev((n) => new Promise((res) => { const g = window.__game; const target = g.frame + n; const chk = () => (g.frame >= target ? res() : setTimeout(chk, 50)); chk(); }), frames); };

await ev(() => { const g = window.__game; g.settings.applyPreset('low'); g.testDt = 1 / 20; g.skipRender = true; });
await page.click('#btn-play');
if (round > 1) await ev((r) => { const g = window.__game; const n = r === 2 ? 16 : 8; g.roster.forEach((x, i) => { x.alive = i < n; }); g.round = r - 1; g.loadRound(); }, round);
await simSeconds(1.5); await shotHQ('lobby');
await simSeconds(5.5); // countdown done
await ev(() => { const g = window.__game; const B = g.bots[0].constructor; g.__bot = new B(g.player, g.level, 7); g.__bot.skill = 0.95; g.__bot.speedMul = 1; g.__botActive = true; });
let next = 10; const marks = [10, 25, 45, 70, 95, 120];
for (let t = 0; t < seconds; t += 5) {
  await simSeconds(5); const i = await info(); console.log(JSON.stringify(i));
  if (marks.includes(t + 5)) await shotHQ(`t${t + 5}`);
  if (i.state === 'results' || i.state === 'menu') break;
  if (i.pstate === 5) { console.log('player eliminated'); }
}
// ragdoll shot: knock the player
const st = await ev(() => window.__game.state);
if (st === 'racing') { await ev(() => { const g = window.__game; if (g.player.state !== 5) g.player.knock(new (g.player.pos.constructor)(3, 7, 2), 'hit'); }); await simSeconds(0.4); await shotHQ('ragdoll'); } else { await shotHQ('end'); }
const deaths = await ev(() => window.__game.chars ? window.__game.chars.chars.filter((c) => c.deathInfo).map((c) => c.deathInfo) : []); console.log('deaths:', JSON.stringify(deaths));
console.log('console messages:', logs.length); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close(); server.kill();
