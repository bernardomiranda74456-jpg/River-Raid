// Moedas (InstancedMesh com giro no shader) e power-ups (pool de meshes).
import * as THREE from 'three';
import { Pool } from './utils.js';
import { mergeGeoms, box, cyl } from './geom.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _zero = new THREE.Vector3(0, 0, 0);
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);

export const PU = { MAGNET: 'magnet', JETPACK: 'jetpack', SNEAKERS: 'sneakers', MULTIPLIER: 'multiplier', HOVERBOARD: 'hoverboard', KEY: 'key' };

export class Coins {
  constructor(scene, M, capacity = 1500) {
    this.capacity = capacity;
    const geo = mergeGeoms([
      cyl(0.42, 0.42, 0.09, 24), new THREE.TorusGeometry(0.4, 0.05, 8, 24).rotateX(Math.PI / 2),
      cyl(0.2, 0.2, 0.11, 6),
    ]);
    geo.rotateX(Math.PI / 2); // deitada no plano XY (face para o jogador), gira em Y no shader
    this.mesh = new THREE.InstancedMesh(geo, M.coin, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.x = new Float32Array(capacity); this.y = new Float32Array(capacity); this.z = new Float32Array(capacity);
    this.active = new Uint8Array(capacity);
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) { this.free.push(i); this.mesh.setMatrixAt(i, _hide); }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = capacity;
  }
  add(x, y, z) {
    if (!this.free.length) return -1;
    const i = this.free.pop();
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.active[i] = 1;
    _m.makeTranslation(x, y, z);
    this.mesh.setMatrixAt(i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
    return i;
  }
  remove(i) {
    if (i < 0 || !this.active[i]) return;
    this.active[i] = 0;
    this.mesh.setMatrixAt(i, _hide);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.free.push(i);
  }
  move(i, x, y, z) {
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    _m.makeTranslation(x, y, z);
    this.mesh.setMatrixAt(i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  shift(dz) {
    for (let i = 0; i < this.capacity; i++) {
      if (!this.active[i]) continue;
      this.z[i] += dz;
      _m.makeTranslation(this.x[i], this.y[i], this.z[i]);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* --------------------------------------------------------- power-ups */
function buildPowerup(kind, M) {
  const g = new THREE.Group();
  let m;
  switch (kind) {
    case PU.MAGNET: {
      m = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.13, 10, 24, Math.PI), M.magnetRed);
      m.rotation.z = Math.PI; g.add(m);
      for (const x of [-0.36, 0.36]) { const t = new THREE.Mesh(box(0.26, 0.22, 0.26), M.magnet); t.position.set(x, 0.1, 0); g.add(t); }
      break;
    }
    case PU.JETPACK: {
      for (const x of [-0.22, 0.22]) {
        const c = new THREE.Mesh(cyl(0.16, 0.16, 0.7, 14), M.jet); c.position.set(x, 0, 0); g.add(c);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8), M.jet); cap.position.set(x, 0.35, 0); g.add(cap);
        const n = new THREE.Mesh(cyl(0.08, 0.13, 0.18, 10), M.steelDark); n.position.set(x, -0.44, 0); g.add(n);
      }
      const strap = new THREE.Mesh(box(0.7, 0.12, 0.08), M.rubber); strap.position.set(0, 0.1, -0.16); g.add(strap);
      break;
    }
    case PU.SNEAKERS: {
      const sole = new THREE.Mesh(box(0.34, 0.12, 0.7), M.coneStripe); sole.position.set(0, 0.05, 0); g.add(sole);
      const upper = new THREE.Mesh(box(0.32, 0.22, 0.5), M.sneaker); upper.position.set(0, 0.22, -0.06); g.add(upper);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), M.sneaker); toe.position.set(0, 0.17, 0.26); toe.scale.set(1, 0.8, 1); g.add(toe);
      const spring = new THREE.Mesh(mergeGeoms([0, 1, 2, 3].map((i) => new THREE.TorusGeometry(0.13, 0.03, 6, 16).rotateX(Math.PI / 2).translate(0, -0.08 - i * 0.07, 0))), M.steelLight);
      g.add(spring);
      break;
    }
    case PU.MULTIPLIER: {
      m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), M.multi); g.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 32), M.steelLight); ring.rotation.x = Math.PI / 2; g.add(ring);
      break;
    }
    case PU.HOVERBOARD: {
      m = new THREE.Mesh(box(0.5, 0.08, 1.2), M.board); g.add(m);
      const u = new THREE.Mesh(box(0.42, 0.04, 1.1), M.headlight); u.position.y = -0.06; g.add(u);
      break;
    }
    case PU.KEY: {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), M.key); ring.position.y = 0.25; g.add(ring);
      const shaft = new THREE.Mesh(box(0.1, 0.5, 0.06), M.key); shaft.position.y = -0.1; g.add(shaft);
      const t1 = new THREE.Mesh(box(0.16, 0.08, 0.06), M.key); t1.position.set(0.1, -0.3, 0); g.add(t1);
      const t2 = new THREE.Mesh(box(0.12, 0.08, 0.06), M.key); t2.position.set(0.08, -0.16, 0); g.add(t2);
      break;
    }
    default: break;
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), M.powerGlow);
  g.add(glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.kind = kind;
  return g;
}

export class Powerups {
  constructor(scene, M) {
    this.scene = scene;
    this.pools = {};
    for (const k of Object.values(PU)) {
      this.pools[k] = new Pool(() => { const g = buildPowerup(k, M); g.visible = false; scene.add(g); return g; }, (g) => { g.visible = true; });
      this.pools[k].warm(k === PU.KEY ? 2 : 3);
    }
    this.records = [];       // registros ativos {kind, mesh, x, y, z, chunk}
    this.recPool = new Pool(() => ({ kind: '', mesh: null, x: 0, y: 0, z: 0, chunk: null, t: 0 }));
    this.recPool.warm(24);
  }
  add(kind, x, y, z, chunk) {
    const rec = this.recPool.acquire();
    rec.kind = kind; rec.x = x; rec.y = y; rec.z = z; rec.chunk = chunk; rec.t = Math.random() * 6;
    rec.mesh = this.pools[kind].acquire();
    rec.mesh.position.set(x, y, z);
    this.records.push(rec);
    return rec;
  }
  remove(rec) {
    const i = this.records.indexOf(rec);
    if (i < 0) return;
    this.records[i] = this.records[this.records.length - 1];
    this.records.pop();
    rec.mesh.visible = false;
    this.pools[rec.kind].release(rec.mesh);
    rec.mesh = null;
    this.recPool.release(rec);
  }
  releaseChunk(chunk) {
    for (let i = this.records.length - 1; i >= 0; i--) if (this.records[i].chunk === chunk) this.remove(this.records[i]);
  }
  update(dt) {
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      r.t += dt;
      r.mesh.position.set(r.x, r.y + Math.sin(r.t * 2.5) * 0.15, r.z);
      r.mesh.rotation.y = r.t * 1.8;
    }
  }
  shift(dz) { for (const r of this.records) { r.z += dz; r.mesh.position.z += dz; } }
  clear() { for (let i = this.records.length - 1; i >= 0; i--) this.remove(this.records[i]); }
}
