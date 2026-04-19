'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const W = 320;
const H = 480;
canvas.width = W;
canvas.height = H;

// ─── Constants ───────────────────────────────────────────────────────────────
const SEG_H       = 48;       // world height of each river segment
const BASE_SCROLL = 1.2;      // base scroll speed (px/frame)
const BULLET_SPD  = 7;
const BULLET_CD   = 14;       // frames between shots

const SCORE = { helicopter: 150, jet: 100, ship: 30, fuel: 80 };

// ─── State ────────────────────────────────────────────────────────────────────
let state, score, hiScore, lives;
let scrollY;          // world Y at top of screen
let segCount;         // total segments ever generated
let segments;         // array of segment objects (absolute index preserved via .idx)
let bullets;
let explosions;
let bulletCd;

const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
  if (state === 'title'    && (e.code === 'Space' || e.code === 'Enter')) startGame();
  if (state === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) startGame();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ─── Player ───────────────────────────────────────────────────────────────────
const player = {
  x: W / 2, y: H - 100,
  w: 16, h: 22,
  fuel: 100, maxFuel: 100,
  invincible: 0,
};

// ─── River generation ────────────────────────────────────────────────────────
function makeSeg(idx) {
  const prev = segments.length ? segments[segments.length - 1] : null;
  let lx, rx;

  if (!prev) {
    lx = 70; rx = 250;
  } else {
    const drift   = (Math.random() - 0.5) * 18;
    const squeeze = (Math.random() - 0.5) * 12;
    lx = clamp(prev.lx + drift + squeeze,  20, 130);
    rx = clamp(prev.rx + drift - squeeze, lx + 90, 300);
    if (rx - lx < 90)  rx = lx + 90;
    if (rx - lx > 190) rx = lx + 190;
  }

  // Enemy spawn (skip first 8 segments so player isn't ambushed)
  let enemy = null;
  if (idx > 8 && Math.random() < 0.38) {
    const types = ['helicopter', 'helicopter', 'jet', 'ship', 'ship', 'fuel'];
    const type  = types[Math.floor(Math.random() * types.length)];
    const mid   = (lx + rx) / 2;
    const range = (rx - lx) * 0.55;
    const ex    = mid - range / 2 + Math.random() * range;
    const speed = 0.6 + Math.random() * 0.7;
    enemy = {
      type, alive: true,
      x: ex,
      worldY: idx * SEG_H + SEG_H / 2,
      dx: (Math.random() > 0.5 ? 1 : -1) * (type === 'ship' || type === 'fuel' ? 0 : speed),
    };
  }

  return { idx, lx, rx, enemy };
}

function ensureSegments() {
  const needed = Math.ceil((scrollY + H) / SEG_H) + 4;
  while (segCount < needed) {
    segments.push(makeSeg(segCount));
    segCount++;
  }
  // Discard segments far behind the camera (keep last 80)
  if (segments.length > 80) segments.splice(0, segments.length - 80);
}

// Interpolate river bounds at a given world Y
function riverAt(wy) {
  const idx = Math.floor(wy / SEG_H);
  const t   = (wy % SEG_H) / SEG_H;
  const a   = segByIdx(idx);
  const b   = segByIdx(idx + 1) || a;
  return {
    lx: a.lx + (b.lx - a.lx) * t,
    rx: a.rx + (b.rx - a.rx) * t,
  };
}

function segByIdx(idx) {
  // Segments array may have gaps from pruning; search from end (recent = end)
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].idx === idx) return segments[i];
  }
  return segments[segments.length - 1];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function screenY(worldY) { return worldY - scrollY; }

// ─── Game lifecycle ───────────────────────────────────────────────────────────
function startGame() {
  state     = 'playing';
  score     = 0;
  lives     = 3;
  scrollY   = 0;
  segCount  = 0;
  segments  = [];
  bullets   = [];
  explosions = [];
  bulletCd  = 0;

  player.x          = W / 2;
  player.y          = H - 100;
  player.fuel       = player.maxFuel;
  player.invincible = 0;

  ensureSegments();
}

