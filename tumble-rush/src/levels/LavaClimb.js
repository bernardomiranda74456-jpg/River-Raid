/**
 * Map 1 — "Corrida da Lava" (Lava Climb).
 * A square spiral of industrial walkways bolted around a volcanic rock column.
 * 14 segments (3.5 laps) rising 4 m each, with hammers, spinners, pushers,
 * stepping stones, moving platforms and conveyors, while lava rises from below.
 */
import * as THREE from 'three';
import { LevelBase, Frame, scaleBoxUV } from './LevelBase.js';
import { Environment } from '../gfx/Environment.js';
import { Lava } from '../gfx/Lava.js';
import { mergeGeos } from '../entities/Character.js';
import { rockGeometry, mountainGeometry } from '../gfx/Rocks.js';

const SIDE = 22, SEG_LEN = 36, W = 8, RISE = 4, SEGMENTS = 14;
const YAWS = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class LavaClimb extends LevelBase {
  constructor(game) {
    super(game); this.name = 'Corrida da Lava'; this.kind = 'race'; this.qualify = 16; this.duration = 180; this.killY = -60;
    this.lavaStart = -9; this.lavaY = this.lavaStart; this.lavaSpeed = 0.24; this.lavaAccel = 0.00095; this.raceTime = 0; this.racing = false;
    this.emberT = 0; this.spawnYaw = Math.PI / 2; this.introCam = { from: new THREE.Vector3(-70, 48, -70), look: new THREE.Vector3(10, 30, 0) };
  }

  build() {
    const M = this.M;
    this.env = new Environment({ scene: this.scene, renderer: this.game.renderer, camera: this.game.camera, materials: M, settings: this.settings,
      preset: { elevation: 26, azimuth: 205, turbidity: 6, rayleigh: 2.2, mie: 0.012, mieG: 0.85, fogColor: 0xcfae98, fogDensity: 0.0036, sunColor: 0xffd9b0, sunIntensity: 5.0, envIntensity: 0.16, hemi: 0.22, hemiSky: 0xffd0b0, hemiGround: 0x4a1a08, exposure: 1.0, groundBounce: 0x6a2a10 } });
    this.lava = new Lava(this.scene, { y: this.lavaStart, intensity: 1.0 }); this.lava.setFog(0xcfae98, 0.0036); this.disposables.push(this.lava);

    this.paintOrange = M.paint('#d9532b'); this.paintBlue = M.paint('#2d6fb3'); this.paintYellow = M.paint('#e8b72a', { edgeDirt: 0.35 }); this.paintTeal = M.paint('#2a8f8a'); this.paintWhite = M.paint('#e9e4dc', { edgeDirt: 0.4 });

    this._buildWorld();
    this._buildPlaza();
    for (let i = 0; i < SEGMENTS; i++) this._buildSegment(i);
    this._buildFinish();
    this.batchStatics();
  }

  // ---------------- world / decoration ----------------
  _buildWorld() {
    const M = this.M;
    // central volcanic column
    const col = new THREE.Mesh(rockGeometry(12, 3, 9, { rough: 0.18, stretch: [1, 6.5, 1] }), M.rock); col.position.set(0, 22, 0); col.castShadow = true; col.receiveShadow = true; this.deco(col);
    // collider for the column so ragdolls bounce off it
    this.cylinder(12.5, 130, [0, 20, 0], [0, 0, 0], M.rock, { noMesh: true, segments: 8 });
    // crater walls: ring of irregular volcanic rocks + distant peaks
    const ring = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2; const r = 118 + Math.sin(i * 1.7) * 16; const h = 36 + Math.sin(i * 2.3) * 16 + Math.cos(i * 0.7) * 10;
      const g = rockGeometry(14 + Math.sin(i * 3.1) * 5, 2, i * 3 + 1, { rough: 0.4, stretch: [1.3, h / 14, 1] });
      const m = new THREE.Mesh(g, M.rock); m.position.set(Math.cos(a) * r, -22 + h * 0.15, Math.sin(a) * r); m.rotation.y = i; m.castShadow = false; m.receiveShadow = true; ring.add(m);
    }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.3; const g = mountainGeometry(55 + (i % 3) * 15, 120 + (i % 4) * 30, 50 + i); const m = new THREE.Mesh(g, M.rock); m.position.set(Math.cos(a) * 330, -30, Math.sin(a) * 330); m.rotation.y = i * 2; ring.add(m); }
    this.deco(ring);
    // scattered rock islands poking out of the lava
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.4; const r = 42 + (i * 37 % 60); const s = 3 + (i * 13 % 7);
      const g = rockGeometry(s, 2, 200 + i, { rough: 0.45 }); const m = new THREE.Mesh(g, M.rock); m.position.set(Math.cos(a) * r, -10 + s * 0.3, Math.sin(a) * r); m.rotation.set(i, i * 2, 0); m.castShadow = true; this.deco(m);
    }
    // steel support columns at the four corners going into the lava
    for (let k = 0; k < 4; k++) { const sx = k % 2 ? 1 : -1, sz = k < 2 ? -1 : 1; this.cylinder(0.6, 110, [sx * (SIDE + 4.8), 20, sz * (SIDE + 4.8)], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 12 }); }
  }

  _buildPlaza() {
    const M = this.M;
    // start plaza: big concrete slab with painted lanes, at height 0, before segment 0 (which starts at x=-18, z=-22)
    this.box([30, 1.2, 18], [-33, -0.6, -22], [0, 0, 0], M.concrete, { uv: 0.35 });
    this.box([30, 0.08, 0.6], [-33, 0.02, -31.2], [0, 0, 0], this.paintYellow, { noCollider: true });
    this.box([30, 0.08, 0.6], [-33, 0.02, -12.8], [0, 0, 0], this.paintYellow, { noCollider: true });
    // start gate
    this.cylinder(0.35, 6, [-19, 3, -31], [0, 0, 0], M.darkMetal, { noCollider: true }); this.cylinder(0.35, 6, [-19, 3, -13], [0, 0, 0], M.darkMetal, { noCollider: true });
    this.box([0.6, 1.2, 18.6], [-19, 6.3, -22], [0, 0, 0], this.paintOrange, { noCollider: true });
    // spawn grid
    this.spawns.length = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) this.spawns.push(new THREE.Vector3(-45 + r * 3.0, 0.05, -30.5 + 1.8 + c * 2.1));
    this.wp(-26, 0.2, -22, { spread: 8 });
    // plaza dressing: crates, barrels, banner, lamp posts
    const crate = (x, y, z, s, ry, mat) => this.box([s, s, s], [x, y + s / 2, z], [0, ry, 0], mat, { uv: 0.8 });
    crate(-44, 0, -29.5, 1.4, 0.3, M.wood); crate(-42.6, 0, -29.8, 1.1, 0.9, M.wood); crate(-43.5, 1.4, -29.6, 1.0, 0.5, this.paintOrange);
    crate(-41, 0, -14.2, 1.3, 0.2, M.wood); crate(-39.6, 0, -13.9, 1.3, 1.1, this.paintBlue);
    for (const [x, z] of [[-46, -27], [-46, -25.4], [-46.4, -18.6], [-45.5, -17]]) { this.cylinder(0.55, 1.3, [x, 0.65, z], [0, 0, 0], this.paintYellow, { segments: 16 }); this.cylinder(0.57, 0.08, [x, 1.0, z], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 16 }); this.cylinder(0.57, 0.08, [x, 0.3, z], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 16 }); }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 12), new THREE.MeshPhysicalMaterial({ color: 0x5a1a08, emissive: 0xff6b35, emissiveIntensity: 0.45, roughness: 0.5 })); banner.position.set(-19.4, 4.4, -22); this.deco(banner);
    for (const [x, z] of [[-46, -31.5], [-46, -12.5], [-33, -31.5], [-33, -12.5]]) { this.cylinder(0.12, 4, [x, 2, z], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 8 }); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 2.5, roughness: 0.3 })); lamp.position.set(x, 4.1, z); this.deco(lamp); }
    // pillars under plaza
    for (const [x, z] of [[-44, -30], [-44, -14], [-22, -30], [-22, -14]]) this.cylinder(0.8, 60, [x, -30, z], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 10 });
  }

  /** Local frame for segment i: origin at the segment start, local +X along the path. */
  _frame(i) {
    const side = i % 4; const h0 = i * RISE;
    const starts = [[-SIDE + 4, -SIDE], [SIDE, -SIDE + 4], [SIDE - 4, SIDE], [-SIDE, SIDE - 4]];
    const [sx, sz] = starts[side];
    return new Frame(new THREE.Vector3(sx, h0, sz), YAWS[side]);
  }

  _buildSegment(i) {
    const f = this._frame(i); const types = ['ramp', 'stairs', 'pendulums', 'stepping', 'spinners', 'movers', 'ramp', 'pendulums', 'stepping', 'conveyor', 'spinners', 'movers', 'pendulums', 'ramp'];
    const type = types[i];
    this['_seg_' + type](f, i);
    // corner landing after the segment
    const side = i % 4; const corners = [[SIDE, -SIDE], [SIDE, SIDE], [-SIDE, SIDE], [-SIDE, -SIDE]];
    const [cx, cz] = corners[side]; const h = (i + 1) * RISE;
    if (i < SEGMENTS - 1) {
      this.box([W, 0.7, W], [cx, h - 0.35, cz], [0, 0, 0], this.M.concrete, { uv: 0.4 });
      this.box([W + 0.4, 0.5, W + 0.4], [cx, h - 0.95, cz], [0, 0, 0], this.M.darkMetal, { noCollider: true });
      this.box([0.22, 0.55, W + 0.4], [cx + Math.sign(cx) * (W / 2 + 0.05), h + 0.27, cz], [0, 0, 0], this.M.darkMetal, {});
      this.box([W + 0.4, 0.55, 0.22], [cx, h + 0.27, cz + Math.sign(cz) * (W / 2 + 0.05)], [0, 0, 0], this.M.darkMetal, {});
      // painted corner marker + a lamp post
      this.cylinder(0.12, 3.2, [cx + (cx > 0 ? 3.4 : -3.4), h + 1.6, cz + (cz > 0 ? 3.4 : -3.4)], [0, 0, 0], this.M.darkMetal, { noCollider: true, segments: 8 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 2.5, roughness: 0.3 })); lamp.position.set(cx + (cx > 0 ? 3.4 : -3.4), h + 3.3, cz + (cz > 0 ? 3.4 : -3.4)); this.deco(lamp);
      this.wp(cx, h + 0.2, cz, { spread: 4, radius: 2.5 });
      // strut to column
      const dir = new THREE.Vector3(-cx, 0, -cz).normalize(); const len = Math.hypot(cx, cz) - 12;
      const strut = this.box([len, 0.5, 0.5], [cx + dir.x * len / 2, h - 1.1, cz + dir.z * len / 2], [0, Math.atan2(-dir.z, dir.x), 0], this.M.darkMetal, { noCollider: true });
    }
  }

  // ---------- shared pieces ----------
  _walkway(f, { x0 = 0, x1 = SEG_LEN, y0 = 0, y1 = RISE, width = W, mat = this.M.concrete, thick = 0.6, rails = true } = {}) {
    const L = Math.hypot(x1 - x0, y1 - y0); const ang = Math.atan2(y1 - y0, x1 - x0); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const q = f.quat(0, 0, ang);
    // the surface is at the center + thick/2 : shift down so the top is at y
    const down = new THREE.Vector3(0, -thick / 2, 0).applyQuaternion(q);
    const p = f.v3(cx, cy, 0).add(down);
    this.box([L, thick, width], [p.x, p.y, p.z], [0, 0, 0], mat, { quat: q, uv: 0.35 });
    // steel frame under the walkway + edge paint
    const under = f.v3(cx, cy, 0).add(new THREE.Vector3(0, -thick - 0.25, 0).applyQuaternion(q));
    this.box([L, 0.5, width + 0.5], [under.x, under.y, under.z], [0, 0, 0], this.M.darkMetal, { quat: q, noCollider: true, uv: 0.3 });
    if (rails) for (const s of [-1, 1]) { const e = f.v3(cx, cy, s * (width / 2 - 0.25)).add(new THREE.Vector3(0, 0.02, 0).applyQuaternion(q)); this.box([L, 0.06, 0.5], [e.x, e.y, e.z], [0, 0, 0], this.M.hazard, { quat: q, noCollider: true, uv: 0.5 }); const r = f.v3(cx, cy, s * (width / 2 + 0.05)).add(new THREE.Vector3(0, 0.3, 0).applyQuaternion(q)); this.box([L, 0.55, 0.22], [r.x, r.y, r.z], [0, 0, 0], this.M.darkMetal, { quat: q, uv: 0.5 }); }
    return { ang, q };
  }
  /** Tall safety fence (posts + bars + invisible wall) along both edges of a walkway span. */
  _fence(f, x0, x1, y0, y1, width = W, height = 3.6) {
    const L = Math.hypot(x1 - x0, y1 - y0); const ang = Math.atan2(y1 - y0, x1 - x0); const q = f.quat(0, 0, ang); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (const s of [-1, 1]) {
      const z = s * (width / 2 + 0.12);
      const w = f.v3(cx, cy, z + s * 0.4).add(new THREE.Vector3(0, height / 2, 0).applyQuaternion(q)); this.box([L, height, 0.9], [w.x, w.y, w.z], [0, 0, 0], null, { quat: q, noMesh: true });
      for (const by of [0.72, 1.32, 1.92, 2.52]) { const b = f.v3(cx, cy, z).add(new THREE.Vector3(0, by, 0).applyQuaternion(q)); this.box([L, 0.09, 0.09], [b.x, b.y, b.z], [0, 0, 0], this.M.metal, { quat: q, noCollider: true, uv: 0.5 }); }
      const postH = Math.min(height, 2.7);
      for (let x = x0 + 1; x < x1; x += 3.5) { const yy = y0 + (y1 - y0) * (x - x0) / (x1 - x0); this.box([0.12, postH, 0.12], f.pos(x, yy + postH / 2, z), f.rot(0, 0, 0), this.M.darkMetal, { noCollider: true, uv: 0.5 }); }
    }
  }
  _wps(f, xs, yFn, flags = {}) { for (const x of xs) this.wp(...f.pos(x, yFn(x) + 0.2, 0), flags); }
  _surf(x) { return (x / SEG_LEN) * RISE; }

  // ---------- segment types ----------
  _seg_ramp(f, i) {
    this._walkway(f, { mat: this.M.wood });
    // bumpers: solid cylinders with a bounce sensor shell
    for (const [x, z] of [[9, -2], [15, 2.2], [21, -1.5], [27, 1.8]]) {
      const y = this._surf(x); const p = f.pos(x, y + 0.7, z);
      const c = this.cylinder(0.75, 1.4, p, [0, 0, 0], this.paintOrange, { castShadow: true });
      const top = this.cylinder(0.78, 0.12, f.pos(x, y + 1.46, z), [0, 0, 0], this.M.darkMetal, { noCollider: true });
      this.cylinder(1.05, 1.5, p, [0, 0, 0], null, { sensor: true, noMesh: true, data: { type: 'bounce', center: new THREE.Vector3(p[0], p[1], p[2]), power: 9 } });
    }
    this._wps(f, [4, 12, 18, 24, 30, 35], (x) => this._surf(x));
  }

  _seg_stairs(f, i) {
    // visual steps + invisible ramp collider
    const n = 12; const stepL = SEG_LEN / n, stepH = RISE / n;
    for (let k = 0; k < n; k++) {
      const top = (k + 1) * stepH; const p = f.pos(k * stepL + stepL / 2, top - 0.6, 0);
      this.box([stepL, 1.2, W], p, f.rot(0, 0, 0), k % 2 ? this.M.concrete : this.M.concreteDark, { noCollider: true, uv: 0.35 });
    }
    const L = Math.hypot(SEG_LEN, RISE), ang = Math.atan2(RISE, SEG_LEN); const q = f.quat(0, 0, ang); const p = f.v3(SEG_LEN / 2, RISE / 2 + 0.05, 0).add(new THREE.Vector3(0, -0.3, 0).applyQuaternion(q));
    this.box([L, 0.6, W], [p.x, p.y, p.z], [0, 0, 0], null, { quat: q, noMesh: true }); this._fence(f, 0, SEG_LEN, 0, RISE, W, 1.3);
    const under = f.v3(SEG_LEN / 2, RISE / 2, 0).add(new THREE.Vector3(0, -1.0, 0).applyQuaternion(q)); this.box([L, 0.5, W + 0.5], [under.x, under.y, under.z], [0, 0, 0], this.M.darkMetal, { quat: q, noCollider: true });
    for (const s of [-1, 1]) { const r = f.v3(SEG_LEN / 2, RISE / 2, s * (W / 2 + 0.05)).add(new THREE.Vector3(0, 0.32, 0).applyQuaternion(q)); this.box([L, 0.55, 0.22], [r.x, r.y, r.z], [0, 0, 0], this.M.darkMetal, { quat: q, uv: 0.5 }); }
    // pushers: kinematic blocks sliding across the stairs
    for (const [x, ph] of [[11, 0], [19, 2.1], [27, 4.2]]) {
      const y = this._surf(x) + 0.9; const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 2.6), this.paintBlue); scaleBoxUV(body.geometry, [1.6, 1.6, 2.6], 0.5); body.castShadow = true; body.receiveShadow = true; g.add(body);
      const face = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.2, 0.3), this.M.hazard); face.position.z = 1.4; g.add(face); const face2 = face.clone(); face2.position.z = -1.4; g.add(face2);
      const rail = this.box([0.3, 0.3, W + 2], f.pos(x, y - 0.95, 0), f.rot(0, 0, 0), this.M.darkMetal, { noCollider: true });
      const fx = f, X = x, Y = y, PH = ph;
      const m = this.mover(g, (t) => ({ pos: fx.v3(X, Y, Math.sin(t * 0.75 + PH) * 2.6), quat: fx.quat(0, 0, 0) }));
      this.moverShape(m, 'box', [1.6, 1.6, 2.6]);
    }
    this._wps(f, [4, 10, 16, 22, 28, 34], (x) => this._surf(x), { spread: 3 });
  }

  _seg_pendulums(f, i, fast = false) {
    this._walkway(f); this._fence(f, 0, SEG_LEN, 0, RISE);
    const xs = [8, 18, 28];
    xs.forEach((x, k) => {
      const ys = this._surf(x); const pivotY = ys + 7.2; const arm = 5.4; const w = 1.35 + (fast ? 0.25 : 0) + k * 0.05;
      // A-frame
      for (const s of [-1, 1]) {
        const top = f.v3(x, pivotY + 0.3, 0); const base = f.v3(x + s * 2.6, ys - 0.3, s * 0 + 5.2);
        for (const zz of [-5.2, 5.2]) { const b = f.v3(x + s * 2.6, ys - 0.3, zz); const mid = b.clone().lerp(top, 0.5); const len = b.distanceTo(top); const dir = top.clone().sub(b).normalize(); const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); this.cylinder(0.22, len, [mid.x, mid.y, mid.z], [0, 0, 0], this.M.darkMetal, { quat: qq, noCollider: true, segments: 10 }); }
      }
      const axle = f.v3(x, pivotY, 0); this.cylinder(0.3, 12, [axle.x, axle.y, axle.z], [0, 0, 0], this.M.metal, { quat: f.quat(Math.PI / 2, 0, 0), noCollider: true, segments: 12 });
      // hammer group: arm + head, pivot at origin
      const g = new THREE.Group();
      const armM = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, arm, 12), this.M.darkMetal); armM.position.y = -arm / 2; armM.castShadow = true; g.add(armM);
      const headG = new THREE.BoxGeometry(1.6, 2.2, 2.4); scaleBoxUV(headG, [1.6, 2.2, 2.4], 0.6); const head = new THREE.Mesh(headG, this.M.hazard); head.position.y = -arm - 1.0; head.castShadow = true; head.receiveShadow = true; g.add(head);
      const capA = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.6), this.M.darkMetal); capA.position.y = -arm - 2.1; g.add(capA); const capB = capA.clone(); capB.position.y = -arm + 0.1; g.add(capB);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 16), this.M.darkMetal); hub.rotation.z = Math.PI / 2; g.add(hub);
      const phase = k * 1.9 + i; const fx = f, X = x, PY = pivotY, A = 1.15;
      const m = this.mover(g, (t) => ({ pos: fx.v3(X, PY, 0), quat: fx.quat(Math.sin(t * w + phase) * A, 0, 0) }), { data: { type: 'platform' } });
      this.moverShape(m, 'box', [2.0, 2.6, 2.8], [0, -arm - 1.0, 0], [0, 0, 0], { sensor: true, data: { type: 'hazard', mul: 0.9, up: 3.5, push: 1.5, max: 12, metal: true } });
    });
    this._wps(f, [3, 8, 13, 18, 23, 28, 33], (x) => this._surf(x), { spread: 5 });
  }

  _seg_stepping(f, i) {
    const n = 5; const len = 4.4, gap = (SEG_LEN - n * len) / (n - 1);
    for (let k = 0; k < n; k++) {
      const x = k * (len + gap) + len / 2; const y = k * (RISE / (n - 1));
      const p = f.pos(x, y - 0.3, 0);
      this.box([len, 0.6, 5.2], p, f.rot(0, 0, 0), this.paintOrange, { uv: 0.4 });
      this.box([len + 0.3, 0.3, 5.5], f.pos(x, y - 0.75, 0), f.rot(0, 0, 0), this.M.darkMetal, { noCollider: true });
      this.box([len - 0.4, 0.05, 4.8], f.pos(x, y + 0.02, 0), f.rot(0, 0, 0), this.M.rubber, { noCollider: true, uv: 0.8 });
      // hanging cable to a beam above
      for (const sz of [-2.2, 2.2]) this.cylinder(0.05, 9, f.pos(x, y + 4.5, sz), [0, 0, 0], this.M.darkMetal, { noCollider: true, segments: 6 });
      this.wp(...f.pos(x, y + 0.2, 0), { spread: 2.5, radius: 1.5 });
    }
    const beam = f.v3(SEG_LEN / 2, RISE / 2 + 9, 0); this.box([SEG_LEN + 2, 0.5, 0.6], [beam.x, beam.y, beam.z], f.rot(0, 0, Math.atan2(RISE, SEG_LEN)), this.M.darkMetal, { noCollider: true });
  }

  _seg_spinners(f, i) {
    this._walkway(f); this._fence(f, 0, SEG_LEN, 0, RISE);
    for (const [x, dir] of [[11, 1], [25, -1]]) {
      const ys = this._surf(x); const g = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.6, 20), this.M.hazard); hub.castShadow = true; g.add(hub);
      const barG = new THREE.BoxGeometry(9.5, 0.5, 0.5); scaleBoxUV(barG, [9.5, 0.5, 0.5], 0.5); const bar = new THREE.Mesh(barG, this.M.metal); bar.position.y = 0.25; bar.castShadow = true; g.add(bar);
      for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), this.paintOrange); tip.position.set(s * 4.9, 0.25, 0); tip.castShadow = true; g.add(tip); }
      this.cylinder(0.5, 2.5, f.pos(x, ys - 1.2, 0), [0, 0, 0], this.M.darkMetal, { noCollider: true });
      const fx = f, X = x, Y = ys + 0.95, D = dir, w = 1.5 + i * 0.03;
      const m = this.mover(g, (t) => ({ pos: fx.v3(X, Y, 0), quat: fx.quat(0, t * w * D, 0) }));
      this.moverShape(m, 'box', [9.8, 0.9, 0.9], [0, 0.25, 0], [0, 0, 0], { sensor: true, data: { type: 'hazard', mul: 0.9, up: 4, push: 2, max: 11, metal: true } });
      this.moverShape(m, 'cylinder', [1.0, 1.6]);
    }
    this._wps(f, [3, 7], (x) => this._surf(x), { spread: 4 });
    this.wp(...f.pos(9.3, this._surf(9.3) + 0.2, 0), { jump: true, jumpDist: 1.6, spread: 3 });
    this.wp(...f.pos(13, this._surf(13) + 0.2, 0), { spread: 3 });
    this._wps(f, [18, 21], (x) => this._surf(x), { spread: 4 });
    this.wp(...f.pos(23.3, this._surf(23.3) + 0.2, 0), { jump: true, jumpDist: 1.6, spread: 3 });
    this.wp(...f.pos(27, this._surf(27) + 0.2, 0), { spread: 3 });
    this._wps(f, [32, 35.5], (x) => this._surf(x), { spread: 4 });
  }

  _seg_movers(f, i) {
    this._walkway(f, { x0: 0, x1: 8, y0: 0, y1: this._surf(8) });
    this._walkway(f, { x0: 28, x1: SEG_LEN, y0: this._surf(28), y1: RISE });
    // rails for the platforms
    for (const s of [-1, 1]) { const r = f.v3(18, this._surf(18) - 1.0, s * 3.2); this.box([22, 0.3, 0.3], [r.x, r.y, r.z], f.rot(0, 0, Math.atan2(RISE, SEG_LEN)), this.M.darkMetal, { noCollider: true }); }
    const mk = (xa, xb, phase) => {
      const g = new THREE.Group();
      const geo = new THREE.BoxGeometry(4.2, 0.6, 5.4); scaleBoxUV(geo, [4.2, 0.6, 5.4], 0.4); const m0 = new THREE.Mesh(geo, this.paintBlue); m0.castShadow = true; m0.receiveShadow = true; g.add(m0);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.05, 5.0), this.M.rubber); top.position.y = 0.32; top.receiveShadow = true; g.add(top);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 5.7), this.M.darkMetal); frame.position.y = -0.4; g.add(frame);
      const fx = f, surf = (x) => this._surf(x);
      const m = this.mover(g, (t) => { const x = xa + (xb - xa) * (0.5 + 0.5 * Math.sin(t * 1.1 + phase)); return { pos: fx.v3(x, surf(x) - 0.3, 0), quat: fx.quat(0, 0, 0) }; });
      this.moverShape(m, 'box', [4.2, 0.6, 5.4]);
    };
    mk(10.5, 16, 0); mk(20, 25.5, Math.PI);
    this.wp(...f.pos(4, this._surf(4) + 0.2, 0), { spread: 3 });
    this.wp(...f.pos(7.5, this._surf(7.5) + 0.2, 0), { spread: 2, slow: true });
    this.wp(...f.pos(13, this._surf(13) + 0.2, 0), { spread: 2, radius: 2.5, slow: true });
    this.wp(...f.pos(23, this._surf(23) + 0.2, 0), { spread: 2, radius: 2.5, slow: true });
    this.wp(...f.pos(30, this._surf(30) + 0.2, 0), { spread: 3 });
    this.wp(...f.pos(35, this._surf(35) + 0.2, 0), { spread: 4 });
  }

  _seg_conveyor(f, i) {
    this._walkway(f, { rails: false }); this._fence(f, 0, SEG_LEN, 0, RISE, W, 1.3);
    const ang = Math.atan2(RISE, SEG_LEN);
    // belts: alternate backward and sideways
    const belts = [[4, 'back'], [11, 'side+'], [18, 'back'], [25, 'side-'], [32, 'back']];
    const beltMat = this.beltMat = this.ownMaterial(this.M.rubber, (m) => m.map.repeat.set(2, 2));
    const beltMatS = this.beltMatS = this.ownMaterial(this.M.rubber, (m) => m.map.repeat.set(2, 2));
    for (const [x, kind] of belts) {
      const y = this._surf(x); const q = f.quat(0, 0, ang);
      const p = f.v3(x, y + 0.12, 0);
      const vel = kind === 'back' ? f.vec(-4.5, 0, 0) : f.vec(0, 0, kind === 'side+' ? 3.4 : -3.4);
      this.box([5.6, 0.25, W - 0.6], [p.x, p.y, p.z], [0, 0, 0], kind === 'back' ? beltMat : beltMatS, { quat: q, data: { type: 'conveyor', conveyor: vel }, uv: 0.5 });
      // rollers at both ends
      for (const s of [-1, 1]) { const r = f.v3(x + s * 2.8, y + 0.12, 0); this.cylinder(0.2, W - 0.4, [r.x, r.y, r.z], [0, 0, 0], this.M.metal, { quat: f.quat(Math.PI / 2, 0, 0), noCollider: true, segments: 12 }); }
      // arrows (painted) to show direction
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 3), this.paintYellow); const ap = f.v3(x, y + 0.27, 0); arrow.position.copy(ap); arrow.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))); 
      if (kind === 'back') arrow.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))); else if (kind === 'side-') arrow.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)));
      arrow.scale.set(1, 1, 0.1); this.deco(arrow);
    }
    this._wps(f, [2, 7, 14, 21, 28, 35], (x) => this._surf(x), { spread: 3 });
  }

  _buildFinish() {
    const M = this.M; const h = SEGMENTS * RISE; const cx = SIDE, cz = SIDE;
    this.box([14, 0.8, 14], [cx, h - 0.4, cz], [0, 0, 0], this.paintWhite, { uv: 0.35 });
    this.box([14.5, 0.5, 14.5], [cx, h - 1.05, cz], [0, 0, 0], M.darkMetal, { noCollider: true });
    this.box([13.5, 0.04, 2.2], [cx, h + 0.02, cz], [0, 0, 0], M.hazard, { noCollider: true, uv: 0.5 });
    // arch
    for (const s of [-1, 1]) this.cylinder(0.4, 7, [cx + s * 6.2, h + 3.5, cz], [0, 0, 0], M.metal, { noCollider: true });
    this.box([13.5, 1.4, 1.0], [cx, h + 7.2, cz], [0, 0, 0], this.paintOrange, { noCollider: true });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 0.9, 0.2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffd23f, emissiveIntensity: 3.5, roughness: 0.4 })); sign.position.set(cx, h + 7.2, cz + 0.6); this.deco(sign);
    this.sensorBox([13, 6, 3], [cx, h + 3, cz], { type: 'finish' });
    // trophy
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 1.0, 20), M.gold); cup.position.set(cx, h + 1.5, cz + 4.5); cup.castShadow = true; this.deco(cup);
    this.cylinder(0.5, 1.0, [cx, h + 0.5, cz + 4.5], [0, 0, 0], M.darkMetal, {});
    this.wp(cx, h + 0.2, cz - 3, { spread: 4, radius: 2.5 }); this.wp(cx, h + 0.2, cz + 2, { spread: 4, radius: 3, noSpread: true });
  }

  // ---------------- runtime ----------------
  startRace() { this.racing = true; this.raceTime = 0; }
  preStep(dt, time) {
    super.preStep(dt, time);
    if (this.racing) { this.raceTime += dt; const t = this.raceTime; this.lavaY = Math.min(SEGMENTS * RISE - 3, this.lavaStart + this.lavaSpeed * t + this.lavaAccel * t * t); }
    this.lava.y = this.lavaY;
  }
  postStep(chars) {
    super.postStep(chars);
    for (const ch of chars) { if (!ch.eliminated && !ch.finished && ch.pos.y < this.lavaY + 0.15) ch.eliminate('lava'); }
  }
  update(dt, time, camPos, playerPos) {
    super.update(dt, time, camPos, playerPos);
    this.lava.update(dt, time, camPos, playerPos);
    if (this.beltMat) { this.beltMat.map.offset.x -= dt * 0.9; this.beltMatS.map.offset.y -= dt * 0.7; }
    // embers & smoke rising around the player
    const P = this.game.particles; if (!P) return;
    this.emberT += dt * 60 * P.density;
    while (this.emberT > 1) {
      this.emberT -= 1; const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 30;
      const p = { x: playerPos.x + Math.cos(a) * r, y: this.lavaY + 0.3, z: playerPos.z + Math.sin(a) * r };
      if (Math.random() < 0.85) P.ember(p, { x: (Math.random() - 0.5) * 1.5, y: 1.5 + Math.random() * 2.5, z: (Math.random() - 0.5) * 1.5 }); else P.smoke(p, { x: 0, y: 1.2 + Math.random(), z: 0 }, 3 + Math.random() * 3);
    }
  }
  /** 0..1 lava danger for HUD/camera: how close the lava is below the player. */
  lavaDanger(playerY) { const d = playerY - this.lavaY; return THREE.MathUtils.clamp(1 - d / 12, 0, 1); }
}

function scaleCylUV(geo, r, h, tile) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r * tile, uv.getY(i) * h * tile); uv.needsUpdate = true; }
function scaleConeUV(geo, tile) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 20, uv.getY(i) * 20); uv.needsUpdate = true; }
