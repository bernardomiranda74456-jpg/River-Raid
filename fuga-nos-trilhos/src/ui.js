// Interface (DOM): carregamento, menu, HUD, pausa, fim de corrida, loja,
// missões e configurações. Mobile-first.
import { SKINS } from './skins.js';
import { formatNumber } from './utils.js';
import { PRESETS } from './config.js';

const $ = (id) => document.getElementById(id);
const PU_LABEL = { magnet: 'Ímã', jetpack: 'Jato', sneakers: 'Tênis de mola', multiplier: 'Multiplicador', hoverboard: 'Prancha' };
const PU_ICON = { magnet: '🧲', jetpack: '🚀', sneakers: '👟', multiplier: '✖️', hoverboard: '🛹' };

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = ['loading', 'menu', 'hud', 'pause', 'gameover', 'shop', 'missions', 'settings'];
    this.current = 'loading';
    this.bind();
  }
  bind() {
    const g = this.game;
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.preventDefault(); g.audio.play('click'); fn(e); }); };
    on('btn-play', () => g.startRun());
    on('btn-shop', () => this.showShop());
    on('btn-missions', () => this.showMissions());
    on('btn-settings', () => this.showSettings('menu'));
    on('btn-pause', () => g.pause());
    on('btn-resume', () => g.resume());
    on('btn-pause-settings', () => this.showSettings('pause'));
    on('btn-pause-menu', () => g.toMenu());
    on('btn-continue', () => g.continueRun());
    on('btn-retry', () => g.startRun());
    on('btn-go-menu', () => g.toMenu());
    on('btn-shop-back', () => this.show('menu'));
    on('btn-missions-back', () => this.show('menu'));
    on('btn-settings-back', () => { this.show(this.settingsReturn || 'menu'); });
    on('btn-apply-quality', () => { const q = $('sel-quality').value; g.save.data.settings.quality = q; g.save.write(); location.reload(); });
    for (const k of ['ao', 'bloom', 'motionBlur', 'chroma', 'flare', 'smaa', 'shadows', 'rain', 'sfx', 'music']) {
      const el = $('tg-' + k);
      if (el) el.addEventListener('change', () => { g.save.data.settings[k] = el.checked; g.save.write(); g.applySettings(); });
    }
  }
  show(id) {
    for (const s of this.screens) { const el = $(s); if (el) el.classList.toggle('hidden', s !== id); }
    this.current = id;
    if (id === 'menu') this.refreshMenu();
  }
  loading(p, label) {
    const bar = $('load-bar'); if (bar) bar.style.width = Math.round(p * 100) + '%';
    const l = $('load-label'); if (l) l.textContent = label;
  }
  refreshMenu() {
    const d = this.game.save.data;
    $('menu-best').textContent = formatNumber(d.best);
    $('menu-coins').textContent = formatNumber(d.coins);
    $('menu-keys').textContent = d.keys;
    $('menu-skin').textContent = SKINS[d.skin].name;
    $('menu-preset').textContent = 'Gráficos: ' + PRESETS[this.game.presetName].label + (this.game.gpuName ? ' · ' + this.game.gpuName : '');
  }
  hud(s) {
    $('hud-score').textContent = formatNumber(s.score);
    $('hud-coins').textContent = formatNumber(s.coins);
    $('hud-mult').textContent = 'x' + s.mult;
    $('hud-dist').textContent = formatNumber(s.distance) + ' m';
    $('hud-keys').textContent = s.keys;
    const pu = $('hud-power');
    if (s.power) {
      pu.classList.remove('hidden');
      $('hud-power-icon').textContent = PU_ICON[s.power.kind];
      $('hud-power-name').textContent = PU_LABEL[s.power.kind];
      $('hud-power-bar').style.width = Math.round(s.power.t * 100) + '%';
    } else pu.classList.add('hidden');
    const warn = $('hud-warn');
    warn.classList.toggle('hidden', !s.chased);
  }
  gameOver(stats, title, canContinue, cost) {
    $('go-title').textContent = title;
    $('go-score').textContent = formatNumber(stats.score);
    $('go-dist').textContent = formatNumber(stats.distance) + ' m';
    $('go-coins').textContent = formatNumber(stats.coins);
    $('go-best').textContent = stats.newBest ? 'NOVO RECORDE!' : 'Recorde: ' + formatNumber(stats.best);
    const btn = $('btn-continue');
    btn.classList.toggle('hidden', !canContinue);
    btn.textContent = `Continuar (${cost} 🔑)`;
    this.show('gameover');
  }
  toast(text, ms = 2600) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), ms - 400);
    setTimeout(() => el.remove(), ms);
  }
  showShop() {
    const g = this.game, d = g.save.data;
    const grid = $('shop-grid');
    grid.innerHTML = '';
    $('shop-coins').textContent = formatNumber(d.coins);
    for (const s of SKINS) {
      const owned = d.unlocked.includes(s.id), sel = d.skin === s.id;
      const card = document.createElement('div');
      card.className = 'card' + (sel ? ' selected' : '');
      const sw = `<div class="swatch"><span style="background:#${s.shirt.toString(16).padStart(6, '0')}"></span><span style="background:#${s.pants.toString(16).padStart(6, '0')}"></span><span style="background:#${s.accent.toString(16).padStart(6, '0')}"></span></div>`;
      card.innerHTML = `${sw}<h3>${s.name}</h3><p>${s.desc}</p><button class="btn small">${sel ? 'Selecionado' : owned ? 'Selecionar' : formatNumber(s.price) + ' 🪙'}</button>`;
      const b = card.querySelector('button');
      if (sel) b.disabled = true;
      b.addEventListener('click', () => {
        g.audio.play('click');
        if (owned) { d.skin = s.id; g.save.write(); g.player.setSkin(s.id); this.showShop(); return; }
        if (d.coins >= s.price) { d.coins -= s.price; d.unlocked.push(s.id); d.skin = s.id; g.save.write(); g.player.setSkin(s.id); g.audio.play('powerup'); this.showShop(); }
        else this.toast('Moedas insuficientes');
      });
      grid.appendChild(card);
    }
    this.show('shop');
  }
  showMissions() {
    const g = this.game;
    const list = $('missions-list');
    list.innerHTML = '';
    for (const m of g.missions.active) {
      if (!m) continue;
      const p = g.missions.progress(m, g.stats);
      const el = document.createElement('div');
      el.className = 'mission';
      el.innerHTML = `<div class="mt">${m.text}</div><div class="mbar"><div style="width:${Math.round(p / m.goal * 100)}%"></div></div><div class="mp">${formatNumber(p)} / ${formatNumber(m.goal)} · +${m.reward} 🪙</div>`;
      list.appendChild(el);
    }
    this.show('missions');
  }
  showSettings(ret) {
    const s = this.game.save.data.settings;
    this.settingsReturn = ret;
    $('sel-quality').value = s.quality;
    for (const k of ['ao', 'bloom', 'motionBlur', 'chroma', 'flare', 'smaa', 'shadows', 'rain', 'sfx', 'music']) { const el = $('tg-' + k); if (el) el.checked = !!s[k]; }
    $('settings-info').textContent = `Preset atual: ${PRESETS[this.game.presetName].label}` + (this.game.gpuName ? ` · GPU: ${this.game.gpuName}` : '');
    this.show('settings');
  }
}
