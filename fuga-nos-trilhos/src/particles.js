// Partículas: sistema CPU (Points + shader) para faíscas, poeira/folhas,
// brilho de moedas, chama/fumaça do jato, vapor/fumaça e respingos; e chuva
// 100% na GPU (animação no vertex shader, sem custo de CPU).
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aLife;
  attribute vec3 aColor;
  attribute float aRot;
  varying float vLife;
  varying vec3 vColor;
  varying float vFog;
  varying float vRot;
  varying float vNear;
  uniform float uScale;
  uniform float uFogNear;
  uniform float uFogFar;
  void main() {
    vLife = aLife; vColor = aColor; vRot = aRot;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uScale / max(0.5, -mv.z), 160.0);
    vFog = smoothstep(uFogNear, uFogFar, -mv.z);
    vNear = smoothstep(0.6, 2.5, -mv.z);
  }
`;
const FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uFogColor;
  uniform float uAdditive;
  uniform float uLight;
  varying float vLife;
  varying vec3 vColor;
  varying float vFog;
  varying float vRot;
  varying float vNear;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    uv = mat2(c, -s, s, c) * uv + 0.5;
    vec4 t = texture2D(uMap, uv);
    float a = t.a * smoothstep(0.0, 0.12, vLife) * smoothstep(1.0, 0.55, vLife);
    vec3 col = vColor * t.rgb * (uAdditive > 0.5 ? 1.0 : uLight);
    col = mix(col, uAdditive > 0.5 ? vec3(0.0) : uFogColor, vFog);
    gl_FragColor = vec4(col, a * (1.0 - vFog * 0.5) * vNear);
  }
`;

export class ParticleSystem {
  constructor(scene, map, capacity, { additive = false, gravity = 0, drag = 0, scale = 300, sizeGrow = 0, depthWrite = false } = {}) {
    this.cap = capacity; this.n = 0;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.sizeV = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 3);
    this.lifeAttr = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    this.rotV = new Float32Array(capacity);
    this.gravity = gravity; this.drag = drag; this.sizeGrow = sizeGrow;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.lifeAttr, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uMap: { value: map }, uScale: { value: scale }, uFogNear: { value: 100 }, uFogFar: { value: 500 }, uFogColor: { value: new THREE.Color() }, uAdditive: { value: additive ? 1 : 0 }, uLight: { value: 1 } },
      transparent: true, depthWrite, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b, rotV = 0, sizeV = 0) {
    let i;
    if (this.n < this.cap) i = this.n++;
    else i = Math.floor(Math.random() * this.cap); // recicla aleatoriamente se cheio
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.sizeV[i] = sizeV;
    this.color[i * 3] = r; this.color[i * 3 + 1] = g; this.color[i * 3 + 2] = b;
    this.rot[i] = Math.random() * 6.28; this.rotV[i] = rotV;
    this.lifeAttr[i] = 1;
  }
  update(dt, fog, light = 1) {
    this.mat.uniforms.uLight.value = light;
    const n = this.n;
    const g = this.gravity * dt, drag = Math.max(0, 1 - this.drag * dt);
    for (let i = 0; i < this.n;) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // swap-remove
        const last = --this.n;
        if (i !== last) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[last * 3 + k]; this.vel[i * 3 + k] = this.vel[last * 3 + k]; this.color[i * 3 + k] = this.color[last * 3 + k]; }
          this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last]; this.size[i] = this.size[last]; this.sizeV[i] = this.sizeV[last];
          this.rot[i] = this.rot[last]; this.rotV[i] = this.rotV[last];
        }
        continue;
      }
      this.vel[i * 3 + 1] -= g;
      this.vel[i * 3] *= drag; this.vel[i * 3 + 1] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += (this.sizeGrow + this.sizeV[i]) * dt;
      this.rot[i] += this.rotV[i] * dt;
      this.lifeAttr[i] = this.life[i] / this.maxLife[i];
      i++;
    }
    const _ = n;
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aSize', 'aLife', 'aColor', 'aRot']) this.geo.attributes[k].needsUpdate = true;
    if (fog) { this.mat.uniforms.uFogNear.value = fog.near; this.mat.uniforms.uFogFar.value = fog.far; this.mat.uniforms.uFogColor.value.copy(fog.color); }
  }
  shift(dz) { for (let i = 0; i < this.n; i++) this.pos[i * 3 + 2] += dz; }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

/* ------------------------------------------------------------- chuva */
const RAIN_VERT = /* glsl */`
  attribute float aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform float uSpeed;
  uniform float uScale;
  varying float vA;
  void main() {
    vec3 p = position;
    float fall = uTime * uSpeed * (0.8 + aSeed * 0.4);
    p.y = mod(p.y - fall, uBox.y);
    p.x = mod(p.x + uTime * 1.5 * aSeed, uBox.x);
    p.z = mod(p.z, uBox.z);
    p += uCenter - uBox * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(uScale / max(1.0, -mv.z), 34.0);
    vA = smoothstep(45.0, 6.0, -mv.z) * smoothstep(0.8, 2.5, -mv.z) * 0.42;
  }
`;
const RAIN_FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying float vA;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vec3(0.8, 0.85, 0.95), t.a * vA);
  }
