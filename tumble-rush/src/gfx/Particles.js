/**
 * CPU-simulated particle pools rendered as THREE.Points with a custom shader
 * (per-particle size, color, alpha, rotation). Two pools: soft (dust, sparks,
 * embers, trails) and square (confetti).
 */
import * as THREE from 'three';
import { softSprite, squareSprite, toTexture } from './Textures.js';

const VS = `
attribute float aSize; attribute vec4 aColor; attribute float aRot;
varying vec4 vColor; varying float vRot;
void main(){ vColor = aColor; vRot = aRot; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(1.0, -mv.z); }
`;
const FS = `
uniform sampler2D uMap; varying vec4 vColor; varying float vRot;
void main(){ vec2 uv = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); uv = vec2(c*uv.x - s*uv.y, s*uv.x + c*uv.y) + 0.5; vec4 t = texture2D(uMap, uv); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.01) discard; }
`;

class Pool {
  constructor(scene, count, tex, { additive = false, scaleMul = 1 } = {}) {
    this.count = count; this.scene = scene; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3); this.size = new Float32Array(count); this.col = new Float32Array(count * 4); this.rot = new Float32Array(count);
    this.vel = new Float32Array(count * 3); this.life = new Float32Array(count); this.maxLife = new Float32Array(count); this.grav = new Float32Array(count); this.drag = new Float32Array(count); this.rotV = new Float32Array(count); this.size0 = new Float32Array(count); this.fade = new Uint8Array(count); this.col0 = new Float32Array(count * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({ uniforms: { uMap: { value: tex }, uScale: { value: 300 * scaleMul } }, vertexShader: 'uniform float uScale;' + VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 10; scene.add(this.points);
    this.geo = g; this.mat = m;
    g.setDrawRange(0, 0);
  }
  emit(p, v, { life = 1, size = 1, color = [1, 1, 1, 1], gravity = 0, drag = 0, rot = 0, rotV = 0, fade = 1, color1 = null }) {
    let i;
    if (this.n < this.count) i = this.n++; else { i = Math.floor(Math.random() * this.count); }
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.size0[i] = size; this.grav[i] = gravity; this.drag[i] = drag; this.rot[i] = rot; this.rotV[i] = rotV; this.fade[i] = fade;
    this.col[i * 4] = color[0]; this.col[i * 4 + 1] = color[1]; this.col[i * 4 + 2] = color[2]; this.col[i * 4 + 3] = color[3];
    const c1 = color1 || color; this.col0[i * 4] = c1[0]; this.col0[i * 4 + 1] = c1[1]; this.col0[i * 4 + 2] = c1[2]; this.col0[i * 4 + 3] = c1[3];
  }
  update(dt) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // swap-remove
        n--; if (i !== n) { this._copy(n, i); i--; } continue;
      }
      const k = this.life[i] / this.maxLife[i]; const d = 1 - this.drag[i] * dt;
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.rot[i] += this.rotV[i] * dt;
      const f = this.fade[i] === 1 ? k : this.fade[i] === 2 ? Math.sin(k * Math.PI) : 1;
      this.col[i * 4 + 3] = this.col0[i * 4 + 3] * f; this.size[i] = this.size0[i] * (this.fade[i] === 3 ? (1 + (1 - k) * 2) : (0.6 + 0.4 * f));
      if (this.fade[i] === 3) this.col[i * 4 + 3] = this.col0[i * 4 + 3] * k * 0.6;
    }
    this.n = n; this.geo.setDrawRange(0, n);
    for (const a of ['position', 'aSize', 'aColor', 'aRot']) this.geo.attributes[a].needsUpdate = true;
  }
  _copy(from, to) {
    for (let c = 0; c < 3; c++) { this.pos[to * 3 + c] = this.pos[from * 3 + c]; this.vel[to * 3 + c] = this.vel[from * 3 + c]; }
    for (let c = 0; c < 4; c++) { this.col[to * 4 + c] = this.col[from * 4 + c]; this.col0[to * 4 + c] = this.col0[from * 4 + c]; }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from]; this.size[to] = this.size[from]; this.size0[to] = this.size0[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.rot[to] = this.rot[from]; this.rotV[to] = this.rotV[from]; this.fade[to] = this.fade[from];
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
  dispose() { this.scene.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

export class Particles {
  constructor(scene, density = 1) {
    this.density = density;
    this.soft = new Pool(scene, Math.floor(3000 * Math.max(0.3, density)), toTexture(softSprite(64), { wrap: false }), { additive: false });
    this.glow = new Pool(scene, Math.floor(2500 * Math.max(0.3, density)), toTexture(softSprite(64, 0.15), { wrap: false }), { additive: true });
    this.square = new Pool(scene, 1200, toTexture(squareSprite(32), { wrap: false }), { additive: false, scaleMul: 0.6 });
    this.tmp = new THREE.Vector3();
  }
  _r(a) { return (Math.random() - 0.5) * 2 * a; }
  dust(p, strength = 1) {
    const n = Math.round(10 * strength * this.density);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const s = 1 + Math.random() * 2.5 * strength;
      this.soft.emit({ x: p.x, y: p.y + 0.1, z: p.z }, { x: Math.cos(a) * s, y: 0.6 + Math.random() * 1.2, z: Math.sin(a) * s }, { life: 0.5 + Math.random() * 0.5, size: 0.5 + Math.random() * 0.5, color: [0.78, 0.72, 0.64, 0.45], gravity: 0.6, drag: 2.5, fade: 3, rot: Math.random() * 6, rotV: this._r(2) });
    }
  }
  sparks(p, n = 14) {
    n = Math.round(n * this.density);
    for (let i = 0; i < n; i++) {
      const v = { x: this._r(6), y: 2 + Math.random() * 6, z: this._r(6) };
      this.glow.emit(p, v, { life: 0.3 + Math.random() * 0.5, size: 0.12 + Math.random() * 0.12, color: [1, 0.85, 0.45, 1], gravity: 18, drag: 0.5, fade: 1 });
    }
  }
  confetti(p, n = 80) {
    const cols = [[1, 0.3, 0.3, 1], [1, 0.85, 0.2, 1], [0.3, 0.8, 1, 1], [0.5, 1, 0.5, 1], [1, 0.5, 1, 1], [1, 1, 1, 1]];
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      this.square.emit(p, { x: this._r(7), y: 4 + Math.random() * 9, z: this._r(7) }, { life: 2 + Math.random() * 1.5, size: 0.18 + Math.random() * 0.1, color: c, gravity: 6, drag: 1.6, rot: Math.random() * 6, rotV: this._r(10), fade: 1 });
    }
  }
  ember(p, v) { this.glow.emit(p, v, { life: 1.5 + Math.random() * 2.5, size: 0.08 + Math.random() * 0.14, color: [1, 0.55, 0.15, 0.9], color1: [1, 0.3, 0.05, 0.9], gravity: -0.8, drag: 0.3, fade: 2 }); }
  lavaBurst(p) {
    for (let i = 0; i < 40 * this.density; i++) this.glow.emit(p, { x: this._r(5), y: 3 + Math.random() * 8, z: this._r(5) }, { life: 0.6 + Math.random() * 0.8, size: 0.15 + Math.random() * 0.3, color: [1, 0.5, 0.1, 1], gravity: 14, drag: 0.8, fade: 1 });
    for (let i = 0; i < 16 * this.density; i++) this.soft.emit(p, { x: this._r(3), y: 1 + Math.random() * 3, z: this._r(3) }, { life: 1 + Math.random(), size: 1 + Math.random() * 1.5, color: [0.2, 0.18, 0.16, 0.6], gravity: -0.5, drag: 1.5, fade: 3 });
  }
  trail(p, v) { this.soft.emit(p, { x: v.x * 0.1 + this._r(0.3), y: 0.3, z: v.z * 0.1 + this._r(0.3) }, { life: 0.35, size: 0.4, color: [1, 1, 1, 0.25], drag: 3, fade: 3 }); }
  smoke(p, v, size = 1) { this.soft.emit(p, v, { life: 2 + Math.random() * 2, size, color: [0.25, 0.22, 0.2, 0.35], gravity: -0.6, drag: 0.6, fade: 3, rot: Math.random() * 6, rotV: this._r(0.6) }); }
  update(dt) { this.soft.update(dt); this.glow.update(dt); this.square.update(dt); }
  clear() { this.soft.clear(); this.glow.clear(); this.square.clear(); }
  dispose() { this.soft.dispose(); this.glow.dispose(); this.square.dispose(); }
}
