// Bootstrap e loop principal: fixed timestep (60 Hz) com interpolação,
// máquina de estados, pontuação, power-ups, perseguição, clima, rebase do
// mundo, qualidade dinâmica e API de depuração para screenshots.
import * as THREE from 'three';
import { PRESETS, detectPreset, FIXED_DT, SPEED_START, SPEED_MAX, SPEED_ACCEL, WORLD_REBASE, POWERUP_TIME, STUMBLE_WINDOW, JET_HEIGHT, LANE_W, CHUNK_LEN } from './config.js';
import { clamp, lerp, damp, smoothstep, urlParams, isMobile, RNG } from './utils.js';
import { buildMaterials, globalUniforms } from './materials.js';
import { Environment } from './environment.js';
import { ObstaclePools, OB } from './obstacles.js';
import { Coins, Powerups, PU } from './collectibles.js';
import { Track } from './track.js';
import { Player, PS } from './player.js';
import { Chaser } from './chaser.js';
import { Effects } from './particles.js';
import { PostFX } from './postfx.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Save } from './save.js';
import { Missions } from './missions.js';
import { Autopilot } from './autopilot.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _sunScreen = new THREE.Vector2(0.5, 0.5);
const _rayDir = new THREE.Vector3();

class Game {
  constructor() {
    this.params = urlParams();
    this.save = new Save();
    const s = this.save.data.settings;
    this.presetName = s.quality !== 'auto' && PRESETS[s.quality] ? s.quality : detectPreset();
    if (this.params.quality && PRESETS[this.params.quality]) this.presetName = this.params.quality;
    this.preset = PRESETS[this.presetName];
    this.gpuName = '';
    this.state = 'boot';
    this.time = 0;
    this.acc = 0;
    this.timeScale = 1;
    this.speed = SPEED_START;
    this.stats = this.newStats();
    this.flash = 0;
    this.hudTimer = 0;
    this.fpsSamples = 0; this.fpsAcc = 0; this.qualityChecked = false;
    this.mobile = isMobile();
    this.audio = new AudioEngine(s);
    this.ui = new UI(this);
    this.seed = this.params.seed ? parseInt(this.params.seed, 10) : (Date.now() % 100000);
  }

  newStats() {
    return { score: 0, distance: 0, coins: 0, jumps: 0, rolls: 0, barriers: 0, trainTops: 0, powerups: 0, jets: 0, magnetCoins: 0, cleanDistance: 0, cleanAcc: 0, nightDistance: 0, rainDistance: 0, stumbles: 0 };
  }

