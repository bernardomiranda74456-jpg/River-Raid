/**
 * Map 3 — "Blocos que Somem" (Hex Fall). Final round.
 * Three stacked layers of hexagonal tiles floating above the clouds. A tile
 * crumbles shortly after someone steps on it. Last character standing wins.
 */
import * as THREE from 'three';
import { LevelBase } from './LevelBase.js';
import { Environment } from '../gfx/Environment.js';
import { GROUP, groups } from '../core/Physics.js';
import { cloudSprite, toTexture } from '../gfx/Textures.js';
import { rockGeometry, mountainGeometry } from '../gfx/Rocks.js';

const HEX_R = 1.75;            // circumradius of a tile
const LAYERS = [{ y: 0, color: '#2a8f8a', rings: 7 }, { y: -7, color: '#d9532b', rings: 7 }, { y: -14, color: '#7b2cbf', rings: 7 }, { y: -21, color: '#e8b72a', rings: 7 }];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class HexFall extends LevelBase {
  constructor(game) {
    super(game); this.name = 'Blocos que Somem'; this.kind = 'survival'; this.qualify = 1; this.duration = 180; this.killY = -30; this.spawnYaw = 0;
    this.tiles = []; this.meshes = []; this.introCam = { from: new THREE.Vector3(30, 22, 30), look: new THREE.Vector3(0, -6, 0) };
  }
  build() {
    const M = this.M;
    this.env = new Environment({ scene: this.scene, renderer: this.game.renderer, camera: this.game.camera, materials: M, settings: this.settings,
      preset: { elevation: 34, azimuth: 60, turbidity: 1.6, rayleigh: 1.0, mie: 0.003, mieG: 0.78, fogColor: 0x9a94a8, fogDensity: 0.0011, skyScale: 0.32, sunColor: 0xffe0c0, sunIntensity: 5.2, envIntensity: 0.15, hemi: 0.3, hemiSky: 0xd0d8ff, hemiGround: 0x9aa0b0, exposure: 0.72, groundBounce: 0x8a8a9a } });
    // cloud sea below the arena
    const ct = toTexture(cloudSprite(256, 9), { srgb: true, wrap: false }); const cm = new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.55, color: 0xa8b4c4, fog: true });
    const sea = new THREE.Group(); for (let i = 0; i < 120; i++) { const s = new THREE.Sprite(cm); const r = 30 + Math.random() * 260; const a = Math.random() * Math.PI * 2; s.position.set(Math.cos(a) * r, -62 - Math.random() * 14, Math.sin(a) * r); const sc = 40 + Math.random() * 60; s.scale.set(sc, sc * 0.45, 1); sea.add(s); } this.deco(sea, false); this.sea = sea;
    // distant peaks to anchor the horizon
    for (let i = 0; i < 14; i++) { const g = mountainGeometry(50 + (i % 3) * 14, 110 + (i % 4) * 30, 800 + i); const m = new THREE.Mesh(g, M.rock); const a = i / 14 * Math.PI * 2; m.position.set(Math.cos(a) * 360, -70, Math.sin(a) * 360); m.rotation.y = i; this.deco(m); }
    // floating rocks for scale
    for (let i = 0; i < 10; i++) { const g = rockGeometry(6 + (i % 4) * 3, 2, 600 + i, { rough: 0.5 }); const m = new THREE.Mesh(g, M.rock); const a = i / 10 * Math.PI * 2; m.position.set(Math.cos(a) * (60 + (i % 3) * 20), -20 - (i % 5) * 6, Math.sin(a) * (60 + (i % 3) * 20)); m.castShadow = true; this.deco(m); }
    // central mast with a glowing beacon (visual anchor)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffd23f, emissiveIntensity: 1.6 })); beacon.position.set(0, 9, 0); this.deco(beacon, false); this.beacon = beacon;

    // tiles
    const hexGeo = new THREE.CylinderGeometry(HEX_R * 0.93, HEX_R * 0.88, 0.6, 6, 1); hexGeo.rotateY(Math.PI / 6);
    // uv: top face planar, scaled
    LAYERS.forEach((L, li) => {
      const mat = M.paint(L.color, { edgeDirt: 0.15, scratches: 10 });
      const positions = hexGrid(L.rings);
      const im = new THREE.InstancedMesh(hexGeo, mat, positions.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const c = new THREE.Color();
      positions.forEach((p, i) => {
        const tile = { layer: li, index: i, pos: new THREE.Vector3(p.x, L.y, p.z), alive: true, timer: -1, fall: 0, stepped: false, mesh: im };
        // collider: fixed cylinder (slightly smaller than the hex so you can fall between neighbours only through real gaps)
        const body = this.physics.world.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(p.x, L.y - 0.3, p.z)); this.bodies.push(body);
        const col = this.physics.world.createCollider(this.R.ColliderDesc.cylinder(0.3, HEX_R * 0.93).setFriction(0.8).setCollisionGroups(groups(GROUP.STATIC, GROUP.CHAR | GROUP.RAGDOLL)), body);
        tile.col = col; this.physics.userData.set(col.handle, { type: 'tile', tile });
        im.setMatrixAt(i, _m.compose(tile.pos.clone().setY(L.y - 0.3), _q.identity(), _s.set(1, 1, 1)));
        const shade = 0.85 + ((i * 7919) % 13) / 13 * 0.3; im.setColorAt(i, c.set(shade, shade, shade));
        this.tiles.push(tile);
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; this.root.add(im); this.meshes.push(im);
      // glowing rim under the layer
      const rim = new THREE.Mesh(new THREE.TorusGeometry(HEX_R * 1.74 * L.rings + 1, 0.15, 8, 96), new THREE.MeshPhysicalMaterial({ color: L.color, emissive: new THREE.Color(L.color), emissiveIntensity: 0.9, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = L.y - 0.6; this.deco(rim);
    });
    // spawns on the top ring area
    this.spawns.length = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const r = 8; this.spawns.push(new THREE.Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r)); }
    this.killPlane = -30;
    this.batchStatics();
  }

  /** Called when a character is standing on a tile. */
  _touch(tile) { if (!tile.alive || tile.timer >= 0) return; tile.timer = 0.9; tile.stepped = true; }

  postStep(chars) {
    super.postStep(chars);
    const dt = 1 / 60;
    if (this.game.state === 'racing') for (const ch of chars) { if (ch.grounded && ch.groundData && ch.groundData.type === 'tile') this._touch(ch.groundData.tile); }
    for (const t of this.tiles) {
      if (!t.alive) continue;
      if (t.timer >= 0) { t.timer -= dt; if (t.timer < 0) { t.alive = false; t.fall = 0.0001; t.col.setEnabled(false); this.game.onTileFall(t); } }
    }
  }
  update(dt, time, camPos, playerPos) {
    super.update(dt, time, camPos, playerPos);
    for (const t of this.tiles) {
      if (t.alive && t.timer < 0) continue;
      const L = LAYERS[t.layer];
      if (t.alive) { // wobble while armed
        const k = 1 - t.timer / 0.9; const w = Math.sin(time * 40) * 0.06 * k;
        t.mesh.setMatrixAt(t.index, _m.compose(_p.set(t.pos.x, L.y - 0.3 - k * 0.15, t.pos.z), _q.setFromEuler(new THREE.Euler(w, 0, w * 0.7)), _s.set(1, 1, 1)));
      } else if (t.fall > 0 && t.fall < 1.6) {
        t.fall += dt; const f = t.fall; const sc = Math.max(0, 1 - f * 0.7);
        t.mesh.setMatrixAt(t.index, _m.compose(_p.set(t.pos.x, L.y - 0.3 - f * f * 9, t.pos.z), _q.setFromEuler(new THREE.Euler(f * 1.5, f * 0.5, f)), _s.set(sc, sc, sc)));
        if (t.fall >= 1.6) t.mesh.setMatrixAt(t.index, _m.makeScale(0, 0, 0));
      }
      t.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const s of this.sea.children) { s.position.x += dt * 1.5; if (s.position.x > 300) s.position.x = -300; }
    if (this.beacon) this.beacon.position.y = 9 + Math.sin(time * 1.5) * 0.5;
  }
  nearestTile(ch) { let best = null, bd = 1e9; for (const t of this.tiles) { if (!t.alive || t.timer >= 0) continue; const dy = t.pos.y - ch.pos.y; if (dy > 0.5 || dy < -1.5) continue; const d = Math.hypot(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z); if (d < bd) { bd = d; best = t; } } return best ? best.pos : null; }
  /** Bot helper: a random live tile near the character (prefers untouched tiles on the same layer). */
  pickTileFor(ch, rnd) {
    let best = null, bestScore = -1e9;
    for (const t of this.tiles) {
      if (!t.alive || t.timer >= 0) continue; const dy = t.pos.y - ch.pos.y; if (dy > 0.5 || dy < -1.5) continue;
      const d = Math.hypot(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z); if (d < 2.5 || d > 10) continue;
      const score = -Math.abs(d - 5) * 0.4 + (t.stepped ? -3 : 0) + rnd() * 4 + (Math.hypot(t.pos.x, t.pos.z) < HEX_R * 1.74 * 5 ? 1 : -2);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best ? best.pos : null;
  }
}

/** Axial hex grid positions (pointy-top), rings around the origin, excluding the center hole for the mast. */
function hexGrid(rings) {
  const out = []; const w = HEX_R * Math.sqrt(3);
  for (let q = -rings; q <= rings; q++) for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
    const x = w * (q + r / 2), z = HEX_R * 1.5 * r; out.push({ x, z });
  }
  return out;
}
