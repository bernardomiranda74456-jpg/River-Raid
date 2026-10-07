'use strict';

// ─── Enduro (clone HTML5 Canvas) ─────────────────────────────────────────────
// Corrida pseudo-3D em visão traseira. Ultrapasse a cota de carros de cada dia
// antes do dia acabar. Ciclo: dia → entardecer → noite → nevoeiro → neve/gelo
// → amanhecer. Som de motor via Web Audio (tecla M silencia).

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const W = 480;
const H = 360;
canvas.width = W;
canvas.height = H;

// ─── Layout ───────────────────────────────────────────────────────────────────
const HORIZON     = 140;              // y do horizonte
const ROAD_BOTTOM = 300;              // y onde a pista encontra o painel
const ROAD_H      = ROAD_BOTTOM - HORIZON;
const HALF_W      = 150;              // meia largura da pista no plano do jogador (px)
const HUD_Y       = ROAD_BOTTOM;
const CAM_Z       = 26;               // distância da câmera ao carro do jogador

// ─── Constantes de jogo ──────────────────────────────────────────────────────
const MAX_SPEED   = 120;   // unidades de mundo por segundo
const OFF_SPEED   = 35;    // velocidade máxima fora da pista
const ACCEL       = 70;
const BRAKE       = 150;
const COAST       = 18;
const SPAWN_Z     = 230;   // distância onde novos carros aparecem
const DAY_LEN     = 180;   // segundos no dia 1
const DAY_LEN_NEXT = 240;  // segundos nos dias seguintes (meta maior)
const QUOTA_DAY1  = 200;
const QUOTA_NEXT  = 300;
const CAR_W       = 64;    // largura de um carro no plano do jogador (px)
const LANE_HALF   = CAR_W / 2 / HALF_W;   // meia largura em unidades de faixa

// ─── Estado ───────────────────────────────────────────────────────────────────
let state;            // 'title' | 'play' | 'gameover'
let day, quota, passed, dayT;
let distance;         // odômetro (unidades de mundo)
let curve, curveTarget, curveLeft;
let cars;
let bgOffset;
let flashTimer;       // pisca quando a cota é atingida
let hiDay, hiDist;
let lastTime = 0;
let shake = 0;
let flakes = [];
let msgTimer = 0, msgText = '';

const player = {
  x: 0,          // posição lateral em frações da meia largura (-1 .. 1)
  speed: 0,
  skid: 0,       // derrapagem no gelo
  bumpCd: 0,     // tempo de invulnerabilidade após batida
};

try {
  hiDay  = parseInt(localStorage.getItem('enduro_hiDay')  || '0', 10) || 0;
  hiDist = parseInt(localStorage.getItem('enduro_hiDist') || '0', 10) || 0;
} catch (e) { hiDay = 0; hiDist = 0; }

// ─── Som (Web Audio) ─────────────────────────────────────────────────────────
const audio = { ctx: null, engine: null, engineGain: null, muted: false, ready: false };
function initAudio() {
  if (audio.ready) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 50;
    const osc2 = ac.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 25;
    const filt = ac.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 400;
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(filt); osc2.connect(filt); filt.connect(gain); gain.connect(ac.destination);
    osc.start(); osc2.start();
    audio.ctx = ac; audio.engine = [osc, osc2]; audio.engineGain = gain; audio.filter = filt;
    audio.ready = true;
  } catch (e) { /* sem áudio */ }
}
function updateEngine() {
  if (!audio.ready) return;
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  const on = state === 'play' && !audio.muted;
  const sf = player.speed / MAX_SPEED;
  const t = audio.ctx.currentTime;
  audio.engine[0].frequency.setTargetAtTime(45 + sf * 140, t, 0.05);
  audio.engine[1].frequency.setTargetAtTime(22 + sf * 70, t, 0.05);
  audio.filter.frequency.setTargetAtTime(300 + sf * 900, t, 0.05);
  audio.engineGain.gain.setTargetAtTime(on ? 0.05 + sf * 0.07 : 0, t, 0.05);
}
function sfxCrash() {
  if (!audio.ready || audio.muted) return;
  const ac = audio.ctx, t = ac.currentTime;
  const len = 0.35, buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(); src.buffer = buf;
  const g = ac.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.01, t + len);
  src.connect(g); g.connect(ac.destination); src.start();
}
function sfxJingle(notes) {
  if (!audio.ready || audio.muted) return;
  const ac = audio.ctx; let t = ac.currentTime;
  for (const f of notes) {
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.15); t += 0.15;
  }
}

