'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const W = 360;
const H = 640;
const DPR = Math.min(window.devicePixelRatio || 1, 3);
canvas.width = W * DPR;
canvas.height = H * DPR;
ctx.scale(DPR, DPR);

// ─── Geometry ────────────────────────────────────────────────────────────────
const LANE_L  = 80;
const LANE_R  = 280;
const LANE_CX = (LANE_L + LANE_R) / 2;
const GUTTER  = 22;
const CARD_H  = 74;        // scorecard height at the top
const PIT_Y   = 90;        // anything past this line falls into the pit
const HEAD_Y  = 270;       // pin 1
const ROW_GAP = 50;
const PIN_GAP = 58;
const DECK_Y  = 330;       // on the pin deck the side walls kick pins back
const FOUL_Y  = 572;
const START_Y = 604;
const PIN_R   = 11;
const DOWN_R  = 15;        // a lying pin sweeps a wider area
const BALL_R  = 18;
const PIN_M   = 1;
const BALL_M  = 4.5;

// ─── Tuning ──────────────────────────────────────────────────────────────────
const SUBSTEPS    = 4;
const MIN_SPEED   = 4.5;   // px/frame
const MAX_SPEED   = 10;
const MAX_AIM     = 0.2;   // rad
const HOOK        = 0.035; // lateral accel per unit of spin
const KNOCK_SPEED = 0.4;   // impact speed that topples a standing pin
const TIP_DIST    = 9;     // a standing pin pushed this far topples
const ROLL_LIMIT  = 60 * 8;

// Pins 1..10, row by row, left to right.
const PIN_SPOTS = [];
for (let row = 0; row < 4; row++)
  for (let i = 0; i <= row; i++)
    PIN_SPOTS.push({ x: LANE_CX + (i - row / 2) * PIN_GAP, y: HEAD_Y - row * ROW_GAP });

// ─── State ───────────────────────────────────────────────────────────────────
let state;          // title | position | aim | spin | power | rolling | settle | gameover
let frames;         // frames[f] = pins knocked per roll
let frameIdx;
let pins, ball;
let meterT;
let aim, spin, power;
let rollTimer, settleTimer;
let standingBefore;
let message, messageTimer;
let hiScore = loadHiScore();
let dragging = false;

const keys = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

function loadHiScore() {
  try { return parseInt(localStorage.getItem('bowling-hi'), 10) || 0; } catch (e) { return 0; }
}
function saveHiScore() {
  try { localStorage.setItem('bowling-hi', String(hiScore)); } catch (e) { /* ignore */ }
}

// ─── Sound ───────────────────────────────────────────────────────────────────
let actx = null;
let lastHitSound = 0;

function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
}

function noise(dur, vol, freq, type) {
  if (!actx) return;
  const len = Math.max(1, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = buf;
  const filt = actx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  const gain = actx.createGain();
  const t = actx.currentTime;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt).connect(gain).connect(actx.destination);
  src.start();
}

function playHit(intensity) {
  const now = performance.now();
  if (now - lastHitSound < 35) return;
  lastHitSound = now;
  noise(0.12 + intensity * 0.02, clamp(intensity * 0.12, 0.05, 0.6), 1800, 'bandpass');
}

// ─── Game setup ──────────────────────────────────────────────────────────────
function rackPins() {
  pins = PIN_SPOTS.map((s, i) => ({
    n: i + 1, x: s.x, y: s.y, sx: s.x, sy: s.y,
    vx: 0, vy: 0, down: false, gone: false, angle: 0, spinRate: 0,
  }));
}

function sweepPins() {
  pins = pins.filter(p => !p.down && !p.gone);
  for (const p of pins) { p.vx = 0; p.vy = 0; p.sx = p.x; p.sy = p.y; }
}

function newBall() {
  ball = { x: LANE_CX, y: START_Y, vx: 0, vy: 0, spin: 0, gutter: false, inPit: false, roll: 0 };
}

function startGame() {
  frames = Array.from({ length: 10 }, () => []);
  frameIdx = 0;
  message = ''; messageTimer = 0;
  rackPins();
  startRoll();
}

function startRoll() {
  newBall();
  aim = 0; spin = 0; power = 0.5;
  state = 'position';
}

function setPhase(next) {
  state = next;
  meterT = 0;
}

