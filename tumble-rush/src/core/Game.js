/**
 * Game: state machine (MENU → LOBBY → COUNTDOWN → RACING → ROUND_END → RESULTS),
 * fixed-timestep loop with render interpolation, round/qualification logic,
 * player control and the glue between level, characters, bots, camera, UI, audio.
 */
import * as THREE from 'three';
import { Physics, FIXED_DT } from './Physics.js';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { AudioSys } from './Audio.js';
import { ThirdPersonCamera } from './Camera.js';
import { Materials } from '../gfx/Materials.js';
import { Particles } from '../gfx/Particles.js';
import { CharacterSystem, STATE, MOVE } from '../entities/Character.js';
import { Bot } from '../entities/Bot.js';
import { SKINS, randomSkin, BOT_NAMES } from '../entities/Skins.js';
import { mulberry32 } from '../gfx/Textures.js';
import { LavaClimb } from '../levels/LavaClimb.js';
import { PendulumRun } from '../levels/PendulumRun.js';
import { HexFall } from '../levels/HexFall.js';
import { MenuStage } from '../levels/MenuStage.js';

export const GS = { MENU: 'menu', LOBBY: 'lobby', COUNTDOWN: 'countdown', RACING: 'racing', ROUND_END: 'roundEnd', RESULTS: 'results' };
const ROUNDS = [
  { level: LavaClimb, name: 'Corrida da Lava', from: 32, to: 16 },
  { level: PendulumRun, name: 'Pista dos Pêndulos', from: 16, to: 8 },
  { level: HexFall, name: 'Blocos que Somem', from: 8, to: 1 },
];
const _v = new THREE.Vector3();

export class Game {
  constructor({ RAPIER, canvas, settings, ui, gpu }) {
    this.R = RAPIER; this.canvas = canvas; this.settings = settings; this.ui = ui; this.gpu = gpu;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
    this.renderer = new Renderer(canvas, settings); this.renderer.setScene(this.scene, this.camera);
    this.input = new Input(canvas); this.audio = new AudioSys();
    this.materials = new Materials({ textureSize: gpu.isMobile ? 512 : 1024, anisotropy: settings.values.anisotropy });
    this.physics = null; this.level = null; this.chars = null; this.bots = []; this.player = null; this.particles = null; this.tpc = null;
    this.state = GS.MENU; this.round = 0; this.roundTime = 0; this.countdown = 0; this.qualified = []; this.roster = []; this.paused = false;
    this.acc = 0; this.last = performance.now(); this.fps = 0; this._fpsAcc = 0; this._fpsN = 0; this.running = false; this.frame = 0;
    this.winner = null; this.resultsPending = 0; this.endTimer = 0;
    this.heading = 0; // player's steered facing direction (follow / first-person camera modes)
    settings.onChange(() => this.applySettings());
    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
    this.clock = { time: 0 };
  }

  applySettings() {
    const s = this.settings;
    this.renderer.rebuild();
    if (this.level && this.level.env) this.level.env.buildSun();
    this.materials.setAnisotropy(s.values.anisotropy);
    this.input.sensitivity = s.sensitivity; if (this.tpc) this.tpc.sens = 1;
    this.audio.setVolume(s.volume);
    if (this.particles) this.particles.density = s.values.particles;
    this.ui.setFpsVisible(s.showFps);
  }

