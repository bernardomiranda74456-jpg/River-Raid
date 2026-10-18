// Bootstrap do jogo: Pixi, loop fixo, estados (título, fase, resultados, pausa), troca HD/retrô.
import { Application, Container, Graphics } from 'pixi.js';
import { GameLoop } from './core/loop.js';
import { Input, setupTouch } from './core/input.js';
import { Save } from './core/save.js';
import { ArtBank } from './render/artbank.js';
import { Scene } from './render/scene.js';
import { Hud } from './render/hud.js';
import { Particles } from './render/particles.js';
import { RetroParallax } from './render/parallax.js';
import { RetroRenderer, RETRO_W, RETRO_H } from './render/retro/retro.js';
import { SpriteLimiter } from './render/retro/spritelimit.js';
import { Level } from './world/level.js';
import { loadLevel } from './world/tilemap.js';
import { BitmapLine } from './render/text.js';
import { LEVELS } from './levels.js';
import { Bot } from './core/bot.js';

export class Game {
  constructor() {
    this.input = new Input(); this.save = new Save(); this.bank = new ArtBank(); this.particles = new Particles(); this.fx = this.particles;
    this.mode = 'retro'; this.viewW = RETRO_W; this.viewH = RETRO_H; this.level = null; this.state = 'boot'; this.stateT = 0; this.audio = null; this.vehicles = null;
    this.input.loadBindings(this.save.settings.keys); this.levelIndex = 0; this.hooks = {}; this.debug = new URLSearchParams(location.search);
    this.spriteLimiter = new SpriteLimiter();
    this.bot = this.debug.get('bot') ? new Bot(this) : null; this.timeScale = +(this.debug.get('fast') || 1);
    if (this.bot) { this.save.progress.lives = 30; this.save.save = () => {}; } // modo de teste: não persiste
  }
  async init() {
    const app = new Application();
    await app.init({ resizeTo: window, preference: 'webgl', antialias: false, backgroundColor: 0x0a0a14, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, powerPreference: 'high-performance' });
    document.getElementById('game').appendChild(app.canvas); this.app = app;
    this.scene = new Scene(this.bank, this.particles); this.hud = new Hud(this.bank); this.scene.hud.addChild(this.hud.root);
    this.retro = new RetroRenderer(app); this.stage = new Container(); app.stage.addChild(this.stage);
    this.menuLayer = new Container(); this.scene.root.addChild(this.menuLayer);
    setupTouch(this.input);
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (a, dt) => this.render(a, dt) }); this.loop.timeScale = this.timeScale;
    document.getElementById('boot')?.classList.add('hidden');
    this.setState('title');
    this.loop.start();
    // modo inicial salvo
    const wantMode = this.debug.get('mode') || this.save.settings.mode; if (wantMode === 'hd') await this.loadHD(); if (wantMode === 'hd') this.setMode('hd', true);
    if (this.debug.get('crt')) { this.save.settings.crt = true; this.save.settings.crtHD = true; } await this.loadCrt();
    if (this.debug.get('level')) { await this.startLevel(+this.debug.get('level') - 1); } else if (this.debug.get('file')) { await this.startLevel(99); }
  }
  applyCrt() { const s = this.save.settings; this.retro.setCrt(s.crt ? (this.crtFilter || (this.crtFilter = new (this.crtClass)())) : null); if (this.hdRenderer) this.hdRenderer.updateFilters(); }
  onResize() {
    this.retro.resize(); if (this.hdRenderer) this.hdRenderer.resize();
    if (this.mode === 'retro') { this.viewW = RETRO_W; this.viewH = RETRO_H; }
    else { const w = this.app.renderer.width / this.app.renderer.resolution, h = this.app.renderer.height / this.app.renderer.resolution; this.hdScale = h / RETRO_H; this.viewW = w / this.hdScale; this.viewH = RETRO_H; }
    this.hud.layout(this.viewW, this.viewH);
    if (this.level) { this.level.camera.setView(this.viewW, this.viewH); this.parallax?.resize(this.viewW, this.viewH); }
    this.hooks.resize?.();
  }
  // ----- Modo gráfico ---------------------------------------------------------------------------
  setMode(mode, silent = false) {
    if (mode === 'hd' && !this.hdReady) { this.loadHD().then(() => this.setMode('hd', silent)); return; }
    this.mode = mode; this.bank.mode = mode; this.particles.setMode(mode); this.save.settings.mode = mode; this.save.save();
    if (mode === 'retro' && this.hdRenderer) this.hdRenderer.detach(this.scene);
    this.onResize(); this.scene.refreshMode(); this.hud.refreshMode(); this.applyCrt();
    if (!this.level && this.state === 'title') this.buildTitleParallax();
    this.hooks.modeChanged?.(mode); this.audio?.setMode(mode);
    if (this.level) this.buildParallax();
    if (!silent) this.audio?.sfx('menu');
  }
  async loadHD() { if (this.hdReady) return; const m = await import('./render/hd/hd.js'); this.hdRenderer = new m.HDRenderer(this); this.hdReady = true; }
  async loadCrt() { const m = await import('./render/hd/postfx.js'); this.crtClass = m.CrtFilter; this.applyCrt(); }
  buildParallax() {
    if (this.parallax) { this.parallax.root.destroy({ children: true }); this.parallax = null; }
    if (this.mode === 'hd' && this.hdRenderer) this.parallax = this.hdRenderer.makeParallax(this.level.theme, this.viewW, this.viewH, this.level.json.time);
    else this.parallax = new RetroParallax(this.level.theme, this.viewW, this.viewH);
    this.scene.bg.removeChildren(); this.scene.bg.addChild(this.parallax.root);
  }
  // ----- Estados --------------------------------------------------------------------------------
  setState(s) { this.state = s; this.stateT = 0; this.menuLayer.removeChildren(); if (s === 'title' && !this.level) this.buildTitleParallax(); this.hooks.stateChanged?.(s); }
  buildTitleParallax() {
    if (this.parallax) { this.parallax.root.destroy({ children: true }); this.parallax = null; }
    const theme = 'mountain', time = 'sunset';
    if (this.mode === 'hd' && this.hdRenderer) this.parallax = this.hdRenderer.makeParallax(theme, this.viewW, this.viewH, time); else this.parallax = new RetroParallax(theme, this.viewW, this.viewH);
    this.scene.bg.removeChildren(); this.scene.bg.addChild(this.parallax.root); this.titleT = 0;
  }
  async startLevel(index, opts = {}) {
    this.levelIndex = index; const def = LEVELS[index] || (this.debug.get('file') ? { file: this.debug.get('file') } : null); if (!def) { this.setState('title'); return; }
    const json = await loadLevel(this.debug.get('file') && index === 99 ? this.debug.get('file') : def.file); this.level = new Level(json, this, opts); this.level.camera.setView(this.viewW, this.viewH);
    this.scene.setLevel(this.level); this.buildParallax(); this.hud.showMessage('');
    this.setState('play'); this.audio?.music.play(json.music, { restart: true });
    this.hooks.levelStarted?.(this.level);
  }
  onLevelClear(level) { this.audio?.music.play('clear', { once: true, duck: true }); this.hooks.levelClear?.(level); }
  gameOver(level) { this.setState('gameover'); this.audio?.music.play('gameover', { once: true }); this.hooks.gameOver?.(); }
  openShop(level, door) { this.hooks.openShop?.(level, door); }
  startBossEncounter(level) { this.hooks.startBoss?.(level); }
  // ----- Passo fixo -----------------------------------------------------------------------------
  update(dt) {
    if (this.bot) this.bot.update(dt);
    this.input.poll(); this.stateT += dt;
    if (this.input.pressed.mode) this.setMode(this.mode === 'hd' ? 'retro' : 'hd');
    if (this.hooks.update?.(dt)) return; // menus/duelo/loja tratados pelos módulos de UI
    switch (this.state) {
      case 'play': {
        const lv = this.level;
        if (this.input.pressed.pause && lv.state === 'play') { this.setState('pause'); this.audio?.music.pause(); break; }
        lv.update(dt); this.particles.update(dt);
        if (lv.state === 'goal' && lv.stateT > 3.2) { this.finishLevel(); }
        break;
      }
      case 'pause': if (this.input.pressed.pause || this.input.pressed.confirm) { this.setState('play'); this.audio?.music.resume(); } break;
      case 'results': if (this.stateT > 1 && (this.input.pressed.confirm || this.input.pressed.jump)) { const next = this.levelIndex + 1; if (LEVELS[next]) this.startLevel(next); else this.setState('title'); } break;
      case 'gameover': if (this.stateT > 1 && (this.input.pressed.confirm || this.input.pressed.jump)) { this.save.progress.lives = 3; this.save.save(); this.startLevel(this.levelIndex); } break;
    }
  }
  finishLevel() {
    const lv = this.level; const p = this.save.progress; p.unlocked = Math.max(p.unlocked, this.levelIndex + 2); p.beaten[lv.id] = true;
    p.bestTimes[lv.id] = Math.min(p.bestTimes[lv.id] ?? 1e9, lv.time); p.bestScores[lv.id] = Math.max(p.bestScores[lv.id] ?? 0, lv.score); p.money = lv.money; this.save.save();
    this.setState('results'); this.hooks.showResults?.(lv);
  }
  // ----- Render ---------------------------------------------------------------------------------
  render(alpha, dt) {
    const retro = this.mode === 'retro';
    if (!this.level) { this.hud.root.visible = false; if (this.parallax && this.state === 'title') { this.titleT = (this.titleT || 0) + dt; this.parallax.update(this.titleT * 14, 0, this.titleT, retro); } }
    if (this.level) {
      this.scene.sync(this.level, alpha, retro, dt);
      this.parallax?.update(this.scene.camX, this.scene.camY, performance.now() / 1000, retro);
      this.hud.update(this.level, this.save); this.hud.root.visible = this.state !== 'title' && this.state !== 'story';
      const fl = this.scene.flashG; fl.clear(); if (this.level.flashA > 0) { fl.rect(0, 0, this.viewW, this.viewH).fill({ color: 0xffffff, alpha: this.level.flashA }); }
      this.hooks.render?.(alpha, dt);
    }
    if (retro) {
      if (this.level && this.save.settings.spriteLimit) this.spriteLimiter.apply(this.scene.views.values(), this.scene.camX, this.scene.camY);
      this.scene.root.scale.set(1); this.retro.render(this.scene.root); this.stage.removeChildren(); this.stage.addChild(this.retro.root);
      this.app.renderer.render({ container: this.stage });
    } else {
      this.hdRenderer.render(this.scene, alpha, dt);
    }
  }
}

const game = new Game(); window.__game = game;
// Inicializa áudio apenas após o primeiro gesto do usuário.
game.init().then(async () => {
  const [{ AudioEngine }, { installUI }] = await Promise.all([import('./audio/audio.js'), import('./ui/ui.js')]);
  game.audio = new AudioEngine(game); installUI(game);
  if (game.level && game.state === 'play') game.audio.music.play(game.level.json.music);
  else if (game.state === 'title') game.audio.music.play('title');
  const unlock = () => { game.audio.unlock(); };
  game.input.onAnyInput = unlock; window.addEventListener('pointerdown', unlock, { once: false });
}).catch((e) => { console.error(e); const b = document.getElementById('boot'); if (b) { b.classList.remove('hidden'); b.textContent = 'Erro ao iniciar: ' + e.message; } });
