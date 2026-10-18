/**
 * Sky, sun, environment lighting (PMREM from the procedural sky), cascaded
 * shadow maps, fog and drifting clouds. One instance per level.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { cloudSprite, toTexture } from './Textures.js';

export class Environment {
  /**
   * @param {object} o { scene, renderer, camera, materials, settings, preset: { elevation, azimuth, turbidity, rayleigh, mie, fogColor, fogDensity, sunColor, sunIntensity, envIntensity } }
   */
  constructor(o) {
    this.scene = o.scene; this.renderer = o.renderer; this.camera = o.camera; this.materials = o.materials; this.settings = o.settings;
    const p = this.p = Object.assign({ elevation: 28, azimuth: 160, turbidity: 3.5, rayleigh: 1.6, mie: 0.006, mieG: 0.8, fogColor: 0xc9d7e8, fogDensity: 0.0035, sunColor: 0xfff1dc, sunIntensity: 5.0, envIntensity: 0.16, hemi: 0.25, exposure: 1.0 }, o.preset || {});

    // --- sky dome ---
    const sky = this.sky = new Sky(); sky.scale.setScalar(4000);
    const u = sky.material.uniforms;
    u.turbidity.value = p.turbidity; u.rayleigh.value = p.rayleigh; u.mieCoefficient.value = p.mie; u.mieDirectionalG.value = p.mieG;
    const phi = THREE.MathUtils.degToRad(90 - p.elevation), theta = THREE.MathUtils.degToRad(p.azimuth);
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);
    // the procedural sky is very bright in HDR; scale the visible dome (the PMREM copy keeps its own intensity)
    sky.material.uniforms.uSkyScale = { value: p.skyScale ?? 0.55 };
    sky.material.fragmentShader = sky.material.fragmentShader.replace('uniform float mieDirectionalG;', 'uniform float mieDirectionalG; uniform float uSkyScale;').replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * uSkyScale, 1.0 );');
    sky.material.needsUpdate = true;
    this.scene.add(sky);

    // --- environment map from sky ---
    const pmrem = new THREE.PMREMGenerator(this.renderer.r); pmrem.compileEquirectangularShader();
    const skyScene = new THREE.Scene(); const skyCopy = new Sky(); skyCopy.scale.setScalar(4000); skyCopy.material.uniforms.turbidity.value = p.turbidity; skyCopy.material.uniforms.rayleigh.value = p.rayleigh; skyCopy.material.uniforms.mieCoefficient.value = p.mie; skyCopy.material.uniforms.mieDirectionalG.value = p.mieG; skyCopy.material.uniforms.sunPosition.value.copy(this.sunDir);
    skyScene.add(skyCopy);
    // ground bounce: a dark warm floor so the lower hemisphere isn't black
    const floor = new THREE.Mesh(new THREE.SphereGeometry(3000, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.groundBounce || 0x6a5a48, side: THREE.BackSide }));
    skyScene.add(floor);
    this.envTarget = pmrem.fromScene(skyScene, 0.04);
    this.scene.environment = this.envTarget.texture; this.scene.environmentIntensity = p.envIntensity;
    pmrem.dispose(); skyCopy.material.dispose(); skyCopy.geometry.dispose(); floor.geometry.dispose(); floor.material.dispose();

    // --- fog ---
    this.scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
    this.renderer.r.toneMappingExposure = p.exposure;

    // --- hemisphere fill ---
    this.hemi = new THREE.HemisphereLight(p.hemiSky || 0xbfd4ff, p.hemiGround || 0x5a4a3a, p.hemi); this.scene.add(this.hemi);

    // --- sun: CSM or a single directional light following the player ---
    this.csm = null; this.sun = null;
    this.buildSun();

    // --- clouds ---
    this.clouds = new THREE.Group(); this.scene.add(this.clouds);
    const ct = toTexture(cloudSprite(256), { srgb: true, wrap: false });
    const cm = new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85, color: 0xffffff, fog: true });
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(cm); const r = 260 + Math.random() * 500; const a = Math.random() * Math.PI * 2;
      s.position.set(Math.cos(a) * r, 120 + Math.random() * 90, Math.sin(a) * r); const sc = 90 + Math.random() * 140; s.scale.set(sc, sc * 0.45, 1); s.userData.speed = 0.6 + Math.random() * 1.0;
      this.clouds.add(s);
    }
  }

  buildSun() {
    const s = this.settings.values; const p = this.p;
    if (this.csm) { this.materials.detachCSM(); this.csm.remove(); this.csm.dispose(); this.csm = null; }
    if (this.sun) { this.scene.remove(this.sun); this.scene.remove(this.sun.target); this.sun.dispose(); this.sun = null; }
    const dir = this.sunDir.clone().negate();
    if (s.shadow === 'off' || s.shadow === 0) {
      this.sun = new THREE.DirectionalLight(p.sunColor, p.sunIntensity); this.sun.position.copy(this.sunDir).multiplyScalar(100); this.sun.castShadow = false; this.scene.add(this.sun); this.scene.add(this.sun.target);
      this.materials.detachCSM(); return;
    }
    const size = Number(s.shadow) || 2048;
    this.csm = new CSM({ camera: this.camera, parent: this.scene, cascades: s.cascades || 3, maxFar: 110, mode: 'practical', shadowMapSize: size, lightDirection: dir, lightIntensity: p.sunIntensity, lightMargin: 60, lightNear: 1, lightFar: 400, shadowBias: -0.00005 });
    this.csm.fade = true;
    for (const l of this.csm.lights) { l.color.set(p.sunColor); l.shadow.normalBias = 0.035; l.shadow.bias = -0.00008; l.shadow.radius = 2; }
    this.materials.attachCSM(this.csm);
  }

  update(dt, playerPos) {
    if (this.csm) this.csm.update();
    for (const c of this.clouds.children) { c.position.x += c.userData.speed * dt; if (c.position.x > 800) c.position.x = -800; }
    if (playerPos) { this.sky.position.copy(playerPos); }
  }

  dispose() {
    if (this.csm) { this.materials.detachCSM(); this.csm.remove(); this.csm.dispose(); }
    if (this.sun) { this.scene.remove(this.sun); }
    this.scene.remove(this.sky); this.sky.material.dispose(); this.sky.geometry.dispose();
    this.scene.remove(this.hemi); this.scene.remove(this.clouds);
    this.envTarget.dispose(); this.scene.environment = null; this.scene.fog = null;
  }
}