  // ---------------- menu backdrop ----------------
  showMenu() {
    this.unloadRound();
    this.physics = new Physics(this.R); this.particles = new Particles(this.scene, this.settings.values.particles);
    this.level = new MenuStage(this); this.level.build();
    this.chars = new CharacterSystem({ scene: this.scene, physics: this.physics, materials: this.materials, maxChars: 12 });
    const rnd = mulberry32(42);
    this.player = this.chars.add(SKINS[this.settings.skin % SKINS.length], { name: 'Você', isPlayer: true }); this.player.spawn(this.level.spawns[0], Math.PI);
    this.bots = [];
    for (let i = 1; i < this.level.spawns.length; i++) { const ch = this.chars.add(randomSkin(rnd), { name: 'bot' }); const sp = this.level.spawns[i]; ch.spawn(sp, Math.atan2(-sp.x, -sp.z)); ch.menuT = 1 + rnd() * 4; }
    this.menuAngle = 0; this.state = GS.MENU; this.paused = false; this.ui.showHud(false);
    this.renderer.setGtaoBox(new THREE.Box3(new THREE.Vector3(-60, -40, -60), new THREE.Vector3(60, 40, 60)));
  }
  /** Live skin preview on the menu podium. */
  setMenuSkin(i) { if (this.state !== GS.MENU || !this.player) return; this.player.skin = SKINS[i % SKINS.length]; this.chars._applySkin(this.player); }
  _menuTick(dt) {
    this.clock.time += dt; this.menuAngle += dt * 0.12;
    for (const ch of this.chars.chars) { if (ch.isPlayer) continue; ch.menuT -= dt; if (ch.menuT <= 0) { ch.menuT = 2 + Math.random() * 5; ch.ctrl.jump = true; } }
    this.player.celebrate = 1; if (this.player.state === STATE.GROUND) { this.player.state = STATE.FINISHED; }
    this.acc += dt; let steps = 0; while (this.acc >= FIXED_DT && steps < 4) { this.level.preStep(FIXED_DT, this.physics.time); this.chars.preStep(FIXED_DT, this.physics.time); this.physics.step(); this.chars.postStep(); this.level.postStep(this.chars.chars); this.acc -= FIXED_DT; steps++; }
    if (steps === 4) this.acc = 0;
    const a = this.menuAngle; this.camera.position.set(Math.sin(a) * 13, 4.2 + Math.sin(a * 0.7) * 0.8, Math.cos(a) * 13); this.camera.lookAt(0, 1.6, 0); this.camera.fov += (50 - this.camera.fov) * Math.min(1, dt * 3); this.camera.updateProjectionMatrix();
    this.chars.advance(dt); this.chars.render(this.acc / FIXED_DT, this.camera.position);
    this.level.update(dt, this.clock.time, this.camera.position, this.player.renderPos); this.particles.update(dt); this._handleEvents();
    this.renderer.setFocus(13); this.renderer.setSpeedBlur(0, 0, 0);
    if (!this.skipRender) this.renderer.render(); this.frame++;
  }

  // ---------------- match flow ----------------
  startMatch() {
    this.audio.resume(); this.audio.startAmbient();
    const rnd = mulberry32(Date.now() & 0xffff);
    // roster: player + 31 bots
    this.roster = [{ name: 'Você', skin: SKINS[this.settings.skin % SKINS.length], isPlayer: true, alive: true, seed: 1 }];
    const names = [...BOT_NAMES].sort(() => rnd() - 0.5);
    for (let i = 0; i < 31; i++) this.roster.push({ name: names[i % names.length], skin: randomSkin(rnd), isPlayer: false, alive: true, seed: 100 + i });
    this.round = 0; this.winner = null;
    this.loadRound();
  }

  loadRound() {
    this.unloadRound();
    const def = ROUNDS[this.round];
    this.physics = new Physics(this.R);
    this.particles = new Particles(this.scene, this.settings.values.particles);
    this.level = new def.level(this); this.level.build();
    this.chars = new CharacterSystem({ scene: this.scene, physics: this.physics, materials: this.materials, maxChars: 32 });
    this.tpc = new ThirdPersonCamera(this.camera, this.physics);
    const alive = this.roster.filter((r) => r.alive);
    this.bots = []; this.qualified = [];
    const spawns = this.level.spawns; const rnd = mulberry32(this.round * 77 + 5);
    const order = alive.map((r, i) => i).sort(() => rnd() - 0.5);
    alive.forEach((r, i) => {
      const ch = this.chars.add(r.skin, { name: r.name, isPlayer: r.isPlayer }); r.char = ch; ch.roster = r;
      const sp = spawns[order[i] % spawns.length]; ch.spawn(sp, this.level.spawnYaw ?? 0);
      if (!r.isPlayer) { const b = new Bot(ch, this.level, r.seed * 31 + this.round); this.bots.push(b); ch.bot = b; }
      else this.player = ch;
    });
    this.tpc.reset(this.player.pos, this.level.spawnYaw ?? 0); this.heading = this.level.spawnYaw ?? 0;
    if (this.level.introCam) this.tpc.startIntro(this.level.introCam.from, this.level.introCam.look, 5.5);
    this.roundTime = 0; this.countdown = 4.0; this.state = GS.LOBBY; this.lobbyTime = 2.5; this.endTimer = 0;
    this.ui.showHud(true); this.ui.setRound(this.round + 1, def.name, this.level.kind === 'survival' ? null : def.to, alive.length);
    this.ui.setLavaVisible(!!this.level.lavaDanger);
    this.ui.message(def.name, 'title', 2.2);
    this.renderer.setGtaoBox(new THREE.Box3(new THREE.Vector3(-200, -80, -200), new THREE.Vector3(200, 200, 200)));
    this.input.requestPointerLock();
  }

