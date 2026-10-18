/**
 * DOM UI: menus, settings, skin picker (with live 2D previews), HUD, touch controls.
 */
import { SKINS, HATS } from '../entities/Skins.js';
import { PRESETS } from '../core/Settings.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(settings) {
    this.settings = settings; this.game = null; this.current = null;
    this.hud = $('hud'); this.center = $('hud-center'); this._msgT = null; this._cdT = null;
    this.overlays = ['menu', 'skins', 'settings', 'controls', 'pause', 'results'];
    this._bind();
    this._buildSkins();
    this._syncSettings();
    this.touch = new TouchControls(this);
  }
  attach(game) { this.game = game; }

  show(name) {
    for (const o of this.overlays) $(o).classList.toggle('visible', o === name);
    this.current = name;
  }
  showHud(v) { this.hud.classList.toggle('visible', v); $('touch').classList.toggle('visible', v && this.touch.enabled); }
  setLoading(p, text) { $('loading-bar').style.width = `${Math.round(p * 100)}%`; if (text) $('loading-text').textContent = text; }
  hideLoading() { $('loading').classList.remove('visible'); }
  setGpuInfo(t) { $('gpu-info').textContent = t; }

  _bind() {
    $('btn-play').onclick = () => { this.game.audio.resume(); this.show(null); this.game.startMatch(); };
    $('btn-skins').onclick = () => this.show('skins');
    $('btn-settings').onclick = () => { this._from = 'menu'; this.show('settings'); };
    $('btn-controls').onclick = () => this.show('controls');
    $('btn-skins-back').onclick = () => this.show('menu');
    $('btn-settings-back').onclick = () => this.show(this._from === 'pause' ? 'pause' : 'menu');
    $('btn-controls-back').onclick = () => this.show('menu');
    $('btn-resume').onclick = () => this.game.pause(false);
    $('btn-pause-settings').onclick = () => { this._from = 'pause'; this.show('settings'); };
    $('btn-quit').onclick = () => this.game.quitToMenu();
    $('btn-again').onclick = () => { this.show(null); this.game.startMatch(); };
    $('btn-results-menu').onclick = () => this.game.quitToMenu();
    document.querySelectorAll('#preset-seg button').forEach((b) => b.onclick = () => { this.settings.applyPreset(b.dataset.v); this._syncSettings(); });
    document.querySelectorAll('#shadow-seg button').forEach((b) => b.onclick = () => { this.settings.set('shadow', b.dataset.v === 'off' ? 'off' : Number(b.dataset.v)); this._syncSettings(); });
    for (const k of ['ao', 'bloom', 'smaa', 'grade', 'dof', 'mblur']) $('opt-' + k).onchange = (e) => { this.settings.set(k, e.target.checked); this._syncSettings(); };
    $('opt-scale').onchange = (e) => { this.settings.set('scale', Number(e.target.value)); };
    $('opt-sens').oninput = (e) => { this.settings.sensitivity = Number(e.target.value); this.settings.save(); this.settings.emit(); };
    $('opt-volume').oninput = (e) => { this.settings.volume = Number(e.target.value); this.settings.save(); this.settings.emit(); };
    $('opt-fps').onchange = (e) => { this.settings.showFps = e.target.checked; this.settings.save(); this.settings.emit(); };
    document.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { if (this.game) this.game.audio.click(); }));
  }
  _syncSettings() {
    const s = this.settings; const v = s.values;
    document.querySelectorAll('#preset-seg button').forEach((b) => b.classList.toggle('active', b.dataset.v === s.preset));
    document.querySelectorAll('#shadow-seg button').forEach((b) => b.classList.toggle('active', String(v.shadow) === b.dataset.v));
    for (const k of ['ao', 'bloom', 'smaa', 'grade', 'dof', 'mblur']) $('opt-' + k).checked = !!v[k];
    $('opt-scale').value = v.scale; $('opt-sens').value = s.sensitivity; $('opt-volume').value = s.volume; $('opt-fps').checked = s.showFps;
  }

  _buildSkins() {
    const grid = $('skin-grid'); grid.innerHTML = '';
    SKINS.forEach((sk, i) => {
      const card = document.createElement('div'); card.className = 'skin-card' + (i === this.settings.skin ? ' selected' : '');
      const c = document.createElement('canvas'); c.width = c.height = 160; drawSkinPreview(c, sk); card.appendChild(c);
      const n = document.createElement('div'); n.className = 'name'; n.textContent = sk.name; card.appendChild(n);
      card.onclick = () => { this.settings.skin = i; this.settings.save(); if (this.game) this.game.setMenuSkin(i); grid.querySelectorAll('.skin-card').forEach((x) => x.classList.remove('selected')); card.classList.add('selected'); };
      grid.appendChild(card);
    });
  }

  // ---------- HUD ----------
  setRound(n, name, target, total) { $('hud-round').textContent = `RODADA ${n} · ${name.toUpperCase()}`; this._target = target; this._total = total; this.setQualified(0, target); }
  setQualified(q, target) { $('hud-qualified').textContent = target == null ? 'ÚLTIMO EM PÉ' : `CLASSIFICADOS ${q} / ${target}`; }
  setTimer(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); $('hud-timer').textContent = `${m}:${s.toString().padStart(2, '0')}`; }
  setPosition(rank, alive) { $('hud-position').textContent = rank != null ? `#${rank}` : `${alive} VIVOS`; }
  setLavaVisible(v) { $('hud-lava').classList.toggle('visible', v); }
  setLava(frac, you) { const el = $('hud-lava'); el.querySelector('.lava-fill').style.height = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`; el.querySelector('.lava-you').style.bottom = `${Math.round(Math.max(0, Math.min(1, you)) * 100)}%`; }
  message(text, kind = '', dur = 2) {
    const el = this.center; el.textContent = text; el.className = 'show ' + kind; clearTimeout(this._msgT); this._msgT = setTimeout(() => el.classList.remove('show'), dur * 1000);
  }
  countdown(text) { const el = $('hud-countdown'); el.textContent = text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  setFps(fps, calls) { $('hud-fps').textContent = `${fps.toFixed(0)} fps · ${calls} draws`; }
  setHint(v) { if (this._hint !== v) { this._hint = v; $('hud-hint').style.display = v ? '' : 'none'; } }
  setFpsVisible(v) { $('hud-fps').classList.toggle('visible', v); }

  showResults({ won, roundReached, podium, playerRank, eliminatedRound }) {
    $('results-title').textContent = won ? '🏆 VOCÊ VENCEU!' : (eliminatedRound ? `Eliminado na rodada ${eliminatedRound}` : 'Fim de jogo');
    const pod = $('podium'); pod.innerHTML = '';
    const order = [1, 0, 2];
    for (const idx of order) {
      const p = podium[idx]; if (!p) continue;
      const step = document.createElement('div'); step.className = `step p${idx + 1}`;
      const c = document.createElement('canvas'); c.width = c.height = 120; drawSkinPreview(c, p.skin, true); step.appendChild(c);
      const pl = document.createElement('div'); pl.className = 'place'; pl.textContent = `${idx + 1}º`; step.appendChild(pl);
      const who = document.createElement('div'); who.className = 'who'; who.textContent = p.name; step.appendChild(who);
      pod.appendChild(step);
    }
    $('results-text').textContent = won ? 'Último em pé entre 32 bonecos. Lenda.' : (eliminatedRound ? `Você chegou até a rodada ${eliminatedRound} de 3.` : '');
    this.show('results');
  }
}

/** Draws a chibi 2D preview of a skin on a canvas (menu + podium). */
export function drawSkinPreview(canvas, sk, transparent = false) {
  const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h);
  if (!transparent) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2238'); g.addColorStop(1, '#0d1120'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  const cx = w / 2, bodyY = h * 0.62, bodyR = w * 0.22, headY = h * 0.34, headR = w * 0.17;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, h * 0.88, bodyR * 1.1, bodyR * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.fillStyle = sk.colA; for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(cx + s * bodyR * 0.45 - w * 0.05, bodyY + bodyR * 0.6, w * 0.1, h * 0.14, 8); ctx.fill(); }
  ctx.fillStyle = sk.accent; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * bodyR * 0.45, h * 0.86, w * 0.08, w * 0.045, 0, 0, Math.PI * 2); ctx.fill(); }
  // body with pattern
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, bodyY, bodyR, bodyR * 1.15, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = sk.colA; ctx.fillRect(0, 0, w, h); ctx.fillStyle = sk.colB;
  const p = sk.pattern;
  if (p === 1) for (let i = 0; i < 6; i++) ctx.fillRect(0, bodyY - bodyR * 1.2 + i * bodyR * 0.45, w, bodyR * 0.22);
  else if (p === 2) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { ctx.beginPath(); ctx.arc(cx - bodyR + x * bodyR * 0.5 + (y % 2) * bodyR * 0.25, bodyY - bodyR + y * bodyR * 0.5, bodyR * 0.09, 0, Math.PI * 2); ctx.fill(); }
  else if (p === 3) for (let i = -1; i < 5; i++) { ctx.beginPath(); const y0 = bodyY - bodyR * 1.3 + i * bodyR * 0.5; ctx.moveTo(cx - bodyR, y0); ctx.lineTo(cx, y0 + bodyR * 0.3); ctx.lineTo(cx + bodyR, y0); ctx.lineTo(cx + bodyR, y0 + bodyR * 0.18); ctx.lineTo(cx, y0 + bodyR * 0.48); ctx.lineTo(cx - bodyR, y0 + bodyR * 0.18); ctx.fill(); }
  else if (p === 4) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0) ctx.fillRect(cx - bodyR + x * bodyR / 3, bodyY - bodyR * 1.3 + y * bodyR / 3 * 1.3, bodyR / 3, bodyR / 3 * 1.3);
  else if (p === 5) ctx.fillRect(0, bodyY, w, h);
  else if (p === 6) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? bodyR * 0.25 : bodyR * 0.6; const a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(cx + Math.cos(a) * r, bodyY + Math.sin(a) * r); } ctx.fill(); }
  else if (p === 7) { for (let i = 0; i < 3; i++) ctx.fillRect(0, bodyY - bodyR + i * bodyR * 0.7, w, bodyR * 0.3); ctx.globalAlpha = 0.6; ctx.fillRect(cx - bodyR * 0.2, 0, bodyR * 0.4, h); ctx.globalAlpha = 1; }
  // body shading
  const sh = ctx.createRadialGradient(cx - bodyR * 0.4, bodyY - bodyR * 0.5, bodyR * 0.1, cx, bodyY, bodyR * 1.4); sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // arms
  ctx.fillStyle = sk.colA; for (const s of [-1, 1]) { ctx.save(); ctx.translate(cx + s * bodyR * 0.95, bodyY - bodyR * 0.2); ctx.rotate(s * 0.5); ctx.beginPath(); ctx.roundRect(-w * 0.045, 0, w * 0.09, h * 0.16, 10); ctx.fill(); ctx.restore(); }
  // head
  const hg = ctx.createRadialGradient(cx - headR * 0.4, headY - headR * 0.4, headR * 0.1, cx, headY, headR * 1.3); hg.addColorStop(0, lighten(sk.colA, 0.35)); hg.addColorStop(0.6, sk.colA); hg.addColorStop(1, darken(sk.colA, 0.35));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill();
  // eyes
  for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + s * headR * 0.38, headY + headR * 0.05, headR * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = sk.eye; ctx.beginPath(); ctx.arc(cx + s * headR * 0.38 + headR * 0.05, headY + headR * 0.08, headR * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx + s * headR * 0.38 + headR * 0.07, headY + headR * 0.1, headR * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + s * headR * 0.38 - headR * 0.02, headY + headR * 0.0, headR * 0.05, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#2a1016'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, headY + headR * 0.35, headR * 0.25, 0.2, Math.PI - 0.2); ctx.stroke();
  // hat
  ctx.fillStyle = sk.accent;
  switch (sk.hat) {
    case 'cap': ctx.beginPath(); ctx.arc(cx, headY - headR * 0.1, headR * 1.05, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - headR * 0.2, headY - headR * 0.25, headR * 1.5, headR * 0.18); break;
    case 'crown': ctx.beginPath(); ctx.moveTo(cx - headR * 0.8, headY - headR * 0.7); for (let i = 0; i < 5; i++) { ctx.lineTo(cx - headR * 0.8 + i * headR * 0.4, headY - headR * 1.4); ctx.lineTo(cx - headR * 0.6 + i * headR * 0.4, headY - headR * 0.9); } ctx.lineTo(cx + headR * 0.8, headY - headR * 0.7); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); break;
    case 'antenna': ctx.fillRect(cx - 2, headY - headR * 1.7, 4, headR * 0.8); ctx.beginPath(); ctx.arc(cx, headY - headR * 1.75, headR * 0.2, 0, Math.PI * 2); ctx.fill(); break;
    case 'horns': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * headR * 0.5, headY - headR * 0.75); ctx.lineTo(cx + s * headR * 0.9, headY - headR * 1.5); ctx.lineTo(cx + s * headR * 0.85, headY - headR * 0.6); ctx.fill(); } break;
    case 'propeller': ctx.fillRect(cx - 2, headY - headR * 1.35, 4, headR * 0.4); ctx.fillRect(cx - headR * 0.8, headY - headR * 1.42, headR * 1.6, 5); break;
    case 'tophat': ctx.fillRect(cx - headR * 1.1, headY - headR * 0.85, headR * 2.2, 6); ctx.fillRect(cx - headR * 0.7, headY - headR * 1.8, headR * 1.4, headR); break;
    case 'headband': ctx.fillRect(cx - headR * 0.95, headY - headR * 0.55, headR * 1.9, 8); break;
    default: break;
  }
}
function lighten(hex, k) { const c = parse(hex); return `rgb(${c.map((v) => Math.round(v + (255 - v) * k)).join(',')})`; }
function darken(hex, k) { const c = parse(hex); return `rgb(${c.map((v) => Math.round(v * (1 - k))).join(',')})`; }
function parse(hex) {
  if (hex.startsWith('hsl')) { const [h, s, l] = hex.match(/[\d.]+/g).map(Number); return hslToRgb(h / 360, s / 100, l / 100); }
  const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hslToRgb(h, s, l) { const f = (n) => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; }

/** Virtual joystick + buttons for touch devices. */
class TouchControls {
  constructor(ui) {
    this.ui = ui; this.enabled = ('ontouchstart' in window) && navigator.maxTouchPoints > 0;
    if (!this.enabled) return;
    const joy = $('joystick'), knob = $('joystick-knob'); let id = null; const R = 50;
    const center = () => { const r = joy.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const input = () => ui.game && ui.game.input;
    joy.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; id = t.identifier; move(t); }, { passive: false });
    const move = (t) => { const c = center(); let dx = t.clientX - c.x, dy = t.clientY - c.y; const l = Math.hypot(dx, dy); if (l > R) { dx = dx / l * R; dy = dy / l * R; } knob.style.transform = `translate(${dx}px, ${dy}px)`; const i = input(); if (i) { i.touch.active = true; i.touch.x = dx / R; i.touch.y = -dy / R; } };
    joy.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) move(t); }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; knob.style.transform = ''; const i = input(); if (i) { i.touch.x = 0; i.touch.y = 0; } } };
    joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
    const btn = (el, key) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); const i = input(); if (i) { i.touch.active = true; i.touch[key] = true; if (key === 'jump') i.jumpPressed = true; else i.divePressed = true; } }, { passive: false });
      const up = (e) => { e.preventDefault(); const i = input(); if (i) i.touch[key] = false; }; el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
    };
    btn($('touch-jump'), 'jump'); btn($('touch-dive'), 'dive');
    $('touch-pause').addEventListener('touchstart', (e) => { e.preventDefault(); if (ui.game) ui.game.pause(true); }, { passive: false });
  }
}
