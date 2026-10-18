/**
 * Menu backdrop: a floating stage above the clouds where the chosen skin
 * stands on a podium with a few bots. The camera slowly orbits.
 */
import * as THREE from 'three';
import { LevelBase } from './LevelBase.js';
import { Environment } from '../gfx/Environment.js';
import { cloudSprite, toTexture } from '../gfx/Textures.js';
import { rockGeometry } from '../gfx/Rocks.js';

export class MenuStage extends LevelBase {
  constructor(game) { super(game); this.name = 'Menu'; this.kind = 'menu'; this.killY = -50; this.spawnYaw = Math.PI; }
  build() {
    const M = this.M;
    this.env = new Environment({ scene: this.scene, renderer: this.game.renderer, camera: this.game.camera, materials: M, settings: this.settings,
      preset: { elevation: 38, azimuth: 230, turbidity: 3, rayleigh: 1.8, mie: 0.006, mieG: 0.8, fogColor: 0xe6d2c4, fogDensity: 0.0018, sunColor: 0xfff0d8, sunIntensity: 5.0, envIntensity: 0.18, hemi: 0.28, hemiSky: 0xd8e4ff, hemiGround: 0x6a5a5a, exposure: 0.95, groundBounce: 0x7a6a6a } });
    const ct = toTexture(cloudSprite(256, 11), { srgb: true, wrap: false }); const cm = new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.8, fog: true });
    const sea = new THREE.Group(); for (let i = 0; i < 120; i++) { const s = new THREE.Sprite(cm); const r = 18 + Math.random() * 220; const a = Math.random() * Math.PI * 2; s.position.set(Math.cos(a) * r, -30 - Math.random() * 10, Math.sin(a) * r); const sc = 40 + Math.random() * 50; s.scale.set(sc, sc * 0.45, 1); sea.add(s); } this.deco(sea, false); this.sea = sea;
    for (let i = 0; i < 8; i++) { const g = rockGeometry(5 + (i % 4) * 2, 2, 700 + i, { rough: 0.5 }); const m = new THREE.Mesh(g, M.rock); const a = i / 8 * Math.PI * 2 + 0.4; m.position.set(Math.cos(a) * (34 + (i % 3) * 12), -12 - (i % 5) * 4, Math.sin(a) * (34 + (i % 3) * 12)); m.castShadow = true; this.deco(m); }
    const paintOrange = M.paint('#d9532b'), paintWhite = M.paint('#e9e4dc', { edgeDirt: 0.4 });
    this.cylinder(11, 1.2, [0, -0.6, 0], [0, 0, 0], M.concrete, { segments: 48 });
    this.cylinder(11.3, 0.5, [0, -1.45, 0], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 48 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10.6, 64), M.hazard); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.receiveShadow = true; this.deco(ring);
    // podium
    this.cylinder(2.4, 0.9, [0, 0.45, 0], [0, 0, 0], paintOrange, { segments: 32 });
    this.cylinder(2.6, 0.12, [0, 0.96, 0], [0, 0, 0], M.gold, { noCollider: true, segments: 32 });
    this.cylinder(0.5, 24, [0, -13, 0], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 12 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.cylinder(0.12, 3.4, [Math.cos(a) * 9.8, 1.7, Math.sin(a) * 9.8], [0, 0, 0], M.darkMetal, { noCollider: true, segments: 8 }); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 3, roughness: 0.3 })); lamp.position.set(Math.cos(a) * 9.8, 3.5, Math.sin(a) * 9.8); this.deco(lamp); }
    this.spawns = [new THREE.Vector3(0, 1.0, 0)];
    for (let i = 0; i < 8; i++) { const a = Math.PI * 0.15 + (i / 7) * Math.PI * 0.7; this.spawns.push(new THREE.Vector3(Math.cos(a + Math.PI / 2) * 6.5, 0.05, Math.sin(a + Math.PI / 2) * 6.5 * -1)); }
    this.batchStatics();
  }
  update(dt, time, camPos, playerPos) { super.update(dt, time, camPos, playerPos); for (const s of this.sea.children) { s.position.x += dt * 1.2; if (s.position.x > 240) s.position.x = -240; } }
}