  unloadRound() {
    if (this.chars) { this.chars.dispose(); for (const m of Object.values(this.chars.mats)) { this.materials.unregister(m); m.dispose(); } this.chars = null; }
    if (this.level) { this.level.dispose(); this.level = null; }
    if (this.particles) { this.particles.dispose(); this.particles = null; }
    if (this.physics) { this.physics.dispose(); this.physics = null; }
    this.bots = []; this.player = null;
  }

  quitToMenu() { this.showMenu(); this.ui.show('menu'); this.input.exitPointerLock(); }

  onFinish(ch) {
    if (this.state !== GS.RACING || ch.finished || ch.eliminated) return;
    const def = ROUNDS[this.round]; if (this.qualified.length >= def.to) { return; }
    ch.finish(this.roundTime); this.qualified.push(ch);
    ch.rank = this.qualified.length;
    if (ch.isPlayer) { this.ui.message('CLASSIFICADO!', 'good', 2.5); this.audio.qualify(); this.particles.confetti(ch.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 120); }
    else this.particles.confetti(ch.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 30);
    this.ui.setQualified(this.qualified.length, def.to);
    if (this.qualified.length >= def.to) this.endRound();
  }
  onTileFall(t) { if (this.particles) { this.particles.dust(t.pos, 1.5); if (t.pos.distanceTo(this.player.pos) < 25) this.audio.tileCrumble(); } }
  onHit(ch, s, soft = false) { if (ch.isPlayer) { this.tpc.addShake(soft ? 0.3 : 0.7); } if (s.metal) { this.particles.sparks(ch.pos.clone().add(new THREE.Vector3(0, 1, 0)), 18); if (ch.isPlayer || ch.renderPos.distanceTo(this.camera.position) < 25) this.audio.metal(); } }

  endRound() {
    if (this.state !== GS.RACING) return;
    this.state = GS.ROUND_END; this.endTimer = 0;
    const def = ROUNDS[this.round];
    if (this.level.kind === 'survival') {
      const alive = this.chars.chars.filter((c) => !c.eliminated); const w = alive[0] || this.player; this.winner = w; w.finish(this.roundTime); this.qualified = [w];
      if (w.isPlayer) { this.ui.message('VOCÊ VENCEU!', 'good', 3.5); this.audio.win(); this.particles.confetti(w.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 200); } else this.ui.message(`${w.name} venceu`, 'bad', 3.5);
    } else {
      for (const ch of this.chars.chars) if (!ch.finished && !ch.eliminated) { ch.eliminate('timeout'); }
      if (!this.player.finished) { this.ui.message('ELIMINADO', 'bad', 3); this.audio.eliminated(); }
    }
    for (const r of this.roster) if (r.alive && r.char) r.alive = !!r.char.finished;
  }

  /** After the round-end pause: next round or results. */
  advance() {
    const def = ROUNDS[this.round];
    const playerAlive = this.roster[0].alive;
    if (this.round >= ROUNDS.length - 1 || !playerAlive) { this.showResults(); return; }
    this.round++; this.loadRound();
  }
  showResults() {
    const playerAlive = this.roster[0].alive; const won = playerAlive && this.round >= ROUNDS.length - 1;
    // podium: winner + top finishers of last round (or the survivor order)
    const last = this.level.kind === 'survival' ? [...this.chars.chars].sort((a, b) => (b.eliminatedAt ?? 1e9) - (a.eliminatedAt ?? 1e9)) : [...this.qualified];
    const podium = last.slice(0, 3).map((c) => ({ name: c.name, skin: c.skin }));
    this.state = GS.RESULTS; this.ui.showHud(false); this.input.exitPointerLock();
    this.ui.showResults({ won, roundReached: this.round + 1, podium, playerRank: this.player.finished ? this.player.rank : null, eliminatedRound: playerAlive ? null : this.round + 1 });
  }