function die() {
  lives--;
  explosions.push({ x: player.x, y: player.y, r: 0, maxR: 28, frame: 0 });
  if (lives <= 0) {
    state = 'gameover';
    if (score > hiScore) hiScore = score;
  } else {
    player.fuel       = player.maxFuel;
    player.invincible = 140;
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update() {
  if (state !== 'playing') return;

  // Scroll speed: player moving up = faster, down = slower
  let scroll = BASE_SCROLL;
  if (keys['ArrowUp']   || keys['KeyW']) scroll += 0.8;
  if (keys['ArrowDown'] || keys['KeyS']) scroll -= 0.6;
  scroll = clamp(scroll, 0.4, 3.5);
  scrollY += scroll;

  ensureSegments();

  // Player lateral movement
  const spd = 2.2;
  if (keys['ArrowLeft']  || keys['KeyA']) player.x -= spd;
  if (keys['ArrowRight'] || keys['KeyD']) player.x += spd;
  player.x = clamp(player.x, player.w / 2, W - player.w / 2);

  // Fire
  if ((keys['Space']) && bulletCd <= 0) {
    bullets.push({ x: player.x, alive: true, screenY: player.y - player.h / 2 });
    bulletCd = BULLET_CD;
  }
  if (bulletCd > 0) bulletCd--;

  // Fuel drain
  player.fuel -= 0.018 + scroll * 0.005;
  if (player.fuel <= 0) { player.fuel = 0; die(); return; }
  if (player.invincible > 0) player.invincible--;

  // Player world position
  const pWorldY = scrollY + player.y;
  const pRiver  = riverAt(pWorldY);

  // Bank collision
  if (player.invincible === 0) {
    if (player.x - player.w / 2 < pRiver.lx || player.x + player.w / 2 > pRiver.rx) {
      die(); return;
    }
  }

  // Move bullets
  for (const b of bullets) {
    if (!b.alive) continue;
    b.screenY -= BULLET_SPD;
    const bwY   = scrollY + b.screenY;
    const bRiv  = riverAt(bwY);
    if (b.screenY < -10 || b.x < bRiv.lx || b.x > bRiv.rx) b.alive = false;
  }
  // Prune dead bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].alive) bullets.splice(i, 1);
  }

  // Enemy updates
  for (const seg of segments) {
    const e = seg.enemy;
    if (!e || !e.alive) continue;
    const sy = screenY(e.worldY);
    if (sy < -SEG_H || sy > H + SEG_H) continue;

    // Move
    if (e.dx !== 0) {
      e.x += e.dx;
      const er = riverAt(e.worldY);
      const hw = enemyHW(e.type);
      if (e.x - hw < er.lx + 6 || e.x + hw > er.rx - 6) e.dx *= -1;
    }

    const hw = enemyHW(e.type);
    const hh = enemyHH(e.type);

    // Bullet hits
    for (const b of bullets) {
      if (!b.alive) continue;
      const bwY = scrollY + b.screenY;
      if (overlap(b.x - 2, bwY - 4, 4, 8, e.x - hw, e.worldY - hh, hw * 2, hh * 2)) {
        b.alive = false;
        e.alive = false;
        score += SCORE[e.type] || 10;
        if (score > hiScore) hiScore = score;
        explosions.push({ x: e.x, y: sy, r: 0, maxR: 20, frame: 0 });
        if (e.type === 'fuel') player.fuel = Math.min(player.maxFuel, player.fuel + 45);
        break;
      }
    }

    if (!e.alive) continue;

    // Player collision
    if (player.invincible === 0) {
      if (overlap(
        player.x - player.w / 2, pWorldY - player.h / 2, player.w, player.h,
        e.x - hw, e.worldY - hh, hw * 2, hh * 2
      )) { die(); return; }
    }
  }

  // Distance score
  score += Math.ceil(scroll);
  if (score > hiScore) hiScore = score;

  // Update explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].frame++;
    explosions[i].r = explosions[i].maxR * (explosions[i].frame / 12);
    if (explosions[i].frame > 12) explosions.splice(i, 1);
  }
}

function enemyHW(type) { return type === 'ship' ? 14 : 9; }
function enemyHH(type) { return type === 'ship' ? 8  : 8; }

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  if (state === 'title')    { drawTitle();   return; }
  if (state === 'gameover') { drawPlay(); drawGameOver(); return; }
  drawPlay();
}

function drawPlay() {
  drawRiver();
  drawEnemies();
  drawBullets();
  drawExplosions();
  drawPlayer();
  drawHUD();
}

