'use strict';

// ─── Enduro (clone HTML5 Canvas) ─────────────────────────────────────────────
// Corrida pseudo-3D em visão traseira. Ultrapasse a cota de carros de cada dia
// antes do dia acabar. Ciclo dia/entardecer/noite/nevoeiro/neve/amanhecer.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const W = 480;
const H = 360;
canvas.width = W;
canvas.height = H;

// ─── Layout ───────────────────────────────────────────────────────────────────
const HORIZON     = 150;              // y do horizonte
const ROAD_BOTTOM = 300;              // y onde a pista encontra o painel
const ROAD_H      = ROAD_BOTTOM - HORIZON;
const HALF_W      = 210;              // meia largura da pista na base (px)
const HUD_Y       = ROAD_BOTTOM;

// ─── Constantes de jogo ──────────────────────────────────────────────────────
const MAX_SPEED   = 100;   // unidades de mundo por segundo
const OFF_SPEED   = 30;    // velocidade máxima fora da pista
const ACCEL       = 55;
const BRAKE       = 130;
const COAST       = 14;
const SPAWN_Z     = 130;   // distância onde novos carros aparecem
const DAY_LEN     = 200;   // segundos por dia
const QUOTA_DAY1  = 200;
const QUOTA_NEXT  = 300;

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

// ─── Entrada ──────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if ((state === 'title' || state === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) startGame();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

const touch = { left: false, right: false, gas: false };
function readTouches(ev) {
  touch.left = touch.right = touch.gas = false;
  const rect = canvas.getBoundingClientRect();
  for (const t of ev.touches) {
    const fx = (t.clientX - rect.left) / rect.width;
    if (fx < 0.33)      touch.left  = true;
    else if (fx > 0.67) touch.right = true;
    touch.gas = true;
  }
}
canvas.addEventListener('touchstart', ev => {
  ev.preventDefault();
  if (state === 'title' || state === 'gameover') { startGame(); return; }
  readTouches(ev);
}, { passive: false });
canvas.addEventListener('touchmove', ev => { ev.preventDefault(); readTouches(ev); }, { passive: false });
canvas.addEventListener('touchend',  ev => { ev.preventDefault(); readTouches(ev); }, { passive: false });