  pause(p) { if (this.state === GS.MENU || this.state === GS.RESULTS) return; this.paused = p; if (p) { this.ui.show('pause'); this.input.exitPointerLock(); } else { this.ui.show(null); this.input.requestPointerLock(); } }

  // ---------------- loop ----------------
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = () => { if (!this.running) return; this.tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }

  tick() {
    const now = performance.now(); let dt = (now - this.last) / 1000; this.last = now; if (dt > 0.1) dt = 0.1;
    if (this.testDt) dt = this.testDt; // deterministic stepping for automated screenshots
    this._fpsAcc += dt; this._fpsN++; if (this._fpsAcc >= 0.5) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; this.ui.setFps(this.fps, this.renderer.r.info.render.calls); }
    const inp = this.input.poll();
    if (inp.pausePressed && this.state !== GS.MENU && this.state !== GS.RESULTS) this.pause(!this.paused);
    if (inp.camPressed && this.state !== GS.MENU && this.state !== GS.RESULTS && !this.paused) this.cycleCamera();
    if (this.state === GS.MENU) { if (this.level && this.level.kind === 'menu') this._menuTick(dt); return; }
    if (this.state === GS.RESULTS || !this.level) { if (this.level && !this.skipRender) this.renderer.render(); this.frame++; return; }
    if (this.paused) { this.renderer.render(); return; }
    if (inp.anyPressed && !this.input.pointerLocked && !this.gpu.isMobile) this.input.requestPointerLock();
    this.ui.setHint(!this.input.pointerLocked && !this.gpu.isMobile && this.state === GS.RACING);
    this.clock.time += dt;
    // ----- state timers -----
    if (this.state === GS.LOBBY) { this.lobbyTime -= dt; if (this.lobbyTime <= 0) { this.state = GS.COUNTDOWN; this.countdown = 3.99; this._cdLast = 4; } }
    else if (this.state === GS.COUNTDOWN) {
      this.countdown -= dt; const n = Math.ceil(this.countdown);
      if (n !== this._cdLast) { this._cdLast = n; if (n > 0) { this.ui.countdown(String(n)); this.audio.countdown(false); } else { this.ui.countdown('VAI!'); this.audio.countdown(true); this.state = GS.RACING; this.roundTime = 0; if (this.level.startRace) this.level.startRace(); } }
    } else if (this.state === GS.RACING) {
      this.roundTime += dt; this.ui.setTimer(Math.max(0, this.level.duration - this.roundTime));
      if (this.roundTime >= this.level.duration) this.endRound();
      if (this.level.kind === 'survival') { const alive = this.chars.chars.filter((c) => !c.eliminated); if (alive.length <= 1) this.endRound(); }
      else { const active = this.chars.chars.filter((c) => !c.eliminated && !c.finished); if (active.length === 0) this.endRound(); }
    } else if (this.state === GS.ROUND_END) { this.endTimer += dt; if (this.endTimer > 4.0) { this.advance(); return; } }