// ─── Entrada ──────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  initAudio();
  if (e.code === 'KeyM') { audio.muted = !audio.muted; showMsg(audio.muted ? 'SOM DESLIGADO' : 'SOM LIGADO'); }
  if ((state === 'title' || state === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) startGame();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

const touch = { left: false, right: false, gas: false, brake: false, active: false };
function readTouches(ev) {
  touch.left = touch.right = touch.gas = touch.brake = false;
  const rect = canvas.getBoundingClientRect();
  touch.active = ev.touches.length > 0;
  for (const t of ev.touches) {
    const fx = (t.clientX - rect.left) / rect.width;
    const fy = (t.clientY - rect.top) / rect.height;
    if (fy > 0.82)      { touch.brake = true; continue; }   // faixa do painel: freio
    if (fx < 0.33)      touch.left  = true;
    else if (fx > 0.67) touch.right = true;
    touch.gas = true;
  }
}
canvas.addEventListener('touchstart', ev => {
  ev.preventDefault();
  initAudio();
  if (state === 'title' || state === 'gameover') { startGame(); return; }
  readTouches(ev);
}, { passive: false });
canvas.addEventListener('touchmove', ev => { ev.preventDefault(); readTouches(ev); }, { passive: false });
canvas.addEventListener('touchend',  ev => { ev.preventDefault(); readTouches(ev); }, { passive: false });
canvas.addEventListener('touchcancel', ev => { ev.preventDefault(); readTouches(ev); }, { passive: false });

function input() {
  return {
    left:  keys['ArrowLeft']  || keys['KeyA'] || touch.left,
    right: keys['ArrowRight'] || keys['KeyD'] || touch.right,
    gas:   keys['ArrowUp']    || keys['KeyW'] || keys['Space'] || touch.gas,
    brake: keys['ArrowDown']  || keys['KeyS'] || touch.brake,
  };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function lerp(a, b, t)     { return a + (b - a) * t; }
function showMsg(t) { msgText = t; msgTimer = 2; }

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function rgbOf(col) {
  if (col[0] === '#') return hexToRgb(col);
  return col.match(/\d+/g).map(Number);
}
function lerpColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
function shade(col, d) {
  const [r, g, b] = rgbOf(col);
  return `rgb(${clamp(r + d, 0, 255)},${clamp(g + d, 0, 255)},${clamp(b + d, 0, 255)})`;
}

// Projeção com câmera atrás do jogador: escala 1 no plano do jogador (z = 0)
function scaleAt(z) { return CAM_Z / (z + CAM_Z); }
function zToY(z)    { return HORIZON + ROAD_H * scaleAt(z); }
function yToZ(y)    { return CAM_Z / ((y - HORIZON) / ROAD_H) - CAM_Z; }
function roadCenter(s) {           // s = escala (1 perto, 0 no horizonte)
  const t = 1 - s;
  return W / 2 + curve * 260 * t * t - player.x * HALF_W * 0.55 * t;
}

// ─── Ciclo do dia ─────────────────────────────────────────────────────────────
// Quadros-chave: [t, céu-alto, céu-baixo, chão, pista, montanhas]
const DAY_KEYS = [
  [0.00, '#b9b9b9', '#cfcfcf', '#9b9b9b', '#8a8a8a', '#9b9b9b'],   // resto do nevoeiro
  [0.05, '#3d8fd6', '#9ccff2', '#3a9a3a', '#2f7a2f', '#9db85a'],   // dia ensolarado
  [0.28, '#3d8fd6', '#9ccff2', '#3a9a3a', '#2f7a2f', '#9db85a'],
  [0.32, '#8fb4d6', '#dfe9f2', '#f2f4f8', '#c3cad3', '#e6ecf2'],   // neve
  [0.50, '#8fb4d6', '#dfe9f2', '#f2f4f8', '#c3cad3', '#e6ecf2'],
  [0.54, '#3d8fd6', '#ffb0c8', '#3a9a3a', '#2f7a2f', '#9db85a'],   // entardecer: faixas rosa
  [0.60, '#4a2c7a', '#e86fb0', '#357f35', '#2b6b2b', '#6f8f45'],   // roxo
  [0.68, '#1a1030', '#ff5a2a', '#255a25', '#1f4f1f', '#3d5a2a'],   // laranja/vermelho
  [0.72, '#000000', '#000000', '#000000', '#000000', '#000000'],   // noite
  [0.90, '#000000', '#000000', '#000000', '#000000', '#000000'],
  [0.94, '#b9b9b9', '#cfcfcf', '#9b9b9b', '#8a8a8a', '#9b9b9b'],   // nevoeiro
  [1.00, '#b9b9b9', '#cfcfcf', '#9b9b9b', '#8a8a8a', '#9b9b9b'],
];

function palette() {
  let i = 0;
  while (i < DAY_KEYS.length - 2 && dayT >= DAY_KEYS[i + 1][0]) i++;
  const a = DAY_KEYS[i], b = DAY_KEYS[i + 1];
  const t = clamp((dayT - a[0]) / (b[0] - a[0]), 0, 1);
  return {
    skyTop: lerpColor(a[1], b[1], t),
    skyBot: lerpColor(a[2], b[2], t),
    ground: lerpColor(a[3], b[3], t),
    road:   lerpColor(a[4], b[4], t),
    mtn:    lerpColor(a[5], b[5], t),
  };
}
function isNight() { return dayT >= 0.71 && dayT < 0.92; }
function isFog()   { return dayT >= 0.92 || dayT < 0.04; }
function isSnow()  { return dayT >= 0.31 && dayT < 0.52; }
function isIce()   { return isSnow(); }
function phaseName() {
  if (dayT < 0.04) return 'NEVOEIRO';
  if (dayT < 0.18) return 'MANHÃ';
  if (dayT < 0.31) return 'TARDE';
  if (dayT < 0.52) return 'NEVE / GELO';
  if (dayT < 0.71) return 'ENTARDECER';
  if (dayT < 0.92) return 'NOITE';
  return 'NEVOEIRO';
}

// ─── Jogo ─────────────────────────────────────────────────────────────────────
function startGame() {
  state = 'play';
  day = 1; quota = QUOTA_DAY1; passed = 0; dayT = 0;
  distance = 0;
  curve = 0; curveTarget = 0; curveLeft = 500;
  cars = [];
  bgOffset = 0;
  flashTimer = 0;
  shake = 0;
  flakes = [];
  msgTimer = 0;
  player.x = 0; player.speed = 0; player.skid = 0; player.bumpCd = 0;
  for (let i = 0; i < 4; i++) spawnCar(50 + i * 50);
  showMsg('DIA 1 — PASSE ' + QUOTA_DAY1 + ' CARROS');
}

const CAR_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#ec407a', '#7cb342'];
const LANES = [-0.58, 0, 0.58];

function spawnCar(z) {
  // Em qualquer janela de 50 unidades há no máximo 2 carros, em faixas distintas:
  // sempre existe uma passagem livre
  const nearby = cars.filter(c => Math.abs(c.z - z) < 50);
  if (nearby.length >= 2) return false;
  const free = LANES.filter(l => !nearby.some(c => Math.abs(c.x - l) < 0.5));
  if (!free.length) return false;
  const x = free[Math.floor(Math.random() * free.length)] + (Math.random() * 0.14 - 0.07);
  cars.push({
    z, x,
    speed: 30 + Math.random() * 34 + Math.min(day - 1, 4) * 4,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    behind: z < 0,
  });
  return true;
}

function nextDay() {
  day++;
  quota = QUOTA_NEXT;
  passed = 0;
  dayT = 0;
  flashTimer = 0;
  showMsg('DIA ' + day + ' — PASSE ' + quota + ' CARROS');
  sfxJingle([523, 659, 784, 1047]);
}

function gameOver() {
  state = 'gameover';
  sfxJingle([392, 330, 262, 196]);
  const d = Math.floor(distance / 10);
  if (day > hiDay || (day === hiDay && d > hiDist)) {
    hiDay = day; hiDist = d;
    try {
      localStorage.setItem('enduro_hiDay', String(hiDay));
      localStorage.setItem('enduro_hiDist', String(hiDist));
    } catch (e) { /* sem armazenamento */ }
  }
}

function crash(c) {
  player.speed = Math.min(player.speed, 28);
  player.bumpCd = 0.9;
  c.z = 8;
  c.speed = Math.max(c.speed, 95);     // o carro atingido dispara à frente
  c.x = player.x > 0 ? -0.58 : 0.58;   // e sai da sua faixa
  shake = 7;
  sfxCrash();
}

function update(dt) {
  if (msgTimer > 0) msgTimer -= dt;
  if (state !== 'play') return;
  const inp = input();
  const ice = isIce();

  // ── Velocidade ──
  const offRoad = Math.abs(player.x) > 1.0;
  if (inp.gas)        player.speed += ACCEL * dt;
  else if (inp.brake) player.speed -= BRAKE * dt;
  else                player.speed -= COAST * dt;
  if (offRoad && player.speed > OFF_SPEED) {
    player.speed -= 130 * dt;
    shake = 2;
  }
  player.speed = clamp(player.speed, 0, MAX_SPEED);
  const sf = player.speed / MAX_SPEED;

  // ── Direção ──
  const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const steerRate = (ice ? 1.0 : 1.9) * (0.35 + 0.65 * sf);
  if (ice) {
    player.skid = clamp(player.skid + steer * 2.4 * dt, -1.3, 1.3);
    player.skid *= Math.pow(0.55, dt);
    player.x += player.skid * dt * 1.5;
  } else {
    player.skid = 0;
  }
  player.x += steer * steerRate * dt;
  player.x -= curve * sf * 0.7 * dt;          // força centrífuga
  player.x = clamp(player.x, -1.4, 1.4);

  // ── Curvas da pista ──
  const travel = player.speed * dt;
  distance += travel;
  curveLeft -= travel;
  if (curveLeft <= 0) {
    curveTarget = Math.random() < 0.3 ? 0 : (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.min(day, 5) / 5);
    curveLeft = 300 + Math.random() * 600;
  }
  curve += clamp(curveTarget - curve, -0.5 * dt, 0.5 * dt);
  bgOffset += curve * sf * 90 * dt;

  // ── Tráfego ──
  if (player.bumpCd > 0) player.bumpCd -= dt;
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    const prevZ = c.z;
    c.z += (c.speed - player.speed) * dt;

    if (prevZ >= 0 && c.z < 0) {
      // Cruzou a posição do jogador vindo da frente
      if (Math.abs(c.x - player.x) < LANE_HALF * 1.7 && player.bumpCd <= 0) {
        crash(c);
      } else {
        passed++;
        c.behind = true;
        if (passed === quota) { flashTimer = 0; sfxJingle([784, 988, 1175]); showMsg('META DO DIA CUMPRIDA!'); }
      }
    } else if (prevZ < 0 && c.z >= 0) {
      // Um carro vindo de trás ultrapassou o jogador (desvia, sem colisão)
      if (Math.abs(c.x - player.x) < LANE_HALF * 1.9) c.x = player.x > 0 ? player.x - 0.6 : player.x + 0.6;
      if (c.behind) {
        passed = Math.max(0, passed - 1);
        c.behind = false;
      }
    }

    if (c.z > SPAWN_Z + 20 || c.z < -30) cars.splice(i, 1);
  }

  const targetCars = 7 + Math.min(day - 1, 3);
  if (cars.length < targetCars && Math.random() < 3.5 * dt) spawnCar(SPAWN_Z);

  // ── Neve ──
  if (isSnow()) {
    if (flakes.length < 90) flakes.push({ x: Math.random() * W, y: -4, vy: 90 + Math.random() * 80, vx: (Math.random() - 0.5) * 20, r: 1 + Math.random() * 1.5 });
    for (const f of flakes) { f.y += f.vy * dt; f.x += (f.vx - curve * 30) * dt; }
    flakes = flakes.filter(f => f.y < ROAD_BOTTOM);
  } else if (flakes.length) {
    for (const f of flakes) f.y += f.vy * dt;
    flakes = flakes.filter(f => f.y < ROAD_BOTTOM);
  }

  // ── Dia ──
  dayT += dt / (day === 1 ? DAY_LEN : DAY_LEN_NEXT);
  if (passed >= quota) flashTimer += dt;
  if (dayT >= 1) {
    if (passed >= quota) nextDay();
    else gameOver();
  }

  if (shake > 0) shake = Math.max(0, shake - 24 * dt);
}

// ─── Renderização ─────────────────────────────────────────────────────────────
function render() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  if (state === 'title') { drawTitle(); ctx.restore(); return; }
  drawScene();
  drawHUD();
  drawMessage();
  if (state === 'gameover') drawGameOver();
  ctx.restore();
}

