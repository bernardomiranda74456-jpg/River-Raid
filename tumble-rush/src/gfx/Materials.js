/**
 * Material library. Builds PBR MeshPhysicalMaterials from the procedural
 * texture sets and registers them with CSM (cascaded shadow maps).
 */
import * as THREE from 'three';
import * as T from './Textures.js';

export class Materials {
  constructor({ textureSize = 512, anisotropy = 8 } = {}) {
    this.size = textureSize; this.aniso = anisotropy;
    this.all = []; this.csm = null; this.cache = new Map(); this.csmGen = 0;
    this._build();
  }

  _set(name, set, repeat) {
    const opts = { anisotropy: this.aniso, repeat };
    return { map: T.toTexture(set.map, { ...opts, srgb: true }), normalMap: T.toTexture(set.normal, opts), roughnessMap: T.toTexture(set.roughness, opts) };
  }

  _build() {
    const s = this.size;
    this.tex = {
      concrete: this._set('concrete', T.concreteSet(s), 1),
      metal: this._set('metal', T.brushedMetalSet(s), 1),
      darkMetal: this._set('darkMetal', T.brushedMetalSet(s, 23, [0.35, 0.36, 0.38]), 1),
      rubber: this._set('rubber', T.rubberSet(s), 1),
      wood: this._set('wood', T.woodSet(s), 1),
      rock: this._set('rock', T.rockSet(s), 1),
      hazard: T.toTexture(T.hazardStripes(256), { srgb: true, anisotropy: this.aniso }),
    };
    this.paintCache = new Map();

    this.concrete = this.register(new THREE.MeshPhysicalMaterial({ ...this.tex.concrete, color: 0xd9d4cc, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.8, 0.8) }));
    this.concreteDark = this.register(new THREE.MeshPhysicalMaterial({ ...this.tex.concrete, color: 0x8f8a84, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.8, 0.8) }));
    this.metal = this.register(new THREE.MeshPhysicalMaterial({ ...this.tex.metal, color: 0xffffff, roughness: 1, metalness: 1, normalScale: new THREE.Vector2(0.5, 0.5), anisotropy: 0.6, anisotropyRotation: Math.PI / 2 }));
    this.darkMetal = this.register(new THREE.MeshPhysicalMaterial({ ...this.tex.darkMetal, color: 0xdddddd, roughness: 1, metalness: 1, normalScale: new THREE.Vector2(0.6, 0.6), anisotropy: 0.5 }));
    this.rubber = this.register(new THREE.MeshPhysicalMaterial({ ...this.tex.rubber, color: 0xffffff, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1, 1) }));
    this.wood = this.register(new THREE.MeshPhysicalMaterial({ ...this.tex.wood, color: 0xffffff, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7) }));
    this.rock = this.register(new THREE.MeshPhysicalMaterial({ ...this.tex.rock, color: 0xb9aea6, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.8, 1.8) }));
    this.hazard = this.register(new THREE.MeshPhysicalMaterial({ map: this.tex.hazard, roughnessMap: this.tex.rubber.roughnessMap, normalMap: this.tex.metal.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.9, metalness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.4 }));
    this.gold = this.register(new THREE.MeshPhysicalMaterial({ color: 0xffc44d, roughness: 0.25, metalness: 1, normalMap: this.tex.metal.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }));
    this.glass = this.register(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 0.9, thickness: 0.5, ior: 1.45, transparent: true, opacity: 1 }));
    this.slime = this.register(new THREE.MeshPhysicalMaterial({ color: 0x5bff6a, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, transmission: 0.25, thickness: 1.2, emissive: 0x1a5a20, emissiveIntensity: 0.35, normalMap: this.tex.concrete.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }));
  }

  /** Painted panel material in a given color (cached by hex). */
  paint(hex, opts = {}) {
    const key = hex + JSON.stringify(opts);
    if (this.paintCache.has(key)) return this.paintCache.get(key);
    const c = new THREE.Color(hex);
    const set = T.paintedSet(this.size, 50 + this.paintCache.size * 7, [c.r, c.g, c.b], opts);
    const t = this._set('paint' + key, set, 1);
    const m = this.register(new THREE.MeshPhysicalMaterial({ ...t, color: 0xffffff, roughness: 1, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.35, normalScale: new THREE.Vector2(0.6, 0.6), sheen: 0.1, sheenRoughness: 0.8 }));
    this.paintCache.set(key, m); return m;
  }

  /** Registers a material so it receives the CSM shader patch. */
  register(m) { this.all.push(m); this._setup(m); return m; }
  unregister(m) { const i = this.all.indexOf(m); if (i >= 0) this.all.splice(i, 1); }
  /** Applies the CSM patch (if active) and composes it with the material's own shader patch (m.userData.patch). */
  _setup(m) {
    if (this.csm) {
      this.csm.setupMaterial(m);
      if (m.userData.patch) { const csmHook = m.onBeforeCompile; m.onBeforeCompile = (shader, r) => { csmHook(shader, r); m.userData.patch(shader); }; }
    } else {
      if (m.defines) { delete m.defines.USE_CSM; delete m.defines.CSM_CASCADES; delete m.defines.CSM_FADE; }
      m.onBeforeCompile = m.userData.patch ? (shader) => m.userData.patch(shader) : () => {};
    }
    // unique key per CSM instance: forces a fresh program (and onBeforeCompile) whenever the sun is rebuilt
    m.customProgramCacheKey = () => (this.csm ? 'csm' + this.csm.cascades + '#' + this.csmGen : 'nocsm#' + this.csmGen) + (m.userData.patch ? '+patch' : '');
    m.needsUpdate = true;
  }
  attachCSM(csm) { this.csm = csm; this.csmGen = (this.csmGen || 0) + 1; for (const m of this.all) this._setup(m); }
  detachCSM() { this.csm = null; this.csmGen = (this.csmGen || 0) + 1; for (const m of this.all) this._setup(m); }

  setAnisotropy(a) { for (const k in this.tex) { const t = this.tex[k]; if (t.isTexture) { t.anisotropy = a; t.needsUpdate = true; } else for (const kk in t) { t[kk].anisotropy = a; t[kk].needsUpdate = true; } } }
}