    // ----- player control -----
    this._applyPlayerInput(inp, dt);
    // ----- fixed-step simulation -----
    this.acc += dt; let steps = 0;
    while (this.acc >= FIXED_DT && steps < 4) {
      this.stepSim(FIXED_DT); this.acc -= FIXED_DT; steps++;
    }
    if (steps === 4) this.acc = 0;
    const alpha = this.acc / FIXED_DT;
    // ----- per-frame visuals -----
    let p = this.player; let spectating = false;
    if ((p.eliminated || p.finished) && this.state === GS.RACING) { const s = this._spectateTarget(); if (s) { if (s !== this._spec) { this._spec = s; this.ui.message(`Espectando ${s.name}`, '', 1.5); } p = s; spectating = true; } }
    else this._spec = null;
    // camera mode: follow (behind the heading), first person (eyes), free (mouse orbit)
    const mode = this.settings.camMode;
    const fpState = p.state === STATE.GROUND || p.state === STATE.AIR || p.state === STATE.DIVE;
    const firstPerson = mode === 'first' && !spectating && fpState && this.tpc.intro <= 0;
    this.player.hideHead = firstPerson;
    this.chars.advance(dt);
    this.chars.render(alpha, this.camera.position);
    let followYaw = null;
    if (mode !== 'free') followYaw = spectating || this.__botActive || this.state === GS.ROUND_END ? p.yaw : this.heading;
    const pv = p.vel;
    const speedFactor = THREE.MathUtils.clamp((Math.hypot(pv.x, pv.z) - 4) / 8, 0, 1) + (p.state === STATE.DIVE ? 0.4 : 0);
    this.tpc.update(dt, p.renderPos, pv, inp.lookX, inp.lookY, speedFactor, { followYaw, eye: firstPerson ? p.eyePos : null });
    this.level.update(dt, this.clock.time, this.camera.position, p.renderPos);
    this.particles.update(dt);
    this._handleEvents();
    this._hud();
    this.renderer.setFocus(this.camera.position.distanceTo(p.renderPos));
    const sb = speedFactor * 0.012 * (p.state === STATE.DIVE ? 1.6 : 1); this.renderer.setSpeedBlur(0, 1, sb);
    if (this.level.lavaDanger) { const d = this.level.lavaDanger(p.pos.y); if (d > 0.3 && this.state === GS.RACING) this.tpc.addShake(dt * d * 0.5); this.audio.setAmbient(0.05, d * 0.12); }
    if (!this.skipRender) this.renderer.render(); this.frame++;
  }

  /** Best alive character to follow once the player is out (highest progress, or nearest survivor). */
  _spectateTarget() {
    let best = null, bp = -1e9;
    for (const c of this.chars.chars) { if (c.eliminated || c.finished || c === this.player) continue; const pr = this.level.kind === 'survival' ? -c.pos.distanceTo(this.player.pos) : c.progress; if (pr > bp) { bp = pr; best = c; } }
    return best;
  }
  /** Cycles the camera mode (V key / gamepad Y / touch button) and remembers the choice. */
  cycleCamera() {
    const order = ['follow', 'first', 'free']; const names = { follow: 'Câmera: segue o boneco', first: 'Câmera: 1ª pessoa', free: 'Câmera: livre (mouse)' };
    const cur = this.settings.camMode; const next = order[(order.indexOf(cur) + 1) % order.length];
    if (cur === 'free') this.heading = this.player ? this.player.yaw : this.heading; // keep looking the same way
    this.settings.camMode = next; this.settings.save(); this.ui.syncCamMode(next); this.ui.message(names[next], '', 1.4);
  }

  /**
   * Player control.
   * follow / first person: the player steers a heading. W/S (stick up/down) move forward/back along it,
   *   A/D (stick left/right) turn it, the mouse / touch-drag turns it too. The camera stays behind it,
   *   so the screen always shows what is in front of the character.
   * free: the old camera-relative control; the camera only turns with the mouse.
   */
  _applyPlayerInput(inp, dt) {
    const p = this.player; const c = p.ctrl;
    if (this.__botActive) { c.faceYaw = null; return; } // automated test driver controls the player
    const mode = this.settings.camMode;
    const canMove = this.state === GS.RACING && !p.finished && !p.eliminated;
    if (mode !== 'free') {
      if (!p.finished && !p.eliminated) {
        const turn = THREE.MathUtils.clamp(inp.move.x, -1, 1);
        this.heading -= turn * 2.9 * dt + inp.lookX * 0.0022;
        this.heading = Math.atan2(Math.sin(this.heading), Math.cos(this.heading));
      }
      const fwd = canMove ? inp.move.y : 0;
      c.x = Math.sin(this.heading) * fwd; c.z = Math.cos(this.heading) * fwd; c.mag = Math.abs(fwd);
      c.faceYaw = p.finished || p.eliminated ? null : this.heading;
    } else {
      c.faceYaw = null;
      if (!canMove) { c.x = c.z = 0; c.mag = 0; }
      else {
        const yaw = this.tpc.yaw; // camera yaw: forward is the direction from camera to target
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw); const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        c.x = fx * inp.move.y + rx * inp.move.x; c.z = fz * inp.move.y + rz * inp.move.x; c.mag = Math.hypot(c.x, c.z);
      }
    }
    if (!canMove) { c.jump = c.dive = false; return; }
    if (inp.jumpPressed) c.jump = true; if (inp.divePressed) c.dive = true;
  }

  stepSim(dt) {
    const t = this.physics.time;
    for (const b of this.bots) b.think(dt, t);
    if (this.__botActive && this.__bot && this.state === GS.RACING) this.__bot.think(dt, t);
    if (this.state !== GS.RACING) for (const b of this.bots) { b.ch.ctrl.mag = 0; b.ch.ctrl.x = b.ch.ctrl.z = 0; b.ch.ctrl.jump = false; }
    this.level.preStep(dt, t);
    this.chars.preStep(dt, t);
    this.physics.step();
    this.chars.postStep();
    this.level.postStep(this.chars.chars);
    if (this.state === GS.RACING && this.level.kind !== 'survival') this.player.progress = this.level.progressOf(this.player);
    for (const ch of this.chars.chars) if (ch.eliminated && ch.eliminatedAt == null) ch.eliminatedAt = this.roundTime;
  }

  _handleEvents() {
    const P = this.particles, A = this.audio, cam = this.camera.position;
    for (const ch of this.chars.chars) {
      if (!ch.events.length) continue;
      const near = ch.isPlayer || ch.renderPos.distanceTo(cam) < 30;
      for (const e of ch.events) {
        switch (e) {
          case 'jump': if (near) A.jump(); break;
          case 'land': P.dust(ch.renderPos, 0.6); if (near) A.land(0.6); break;
          case 'landHard': P.dust(ch.renderPos, 1.2); if (near) A.land(1.2); if (ch.isPlayer) this.tpc.addShake(0.25); break;
          case 'dive': if (near) A.dive(); break;
          case 'hit': P.dust(ch.renderPos, 1); if (near) A.hit(1); if (ch.isPlayer) this.tpc.addShake(0.6); break;
          case 'flop': P.dust(ch.renderPos, 1.5); if (near) A.hit(0.8); if (ch.isPlayer) this.tpc.addShake(0.5); break;
          case 'boing': if (near) A.boing(); if (ch.isPlayer) this.tpc.addShake(0.2); break;
          case 'lava': P.lavaBurst(ch.renderPos); if (near) A.sizzle(); if (ch.isPlayer) { this.tpc.addShake(0.8); if (this.state === GS.RACING) { this.ui.message('ELIMINADO', 'bad', 3); A.eliminated(); } } break;
          case 'eliminated': if (ch.isPlayer && this.state === GS.RACING) { this.ui.message('ELIMINADO', 'bad', 3); A.eliminated(); } break;
          case 'finish': break;
          case 'respawn': P.dust(ch.renderPos, 1); if (ch.isPlayer) { this.tpc.addShake(0.3); A.whoosh(); this.heading = ch.yaw; } break;
          case 'getup': break;
          default: break;
        }
      }
      ch.events.length = 0;
      if (ch.state === STATE.GROUND && ch.speed > 5 && ch.isPlayer && Math.random() < 0.5) P.trail(ch.renderPos, ch.vel);
      if (ch.isPlayer && ch.state === STATE.GROUND && ch.grounded && ch.speed > 2.5) { this._stepT = (this._stepT || 0) - (1 / 60); if (this._stepT <= 0) { this._stepT = 0.32 - ch.speed * 0.012; A.step(); } }
    }
  }

  _hud() {
    const p = this.player; const def = ROUNDS[this.round];
    if (this.level.kind === 'survival') { const alive = this.chars.chars.filter((c) => !c.eliminated).length; this.ui.setPosition(null, alive); }
    else {
      let rank = 1; for (const c of this.chars.chars) { if (c === p || c.eliminated) continue; if (c.finished && !p.finished) { rank++; continue; } if (!p.finished && c.progress > p.progress) rank++; }
      this.ui.setPosition(p.finished ? p.rank : rank, null);
    }
    if (this.level.lavaDanger) this.ui.setLava((this.level.lavaY - this.level.lavaStart) / 60, (p.pos.y - this.level.lavaStart) / 60);
  }
}