function input() {
  return {
    left:  keys['ArrowLeft']  || keys['KeyA'] || touch.left,
    right: keys['ArrowRight'] || keys['KeyD'] || touch.right,
    gas:   keys['ArrowUp']    || keys['KeyW'] || keys['Space'] || touch.gas,
    brake: keys['ArrowDown']  || keys['KeyS'],
  };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function lerp(a, b, t)     { return a + (b - a) * t; }

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function lerpColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

// Projeção: linha r (1..ROAD_H) abaixo do horizonte ↔ profundidade z
function zToY(z)  { return HORIZON + ROAD_H / z; }
function yScale(y) { return (y - HORIZON) / ROAD_H; }          // 0 no horizonte, 1 na base
function roadCenter(y) {
  const t = 1 - yScale(y);
  return W / 2 + curve * 170 * t * t;
}

// ─── Ciclo do dia ─────────────────────────────────────────────────────────────
// Cada quadro-chave: [t, céu-alto, céu-baixo, chão, pista, montanhas]
const DAY_KEYS = [
  [0.00, '#4fa3e0', '#a9d8f5', '#3c8f3c', '#8a8a8a', '#2f6b2f'],
  [0.26, '#4fa3e0', '#a9d8f5', '#3c8f3c', '#8a8a8a', '#2f6b2f'],
  [0.36, '#2b2d6b', '#ff8c42', '#2a5c2a', '#6e6e6e', '#1e3d1e'],
  [0.42, '#000000', '#05051a', '#000000', '#101010', '#000000'],
  [0.60, '#000000', '#05051a', '#000000', '#101010', '#000000'],
  [0.66, '#9a9a9a', '#b5b5b5', '#8c8c8c', '#9e9e9e', '#8c8c8c'],
  [0.76, '#9a9a9a', '#b5b5b5', '#8c8c8c', '#9e9e9e', '#8c8c8c'],
  [0.80, '#cfe3f0', '#e8f1f8', '#f0f0f5', '#9aa3ad', '#d8dee5'],   // neve
  [0.88, '#cfe3f0', '#e8f1f8', '#f0f0f5', '#9aa3ad', '#d8dee5'],
  [0.94, '#6a4c93', '#ffb86b', '#3c7a3c', '#7f7f7f', '#2a552a'],   // amanhecer
  [1.00, '#4fa3e0', '#a9d8f5', '#3c8f3c', '#8a8a8a', '#2f6b2f'],
];
// No dia 1 não há neve: substitui pelo amanhecer prolongado
const DAY1_KEYS = DAY_KEYS.map(k => {
  if (k[0] === 0.80 || k[0] === 0.88) return [k[0], '#6a4c93', '#ffb86b', '#3c7a3c', '#7f7f7f', '#2a552a'];
  return k;
});

function palette() {
  const keysArr = day === 1 ? DAY1_KEYS : DAY_KEYS;
  let i = 0;
  while (i < keysArr.length - 2 && dayT >= keysArr[i + 1][0]) i++;
  const a = keysArr[i], b = keysArr[i + 1];
  const t = clamp((dayT - a[0]) / (b[0] - a[0]), 0, 1);
  return {
    skyTop: lerpColor(a[1], b[1], t),
    skyBot: lerpColor(a[2], b[2], t),
    ground: lerpColor(a[3], b[3], t),
    road:   lerpColor(a[4], b[4], t),
    mtn:    lerpColor(a[5], b[5], t),
  };
}
function isNight() { return dayT >= 0.40 && dayT < 0.62; }
function isFog()   { return dayT >= 0.64 && dayT < 0.78; }
function isIce()   { return day >= 2 && dayT >= 0.79 && dayT < 0.90; }
function phaseName() {
  if (dayT < 0.15) return 'MANHÃ';
  if (dayT < 0.30) return 'TARDE';
  if (dayT < 0.40) return 'ENTARDECER';
  if (dayT < 0.62) return 'NOITE';
  if (dayT < 0.78) return 'NEVOEIRO';
  if (dayT < 0.90) return day >= 2 ? 'GELO' : 'AMANHECER';
  return 'AMANHECER';
}

// ─── Jogo ─────────────────────────────────────────────────────────────────────
function startGame() {
  state = 'play';
  day = 1; quota = QUOTA_DAY1; passed = 0; dayT = 0;
  distance = 0;
  curve = 0; curveTarget = 0; curveLeft = 400;
  cars = [];
  bgOffset = 0;
  flashTimer = 0;
  shake = 0;
  player.x = 0; player.speed = 0; player.skid = 0; player.bumpCd = 0;
  for (let i = 0; i < 5; i++) spawnCar(30 + i * 20);
}

const CAR_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#f5f5f5'];

function spawnCar(z) {
  // Três faixas com pequeno desvio; evita "paredes" de carros na mesma distância
  const nearby = cars.filter(c => Math.abs(c.z - z) < 12);
  if (nearby.length >= 2) return false;
  const lanes = [-0.6, 0, 0.6].filter(l => !nearby.some(c => Math.abs(c.x - l) < 0.45));
  if (!lanes.length) return false;
  const x = lanes[Math.floor(Math.random() * lanes.length)] + (Math.random() * 0.16 - 0.08);
  cars.push({
    z, x,
    speed: 28 + Math.random() * 34 + Math.min(day - 1, 4) * 3,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    behind: z < 1,
  });
  return true;
}

function nextDay() {
  day++;
  quota = QUOTA_NEXT;
  passed = 0;
  dayT = 0;
  flashTimer = 0;
}

function gameOver() {
  state = 'gameover';
  const d = Math.floor(distance / 10);
  if (day > hiDay || (day === hiDay && d > hiDist)) {
    hiDay = day; hiDist = d;
    try {
      localStorage.setItem('enduro_hiDay', String(hiDay));
      localStorage.setItem('enduro_hiDist', String(hiDist));
    } catch (e) { /* sem armazenamento */ }
  }
}

function update(dt) {
  if (state !== 'play') return;
  const inp = input();
  const ice = isIce();

  // ── Velocidade ──
  const offRoad = Math.abs(player.x) > 1.0;
  if (inp.gas)        player.speed += ACCEL * dt;
  else if (inp.brake) player.speed -= BRAKE * dt;
  else                player.speed -= COAST * dt;
  if (offRoad && player.speed > OFF_SPEED) {
    player.speed -= 110 * dt;
    shake = 2;
  }
  player.speed = clamp(player.speed, 0, MAX_SPEED);
  const sf = player.speed / MAX_SPEED;

  // ── Direção ──
  let steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const steerRate = (ice ? 0.9 : 1.7) * (0.35 + 0.65 * sf);
  if (ice) {
    player.skid = clamp(player.skid + steer * 2.2 * dt, -1.2, 1.2);
    player.skid *= Math.pow(0.6, dt);
    player.x += player.skid * dt * 1.4;
  } else {
    player.skid = 0;
  }
  player.x += steer * steerRate * dt;
  // força centrífuga nas curvas
  player.x -= curve * sf * 1.1 * dt;
  player.x = clamp(player.x, -1.35, 1.35);

  // ── Curvas da pista ──
  const travel = player.speed * dt;
  distance += travel;
  curveLeft -= travel;
  if (curveLeft <= 0) {
    curveTarget = Math.random() < 0.3 ? 0 : (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.min(day, 5) / 5);
    curveLeft = 250 + Math.random() * 500;
  }
  curve += clamp(curveTarget - curve, -0.6 * dt, 0.6 * dt);
  bgOffset += curve * sf * 70 * dt;

  // ── Tráfego ──
  if (player.bumpCd > 0) player.bumpCd -= dt;
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    const prevZ = c.z;
    c.z += (c.speed - player.speed) * dt;

    // Cruzou a posição do jogador (z ≈ 1)
    if (prevZ >= 1 && c.z < 1) {
      if (Math.abs(c.x - player.x) < 0.30 && player.bumpCd <= 0) {
        // Batida: perde velocidade, carro é empurrado à frente
        player.speed = Math.min(player.speed, 12);
        player.bumpCd = 0.8;
        c.z = 3;
        c.speed = Math.max(c.speed, 72);     // o carro atingido dispara à frente
        shake = 6;
      } else {
        passed++;
        c.behind = true;
      }
    } else if (prevZ < 1 && c.z >= 1) {
      // Um carro vindo de trás ultrapassou o jogador (sem colisão: ele desvia)
      if (Math.abs(c.x - player.x) < 0.30) c.x = player.x > 0 ? player.x - 0.5 : player.x + 0.5;
      if (c.behind) {
        passed = Math.max(0, passed - 1);
        c.behind = false;
      }
    }

    if (c.z > SPAWN_Z + 10 || c.z < -12) cars.splice(i, 1);
  }

  const targetCars = 8 + Math.min(day - 1, 3);
  if (cars.length < targetCars && Math.random() < 3.2 * dt) spawnCar(SPAWN_Z);

  // ── Dia ──
  dayT += dt / DAY_LEN;
  if (passed >= quota) flashTimer += dt;
  if (dayT >= 1) {
    if (passed >= quota) nextDay();
    else gameOver();
  }

  if (shake > 0) shake = Math.max(0, shake - 20 * dt);
}