function drawScene() {
  const pal = palette();
  const night = isNight();
  const fog = isFog();
  const fogDist = 55;

  // Céu
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON);

  // Sol / lua / estrelas
  if (dayT >= 0.04 && dayT < 0.70 && !fog) {
    const sunT = (dayT - 0.04) / 0.66;
    const sy = HORIZON - 6 - Math.sin(sunT * Math.PI) * 110;
    ctx.fillStyle = dayT > 0.54 ? '#ff7043' : '#fff176';
    ctx.beginPath(); ctx.arc(W * 0.72, sy, 13, 0, Math.PI * 2); ctx.fill();
  }
  if (night) {
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.arc(W * 0.3, 40, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 45; i++) {
      const sx = (i * 97 + 13) % W, sy = (i * 53 + 7) % (HORIZON - 30);
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  // Montanhas (parallax com a curva)
  if (!fog) {
    ctx.fillStyle = pal.mtn;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON);
    const period = 240;
    for (let x = -period; x <= W + period; x += 8) {
      const wx = x + ((bgOffset % period) + period) % period;
      const hgt = 18 + 14 * Math.sin(wx * 0.03) + 10 * Math.sin(wx * 0.071 + 1.3) + 6 * Math.sin(wx * 0.17);
      ctx.lineTo(x, HORIZON - Math.max(4, hgt));
    }
    ctx.lineTo(W, HORIZON);
    ctx.closePath();
    ctx.fill();
  }

  // Pista, linha a linha: marcadores brancos tracejados nas bordas (como no original)
  const groundB = night ? pal.ground : shade(pal.ground, -14);
  const roadB   = night ? pal.road   : shade(pal.road, -6);
  for (let y = HORIZON; y < ROAD_BOTTOM; y++) {
    const s = (y - HORIZON + 1) / ROAD_H;
    const z = CAM_Z / s - CAM_Z;
    const half = HALF_W * s;
    const cx = roadCenter(s);
    const stripe = Math.floor((z + distance) / 16) % 2 === 0;

    ctx.fillStyle = stripe ? pal.ground : groundB;
    ctx.fillRect(0, y, W, 1);

    ctx.fillStyle = stripe ? pal.road : roadB;
    ctx.fillRect(cx - half, y, half * 2, 1);

    if (stripe) {
      const ew = Math.max(1, 7 * s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - half - ew, y, ew, 1);
      ctx.fillRect(cx + half, y, ew, 1);
    }

    if (fog && z > 10) {
      const a = clamp((z - 10) / fogDist, 0, 1);
      ctx.fillStyle = `rgba(207,207,207,${a})`;
      ctx.fillRect(0, y, W, 1);
    }
  }

  // Carros, do mais distante ao mais próximo
  const sorted = cars.slice().sort((a, b) => b.z - a.z);
  for (const c of sorted) {
    if (c.z < -2) continue;
    if (fog && c.z > fogDist + 15) continue;
    const s = scaleAt(Math.max(c.z, 0));
    const y = HORIZON + ROAD_H * s;
    const x = roadCenter(s) + c.x * HALF_W * s;
    const w = CAR_W * s, h = CAR_W * 0.58 * s;
    if (night) {
      // Só as lanternas traseiras
      ctx.fillStyle = '#ff1744';
      const lw = Math.max(1.5, 9 * s), lh = Math.max(1, 4 * s);
      ctx.fillRect(x - w * 0.34 - lw / 2, y - h * 0.5, lw, lh);
      ctx.fillRect(x + w * 0.34 - lw / 2, y - h * 0.5, lw, lh);
    } else {
      ctx.globalAlpha = fog ? clamp(1 - (c.z - 10) / fogDist, 0.08, 1) : 1;
      drawCar(x, y, w, h, c.color, false);
      ctx.globalAlpha = 1;
    }
  }

  // Neve caindo
  if (flakes.length) {
    ctx.fillStyle = '#ffffff';
    for (const f of flakes) ctx.fillRect(f.x, f.y, f.r, f.r);
  }

  // Carro do jogador
  const px = W / 2 + player.x * HALF_W * 0.9;
  drawCar(px, ROAD_BOTTOM - 4, CAR_W, CAR_W * 0.58, '#f1f1f1', true);
  if (player.bumpCd > 0 && Math.floor(player.bumpCd * 20) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px - 36, ROAD_BOTTOM - 44, 72, 42);
  }
}

