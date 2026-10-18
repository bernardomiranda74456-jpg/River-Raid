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
import { rockGeometry } from '../gfx/Rocks.js';

const HEX_R = 1.75;            // circumradius of a tile
const LAYERS = [{ y: 0, color: '#2a8f8a', rings: 6 }, { y: -9, color: '#d9532b', rings: 6 }, { y: -18, color: '#7b2cbf', rings: 6 }];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class HexFall extends LevelBase {
  constructor(game) {
    super(game); this.name = 'Blocos que Somem'; this.kind = 'survival'; this.qualify = 1; this.duration = 180; this.killY = -27; this.spawnYaw = 0;
    this.tiles = []; this.meshes = [];
  }
  build() {
    const M = this.M;
    this.env = new Environment({ scene: this.scene, renderer: this.game.renderer, camera: this.game.camera, materials: M, settings: this.settings,
      preset: { elevation: 16, azimuth: 60, turbidity: 4, rayleigh: 2.6, mie: 0.008, mieG: 0.82, fogColor: 0xf0c9b0, fogDensity: 0.0032, sunColor: 0xffc9a0, sunIntensity: 4.6, envIntensity: 0.2, hemi: 0.3, hemiSky: 0xffd9c0, hemiGround: 0x7a5a6a, exposure: 1.0, groundBounce: 0x8a6a7a } });
    // cloud sea below the arena
    const ct = toTexture(cloudSprite(256, 9), { srgb: true, wrap: false }); const cm = new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.95, fog: true });
    const sea = new THREE.Group(); for (let i = 0; i < 160; i++) { const s = new THREE.Sprite(cm); const r = 20 + Math.random() * 260; const a = Math.random() * Math.PI * 2; s.position.set(Math.cos(a) * r, -40 - Math.random() * 12, Math.sin(a) * r); const sc = 40 + Math.random() * 60; s.scale.set(sc, sc * 0.45, 1); sea.add(s); } this.deco(sea); this.sea = sea;
    // floating rocks for scale
    for (let i = 0; i < 10; i++) { const g = rockGeometry(6 + (i % 4) * 3, 2, 600 + i, { rough: 0.5 }); const m = new THREE.Mesh(g, M.rock); const a = i / 10 * Math.PI * 2; m.position.set(Math.cos(a) * (60 + (i % 3) * 20), -20 - (i % 5) * 6, Math.sin(a) * (60 + (i % 3) * 20)); m.castShadow = true; this.deco(m); }
    // central mast with a glowing beacon (visual anchor)
    this.cylinder(0.5, 70, [0, -35, 0], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 12 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffd23f, emissiveIntensity: 4 })); beacon.position.set(0, 4, 0); this.deco(beacon);
    this.cylinder(0.9, 8, [0, 0, 0], [0, 0, 0], M.darkMetal, { segments: 12 });

    // tiles
    const hexGeo = new THREE.CylinderGeometry(HEX_R, HEX_R * 0.96, 0.6, 6, 1); hexGeo.rotateY(Math.PI / 6);
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
      const rim = new THREE.Mesh(new THREE.TorusGeometry(HEX_R * 1.74 * L.rings + 1, 0.15, 8, 96), new THREE.MeshPhysicalMaterial({ color: L.color, emissive: new THREE.Color(L.color), emissiveIntensity: 1.6, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = L.y - 0.6; this.deco(rim);
    });
    // spawns on the top ring area
    this.spawns.length = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const r = 8; this.spawns.push(new THREE.Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r)); }
    this.killPlane = -26;
    this.batchStatics();
  }

  /** Called when a character is standing on a tile. */
  _touch(tile) { if (!tile.alive || tile.timer >= 0) return; tile.timer = 0.45; tile.stepped = true; }

  postStep(chars) {
    super.postStep(chars);
    const dt = 1 / 60;
    for (const ch of chars) { if (ch.grounded && ch.groundData && ch.groundData.type === 'tile') this._touch(ch.groundData.tile); }
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
        const k = 1 - t.timer / 0.45; const w = Math.sin(time * 40) * 0.06 * k;
        t.mesh.setMatrixAt(t.index, _m.compose(_p.set(t.pos.x, L.y - 0.3 - k * 0.15, t.pos.z), _q.setFromEuler(new THREE.Euler(w, 0, w * 0.7)), _s.set(1, 1, 1)));
      } else if (t.fall > 0 && t.fall < 1.6) {
        t.fall += dt; const f = t.fall; const sc = Math.max(0, 1 - f * 0.7);
        t.mesh.setMatrixAt(t.index, _m.compose(_p.set(t.pos.x, L.y - 0.3 - f * f * 9, t.pos.z), _q.setFromEuler(new THREE.Euler(f * 1.5, f * 0.5, f)), _s.set(sc, sc, sc)));
        if (t.fall >= 1.6) t.mesh.setMatrixAt(t.index, _m.makeScale(0, 0, 0));
      }
      t.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const s of this.sea.children) { s.position.x += dt * 1.5; if (s.position.x > 300) s.position.x = -300; }
  }
  /** Bot helper: a random live tile near the character (prefers untouched tiles on the same layer). */
  pickTileFor(ch, rnd) {
    let best = null, bestScore = -1e9;
    for (const t of this.tiles) {
      if (!t.alive || t.timer >= 0) continue; const dy = t.pos.y - ch.pos.y; if (dy > 0.5 || dy < -1.5) continue;
      const d = Math.hypot(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z); if (d < 0.8 || d > 9) continue;
      const score = -d * 0.4 + (t.stepped ? -3 : 0) + rnd() * 4 + (Math.hypot(t.pos.x, t.pos.z) < HEX_R * 1.74 * 5 ? 1 : -2);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best ? best.pos : null;
  }
}

/** Axial hex grid positions (pointy-top), rings around the origin, excluding the center hole for the mast. */
function hexGrid(rings) {
  const out = []; const w = HEX_R * Math.sqrt(3);
  for (let q = -rings; q <= rings; q++) for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
    const x = w * (q + r / 2), z = HEX_R * 1.5 * r; if (q === 0 && r === 0) continue; out.push({ x, z });
  }
  return out;
}