function lockPhase() {
  if (state === 'position') setPhase('aim');
  else if (state === 'aim') setPhase('spin');
  else if (state === 'spin') setPhase('power');
  else if (state === 'power') launch();
}

function launch() {
  const speed = MIN_SPEED + power * (MAX_SPEED - MIN_SPEED);
  ball.vx = Math.sin(aim) * speed;
  ball.vy = -Math.cos(aim) * speed;
  ball.spin = spin;
  standingBefore = pins.length;
  rollTimer = 0;
  state = 'rolling';
  noise((START_Y - HEAD_Y) / speed / 60 + 0.3, 0.25, 180, 'lowpass');
}

// ─── Physics ─────────────────────────────────────────────────────────────────
function stepBall(b, dt) {
  if (b.inPit) return;
  if (!b.gutter) {
    const t = clamp((FOUL_Y - b.y) / (FOUL_Y - HEAD_Y), 0, 1);
    b.vx += b.spin * HOOK * t * dt;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.roll += Math.hypot(b.vx, b.vy) * dt;
  if (!b.gutter && (b.x < LANE_L || b.x > LANE_R)) {
    b.gutter = true;
    b.vx = 0;
    b.x = b.x < LANE_L ? LANE_L - GUTTER / 2 : LANE_R + GUTTER / 2;
  }
  if (b.y < PIT_Y - BALL_R) b.inPit = true;
}

function topple(p, speed) {
  if (p.down) return;
  p.down = true;
  // Pin action is chaotic: scatter the direction a little.
  const a = Math.atan2(p.vy, p.vx) + rand(-0.3, 0.3);
  const s = Math.hypot(p.vx, p.vy);
  p.vx = Math.cos(a) * s;
  p.vy = Math.sin(a) * s;
  p.angle = a;
  p.spinRate = rand(-0.25, 0.25);
  playHit(speed);
}

// Elastic-ish impulse between two discs; returns the impact speed.
function collide(a, b, ra, rb, ma, mb, e) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d2 = dx * dx + dy * dy, rs = ra + rb;
  if (d2 >= rs * rs || d2 === 0) return 0;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  const im = 1 / ma + 1 / mb;
  const overlap = rs - d;
  a.x -= nx * overlap * (1 / ma) / im; a.y -= ny * overlap * (1 / ma) / im;
  b.x += nx * overlap * (1 / mb) / im; b.y += ny * overlap * (1 / mb) / im;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return 0;
  const j = -(1 + e) * vn / im;
  a.vx -= j * nx / ma; a.vy -= j * ny / ma;
  b.vx += j * nx / mb; b.vy += j * ny / mb;
  return -vn;
}