// ─── Renderização ─────────────────────────────────────────────────────────────
function render() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  if (state === 'title') { drawTitle(); ctx.restore(); return; }
  drawScene();
  drawHUD();
  if (state === 'gameover') drawGameOver();
  ctx.restore();
}

function drawScene() {
  const pal = palette();
  const night = isNight();
  const fog = isFog();

  // Céu
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON);

  // Sol / lua
  if (dayT < 0.42 || dayT > 0.92) {
    const sunT = dayT < 0.42 ? dayT / 0.42 : (dayT - 0.92) / 0.08 * 0.15;
    const sy = HORIZON - 20 - Math.sin(sunT * Math.PI) * 100;
    ctx.fillStyle = dayT > 0.30 && dayT < 0.42 ? '#ff7043' : '#fff176';
    ctx.beginPath(); ctx.arc(W * 0.72, sy, 12, 0, Math.PI * 2); ctx.fill();
  } else if (night) {
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.arc(W * 0.3, 40, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
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

  // Pista, linha a linha
  const roadRgb = hexToRgbStr(pal.road);
  const fogDist = 45;
  for (let y = HORIZON; y < ROAD_BOTTOM; y++) {
    const r = y - HORIZON + 1;
    const z = ROAD_H / r;
    const s = r / ROAD_H;
    const half = HALF_W * s;
    const cx = roadCenter(y);
    const stripe = Math.floor((z + distance) / 9) % 2 === 0;

    ctx.fillStyle = stripe ? pal.ground : shade(pal.ground, night ? 0 : -16);
    ctx.fillRect(0, y, W, 1);

    ctx.fillStyle = stripe ? pal.road : shade(pal.road, -6);
    ctx.fillRect(cx - half, y, half * 2, 1);

    // Bordas (brancas/vermelhas); à noite só as próximas são visíveis
    const ew = Math.max(1, 7 * s);
    if (!night || z < 18) {
      ctx.fillStyle = stripe ? '#f5f5f5' : '#e53935';
      ctx.fillRect(cx - half, y, ew, 1);
      ctx.fillRect(cx + half - ew, y, ew, 1);
    }

    if (fog && z > 8) {
      const a = clamp((z - 8) / fogDist, 0, 1);
      ctx.fillStyle = `rgba(181,181,181,${a})`;
      ctx.fillRect(0, y, W, 1);
    }
  }
  void roadRgb;

  // Carros, do mais distante ao mais próximo
  const sorted = cars.slice().sort((a, b) => b.z - a.z);
  for (const c of sorted) {
    if (c.z < 1) continue;                      // atrás do jogador: fora da tela
    if (fog && c.z > fogDist + 8) continue;
    const y = zToY(c.z);
    const s = yScale(y);
    const x = roadCenter(y) + c.x * HALF_W * s;
    const w = 58 * s, h = 34 * s;
    if (night) {
      ctx.fillStyle = '#ff1744';
      const lw = Math.max(1, 7 * s);
      ctx.fillRect(x - w * 0.36 - lw / 2, y - h * 0.45, lw, Math.max(1, 3 * s));
      ctx.fillRect(x + w * 0.36 - lw / 2, y - h * 0.45, lw, Math.max(1, 3 * s));
    } else {
      ctx.globalAlpha = fog ? clamp(1 - (c.z - 8) / fogDist, 0.1, 1) : 1;
      drawCar(x, y, w, h, c.color, false);
      ctx.globalAlpha = 1;
    }
  }

  // Carro do jogador
  const px = W / 2 + player.x * HALF_W * 0.86;
  drawCar(px, ROAD_BOTTOM - 4, 58, 34, '#eeeeee', true);
  if (player.bumpCd > 0 && Math.floor(player.bumpCd * 20) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px - 32, ROAD_BOTTOM - 40, 64, 38);
  }
}