// Carro estilo Fórmula 1 em visão traseira. (x, yBottom) é o centro da base.
function drawCar(x, yb, w, h, color, isPlayer) {
  const px = v => Math.max(1, v);
  // Rodas traseiras (grandes, expostas)
  const rw = w * 0.20, rh = h * 0.62;
  ctx.fillStyle = '#111';
  ctx.fillRect(x - w / 2, yb - rh, rw, rh);
  ctx.fillRect(x + w / 2 - rw, yb - rh, rw, rh);
  // Banda de rodagem animada
  if (w > 20) {
    const ph = Math.floor(distance / 2.5) % 2 === 0;
    ctx.fillStyle = ph ? '#5a5a5a' : '#2a2a2a';
    ctx.fillRect(x - w / 2 + 1, yb - rh * 0.55, rw - 2, px(h * 0.07));
    ctx.fillRect(x + w / 2 - rw + 1, yb - rh * 0.55, rw - 2, px(h * 0.07));
  }
  // Rodas dianteiras (menores, aparecem acima)
  const fw = w * 0.14, fh = h * 0.30;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x - w * 0.38, yb - h * 0.98, fw, fh);
  ctx.fillRect(x + w * 0.38 - fw, yb - h * 0.98, fw, fh);
  // Corpo (estreito, entre as rodas)
  const bw = w * 0.42, bh = h * 0.55;
  const by = yb - bh - h * 0.05;
  ctx.fillStyle = color;
  ctx.fillRect(x - bw / 2, by, bw, bh);
  // Entrada de ar / cabine
  ctx.fillStyle = shade(color, -45);
  ctx.fillRect(x - bw * 0.3, by - h * 0.12, bw * 0.6, h * 0.22);
  // Capacete do piloto
  ctx.fillStyle = isPlayer ? '#ffd54f' : '#eeeeee';
  ctx.fillRect(x - px(w * 0.05), by - h * 0.12, px(w * 0.10), px(h * 0.10));
  // Asa traseira
  ctx.fillStyle = shade(color, -70);
  ctx.fillRect(x - w * 0.36, by + bh * 0.05, w * 0.72, px(h * 0.10));
  ctx.fillRect(x - w * 0.36, by + bh * 0.05, px(w * 0.04), bh * 0.5);
  ctx.fillRect(x + w * 0.36 - px(w * 0.04), by + bh * 0.05, px(w * 0.04), bh * 0.5);
  // Lanternas
  ctx.fillStyle = '#ff1744';
  const lw = px(w * 0.10), lh = px(h * 0.10);
  ctx.fillRect(x - bw / 2, by + bh - lh - px(h * 0.05), lw, lh);
  ctx.fillRect(x + bw / 2 - lw, by + bh - lh - px(h * 0.05), lw, lh);
}