`;
export class Rain {
  constructor(scene, map, count) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    const box = new THREE.Vector3(36, 22, 50);
    for (let i = 0; i < count; i++) { pos[i * 3] = Math.random() * box.x; pos[i * 3 + 1] = Math.random() * box.y; pos[i * 3 + 2] = Math.random() * box.z; seed[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG,
      uniforms: { uMap: { value: map }, uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: box }, uSpeed: { value: 22 }, uScale: { value: 220 } },
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.visible = false;
    scene.add(this.points);
    this.count = count;
  }
  update(dt, center, amount, speed) {
    this.points.visible = amount > 0.02;
    if (!this.points.visible) return;
    this.mat.uniforms.uTime.value += dt;
    this.mat.uniforms.uCenter.value.set(center.x, center.y + 4, center.z + 12);
    this.mat.uniforms.uBox.value.z = 50;
    this.mat.uniforms.uSpeed.value = 22;
    this.mat.uniforms.uScale.value = 220 * (0.6 + amount * 0.4);
    // a chuva "inclina" com a velocidade: deslocamos a caixa para frente
    this.mat.uniforms.uCenter.value.z += speed * 0.1;
  }
}

/** Gerencia todos os emissores do jogo. */
export class Effects {
  constructor(scene, M, preset) {
    const S = M.sprites;
    const q = preset.particles;
    this.q = q;
    this.sparks = new ParticleSystem(scene, S.spark, Math.round(500 * q), { additive: true, gravity: 14, drag: 1.5, scale: 110 });
    this.dust = new ParticleSystem(scene, S.smoke, Math.round(300 * q), { gravity: -0.3, drag: 1.2, scale: 260, sizeGrow: 1.2 });
    this.leaves = new ParticleSystem(scene, S.leaf, Math.round(120 * q), { gravity: 2.5, drag: 0.8, scale: 160 });
    this.glow = new ParticleSystem(scene, S.soft, Math.round(400 * q), { additive: true, gravity: -1, drag: 2, scale: 180 });
    this.flame = new ParticleSystem(scene, S.soft, Math.round(400 * q), { additive: true, gravity: -4, drag: 3, scale: 260, sizeGrow: -0.8 });
    this.smoke = new ParticleSystem(scene, S.smoke, Math.round(500 * q), { gravity: -0.8, drag: 0.4, scale: 420, sizeGrow: 0.7 });
    this.splash = new ParticleSystem(scene, S.ring, Math.round(250 * q), { gravity: 0, drag: 0, scale: 140, sizeGrow: 2.5 });
    this.rain = new Rain(scene, S.streak, Math.round(2600 * preset.rain));
    this.systems = [this.sparks, this.dust, this.leaves, this.glow, this.flame, this.smoke, this.splash];
    this.acc = { dust: 0, leaf: 0, flame: 0, splash: 0, smoke: 0, steam: 0 };
  }
  update(dt, fog, light = 1) { for (const s of this.systems) s.update(dt, fog, light); }
  shift(dz) { for (const s of this.systems) s.shift(dz); }
  clear() { for (const s of this.systems) s.clear(); }

  /** Faíscas nas rodas de um trem em movimento (posição do bogie). */
  trainSparks(x, y, z, dir, n) {
    for (let i = 0; i < n; i++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      this.sparks.emit(x + s * 0.75, y + 0.1, z + Math.random() * 1.5, s * (1 + Math.random() * 3), 2 + Math.random() * 5, dir * (4 + Math.random() * 8), 0.25 + Math.random() * 0.35, 0.12 + Math.random() * 0.12, 1, 0.75, 0.3);
    }
  }
  /** Poeira e folhas no rastro do jogador (pés). */
  runDust(x, y, z, speed, dt, night) {
    this.acc.dust += dt * (6 + speed * 0.35) * this.q;
    while (this.acc.dust >= 1) {
      this.acc.dust--;
      const c = night ? 0.25 : 0.55;
      this.dust.emit(x + (Math.random() - 0.5) * 0.5, y + 0.05, z - 0.3, (Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.8, -speed * 0.15 - Math.random(), 0.7 + Math.random() * 0.6, 0.5 + Math.random() * 0.4, c, c * 0.95, c * 0.85, (Math.random() - 0.5) * 2);
    }
    this.acc.leaf += dt * speed * 0.06 * this.q;
    while (this.acc.leaf >= 1) {
      this.acc.leaf--;
      const g = 0.3 + Math.random() * 0.4;
      this.leaves.emit(x + (Math.random() - 0.5) * 2.5, y + 0.1, z - 1, (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2.5, -speed * 0.25, 1.2 + Math.random(), 0.18 + Math.random() * 0.12, g + 0.3, g, 0.1, (Math.random() - 0.5) * 12);
    }
  }
  coinBurst(x, y, z) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3;
      this.glow.emit(x, y, z, Math.cos(a) * s, 1 + Math.random() * 3, Math.sin(a) * s, 0.2 + Math.random() * 0.2, 0.1 + Math.random() * 0.1, 1, 0.85, 0.3);
    }
  }
  coinSparkle(x, y, z) {
    this.glow.emit(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z, 0, 0.6, 0, 0.45, 0.1 + Math.random() * 0.08, 1, 0.9, 0.5);
  }
  powerBurst(x, y, z, r, g, b) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      this.glow.emit(x, y, z, Math.cos(a) * s, Math.random() * 6, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 0.35 + Math.random() * 0.3, r, g, b);
    }
  }
  /** Chama e fumaça do jato (posições dos bocais em mundo). */
  jetFlame(x, y, z, speed, dt) {
    this.acc.flame += dt * 160 * this.q;
    while (this.acc.flame >= 1) {
      this.acc.flame--;
      for (const dx of [-0.12, 0.12]) {
        const t = Math.random();
        this.flame.emit(x + dx + (Math.random() - 0.5) * 0.06, y, z, (Math.random() - 0.5) * 0.5, -7 - Math.random() * 5, -speed * 0.25 - 2, 0.12 + Math.random() * 0.1, 0.22 + Math.random() * 0.14, 1, 0.55 + t * 0.4, 0.15 + t * 0.3);
      }
      if (Math.random() < 0.25) this.smoke.emit(x + (Math.random() - 0.5) * 0.3, y - 0.9, z - 0.6, (Math.random() - 0.5), -1.5, -speed * 0.45, 1.0 + Math.random() * 0.8, 0.25, 0.3, 0.3, 0.32, (Math.random() - 0.5) * 2, 0.4);
    }
  }
  crashDust(x, y, z) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      this.dust.emit(x, y + 0.3, z, Math.cos(a) * s, 1 + Math.random() * 4, Math.sin(a) * s, 1 + Math.random(), 0.8 + Math.random() * 0.6, 0.5, 0.45, 0.4, (Math.random() - 0.5) * 3, 1);
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 6;
      this.sparks.emit(x, y + 0.8, z, Math.cos(a) * s, 3 + Math.random() * 6, Math.sin(a) * s, 0.4 + Math.random() * 0.5, 0.15, 1, 0.8, 0.4);
    }
  }
  barrierHit(x, y, z) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      this.dust.emit(x, y + 0.5, z, Math.cos(a) * s, 1 + Math.random() * 2, Math.sin(a) * s, 0.6 + Math.random() * 0.5, 0.5, 0.55, 0.5, 0.45, 0, 0.6);
    }
  }
  /** Respingos de chuva no chão em volta do jogador. */
  rainSplashes(x, y, z, amount, dt) {
    this.acc.splash += dt * 90 * amount * this.q;
    while (this.acc.splash >= 1) {
      this.acc.splash--;
      const px = x + (Math.random() - 0.5) * 10, pz = z + Math.random() * 16 - 3;
      this.splash.emit(px, y + 0.03, pz, 0, 0, 0, 0.25 + Math.random() * 0.15, 0.1, 0.8, 0.85, 0.95, 0, 0.3);
    }
  }
  /** Fumaça de chaminés / vapor de ventilação (emissores do cenário). */
  sceneEmitters(emitters, dt, wind) {
    this.acc.smoke += dt * 10 * this.q;
    this.acc.steam += dt * 14 * this.q;
    let doSmoke = false, doSteam = false;
    if (this.acc.smoke >= 1) { this.acc.smoke--; doSmoke = true; }
    if (this.acc.steam >= 1) { this.acc.steam--; doSteam = true; }
    for (const e of emitters) {
      if (!e.active) continue;
      if (e.kind === 'smoke' && doSmoke) this.smoke.emit(e.pos.x + (Math.random() - 0.5), e.pos.y, e.pos.z, wind + (Math.random() - 0.5) * 0.6, 1.5 + Math.random(), (Math.random() - 0.5) * 0.6, 7 + Math.random() * 4, 2.5, 0.42, 0.4, 0.4, (Math.random() - 0.5) * 0.6, 1.5);
      else if (e.kind === 'steam' && doSteam) this.smoke.emit(e.pos.x + (Math.random() - 0.5) * 0.5, e.pos.y, e.pos.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, 1.0 + Math.random() * 1.2, (Math.random() - 0.5) * 0.5, 1.4 + Math.random() * 1.0, 0.35, 0.85, 0.85, 0.88, (Math.random() - 0.5), 0.5);
    }
  }
}