function stepPhysics(dt) {
  stepBall(ball, dt);

  for (const p of pins) {
    if (p.gone) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const f = Math.pow(p.down ? 0.985 : 0.8, dt);
    p.vx *= f; p.vy *= f;
    if (p.down) p.angle += p.spinRate * dt;
    else if (Math.hypot(p.x - p.sx, p.y - p.sy) > TIP_DIST) topple(p, 1);

    // Kickback walls on the pin deck.
    if (p.y < DECK_Y) {
      const lo = LANE_L - GUTTER + PIN_R, hi = LANE_R + GUTTER - PIN_R;
      if (p.x < lo) { p.x = lo; p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x > hi) { p.x = hi; p.vx = -Math.abs(p.vx) * 0.5; }
    }
    if (p.y < PIT_Y) { p.gone = true; p.down = true; }
  }

  if (!ball.gutter && !ball.inPit) {
    for (const p of pins) {
      if (p.gone) continue;
      const s = collide(ball, p, BALL_R, PIN_R, BALL_M, PIN_M, 0.8);
      if (s > KNOCK_SPEED) topple(p, s);
    }
  }

  for (let i = 0; i < pins.length; i++) {
    const a = pins[i];
    if (a.gone) continue;
    for (let j = i + 1; j < pins.length; j++) {
      const b = pins[j];
      if (b.gone) continue;
      const s = collide(a, b, a.down ? DOWN_R : PIN_R, b.down ? DOWN_R : PIN_R, PIN_M, PIN_M, 0.8);
      if (s > KNOCK_SPEED) { topple(a, s); topple(b, s); }
    }
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────
function sym(n) { return n === 0 ? '-' : String(n); }

function frameMarks(fr, f) {
  const m = [];
  if (f < 9) {
    if (fr[0] === 10) return ['', 'X'];
    if (fr.length > 0) m[0] = sym(fr[0]);
    if (fr.length > 1) m[1] = fr[0] + fr[1] === 10 ? '/' : sym(fr[1]);
    return m;
  }
  for (let k = 0; k < fr.length; k++) {
    const fresh = k === 0 || m[k - 1] === 'X' || m[k - 1] === '/';
    if (fresh && fr[k] === 10) m[k] = 'X';
    else if (!fresh && fr[k - 1] + fr[k] === 10) m[k] = '/';
    else m[k] = sym(fr[k]);
  }
  return m;
}

// Cumulative score per frame, or null while a frame is still undecided.
function scoreFrames(frames) {
  const rolls = frames.flat();
  const out = [];
  let i = 0, total = 0, known = true;
  for (let f = 0; f < 10; f++) {
    const fr = frames[f];
    let s = null;
    if (f < 9) {
      if (fr[0] === 10) {
        if (rolls.length > i + 2) s = 10 + rolls[i + 1] + rolls[i + 2];
      } else if (fr.length === 2) {
        if (fr[0] + fr[1] === 10) { if (rolls.length > i + 2) s = 10 + rolls[i + 2]; }
        else s = fr[0] + fr[1];
      }
      i += fr.length;
    } else if (fr.length === 3 || (fr.length === 2 && fr[0] + fr[1] < 10)) {
      s = fr[0] + fr[1] + (fr[2] || 0);
    }
    if (s === null) known = false;
    if (known) { total += s; out.push(total); } else out.push(null);
  }
  return out;
}

function totalScore() {
  const s = scoreFrames(frames);
  for (let f = 9; f >= 0; f--) if (s[f] !== null) return s[f];
  return 0;
}

function recordRoll() {
  const left = pins.filter(p => !p.down && !p.gone).length;
  const knocked = standingBefore - left;
  const f = frameIdx;
  const fr = frames[f];
  fr.push(knocked);
  const marks = frameMarks(fr, f);
  const last = marks[marks.length - 1];

  let fresh = false, over = false;
  if (f < 9) {
    if (fr.length === 2 || knocked === 10) { frameIdx++; fresh = true; }
  } else if (fr.length === 3 || (fr.length === 2 && marks[0] !== 'X' && marks[1] !== '/')) {
    over = true;
  } else {
    fresh = last === 'X' || last === '/';
  }

  if (last === 'X') showMessage('STRIKE!');
  else if (last === '/') showMessage('SPARE!');
  else if (knocked === 0) showMessage(ball.gutter ? 'CANALETA!' : 'ZERO');
  else showMessage(knocked === 1 ? '1 PINO' : `${knocked} PINOS`);

  if (over) {
    const total = totalScore();
    if (total > hiScore) { hiScore = total; saveHiScore(); }
    state = 'gameover';
    return;
  }
  if (fresh) rackPins(); else sweepPins();
  startRoll();
}

function showMessage(text) {
  message = text;
  messageTimer = 90;
}

// ─── Input ───────────────────────────────────────────────────────────────────
function onAction() {
  initAudio();
  if (state === 'title' || state === 'gameover') startGame();
  else lockPhase();
}

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) onAction();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}

function placeBall(x) {
  ball.x = clamp(x, LANE_L + BALL_R, LANE_R - BALL_R);
}

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (state === 'position') {
    initAudio();
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    placeBall(pointerPos(e).x);
  } else {
    onAction();
  }
});
canvas.addEventListener('pointermove', e => {
  if (state === 'position' && (dragging || e.pointerType === 'mouse')) placeBall(pointerPos(e).x);
});
canvas.addEventListener('pointerup', () => {
  if (state === 'position' && dragging) lockPhase();
  dragging = false;
});
canvas.addEventListener('pointercancel', () => { dragging = false; });