function drawHUD() {
  ctx.fillStyle = '#d9822b';
  ctx.fillRect(0, HUD_Y, W, H - HUD_Y);
  ctx.fillStyle = '#7a3e0f';
  ctx.fillRect(0, HUD_Y, W, 2);

  const remaining = Math.max(0, quota - passed);
  const quotaMet = passed >= quota;

  // Odômetro (centro, em cima)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(W / 2 - 46, HUD_Y + 7, 92, 20);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(String(Math.floor(distance / 10)).padStart(5, '0'), W / 2, HUD_Y + 22);

  // Dia (embaixo, à esquerda do centro)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(W / 2 - 135, HUD_Y + 32, 70, 22);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('DIA ' + day, W / 2 - 100, HUD_Y + 49);

  // Carros a passar (embaixo, à direita do centro) ou 4 bandeiras
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(W / 2 + 60, HUD_Y + 32, 90, 22);
  if (quotaMet) {
    const wave = Math.floor(flashTimer * 6) % 2;
    for (let i = 0; i < 4; i++) drawFlag(W / 2 + 68 + i * 21, HUD_Y + 35, '#43d16a', wave);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(String(remaining), W / 2 + 105, HUD_Y + 49);
  }

  // Fase do dia e velocidade (extras, discretos)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5a2d08';
  ctx.font = '9px monospace';
  ctx.fillText(phaseName(), 14, HUD_Y + 18);
  ctx.fillStyle = '#7a3e0f';
  ctx.fillRect(14, HUD_Y + 26, 80, 5);
  ctx.fillStyle = player.speed > MAX_SPEED * 0.85 ? '#fff176' : '#fbe9d0';
  ctx.fillRect(14, HUD_Y + 26, 80 * player.speed / MAX_SPEED, 5);
  ctx.fillStyle = '#5a2d08';
  ctx.fillText('META ' + quota + ' · M:SOM', 14, HUD_Y + 46);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#5a2d08';
  ctx.fillText('DISTÂNCIA', W - 14, HUD_Y + 18);
  ctx.fillText('CARROS', W - 14, HUD_Y + 46);
  ctx.textAlign = 'left';
}