function hexToRgbStr(c) { return c; }

// Escurece/clareia uma cor 'rgb(r,g,b)' ou '#rrggbb'
function shade(col, d) {
  let r, g, b;
  if (col[0] === '#') [r, g, b] = hexToRgb(col);
  else [r, g, b] = col.match(/\d+/g).map(Number);
  return `rgb(${clamp(r + d, 0, 255)},${clamp(g + d, 0, 255)},${clamp(b + d, 0, 255)})`;
}

// Carro em visão traseira. (x, yBottom) é o centro da base.
function drawCar(x, yb, w, h, color, isPlayer) {
  const wheelW = w * 0.18, wheelH = h * 0.32;
  // Rodas
  ctx.fillStyle = '#111';
  ctx.fillRect(x - w / 2, yb - wheelH, wheelW, wheelH);
  ctx.fillRect(x + w / 2 - wheelW, yb - wheelH, wheelW, wheelH);
  // Faixa animada nas rodas do jogador
  if (isPlayer && player.speed > 2) {
    const ph = Math.floor(distance / 3) % 2 === 0;
    ctx.fillStyle = ph ? '#555' : '#222';
    ctx.fillRect(x - w / 2 + 1, yb - wheelH * 0.6, wheelW - 2, 2);
    ctx.fillRect(x + w / 2 - wheelW + 1, yb - wheelH * 0.6, wheelW - 2, 2);
  }
  // Corpo
  const bw = w * 0.78, bh = h * 0.55;
  ctx.fillStyle = color;
  ctx.fillRect(x - bw / 2, yb - bh - h * 0.08, bw, bh);
  // Cabine
  const cw = w * 0.5, ch = h * 0.42;
  ctx.fillStyle = shade(color, -40);
  ctx.fillRect(x - cw / 2, yb - h, cw, ch);
  // Vidro traseiro
  ctx.fillStyle = '#263238';
  ctx.fillRect(x - cw / 2 + cw * 0.12, yb - h + ch * 0.18, cw * 0.76, ch * 0.5);
  // Lanternas
  ctx.fillStyle = '#ff1744';
  const lw = Math.max(1, w * 0.12), lh = Math.max(1, h * 0.09);
  ctx.fillRect(x - bw / 2 + 1, yb - bh - h * 0.08 + bh * 0.3, lw, lh);
  ctx.fillRect(x + bw / 2 - lw - 1, yb - bh - h * 0.08 + bh * 0.3, lw, lh);
}

