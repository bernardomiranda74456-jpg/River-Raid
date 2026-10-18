/**
 * Map 2 — "Pista dos Pêndulos" (Pendulum Run).
 * A straight 210 m gauntlet on concrete pylons above a sea: hammers,
 * spinning bars, conveyors with bumpers, a slime slide, updraft fans over a
 * wall, jump pads across a pit and a final pusher gauntlet. Falling respawns
 * at the last checkpoint.
 */
import * as THREE from 'three';
import { LevelBase, Frame, scaleBoxUV } from './LevelBase.js';
import { Environment } from '../gfx/Environment.js';
import { Water } from '../gfx/Water.js';
import { rockGeometry, mountainGeometry } from '../gfx/Rocks.js';

const W = 14;
export class PendulumRun extends LevelBase {
  constructor(game) {
    super(game); this.name = 'Pista dos Pêndulos'; this.kind = 'race'; this.qualify = 8; this.duration = 120; this.killY = -14; this.respawn = true; this.spawnYaw = Math.PI / 2; this.introCam = { from: new THREE.Vector3(40, 26, -60), look: new THREE.Vector3(60, 0, 0) };
  }
  build() {
    const M = this.M;
    this.env = new Environment({ scene: this.scene, renderer: this.game.renderer, camera: this.game.camera, materials: M, settings: this.settings,
      preset: { elevation: 48, azimuth: 140, turbidity: 2.5, rayleigh: 1.2, mie: 0.004, mieG: 0.8, fogColor: 0xd6e6f5, fogDensity: 0.0026, sunColor: 0xfff4e0, sunIntensity: 5.2, envIntensity: 0.18, hemi: 0.28, hemiSky: 0xcfe3ff, hemiGround: 0x3a6a7a, exposure: 1.0, groundBounce: 0x2a5a6a } });
    this.water = new Water(this.scene, { y: -16, sunDir: this.env.sunDir, fogColor: 0xd6e6f5, fogDensity: 0.0026 }); this.disposables.push(this.water);
    this.paintRed = M.paint('#c8352b'); this.paintBlue = M.paint('#2d6fb3'); this.paintYellow = M.paint('#e8b72a', { edgeDirt: 0.35 }); this.paintGreen = M.paint('#3f9d4a'); this.paintWhite = M.paint('#e9e4dc', { edgeDirt: 0.4 }); this.paintTeal = M.paint('#2a8f8a');
    const f = new Frame(new THREE.Vector3(0, 0, 0), 0); this.f = f;
    // scenery: cliffs and islands
    for (let i = 0; i < 14; i++) { const g = mountainGeometry(40 + (i % 3) * 12, 70 + (i % 4) * 25, 300 + i); const m = new THREE.Mesh(g, M.rock); const a = i / 14 * Math.PI * 2; m.position.set(100 + Math.cos(a) * 320, -30, Math.sin(a) * 320); m.rotation.y = i; this.deco(m); }
    for (let i = 0; i < 16; i++) { const g = rockGeometry(4 + (i % 5) * 2, 2, 400 + i, { rough: 0.45 }); const m = new THREE.Mesh(g, M.rock); m.position.set(-20 + i * 16, -16 + 2, (i % 2 ? 1 : -1) * (30 + (i * 7 % 20))); m.castShadow = true; this.deco(m); }

    this._plaza(); this._hammers(0, 34); this._spinners(34, 64); this._conveyors(64, 92); this._slide(92, 124); this._fans(124, 150); this._pads(150, 182); this._gauntlet(182, 206); this._finish(206);
    this.batchStatics();
  }
  _deck(x0, x1, y = 0, w = W, mat = this.M.concrete, { rails = true, thick = 0.8 } = {}) {
    const L = x1 - x0; const cx = (x0 + x1) / 2;
    this.box([L, thick, w], [cx, y - thick / 2, 0], [0, 0, 0], mat, { uv: 0.3 });
    this.box([L, 0.5, w + 0.6], [cx, y - thick - 0.25, 0], [0, 0, 0], this.M.darkMetal, { noCollider: true, uv: 0.3 });
    if (rails) for (const s of [-1, 1]) this.box([L, 0.06, 0.5], [cx, y + 0.02, s * (w / 2 - 0.25)], [0, 0, 0], this.M.hazard, { noCollider: true });
    // pylons
    for (let x = x0 + 4; x < x1; x += 12) for (const s of [-1, 1]) this.cylinder(0.9, 20, [x, y - 10, s * (w / 2 - 1.5)], [0, 0, 0], this.M.concreteDark, { noCollider: true, segments: 12 });
  }
  _checkpoint(x, y = 0) { this.sensorBox([2, 6, W + 4], [x, y + 3, 0], { type: 'checkpoint', pos: new THREE.Vector3(x, y + 0.1, 0) }); }
  _plaza() {
    this._deck(-28, 0, 0, 22);
    this.spawns.length = 0; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) this.spawns.push(new THREE.Vector3(-24 + r * 3, 0.05, -8.4 + c * 2.4));
    this.cylinder(0.35, 7, [-1, 3.5, -11.5], [0, 0, 0], this.M.darkMetal, { noCollider: true }); this.cylinder(0.35, 7, [-1, 3.5, 11.5], [0, 0, 0], this.M.darkMetal, { noCollider: true });
    this.box([0.6, 1.2, 23.6], [-1, 7.4, 0], [0, 0, 0], this.paintRed, { noCollider: true });
    this.wp(-8, 0.2, 0, { spread: 10 }); this.wp(2, 0.2, 0, { spread: 10 });
    this.respawnPos = new THREE.Vector3(-10, 0.1, 0);
  }
  _hammers(x0, x1) {
    this._deck(x0, x1);
    [8, 18, 28].forEach((x, k) => {
      const pivotY = 8.2, arm = 6.2, w = 1.2 + k * 0.08;
      for (const s of [-1, 1]) for (const zz of [-8, 8]) { const b = new THREE.Vector3(x + s * 2.8, -0.6, zz), top = new THREE.Vector3(x, pivotY + 0.3, 0); const mid = b.clone().lerp(top, 0.5); const dir = top.clone().sub(b); const len = dir.length(); dir.normalize(); const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); this.cylinder(0.24, len, [mid.x, mid.y, mid.z], [0, 0, 0], this.M.darkMetal, { quat: qq, noCollider: true, segments: 10 }); }
      this.cylinder(0.32, 18, [x, pivotY, 0], [0, 0, 0], this.M.metal, { quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), noCollider: true, segments: 12 });
      const g = new THREE.Group();
      const armM = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, arm, 12), this.M.darkMetal); armM.position.y = -arm / 2; armM.castShadow = true; g.add(armM);
      const headG = new THREE.BoxGeometry(1.8, 2.4, 2.8); scaleBoxUV(headG, [1.8, 2.4, 2.8], 0.6); const head = new THREE.Mesh(headG, this.M.hazard); head.position.y = -arm - 1.1; head.castShadow = true; g.add(head);
      const capA = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 3.0), this.M.darkMetal); capA.position.y = -arm - 2.3; g.add(capA); const capB = capA.clone(); capB.position.y = -arm + 0.1; g.add(capB);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.0, 16), this.M.darkMetal); hub.rotation.z = Math.PI / 2; g.add(hub);
      const phase = k * 2.0; const X = x;
      const m = this.mover(g, (t) => ({ pos: new THREE.Vector3(X, pivotY, 0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * w + phase) * 1.2, 0, 0)) }));
      this.moverShape(m, 'box', [1.8, 2.4, 2.8], [0, -arm - 1.1, 0], [0, 0, 0], { hazardSolid: true });
      this.moverShape(m, 'box', [2.2, 2.8, 3.2], [0, -arm - 1.1, 0], [0, 0, 0], { sensor: true, data: { type: 'hazard', mul: 1.0, up: 5, push: 2, max: 16, metal: true } });
      this.moverShape(m, 'cylinder', [0.3, arm], [0, -arm / 2, 0], [0, 0, 0], { hazardSolid: true });
    });
    for (const x of [8, 13, 18, 23, 28, 33]) this.wp(x, 0.2, 0, { spread: 8 });
  }
  _spinners(x0, x1) {
    this._deck(x0, x1); this._checkpoint(x0 + 1);
    [[x0 + 9, 1], [x0 + 21, -1]].forEach(([x, dir]) => {
      const g = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 1.6, 20), this.M.hazard); hub.castShadow = true; g.add(hub);
      const barG = new THREE.BoxGeometry(13, 0.5, 0.5); scaleBoxUV(barG, [13, 0.5, 0.5], 0.5); const bar = new THREE.Mesh(barG, this.M.metal); bar.position.y = 0.25; bar.castShadow = true; g.add(bar);
      for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), this.paintRed); tip.position.set(s * 6.6, 0.25, 0); g.add(tip); }
      this.cylinder(0.55, 2, [x, -0.8, 0], [0, 0, 0], this.M.darkMetal, { noCollider: true });
      const X = x, D = dir;
      const m = this.mover(g, (t) => ({ pos: new THREE.Vector3(X, 0.95, 0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t * 1.4 * D, 0)) }));
      this.moverShape(m, 'box', [13, 0.5, 0.5], [0, 0.25, 0], [0, 0, 0], { hazardSolid: true });
      this.moverShape(m, 'box', [13.3, 0.9, 0.9], [0, 0.25, 0], [0, 0, 0], { sensor: true, data: { type: 'hazard', mul: 1.0, up: 5, push: 2, max: 14, metal: true } });
      this.moverShape(m, 'cylinder', [1.1, 1.6]);
      this.wp(x - 2.2, 0.2, 0, { jump: true, jumpDist: 1.8, spread: 5 }); this.wp(x + 3, 0.2, 0, { spread: 6 });
    });
    this.wp(x1 - 2, 0.2, 0, { spread: 8 });
  }
  _conveyors(x0, x1) {
    this._deck(x0, x1, 0, W, this.M.concrete, { rails: false }); this._checkpoint(x0 + 1);
    const beltMat = this.beltMat = this.ownMaterial(this.M.rubber);
    // three lanes with different directions; players pick a lane
    const lanes = [[-4.6, -3.5], [0, 2.5], [4.6, -5.5]];
    for (const [z, vx] of lanes) {
      this.box([x1 - x0 - 4, 0.25, 4.2], [(x0 + x1) / 2, 0.12, z], [0, 0, 0], beltMat, { data: { type: 'conveyor', conveyor: new THREE.Vector3(vx, 0, 0) }, uv: 0.5 });
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.3, 3), this.paintYellow); arrow.position.set((x0 + x1) / 2, 0.27, z); arrow.rotation.set(Math.PI / 2, 0, vx > 0 ? -Math.PI / 2 : Math.PI / 2); arrow.scale.set(1, 1, 0.1); this.deco(arrow);
    }
    for (const s of [-1, 1]) { const r = [x0 + 2, 0.12, s * 7]; this.cylinder(0.2, 13.5, [x0 + 2, 0.12, 0], [0, 0, 0], this.M.metal, { quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), noCollider: true, segments: 12 }); this.cylinder(0.2, 13.5, [x1 - 2, 0.12, 0], [0, 0, 0], this.M.metal, { quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), noCollider: true, segments: 12 }); }
    // bumpers on the fast lane
    for (const [x, z] of [[x0 + 8, 2.3], [x0 + 16, -2.3], [x0 + 22, 2.0]]) {
      const p = [x, 0.95, z]; this.cylinder(0.8, 1.5, p, [0, 0, 0], this.paintRed); this.cylinder(0.83, 0.12, [x, 1.75, z], [0, 0, 0], this.M.darkMetal, { noCollider: true });
      this.cylinder(1.1, 1.6, p, [0, 0, 0], null, { sensor: true, noMesh: true, data: { type: 'bounce', center: new THREE.Vector3(x, 0, z), power: 10 } });
    }
    for (const x of [x0 + 3, x0 + 9, x0 + 15, x0 + 21, x1 - 2]) this.wp(x, 0.2, 0, { spread: 4 });
  }
  _slide(x0, x1) {
    // downhill slime slide dropping 7 m; slippery, with posts to dodge
    this._checkpoint(x0 + 1);
    this._deck(x0, x0 + 4);
    const drop = 7; const L = Math.hypot(x1 - x0 - 8, drop); const ang = -Math.atan2(drop, x1 - x0 - 8);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang)); const cx = (x0 + 4 + x1 - 4) / 2;
    this.box([L, 0.6, W], [cx, -drop / 2 - 0.3, 0], [0, 0, 0], this.M.slime, { quat: q, data: { type: 'slippery', slippery: true }, friction: 0, uv: 0.3 });
    this.box([L, 0.5, W + 0.6], [cx, -drop / 2 - 0.85, 0], [0, 0, 0], this.M.darkMetal, { quat: q, noCollider: true });
    for (const s of [-1, 1]) { this.box([L, 1.0, 0.4], [cx, -drop / 2 + 0.3, s * (W / 2 + 0.1)], [0, 0, 0], this.paintGreen, { quat: q }); }
    for (let i = 0; i < 6; i++) { const x = x0 + 8 + i * 3.6; const z = ((i % 2) ? 1 : -1) * (1.5 + (i % 3)); const y = -(x - x0 - 4) / (x1 - x0 - 8) * drop; this.cylinder(0.45, 2.2, [x, y + 0.8, z], [0, 0, 0], this.paintWhite); }
    this._deck(x1 - 4, x1, -drop);
    this.wp(x0 + 2, 0.2, 0, { spread: 6 }); this.wp(x0 + 10, -1.8, 0, { spread: 5, dive: true }); this.wp(x0 + 20, -4.5, 0, { spread: 5 }); this.wp(x1 - 2, -drop + 0.2, 0, { spread: 6 });
    this.levelY = -drop;
  }
  _fans(x0, x1) {
    const y = this.levelY; this._deck(x0, x0 + 6, y); this._checkpoint(x0 + 1, y);
    // wall + updraft fans; after the wall, a high deck
    const wallX = x0 + 11; this.box([1.2, 6, W], [wallX, y + 3, 0], [0, 0, 0], this.paintBlue, { uv: 0.4 });
    this.box([1.4, 0.3, W + 0.2], [wallX, y + 6.1, 0], [0, 0, 0], this.M.hazard, { noCollider: true });
    this._deck(x0 + 6, wallX - 0.6, y);
    for (const z of [-4.5, 0, 4.5]) {
      const fx = wallX - 3.2; this.cylinder(1.6, 0.5, [fx, y + 0.25, z], [0, 0, 0], this.M.darkMetal, { noCollider: true });
      const g = new THREE.Group(); for (let b = 0; b < 4; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.4), this.M.metal); blade.rotation.y = b * Math.PI / 2; blade.rotation.x = 0.5; g.add(blade); }
      const m = this.mover(g, (t) => ({ pos: new THREE.Vector3(fx, y + 0.55, z), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t * 9, 0)) }));
      this.sensorBox([4.2, 12, 4.2], [fx, y + 6, z], { type: 'fan', force: new THREE.Vector3(2, 60, 0) });
      const grill = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 6, 24), this.M.darkMetal); grill.rotation.x = Math.PI / 2; grill.position.set(fx, y + 0.7, z); this.deco(grill);
    }
    this._deck(wallX + 0.6, x1, y + 6);
    this.wp(x0 + 3, y + 0.2, 0, { spread: 6 }); this.wp(wallX - 3.2, y + 0.2, 0, { spread: 4, wait: false, jump: true, jumpDist: 3 }); this.wp(wallX + 5, y + 6.2, 0, { spread: 6, radius: 3 }); this.wp(x1 - 2, y + 6.2, 0, { spread: 6 });
    this.levelY = y + 6;
  }
  _pads(x0, x1) {
    const y = this.levelY; this._checkpoint(x0 + 1, y);
    // pit with islands reached via jump pads
    this._deck(x0, x0 + 6, y);
    const islands = [[x0 + 14, 0], [x0 + 22, 0]];
    let px = x0 + 4;
    for (const [ix, iz] of islands) {
      this.cylinder(0.9, 0.3, [px, y + 0.15, 0], [0, 0, 0], this.paintYellow, { noCollider: true }); this.cylinder(0.7, 0.2, [px, y + 0.3, 0], [0, 0, 0], this.paintRed, { noCollider: true });
      this.sensorBox([2.0, 1.5, 2.0], [px, y + 0.8, 0], { type: 'jumppad', power: 17 });
      this.cylinder(3.2, 0.8, [ix, y - 0.4, iz], [0, 0, 0], this.paintTeal, { segments: 24 }); this.cylinder(3.4, 0.4, [ix, y - 1.0, iz], [0, 0, 0], this.M.darkMetal, { noCollider: true, segments: 24 });
      this.cylinder(0.8, 24, [ix, y - 12, iz], [0, 0, 0], this.M.concreteDark, { noCollider: true, segments: 12 });
      this.wp(px, y + 0.2, 0, { spread: 0.5, noSpread: true, radius: 1.2, wait: false }); this.wp(ix, y + 0.2, iz, { spread: 1.5, radius: 2.5, wait: false });
      px = ix + 2.2;
    }
    this.cylinder(0.9, 0.3, [px, y + 0.15, 0], [0, 0, 0], this.paintYellow, { noCollider: true }); this.cylinder(0.7, 0.2, [px, y + 0.3, 0], [0, 0, 0], this.paintRed, { noCollider: true });
    this.sensorBox([2.0, 1.5, 2.0], [px, y + 0.8, 0], { type: 'jumppad', power: 17 });
    this.wp(px, y + 0.2, 0, { spread: 0.5, noSpread: true, radius: 1.2, wait: false });
    this._deck(x1 - 6, x1, y); this.wp(x1 - 3, y + 0.2, 0, { spread: 5, radius: 3, wait: false });
  }
  _gauntlet(x0, x1) {
    const y = this.levelY; this._deck(x0, x1, y); this._checkpoint(x0 + 1, y);
    for (const [x, ph] of [[x0 + 6, 0], [x0 + 12, 1.5], [x0 + 18, 3]]) {
      const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.0, 4.0), this.paintBlue); body.castShadow = true; g.add(body);
      const face = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 0.3), this.M.hazard); face.position.z = 2.1; g.add(face); const f2 = face.clone(); f2.position.z = -2.1; g.add(f2);
      this.box([0.3, 0.3, W + 2], [x, y + 0.15, 0], [0, 0, 0], this.M.darkMetal, { noCollider: true });
      const X = x, PH = ph;
      const m = this.mover(g, (t) => ({ pos: new THREE.Vector3(X, y + 1.2, Math.sin(t * 1.1 + PH) * 5.5), quat: new THREE.Quaternion() }));
      this.moverShape(m, 'box', [1.8, 2.0, 4.0]);
    }
    for (const x of [x0 + 3, x0 + 9, x0 + 15, x0 + 21]) this.wp(x, y + 0.2, 0, { spread: 8 });
  }
  _finish(x0) {
    const y = this.levelY; this._deck(x0, x0 + 16, y, 18);
    for (const s of [-1, 1]) this.cylinder(0.4, 7, [x0 + 4, y + 3.5, s * 8], [0, 0, 0], this.M.metal, { noCollider: true });
    this.box([1.0, 1.4, 17], [x0 + 4, y + 7.2, 0], [0, 0, 0], this.paintRed, { noCollider: true });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffd23f, emissiveIntensity: 3.5 })); sign.position.set(x0 + 3.4, y + 7.2, 0); this.deco(sign);
    this.box([2.2, 0.04, 17], [x0 + 4, y + 0.02, 0], [0, 0, 0], this.M.hazard, { noCollider: true });
    this.sensorBox([3, 6, 18], [x0 + 5, y + 3, 0], { type: 'finish' });
    this.wp(x0 + 6, y + 0.2, 0, { spread: 6 }); this.wp(x0 + 12, y + 0.2, 0, { spread: 6, noSpread: true });
  }
  onSensor(s, ch, started) {
    if (s.type === 'checkpoint') { if (started) ch.checkpoint = s.pos; return; }
    super.onSensor(s, ch, started);
  }
  postStep(chars) {
    super.preStep; // (no-op reference)
    const ph = this.physics; const ud = ph.userData;
    ph.events.drainCollisionEvents((h1, h2, started) => { let s = this.sensors.get(h1), other = h2; if (!s) { s = this.sensors.get(h2); other = h1; } if (!s) return; const d = ud.get(other); if (!d || d.type !== 'char') return; this.onSensor(s, d.char, started); });
    for (const ch of chars) {
      if (ch.state === 5 || ch.eliminated) continue;
      if (ch.pos.y < this.killY + (ch.checkpoint ? ch.checkpoint.y : 0) - 2) { // fell: respawn at checkpoint
        const p = ch.checkpoint || this.respawnPos; ch.events.push('respawn'); ch.spawn(new THREE.Vector3(p.x + (Math.random() - 0.5) * 2, p.y, p.z + (Math.random() - 0.5) * 4), this.spawnYaw); if (ch.bot) ch.bot.wp = Math.max(0, ch.bot.wp - 2);
      }
    }
    this.fanOccupants.forEach((set, ch) => { ch.inFans = set.size; });
  }
  update(dt, time, camPos, playerPos) { super.update(dt, time, camPos, playerPos); this.water.update(dt, time, camPos); if (this.beltMat) this.beltMat.map.offset.x -= dt * 0.8; }
}