function drawFlag(x, y, color, wave) {
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(x, y, 2, 16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + 14, y + 3 + (wave ? 2 : 0));
  ctx.lineTo(x + 2, y + 8);
  ctx.closePath();
  ctx.fill();
}

function drawMessage() {
  if (msgTimer <= 0 || !msgText) return;
  ctx.globalAlpha = clamp(msgTimer, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W / 2 - 150, 18, 300, 26);
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(msgText, W / 2, 36);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

let titleT = 0;
function drawTitle() {
  // Cenário animado de entardecer com tráfego
  titleT += 1 / 60;
  const savedT = dayT, savedCurve = curve;
  dayT = 0.33; curve = Math.sin(titleT * 0.4) * 0.6;
  distance += 0.8;
  if (cars.length < 5 && Math.random() < 0.05) spawnCar(SPAWN_Z);
  for (const c of cars) c.z -= 60 / 60;
  cars = cars.filter(c => c.z > -5);
  drawScene();
  dayT = savedT; curve = savedCurve;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 54px monospace';
  ctx.fillText('ENDURO', W / 2, 108);

  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  if (Math.floor(titleT * 2) % 2 === 0) ctx.fillText('PRESSIONE ESPAÇO OU TOQUE PARA JOGAR', W / 2, 158);

  ctx.fillStyle = '#90caf9';
  ctx.font = '11px monospace';
  ctx.fillText('← → ou A/D     Virar', W / 2, 192);
  ctx.fillText('↑ ou ESPAÇO    Acelerar', W / 2, 208);
  ctx.fillText('↓ ou S         Frear        M  Som', W / 2, 224);

  ctx.fillStyle = '#eceff1';
  ctx.fillText('Ultrapasse ' + QUOTA_DAY1 + ' carros no 1º dia e ' + QUOTA_NEXT + ' nos seguintes.', W / 2, 254);
  ctx.fillText('Dia, entardecer, noite, nevoeiro, neve e gelo mudam a pista.', W / 2, 270);

  if (hiDay > 0) {
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('RECORDE: DIA ' + hiDay + '  |  DISTÂNCIA ' + String(hiDist).padStart(6, '0'), W / 2, 330);
  }
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f44336';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('FIM DE JOGO', W / 2, H / 2 - 50);

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText('Faltaram ' + Math.max(0, quota - passed) + ' carros no dia ' + day, W / 2, H / 2 - 15);
  ctx.fillText('DISTÂNCIA: ' + String(Math.floor(distance / 10)).padStart(6, '0'), W / 2, H / 2 + 8);

  ctx.fillStyle = '#ffd54f';
  ctx.fillText('RECORDE: DIA ' + hiDay + '  |  ' + String(hiDist).padStart(6, '0'), W / 2, H / 2 + 32);

  ctx.fillStyle = '#aaa';
  ctx.font = '11px monospace';
  ctx.fillText('ESPAÇO ou toque para jogar novamente', W / 2, H / 2 + 65);
  ctx.textAlign = 'left';
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
state = 'title';
day = 1; quota = QUOTA_DAY1; passed = 0; dayT = 0; distance = 0;
curve = 0; cars = []; bgOffset = 0; flashTimer = 0;

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0);
  lastTime = ts;
  update(dt);
  updateEngine();
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