function drawHUD() {
  // Painel
  ctx.fillStyle = '#1b2a38';
  ctx.fillRect(0, HUD_Y, W, H - HUD_Y);
  ctx.fillStyle = '#90a4ae';
  ctx.fillRect(0, HUD_Y, W, 2);

  const remaining = Math.max(0, quota - passed);
  const quotaMet = passed >= quota;

  // Odômetro
  ctx.textAlign = 'left';
  ctx.fillStyle = '#90a4ae';
  ctx.font = '10px monospace';
  ctx.fillText('DISTÂNCIA', 16, HUD_Y + 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(String(Math.floor(distance / 10)).padStart(6, '0'), 16, HUD_Y + 38);

  // Velocidade
  ctx.fillStyle = '#90a4ae';
  ctx.font = '10px monospace';
  ctx.fillText('VELOCIDADE', 16, HUD_Y + 52);
  ctx.fillStyle = '#37474f';
  ctx.fillRect(90, HUD_Y + 45, 100, 8);
  ctx.fillStyle = player.speed > 85 ? '#ff7043' : '#4fc3f7';
  ctx.fillRect(90, HUD_Y + 45, player.speed, 8);

  // Dia
  ctx.textAlign = 'center';
  ctx.fillStyle = '#90a4ae';
  ctx.font = '10px monospace';
  ctx.fillText(phaseName(), W / 2, HUD_Y + 16);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('DIA ' + day, W / 2, HUD_Y + 40);
  // Barra de progresso do dia
  ctx.fillStyle = '#37474f';
  ctx.fillRect(W / 2 - 50, HUD_Y + 47, 100, 5);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(W / 2 - 50, HUD_Y + 47, 100 * dayT, 5);

  // Carros a ultrapassar
  ctx.textAlign = 'right';
  ctx.fillStyle = '#90a4ae';
  ctx.font = '10px monospace';
  ctx.fillText('CARROS A PASSAR', W - 16, HUD_Y + 16);
  if (quotaMet) {
    const on = Math.floor(flashTimer * 4) % 2 === 0;
    ctx.fillStyle = on ? '#69f0ae' : '#00c853';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('META OK!', W - 16, HUD_Y + 38);
    drawFlag(W - 100, HUD_Y + 24, '#69f0ae');
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(String(remaining).padStart(3, '0'), W - 16, HUD_Y + 38);
  }
  ctx.fillStyle = '#90a4ae';
  ctx.font = '10px monospace';
  ctx.fillText('META: ' + quota, W - 16, HUD_Y + 54);
  ctx.textAlign = 'left';
}

function drawFlag(x, y, color) {
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(x, y, 2, 16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + 14, y + 4);
  ctx.lineTo(x + 2, y + 8);
  ctx.closePath();
  ctx.fill();
}

function drawTitle() {
  // Cenário estático de entardecer
  const savedT = dayT, savedDay = day, savedCurve = curve;
  dayT = 0.33; day = 1; curve = 0.5;
  if (!cars) cars = [];
  if (distance === undefined) distance = 0;
  drawScene();
  dayT = savedT; day = savedDay; curve = savedCurve;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 54px monospace';
  ctx.fillText('ENDURO', W / 2, 110);

  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText('PRESSIONE ESPAÇO PARA JOGAR', W / 2, 160);

  ctx.fillStyle = '#90caf9';
  ctx.font = '11px monospace';
  ctx.fillText('← → ou A/D     Virar', W / 2, 195);
  ctx.fillText('↑ ou ESPAÇO    Acelerar', W / 2, 211);
  ctx.fillText('↓ ou S         Frear', W / 2, 227);

  ctx.fillStyle = '#eceff1';
  ctx.font = '11px monospace';
  ctx.fillText('Ultrapasse ' + QUOTA_DAY1 + ' carros no 1º dia e ' + QUOTA_NEXT + ' nos seguintes.', W / 2, 258);
  ctx.fillText('Cuidado com a noite, o nevoeiro e o gelo!', W / 2, 274);

  if (hiDay > 0) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = '11px monospace';
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
  ctx.fillText('ESPAÇO para jogar novamente', W / 2, H / 2 + 65);
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
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