function drawRiver() {
  // Water background
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(0, 0, W, H);

  // Ground / banks
  ctx.fillStyle = '#388e3c';
  const first = Math.floor(scrollY / SEG_H) - 1;
  const last  = first + Math.ceil(H / SEG_H) + 2;

  for (let idx = first; idx <= last; idx++) {
    const seg  = segByIdx(idx);
    const seg2 = segByIdx(idx + 1) || seg;
    const y0   = screenY(idx * SEG_H);
    const y1   = y0 + SEG_H + 1; // +1 to avoid gaps

    // Left bank
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(seg.lx, y0);
    ctx.lineTo(seg2.lx, y1);
    ctx.lineTo(0, y1);
    ctx.closePath();
    ctx.fill();

    // Right bank
    ctx.beginPath();
    ctx.moveTo(seg.rx, y0);
    ctx.lineTo(W, y0);
    ctx.lineTo(W, y1);
    ctx.lineTo(seg2.rx, y1);
    ctx.closePath();
    ctx.fill();

    // Water ripples for texture
    ctx.strokeStyle = 'rgba(100,180,255,0.18)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 2; row++) {
      const ry = y0 + SEG_H * (0.3 + row * 0.4);
      const mid = (seg.lx + seg.rx) / 2;
      ctx.beginPath();
      ctx.moveTo(seg.lx + 8, ry);
      ctx.lineTo(mid - 8, ry);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mid + 8, ry);
      ctx.lineTo(seg.rx - 8, ry);
      ctx.stroke();
    }
  }

  // Bank edge highlight
  ctx.strokeStyle = '#2e7d32';
  ctx.lineWidth = 2;
  for (let idx = first; idx <= last; idx++) {
    const seg  = segByIdx(idx);
    const seg2 = segByIdx(idx + 1) || seg;
    const y0   = screenY(idx * SEG_H);
    const y1   = y0 + SEG_H + 1;
    ctx.beginPath();
    ctx.moveTo(seg.lx, y0);
    ctx.lineTo(seg2.lx, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(seg.rx, y0);
    ctx.lineTo(seg2.rx, y1);
    ctx.stroke();
  }
}

function drawEnemies() {
  for (const seg of segments) {
    const e = seg.enemy;
    if (!e || !e.alive) continue;
    const sy = screenY(e.worldY);
    if (sy < -30 || sy > H + 30) continue;

    ctx.save();
    ctx.translate(e.x, sy);

    switch (e.type) {
      case 'helicopter': drawHelicopter(); break;
      case 'jet':        drawJet();        break;
      case 'ship':       drawShip();       break;
      case 'fuel':       drawFuelDepot();  break;
    }
    ctx.restore();
  }
}

function drawHelicopter() {
  // Body
  ctx.fillStyle = '#c62828';
  ctx.fillRect(-9, -5, 18, 9);
  // Tail
  ctx.fillStyle = '#b71c1c';
  ctx.fillRect(8, -3, 6, 5);
  // Blades
  ctx.fillStyle = '#333';
  ctx.fillRect(-12, -7, 24, 2);
  // Cockpit
  ctx.fillStyle = '#ef9a9a';
  ctx.fillRect(-5, -5, 8, 5);
  // Skids
  ctx.fillStyle = '#555';
  ctx.fillRect(-8, 4, 6, 2);
  ctx.fillRect(2, 4, 6, 2);
}

function drawJet() {
  // Fuselage
  ctx.fillStyle = '#e65100';
  ctx.fillRect(-5, -10, 10, 20);
  // Wings
  ctx.fillStyle = '#bf360c';
  ctx.fillRect(-13, 0, 10, 6);
  ctx.fillRect(3, 0, 10, 6);
  // Nose
  ctx.fillStyle = '#ff6d00';
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(4, -10);
  ctx.lineTo(0, -16);
  ctx.closePath();
  ctx.fill();
  // Exhaust
  ctx.fillStyle = '#444';
  ctx.fillRect(-3, 9, 6, 3);
}

function drawShip() {
  // Hull
  ctx.fillStyle = '#827717';
  ctx.fillRect(-14, -5, 28, 10);
  // Deck details
  ctx.fillStyle = '#9e9d24';
  ctx.fillRect(-10, -8, 8, 4);
  ctx.fillRect(2, -8, 8, 4);
  // Gun turret
  ctx.fillStyle = '#555';
  ctx.fillRect(-3, -11, 6, 6);
  ctx.fillRect(-1, -14, 2, 3);
}

function drawFuelDepot() {
  // Tank
  ctx.fillStyle = '#f57f17';
  ctx.fillRect(-9, -12, 18, 22);
  // Top
  ctx.fillStyle = '#ff8f00';
  ctx.fillRect(-7, -15, 14, 4);
  // "F" label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('F', 0, 5);
}