// ─── Update ──────────────────────────────────────────────────────────────────
function update() {
  if (messageTimer > 0) messageTimer--;
  meterT++;

  switch (state) {
    case 'position':
      if (keys.ArrowLeft || keys.KeyA) placeBall(ball.x - 2);
      if (keys.ArrowRight || keys.KeyD) placeBall(ball.x + 2);
      break;
    case 'aim':
      aim = MAX_AIM * Math.sin(meterT * 0.05);
      break;
    case 'spin':
      spin = Math.sin(meterT * 0.06);
      break;
    case 'power':
      power = (1 - Math.cos(meterT * 0.07)) / 2;
      break;
    case 'rolling': {
      rollTimer++;
      for (let s = 0; s < SUBSTEPS; s++) stepPhysics(1 / SUBSTEPS);
      const moving = pins.some(p => !p.gone && Math.hypot(p.vx, p.vy) > 0.15);
      if ((ball.inPit && !moving) || rollTimer > ROLL_LIMIT) {
        state = 'settle';
        settleTimer = 45;
      }
      break;
    }
    case 'settle':
      if (--settleTimer <= 0) recordRoll();
      break;
  }
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
const BOARD_W = (LANE_R - LANE_L) / 39;

function drawLane() {
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(0, 0, W, H);

  // Gutters
  for (const gx of [LANE_L - GUTTER, LANE_R]) {
    const g = ctx.createLinearGradient(gx, 0, gx + GUTTER, 0);
    g.addColorStop(0, '#3a3a44');
    g.addColorStop(0.5, '#6a6a76');
    g.addColorStop(1, '#3a3a44');
    ctx.fillStyle = g;
    ctx.fillRect(gx, PIT_Y, GUTTER, H - PIT_Y);
  }

  // Wood
  const wood = ctx.createLinearGradient(0, PIT_Y, 0, H);
  wood.addColorStop(0, '#e2b877');
  wood.addColorStop(0.45, '#d9a45b');
  wood.addColorStop(1, '#c98f45');
  ctx.fillStyle = wood;
  ctx.fillRect(LANE_L, PIT_Y, LANE_R - LANE_L, H - PIT_Y);

  ctx.strokeStyle = 'rgba(120, 70, 20, 0.18)';
  ctx.lineWidth = 1;
  for (let b = 1; b < 39; b++) {
    const x = Math.round(LANE_L + b * BOARD_W) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, PIT_Y); ctx.lineTo(x, H); ctx.stroke();
  }

  // Oil shine
  const oil = ctx.createLinearGradient(LANE_L, 0, LANE_R, 0);
  oil.addColorStop(0, 'rgba(255,255,255,0)');
  oil.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  oil.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = oil;
  ctx.fillRect(LANE_L, DECK_Y, LANE_R - LANE_L, FOUL_Y - DECK_Y);

  // Pit and masking curtain
  ctx.fillStyle = '#050507';
  ctx.fillRect(LANE_L - GUTTER - 4, CARD_H, LANE_R - LANE_L + GUTTER * 2 + 8, PIT_Y - CARD_H);

  // Pin deck marks
  ctx.fillStyle = 'rgba(90, 50, 10, 0.35)';
  for (const s of PIN_SPOTS) { ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill(); }

  // Target arrows and dots
  ctx.fillStyle = '#6b3b12';
  for (let k = 1; k <= 7; k++) {
    const x = LANE_L + (k * 5 - 0.5) * BOARD_W;
    const y = 470 - Math.abs(4 - k) * 12;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x - 4, y + 5);
    ctx.lineTo(x + 4, y + 5);
    ctx.closePath();
    ctx.fill();
  }
  for (const k of [3, 5, 8, 11, 14, 25, 28, 31, 34, 36]) {
    ctx.beginPath();
    ctx.arc(LANE_L + (k - 0.5) * BOARD_W, 540, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Foul line and approach
  ctx.fillStyle = '#e8c68e';
  ctx.fillRect(LANE_L - GUTTER, FOUL_Y + 2, LANE_R - LANE_L + GUTTER * 2, H - FOUL_Y - 2);
  ctx.fillStyle = '#b3261e';
  ctx.fillRect(LANE_L - GUTTER, FOUL_Y, LANE_R - LANE_L + GUTTER * 2, 3);
}

function drawPin(p) {
  if (p.gone) return;
  if (!p.down) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(p.x + 2, p.y + 3, PIN_R, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, PIN_R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cfd3d8');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, PIN_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d0202a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, PIN_R * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, PIN_R * 0.3, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // Lying pin: body toward the angle, head at the far end.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, PIN_R * 1.5, PIN_R * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath(); ctx.ellipse(-3, 0, PIN_R * 1.1, PIN_R * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, 0, PIN_R * 0.55, PIN_R * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d0202a';
  ctx.fillRect(4, -PIN_R * 0.38, 2, PIN_R * 0.76);
  ctx.fillRect(7, -PIN_R * 0.34, 1.5, PIN_R * 0.68);
  ctx.restore();
}

function drawBall(b) {
  if (b.inPit) return;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(b.x + 3, b.y + 4, BALL_R, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(b.x - 6, b.y - 6, 2, b.x, b.y, BALL_R);
  g.addColorStop(0, '#6f8cff');
  g.addColorStop(0.6, '#2a3fb8');
  g.addColorStop(1, '#141c5c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();

  // Finger holes rolling over the top.
  const phase = b.roll / BALL_R;
  const c = Math.cos(phase);
  if (c > 0) {
    const dir = Math.atan2(b.vy || -1, b.vx);
    const off = Math.sin(phase) * BALL_R * 0.55;
    const hx = b.x + Math.cos(dir) * off, hy = b.y + Math.sin(dir) * off;
    ctx.fillStyle = `rgba(5, 8, 30, ${0.4 + c * 0.5})`;
    const px = -Math.sin(dir), py = Math.cos(dir);
    for (const [u, v] of [[-4, -3], [4, -3], [0, 5]]) {
      ctx.beginPath();
      ctx.ellipse(hx + px * u + Math.cos(dir) * v * c, hy + py * u + Math.sin(dir) * v * c,
        2.4, 2.4 * Math.max(c, 0.3), dir, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawAimLine() {
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(ball.x, ball.y);
  ctx.lineTo(ball.x + Math.sin(aim) * 320, ball.y - Math.cos(aim) * 320);
  ctx.stroke();
  ctx.restore();
}

function drawPreview() {
  const speed = MIN_SPEED + 0.5 * (MAX_SPEED - MIN_SPEED);
  const b = { x: ball.x, y: ball.y, vx: Math.sin(aim) * speed, vy: -Math.cos(aim) * speed,
    spin, gutter: false, inPit: false, roll: 0 };
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 90 && !b.inPit && !b.gutter && b.y > HEAD_Y - 20; i++) {
    stepBall(b, 1);
    if (i % 4 === 0) { ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function drawPowerMeter() {
  const x = 314, y = 400, w = 24, h = 180;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const g = ctx.createLinearGradient(0, y + h, 0, y);
  g.addColorStop(0, '#2ecc71');
  g.addColorStop(0.6, '#f1c40f');
  g.addColorStop(1, '#e74c3c');
  ctx.fillStyle = g;
  ctx.fillRect(x, y + h * (1 - power), w, h * power);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FORÇA', x + w / 2, y - 8);
}

function drawSpinMeter() {
  const x = LANE_L + 10, y = 505, w = LANE_R - LANE_L - 20, h = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 3, y - 18, w + 6, h + 22);
  ctx.fillStyle = '#444';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9b59b6';
  const cx = x + w / 2;
  ctx.fillRect(Math.min(cx, cx + spin * w / 2), y, Math.abs(spin * w / 2), h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - 1, y - 2, 2, h + 4);
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('◀ EFEITO ▶', cx, y - 6);
}

function drawBanner(text) {
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 20;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(LANE_CX - w / 2, 372, w, 22);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, LANE_CX, 387);
}

function drawScorecard() {
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0, 0, W, CARD_H);

  const scores = scoreFrames(frames);
  const x0 = 8, y0 = 22, fw = 32, lastW = 56, rowH = 18;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  for (let f = 0; f < 10; f++) {
    const x = x0 + f * fw;
    const w = f < 9 ? fw : lastW;
    const current = (state !== 'gameover' && state !== 'title') && f === frameIdx;
    ctx.fillStyle = current ? '#fff6d5' : '#f4f4f4';
    ctx.fillRect(x, y0, w, rowH * 2);
    ctx.strokeStyle = '#223';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y0 + 0.5, w - 1, rowH * 2 - 1);

    ctx.fillStyle = '#8fa3b8';
    ctx.fillText(String(f + 1), x + w / 2, y0 - 5);

    const boxes = f < 9 ? 2 : 3;
    const bw = 13;
    const marks = frameMarks(frames[f], f);
    for (let k = 0; k < boxes; k++) {
      const bx = x + w - bw * (boxes - k);
      ctx.strokeRect(bx + 0.5, y0 + 0.5, bw, 13);
      const mk = marks[k];
      if (mk) {
        ctx.fillStyle = mk === 'X' || mk === '/' ? '#c0392b' : '#111';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(mk, bx + bw / 2 + 0.5, y0 + 11);
      }
    }
    if (scores[f] !== null && frames[f].length > 0) {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(String(scores[f]), x + w / 2, y0 + 31);
    }
    ctx.font = 'bold 9px monospace';
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#8fa3b8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(`TOTAL ${totalScore()}`, 8, CARD_H - 6);
  ctx.textAlign = 'right';
  ctx.fillText(`RECORDE ${hiScore}`, W - 8, CARD_H - 6);
}

function drawSidebar() {
  if (state === 'title' || state === 'gameover') return;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8fa3b8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('FRAME', 29, 130);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(Math.min(frameIdx, 9) + 1), 29, 156);
  ctx.fillStyle = '#8fa3b8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('BOLA', 29, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(frames[Math.min(frameIdx, 9)].length + 1), 29, 216);
  ctx.fillStyle = '#8fa3b8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('PINOS', 29, 250);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(String(pins.filter(p => !p.down && !p.gone).length), 29, 276);
}

function drawMessage() {
  if (messageTimer <= 0 || !message) return;
  const t = 1 - messageTimer / 90;
  const scale = t < 0.15 ? 0.5 + t / 0.15 * 0.6 : 1.1 - Math.min(0.1, (t - 0.15));
  ctx.save();
  ctx.globalAlpha = messageTimer < 20 ? messageTimer / 20 : 1;
  ctx.translate(LANE_CX, 330);
  ctx.scale(scale, scale);
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1a1a22';
  ctx.strokeText(message, 0, 0);
  ctx.fillStyle = message === 'STRIKE!' ? '#ffd23f' : message === 'SPARE!' ? '#4fd1ff' : '#fff';
  ctx.fillText(message, 0, 0);
  ctx.restore();
}

function drawOverlay(title, lines) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, CARD_H, W, H - CARD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 40px monospace';
  ctx.fillText(title, W / 2, 250);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 300 + i * 24));
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('ESPAÇO ou TOQUE para jogar', W / 2, 300 + lines.length * 24 + 30);
  }
}

function draw() {
  drawLane();
  for (const p of pins) if (p.down) drawPin(p);
  for (const p of pins) if (!p.down) drawPin(p);
  if (state === 'aim') drawAimLine();
  if (state === 'spin') drawPreview();
  drawBall(ball);
  if (state === 'spin') drawSpinMeter();
  if (state === 'power') drawPowerMeter();

  if (state === 'position') drawBanner('← → ou arraste • ESPAÇO/solte confirma');
  else if (state === 'aim') drawBanner('DIREÇÃO: toque/ESPAÇO para travar');
  else if (state === 'spin') drawBanner('EFEITO: toque/ESPAÇO para travar');
  else if (state === 'power') drawBanner('FORÇA: toque/ESPAÇO para lançar');

  drawSidebar();
  drawMessage();
  drawScorecard();

  if (state === 'title') {
    drawOverlay('BOLICHE', [
      '1. Posicione a bola',
      '2. Trave a direção',
      '3. Trave o efeito (curva)',
      '4. Trave a força',
      `Recorde: ${hiScore}`,
    ]);
  } else if (state === 'gameover') {
    const total = totalScore();
    drawOverlay('FIM DE JOGO', [
      `Pontuação: ${total}`,
      total >= hiScore && total > 0 ? 'NOVO RECORDE!' : `Recorde: ${hiScore}`,
    ]);
  }
}

// ─── Main loop ───────────────────────────────────────────────────────────────
frames = Array.from({ length: 10 }, () => []);
frameIdx = 0;
rackPins();
newBall();
state = 'title';
meterT = 0;
aim = 0; spin = 0; power = 0.5;

let lastTime = 0, acc = 0;
function loop(t) {
  acc += Math.min(100, t - (lastTime || t));
  lastTime = t;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