  async init() {
    const canvas = document.getElementById('c');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer = renderer;
    try { const dbg = renderer.getContext().getExtension('WEBGL_debug_renderer_info'); if (dbg) this.gpuName = renderer.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL).replace(/ANGLE \(|\)|Direct3D11 vs_5_0 ps_5_0|,? ?D3D11/g, '').slice(0, 48); } catch (e) { /* noop */ }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = this.save.data.settings.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap; // r186: PCF por hardware com disco de Vogel; suavidade via shadow.radius
    this.scene = new THREE.Scene();
    this.ui.loading(0, 'Gerando texturas…');
    this.M = await buildMaterials(this.preset, (p, label) => this.ui.loading(p * 0.7, label));
    this.ui.loading(0.72, 'Construindo o mundo…');
    await new Promise((r) => setTimeout(r, 0));
    this.env = new Environment(renderer, this.scene, this.preset, this.M);
    this.obPools = new ObstaclePools(this.scene, this.M);
    this.obPools.warm();
    this.coins = new Coins(this.scene, this.M, 1500);
    this.powerups = new Powerups(this.scene, this.M);
    this.ui.loading(0.8, 'Trilhos, estações e túneis…');
    await new Promise((r) => setTimeout(r, 0));
    this.track = new Track(this.scene, this.M, this.preset, this.env, this.obPools, this.coins, this.powerups, this.seed);
    this.player = new Player(this.scene, this.M, this.save.data.skin);
    this.chaser = new Chaser(this.scene, this.M, this.env);
    this.effects = new Effects(this.scene, this.M, this.preset);
    this.camera = new FollowCamera(window.innerWidth / window.innerHeight);
    this.postfx = new PostFX(renderer, this.scene, this.camera.cam, this.preset, this.save.data.settings);
    this.autopilot = new Autopilot(this.track, this.player);
    this.missions = new Missions(this.save);
    this.input = new Input(document.getElementById('touch'), {
      left: () => this.onAction('left'), right: () => this.onAction('right'), jump: () => this.onAction('jump'), roll: () => this.onAction('roll'),
      board: () => this.onAction('board'), pause: () => this.togglePause(), confirm: () => this.onConfirm(),
    });
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'running') this.pause(); });
    const startAudio = () => { this.audio.start(); this.audio.applyVolumes(); };
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    this.ui.loading(0.95, 'Compilando shaders…');
    await new Promise((r) => setTimeout(r, 0));
    // URL params (depuração / screenshots)
    if (this.params.tod) this.env.setTime(parseFloat(this.params.tod), true);
    if (this.params.rain) this.rainForce = parseFloat(this.params.rain);
    this.env.todSpeed = this.params.todspeed ? parseFloat(this.params.todspeed) : 24 / 380;
    this.weather = { rain: 0, timer: 30, target: 0 };
    // pré-compila todos os shaders (objetos em pool ficam visíveis só durante o compile)
    const hidden = [];
    this.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    this.renderer.compile(this.scene, this.camera.cam);
    for (const o of hidden) o.visible = false;
    this.env.updateEnv();
    this.ui.loading(1, 'Pronto');
    this.toMenu();
    if (this.params.auto === '1') { this.startRun(); this.autoMode = true; }
    this.last = performance.now();
    this.manual = this.params.manual === '1';
    if (!this.manual) requestAnimationFrame((t) => { this.last = t; this.frame(t); });
    window.__game = this;
    window.__gameReady = true;
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.setAspect(w / h);
    this.postfx.setSize(w, h);
  }

  applySettings() {
    const s = this.save.data.settings;
    this.renderer.shadowMap.enabled = s.shadows;
    this.scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
    this.postfx.applySettings();
    this.audio.applyVolumes();
  }

  /* ------------------------------------------------------- estados */
  toMenu() {
    this.state = 'menu';
    this.autoMode = false;
    this.resetWorld();
    this.speed = 14;
    this.input.enabled = false;
    this.audio.setMusic(false);
    this.ui.show('menu');
  }
  resetWorld() {
    this.track.reset();
    this.player.reset();
    this.chaser.reset();
    this.effects.clear();
    this.stats = this.newStats();
    this.continues = 0;
    this.chaseActive = false;
    this.timeScale = 1;
    this.deadTimer = 0;
    this.camera.pos.set(0, 3.4, -6.5); this.camera.look.set(0, 1.2, 10);
    this.boards = this.save.data.boards === undefined ? 2 : this.save.data.boards;
    this.track.jetActive = false;
  }
  startRun() {
    this.resetWorld();
    this.state = 'running';
    this.speed = SPEED_START;
    this.input.enabled = true;
    this.ui.show('hud');
    this.audio.start();
    this.audio.setMusic(true, this.seed + this.save.data.runs);
    this.save.data.runs++;
    this.save.write();
    this.runSeed = new RNG(this.seed + this.save.data.runs);
    if (this.params.speed) this.speed = parseFloat(this.params.speed);
  }
  pause() { if (this.state !== 'running') return; this.state = 'paused'; this.ui.show('pause'); this.input.enabled = false; }
  resume() { if (this.state !== 'paused') return; this.state = 'running'; this.ui.show('hud'); this.input.enabled = true; this.last = performance.now(); }
  togglePause() { if (this.state === 'running') this.pause(); else if (this.state === 'paused') this.resume(); }
  onConfirm() { if (this.state === 'menu' && this.ui.current === 'menu') this.startRun(); }

  onAction(a) {
    if (this.state !== 'running' || this.autoMode) return;
    const p = this.player;
    switch (a) {
      case 'left': p.moveLane(-1, this); break;
      case 'right': p.moveLane(1, this); break;
      case 'jump': p.jump(this); break;
      case 'roll': p.roll(this); break;
      case 'board': this.useBoard(); break;
      default: break;
    }
  }
  useBoard() {
    const p = this.player;
    if (!p.alive || p.hoverboard > 0 || p.jetpack > 0) return;
    if (this.boards <= 0) { this.ui.toast('Sem pranchas: pegue 🛹 na pista'); return; }
    this.boards--; this.save.data.boards = this.boards; this.save.write();
    p.hoverboard = POWERUP_TIME.hoverboard;
    this.audio.play('board');
    this.effects.powerBurst(p.x, p.y + 0.5, p.z, 0.3, 0.9, 1);
    this.stats.powerups++;
  }

  /* --------------------------------------------------- callbacks jogo */
  onStumble(kind) {
    const p = this.player;
    this.stats.stumbles++;
    this.stats.cleanAcc = 0;
    this.camera.addShake(0.5);
    this.audio.play('stumble');
    this.effects.barrierHit(p.x, p.y, p.z);
    if (this.chaseActive && this.chaser.timer > 0) { this.caught(); return; }
    this.chaseActive = true;
    this.chaser.alert(STUMBLE_WINDOW);
    const _ = kind;
  }
  onBarrierHit(r) {
    // animação simples: a barreira tomba
    if (r.mesh) { r.mesh.rotation.x = -0.9; r.mesh.position.y = -0.1; }
  }
  onBoardBreak() {
    const p = this.player;
    p.hoverboard = 0; p.invuln = 1.6;
    this.audio.play('boardBreak');
    this.camera.addShake(0.6);
    this.effects.powerBurst(p.x, p.y + 0.3, p.z, 0.3, 0.9, 1);
    this.ui.toast('Prancha quebrou!');
  }
  onCrash(r) {
    const p = this.player;
    if (!p.alive) return;
    p.die('crash');
    this.state = 'dead'; this.deadTimer = 0; this.timeScale = 0.28;
    this.camera.startDeath(); this.camera.addShake(1.3);
    this.flash = 0.6;
    this.audio.play('crash');
    this.effects.crashDust(p.x, p.y, p.z);
    this.audio.setMusic(false);
    this.input.enabled = false;
    this.deathTitle = r.type === OB.TRAIN_MOVING ? 'Atropelado!' : 'Batida!';
  }
  caught() {
    const p = this.player;
    if (!p.alive) return;
    p.die('caught');
    this.chaser.startCatch();
    this.state = 'dead'; this.deadTimer = 0; this.timeScale = 0.4;
    this.camera.startDeath(); this.camera.addShake(0.6);
    this.audio.play('caught');
    this.audio.setMusic(false);
    this.input.enabled = false;
    this.deathTitle = 'Capturado!';
  }
  onLand(vy) { this.audio.play('land'); this.camera.addShake(Math.min(0.3, -vy * 0.015)); }
  onTrainHorn(r) { this.audio.play('horn'); const _ = r; }

  finishRun() {
    const d = this.save.data;
    const st = this.stats;
    d.coins += st.coins;
    const newBest = st.score > d.best;
    if (newBest) d.best = Math.floor(st.score);
    const completed = this.missions.update(st, true);
    this.save.write();
    const cost = Math.pow(2, this.continues);
    const canContinue = d.keys >= cost && this.continues < 3;
    this.ui.gameOver({ score: st.score, distance: st.distance, coins: st.coins, best: d.best, newBest }, this.deathTitle, canContinue, cost);
    for (const m of completed) this.ui.toast(`Missão concluída: ${m.text} (+${m.reward} 🪙)`, 4000);
    this.state = 'gameover';
    // reinicia stats de moedas da corrida para não contabilizar duas vezes ao continuar
    this.stats.coins = 0; this.stats.score = 0; this.stats.distance = 0;
  }
  continueRun() {
    const d = this.save.data;
    const cost = Math.pow(2, this.continues);
    if (d.keys < cost) return;
    d.keys -= cost; this.continues++;
    this.save.write();
    const p = this.player;
    this.clearAhead(70);
    p.state = PS.RUN; p.ragdoll = null; p.y = Math.max(0, p.groundY); p.vy = 0; p.grounded = true; p.invuln = 3; p.speedScale = 1; p.lane = p.targetLane; p.x = (p.lane - 1) * LANE_W; p.laneT = 1;
    p.resetPose(); p.model.rotation.set(0, 0, 0);
    this.chaser.reset(); this.chaser.visible = false; this.chaser.timer = 0; this.chaseActive = false;
    this.speed = Math.max(SPEED_START, this.speed * 0.8);
    this.timeScale = 1; this.state = 'running'; this.input.enabled = true;
    this.ui.show('hud');
    this.audio.play('continue');
    this.audio.setMusic(true, this.seed + this.continues * 7);
    this.last = performance.now();
  }

  /** Remove obstáculos entre 6 m atrás e `ahead` m à frente do jogador (continuar / depuração). */
  clearAhead(ahead) {
    const p = this.player;
    const clearNear = (c) => { for (let i = c.obstacles.length - 1; i >= 0; i--) { const r = c.obstacles[i]; if (r.z1 > p.z - 6 && r.z0 < p.z + ahead) { this.track.releaseObstacle(r); c.obstacles.splice(i, 1); } } };
    const c = this.track.chunkAt(p.z); if (c) { clearNear(c); const n = this.track.chunkAfter(c); if (n) clearNear(n); }
    for (let i = this.track.moving.length - 1; i >= 0; i--) this.track.releaseMoving(this.track.moving[i]);
  }

  /* ---------------------------------------------------- power-ups */
  activatePowerup(kind, x, y, z) {
    const p = this.player;
    this.audio.play('powerup');
    this.stats.powerups++;
    switch (kind) {
      case PU.MAGNET: p.magnet = POWERUP_TIME.magnet; this.effects.powerBurst(x, y, z, 1, 0.3, 0.3); break;
      case PU.JETPACK: p.jetpack = POWERUP_TIME.jetpack; this.stats.jets++; this.track.jetActive = true; this.track.onJetpack(p.z); this.audio.play('jetStart'); this.effects.powerBurst(x, y, z, 0.3, 0.6, 1); break;
      case PU.SNEAKERS: p.sneakers = POWERUP_TIME.sneakers; this.effects.powerBurst(x, y, z, 0.3, 1, 0.5); break;
      case PU.MULTIPLIER: p.multiplier = POWERUP_TIME.multiplier; this.effects.powerBurst(x, y, z, 1, 0.3, 0.9); break;
      case PU.HOVERBOARD: this.boards++; this.save.data.boards = this.boards; this.save.write(); this.ui.toast('🛹 Prancha +1 (toque duplo / Espaço)'); this.effects.powerBurst(x, y, z, 0.2, 0.9, 1); break;
      case PU.KEY: this.save.data.keys++; this.save.write(); this.audio.play('key'); this.ui.toast('🔑 Chave +1'); this.effects.powerBurst(x, y, z, 1, 0.9, 0.3); break;
      default: break;
    }
  }

  /* ------------------------------------------------------------ loop */
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    this.frameCount = (this.frameCount || 0) + 1;
    let dtReal = clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    try { this.tick(dtReal); } catch (e) { if (!this.errorLogged) { this.errorLogged = true; console.error('Erro no loop:', e); } }
  }

  tick(dtReal) {
    if (this.state === 'paused' || this.state === 'gameover' && false) dtReal = 0;
    const dt = dtReal * this.timeScale;
    this.time += dt;
    // física em passo fixo
    if (this.state === 'running' || this.state === 'menu' || this.state === 'dead') {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 5) { this.step(FIXED_DT); this.acc -= FIXED_DT; steps++; }
      if (steps === 5) this.acc = 0;
    }
    const alpha = clamp(this.acc / FIXED_DT, 0, 1);
    this.render(dt, dtReal, alpha);
    // qualidade dinâmica (primeiros segundos de corrida)
    if (this.state === 'running' && !this.qualityChecked && !this.params.quality) {
      this.fpsAcc += dtReal; this.fpsSamples++;
      if (this.fpsAcc > 6) {
        const fps = this.fpsSamples / this.fpsAcc;
        this.qualityChecked = true;
        if (fps < 42 && this.presetName !== 'low') {
          const order = ['low', 'medium', 'high', 'ultra'];
          const lower = order[Math.max(0, order.indexOf(this.presetName) - 1)];
          this.save.data.settings.quality = lower; this.save.write();
          this.renderer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), 1));
          if (this.postfx.gtao) this.postfx.gtao.enabled = false;
          this.onResize();
          this.ui.toast(`Desempenho baixo (${Math.round(fps)} fps): qualidade reduzida para ${PRESETS[lower].label}`);
        }
      }
    }
  }

  step(dt) {
    const p = this.player, st = this.stats;
    const running = this.state === 'running';
    if (running) {
      if (!this.params.speed || st.distance > 0) this.speed = Math.min(SPEED_MAX, this.speed + SPEED_ACCEL * dt);
    } else if (this.state === 'menu') { this.speed = 14; } else if (this.state === 'dead') { this.speed = damp(this.speed, 0, 3, dt); }
    const sp = this.speed;
    if (running || this.state === 'menu') {
      if (this.autoMode || this.state === 'menu') this.autopilot.update(dt, sp, this);
      const wasOnTrain = p.onTrain;
      p.step(dt, sp, this.track, this);
      if (p.onTrain && !wasOnTrain) st.trainTops++;
      // pontuação
      const mult = this.multiplier;
      const dz = p.z - p.prevZ;
      if (running) {
        st.distance += dz; st.score += dz * 2 * mult;
        st.cleanAcc += dz; st.cleanDistance = Math.max(st.cleanDistance, st.cleanAcc);
        if (this.env.night > 0.5) st.nightDistance += dz;
        if (this.env.rain > 0.5) st.rainDistance += dz;
        if (p.jetpack <= 0) this.track.jetActive = false;
      }
      this.collect();
      // passos
      if (p.grounded && p.state === PS.RUN && p.hoverboard <= 0) {
        const f = Math.sin(p.runPhase);
        if ((f > 0) !== (this.lastFoot > 0)) { this.audio.play('step', clamp((sp - 10) / 20, 0, 1)); }
        this.lastFoot = f;
      }
    } else if (this.state === 'dead') {
      p.step(dt, 0, this.track, this);
    }
    this.track.update(dt, p.z, p.x, this);
    // trens em movimento: whoosh/faíscas ao passar
    for (const r of this.track.moving) {
      if (!r.active) continue;
      if (!r.passed && r.z0 < p.z + 1) { r.passed = true; if (Math.abs(r.x - p.x) < LANE_W * 1.6) { this.audio.play('whoosh'); this.camera.addShake(0.35); } }
      if (r.z0 > p.z - 30 && r.z0 < p.z + 80) {
        r.sparkT += dt;
        if (r.sparkT > 0.06) { r.sparkT = 0; const b = r.mesh.userData.bogies; for (let i = 0; i < Math.min(2, b.length); i++) { r.mesh.localToWorld(_v.copy(b[i])); this.effects.trainSparks(_v.x, 0.1, _v.z, -1, 2); } }
      }
    }
    // perseguição: captura quando o fiscal alcança
    if (this.chaser.catching && this.chaser.catchT > 0.6 && this.state === 'dead') { /* animação de captura segue */ }
    // morte → fim
    if (this.state === 'dead') {
      this.deadTimer += dt / Math.max(this.timeScale, 0.01);
      this.timeScale = this.deadTimer < 1.3 ? lerp(this.timeScale, 0.25, 0.1) : damp(this.timeScale, 1, 3, dt);
      if (this.deadTimer > 2.4) this.finishRun();
    }
    // clima
    this.updateWeather(dt);
    // rebase do mundo
    if (p.z > WORLD_REBASE) {
      const dz = WORLD_REBASE;
      this.track.rebase(dz); p.shift(dz); this.chaser.shift(dz); this.camera.shift(dz); this.effects.shift(-dz);
      for (const r of this.track.moving) r.passed = r.passed && true;
    }
  }

  get multiplier() { return this.player.multiplier > 0 ? 2 : 1; }

  updateWeather(dt) {
    const w = this.weather;
    if (this.rainForce !== undefined) { w.target = this.rainForce; }
    else {
      w.timer -= dt;
      if (w.timer <= 0) {
        if (w.target > 0) { w.target = 0; w.timer = 50 + Math.random() * 60; }
        else if (Math.random() < 0.35 && this.state === 'running') { w.target = 0.6 + Math.random() * 0.4; w.timer = 40 + Math.random() * 40; }
        else w.timer = 30;
      }
    }
    if (!this.save.data.settings.rain) w.target = 0;
  }

  collect() {
    const p = this.player;
    const C = this.coins;
    const px = p.x, py = p.y + 0.9, pz = p.z;
    const magnet = p.magnet > 0;
    const reach = 0.9;
    const c = this.track.chunkAt(pz);
    const chunks = [c, c ? this.track.chunkAfter(c) : null];
    for (const ch of chunks) {
      if (!ch) continue;
      for (let k = 0; k < ch.nCoins; k++) {
        const i = ch.coins[k];
        if (!C.active[i]) continue;
        const dx = C.x[i] - px, dz = C.z[i] - pz, dy = C.y[i] - py;
        if (magnet && dz > -2 && dz < 9 && Math.abs(dx) < 7 && Math.abs(dy) < 8) {
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
          const sp = 26 * FIXED_DT / d;
          C.move(i, C.x[i] - dx * sp, C.y[i] - dy * sp, C.z[i] - dz * sp);
          if (d < 1.2) { this.takeCoin(i, true); }
          continue;
        }
        if (Math.abs(dx) < reach && Math.abs(dy) < 1.3 && dz > -0.8 && dz < 1.2) this.takeCoin(i, false);
      }
    }
    // power-ups e chaves
    const P = this.powerups;
    for (let i = P.records.length - 1; i >= 0; i--) {
      const r = P.records[i];
      const dx = r.x - px, dz = r.z - pz, dy = r.y - py;
      if (Math.abs(dx) < 1.1 && Math.abs(dy) < 1.6 && dz > -1 && dz < 1.4) {
        this.activatePowerup(r.kind, r.x, r.y, r.z);
        P.remove(r);
      }
    }
  }
  takeCoin(i, viaMagnet) {
    const C = this.coins;
    this.effects.coinBurst(C.x[i], C.y[i], C.z[i]);
    C.remove(i);
    this.stats.coins++;
    if (viaMagnet) this.stats.magnetCoins++;
    this.audio.play('coin');
  }

  render(dt, dtReal, alpha) {
    const p = this.player;
    const sp = this.speed;
    const speedT = clamp((sp - SPEED_START) / (SPEED_MAX - SPEED_START), 0, 1);
    p.animate(dt, this.time, sp, alpha);
    const mode = this.state === 'dead' || this.state === 'gameover' ? 'dead' : this.state === 'menu' ? 'menu' : 'run';
    this.chaser.update(dt, p, sp, this.time);
    this.camera.update(dt, p, sp, p.tilt, this.time, mode);
    // ambiente
    p.getRenderPos(_v);
    const tunnel = this.track.tunnelAmount(_v.z);
    this.env.update(dt, _v, tunnel, this.weather.target);
    this.env.sky.position.copy(this.camera.cam.position);
    // partículas
    const E = this.effects;
    if (this.state === 'running' || this.state === 'menu') {
      if (p.grounded && p.jetpack <= 0 && p.alive) E.runDust(_v.x, p.groundY, _v.z, sp, dt, this.env.night);
      if (p.jetpack > 0) { p.parts.jet.getWorldPosition(_v2); E.jetFlame(_v2.x, _v2.y - 0.3, _v2.z - 0.1, sp, dt); }
    }
    if (this.env.rain > 0.05 && tunnel < 0.5) E.rainSplashes(_v.x, p.groundY, _v.z, this.env.rain * (1 - tunnel), dt);
    E.rain.update(dt, this.camera.cam.position, this.env.rain * (1 - tunnel), sp);
    E.sceneEmitters(this.track.emitters, dt, 0.8);
    // brilhos aleatórios nas moedas próximas
    const c = this.track.chunkAt(_v.z);
    if (c && c.nCoins) { for (let k = 0; k < 2; k++) { const i = c.coins[Math.floor(Math.random() * c.nCoins)]; if (this.coins.active[i]) E.coinSparkle(this.coins.x[i], this.coins.y[i], this.coins.z[i]); } }
    E.update(dt, this.scene.fog, lerp(0.45, 1, Math.max(this.env.sun.intensity / 4.6, this.env.hemi.intensity)) * (1 - tunnel * 0.4));
    // pós
    this.flash = Math.max(0, this.flash - dtReal * 1.5);
    const sunDir = this.env.uniforms.uSunDir.value;
    _rayDir.copy(sunDir).multiplyScalar(1000).add(this.camera.cam.position);
    _rayDir.project(this.camera.cam);
    const onScreen = _rayDir.z < 1 && Math.abs(_rayDir.x) < 1.3 && Math.abs(_rayDir.y) < 1.3;
    _sunScreen.set(_rayDir.x * 0.5 + 0.5, _rayDir.y * 0.5 + 0.5);
    const facing = clamp(this.camera.cam.getWorldDirection(_v2).dot(sunDir), 0, 1);
    const flareAmt = onScreen ? smoothstep(0.0, 0.15, this.env.sunElev) * (1 - this.env.rain) * (1 - tunnel) * Math.pow(facing, 2) * smoothstep(0.75, 1.0, 1 - Math.hypot(_rayDir.x * 0.6, _rayDir.y * 0.6)) : 0;
    const dusk = smoothstep(0.35, 0.0, this.env.sunElev) * smoothstep(-0.15, 0.02, this.env.sunElev);
    const tint = dusk - this.env.night * 0.6 - this.env.rain * 0.4;
    this.postfx.update(dt, { speedT: this.state === 'menu' ? 0 : speedT, flash: this.flash, sunScreen: _sunScreen, flareAmt, timeOfDayTint: tint, tunnel, night: this.env.night, rain: this.env.rain, dead: this.state === 'dead' || this.state === 'gameover' });
    if (!this.skipRender) this.postfx.render();
    // áudio contínuo
    this.audio.updateLoops(speedT, this.env.rain, p.jetpack > 0, this.state === 'running', tunnel);
    if (this.audio.music.playing) this.audio.setTempo(126 + speedT * 24);
    // HUD
    this.hudTimer += dtReal;
    if (this.hudTimer > 0.08 && this.state === 'running') {
      this.hudTimer = 0;
      let power = null;
      for (const k of ['jetpack', 'magnet', 'sneakers', 'multiplier', 'hoverboard']) if (p[k] > 0) { power = { kind: k, t: p[k] / POWERUP_TIME[k] }; break; }
      this.ui.hud({ score: this.stats.score, coins: this.stats.coins, mult: this.multiplier, distance: this.stats.distance, keys: this.save.data.keys, power, chased: this.chaseActive && this.chaser.timer > 0 });
    }
  }

  /* ---------------------------------------------- API de depuração */
  debug() {
    return {
      /** Modo manual: avança a simulação `sec` segundos sem renderizar (screenshots em headless). */
      advance: (sec) => { this.skipRender = true; const n = Math.round(sec / FIXED_DT); for (let i = 0; i < n; i++) this.tick(FIXED_DT); this.skipRender = false; },
      renderOnce: () => { this.skipRender = false; this.tick(FIXED_DT); },
      setTime: (h) => this.env.setTime(h, true),
      setRain: (r) => { this.rainForce = r; },
      setSpeed: (s) => { this.speed = s; },
      crash: () => { const p = this.player; this.onCrash({ type: OB.TRAIN }); const _ = p; },
      jet: () => this.activatePowerup(PU.JETPACK, 0, 0, 0),
      state: () => ({ state: this.state, z: this.player.z, speed: this.speed, zone: (this.track.chunkAt(this.player.z) || {}).zone, tod: this.env.tod, rain: this.env.rain, stats: this.stats, chunks: this.track.stats }),
      skipTo: (zone) => { // avança até 20 m antes da próxima zona pedida (gera chunks no caminho)
        for (let i = 0; i < 220; i++) {
          const c = this.track.chunkAt(this.player.z + CHUNK_LEN);
          if (c && c.zone === zone && c.zoneIndex === 0) { this.player.z = c.z - 20; break; }
          this.player.z += CHUNK_LEN; this.track.update(0.016, this.player.z, this.player.x, this);
        }
        this.player.prevZ = this.player.z; this.player.y = 0; this.player.vy = 0; this.player.x = 0; this.player.lane = this.player.targetLane = 1; this.player.laneT = 1;
        this.camera.pos.set(0, 3.4, this.player.z - 6.5); this.camera.look.set(0, 1.2, this.player.z + 10);
        this.track.update(0.016, this.player.z, this.player.x, this);
        this.clearAhead(50);
      },
      zoneAt: () => this.track.chunks.map((c) => c.zone + '@' + c.z).join(','),
      pools: () => { const out = {}; for (const [k, p] of Object.entries(this.track.props.pools)) out[k] = p.created + '/' + p.free.length; out.yardTrain = this.track.props.yardTrains.created; for (const k of ['low', 'high', 'cone', 'hoarding', 'ramp', 'arch']) out[k] = this.obPools[k].created + '/' + this.obPools[k].free.length; out.trains = this.obPools.trains.slice(1).map((ps) => ps.map((p) => p.created).join('+')).join(' | '); out.records = this.track.recPool.created; return out; },
    };
  }
}

const game = new Game();
game.init().catch((e) => { console.error(e); const l = document.getElementById('load-label'); if (l) l.textContent = 'Erro: ' + e.message; });
const _ = JET_HEIGHT + globalUniforms.uTime.value;