function drawBullets() {
  ctx.fillStyle = '#ffee58';
  for (const b of bullets) {
    if (!b.alive) continue;
    ctx.fillRect(b.x - 2, b.screenY - 5, 4, 10);
  }
}

function drawExplosions() {
  for (const ex of explosions) {
    const alpha = 1 - ex.frame / 12;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer ring
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6f00';
    ctx.fill();

    // Inner bright
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffff00';
    ctx.fill();

    ctx.restore();
  }
}

function drawPlayer() {
  // Blink when invincible
  if (player.invincible > 0 && Math.floor(player.invincible / 7) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x, player.y);

  // Exhaust flame
  ctx.fillStyle = '#ff6d00';
  ctx.beginPath();
  ctx.moveTo(-3, 11);
  ctx.lineTo(3, 11);
  ctx.lineTo(0, 17 + Math.random() * 4);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = '#90caf9';
  ctx.fillRect(-4, -11, 8, 22);

  // Wings
  ctx.fillStyle = '#bbdefb';
  ctx.fillRect(-14, -2, 10, 7);
  ctx.fillRect(4, -2, 10, 7);

  // Nose
  ctx.fillStyle = '#e3f2fd';
  ctx.beginPath();
  ctx.moveTo(-3, -11);
  ctx.lineTo(3, -11);
  ctx.lineTo(0, -17);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#1a237e';
  ctx.fillRect(-2, -8, 4, 6);

  ctx.restore();
}

function drawHUD() {
  // Fuel bar background
  const fBarX = 10, fBarY = H - 22, fBarW = 110, fBarH = 10;
  ctx.fillStyle = '#222';
  ctx.fillRect(fBarX, fBarY, fBarW, fBarH);

  // Fuel fill
  const pct = player.fuel / player.maxFuel;
  ctx.fillStyle = pct > 0.3 ? '#43a047' : pct > 0.15 ? '#fdd835' : '#e53935';
  ctx.fillRect(fBarX, fBarY, fBarW * pct, fBarH);

  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(fBarX, fBarY, fBarW, fBarH);

  ctx.fillStyle = '#ccc';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', fBarX, fBarY - 3);

  // Score
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('SCORE ' + String(score).padStart(6, '0'), W - 8, 14);

  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('HI    ' + String(hiScore).padStart(6, '0'), W - 8, 27);

  // Lives (plane icons as triangles)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#90caf9';
  ctx.font = '13px monospace';
  for (let i = 0; i < lives; i++) {
    ctx.fillText('▲', 8 + i * 16, 14);
  }
}

function drawTitle() {
  // Sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d47a1');
  g.addColorStop(1, '#1565c0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Water
  ctx.fillStyle = '#1976d2';
  ctx.fillRect(60, 0, 200, H);

  // Title
  ctx.fillStyle = '#ff1744';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RIVER', W / 2, H / 2 - 50);

  ctx.fillStyle = '#ff6d00';
  ctx.font = 'bold 42px monospace';
  ctx.fillText('RAID', W / 2, H / 2);

  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText('PRESSIONE ESPAÇO PARA JOGAR', W / 2, H / 2 + 55);

  ctx.fillStyle = '#90caf9';
  ctx.font = '10px monospace';
  ctx.fillText('← → ou A/D  Mover lateralmente', W / 2, H / 2 + 80);
  ctx.fillText('↑ ↓ ou W/S  Acelerar / Frear', W / 2, H / 2 + 96);
  ctx.fillText('ESPAÇO       Atirar', W / 2, H / 2 + 112);

  if (hiScore > 0) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = '11px monospace';
    ctx.fillText('HI-SCORE: ' + String(hiScore).padStart(6, '0'), W / 2, H / 2 + 140);
  }

  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f44336';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 30);

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText('SCORE: ' + String(score).padStart(6, '0'), W / 2, H / 2 + 10);

  ctx.fillStyle = '#ffd54f';
  ctx.fillText('HI:    ' + String(hiScore).padStart(6, '0'), W / 2, H / 2 + 30);

  ctx.fillStyle = '#aaa';
  ctx.font = '11px monospace';
  ctx.fillText('ESPAÇO para jogar novamente', W / 2, H / 2 + 65);
  ctx.textAlign = 'left';
}

// ─── Main loop ────────────────────────────────────────────────────────────────
hiScore = 0;
state   = 'title';
score   = 0;
lives   = 3;

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

loop();
