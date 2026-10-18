/**
 * WebGL2 renderer + post-processing chain.
 * Chain: Render -> GTAO -> Bloom (emissive only) -> DoF -> Grade (vignette, color grading, speed blur) -> Output (ACES + sRGB) -> SMAA
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, vignette: { value: 0.35 }, saturation: { value: 1.08 }, contrast: { value: 1.04 },
    lift: { value: new THREE.Vector3(0.0, 0.0, 0.01) }, gain: { value: new THREE.Vector3(1.0, 0.98, 0.95) },
    blurDir: { value: new THREE.Vector2(0, 0) }, blurAmount: { value: 0 }, resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette, saturation, contrast, blurAmount; uniform vec3 lift, gain; uniform vec2 blurDir, resolution; varying vec2 vUv;
    void main(){
      vec2 uv = vUv; vec3 c;
      if (blurAmount > 0.001) {
        // directional speed blur, stronger toward screen edges so the hero stays sharp
        vec2 d = (uv - 0.5); float edge = smoothstep(0.1, 0.7, length(d));
        vec2 dir = blurDir * blurAmount * edge;
        c = vec3(0.0); float w = 0.0;
        for (int i = -4; i <= 4; i++) { float t = float(i) / 4.0; c += texture2D(tDiffuse, uv + dir * t).rgb; w += 1.0; }
        c /= w;
      } else { c = texture2D(tDiffuse, uv).rgb; }
      // color grade (in linear HDR space, before tonemapping)
      c = c * gain + lift;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, saturation);
      c = (c - 0.5 * l) * contrast + 0.5 * l; c = max(c, 0.0);
      vec2 q = uv * (1.0 - uv.yx); float v = pow(clamp(q.x * q.y * 15.0, 0.0, 1.0), vignette);
      gl_FragColor = vec4(c * v, 1.0);
    }`,
};

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas; this.settings = settings;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x0b1020); r.info.autoReset = false;
    this.r = r;
    this.scene = null; this.camera = null; this.composer = null; this.passes = {};
    this.width = 1; this.height = 1; this.pixelRatio = 1;
    this.blurDir = new THREE.Vector2(); this.blurAmount = 0;
  }

  setScene(scene, camera) {
    this.scene = scene; this.camera = camera; this._buildComposer();
  }

  _buildComposer() {
    if (this.composer) { this.composer.dispose(); }
    const s = this.settings.values;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: s.scale >= 1 && !s.smaa ? 4 : (s.smaa ? 2 : 0) });
    const c = new EffectComposer(this.r, target);
    this.composer = c; const p = this.passes = {};
    p.render = new RenderPass(this.scene, this.camera); c.addPass(p.render);
    if (s.ao) {
      p.gtao = new GTAOPass(this.scene, this.camera, 1, 1, { depthHelper: false });
      p.gtao.output = GTAOPass.OUTPUT.Default;
      p.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.2, thickness: 1.0, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false });
      p.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 3, radiusExponent: 1, rings: 2, samples: 12 });
      p.gtao.blendIntensity = 0.85;
      c.addPass(p.gtao);
    }
    if (s.bloom) { p.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.4, 2.4); c.addPass(p.bloom); }
    if (s.dof) { p.dof = new BokehPass(this.scene, this.camera, { focus: 8, aperture: 0.00025, maxblur: 0.006 }); c.addPass(p.dof); }
    if (s.grade || s.mblur) { p.grade = new ShaderPass(GradeShader); if (!s.grade) { p.grade.uniforms.vignette.value = 0; p.grade.uniforms.saturation.value = 1; p.grade.uniforms.contrast.value = 1; p.grade.uniforms.gain.value.set(1, 1, 1); p.grade.uniforms.lift.value.set(0, 0, 0); } c.addPass(p.grade); }
    p.output = new OutputPass(); c.addPass(p.output);
    if (s.smaa) { p.smaa = new SMAAPass(); c.addPass(p.smaa); }
    this.resize();
  }

  rebuild() { if (this.scene) this._buildComposer(); }

  resize() {
    const s = this.settings.values;
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w; this.height = h;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * (s.scale || 1);
    this.r.setPixelRatio(this.pixelRatio); this.r.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio); this.composer.setSize(w, h);
      const pw = Math.floor(w * this.pixelRatio), ph = Math.floor(h * this.pixelRatio);
      if (this.passes.gtao) this.passes.gtao.setSize(pw, ph);
      if (this.passes.grade) this.passes.grade.uniforms.resolution.value.set(pw, ph);
    }
  }

  /** Per-frame camera-driven effects: DoF focus distance and speed blur. */
  setFocus(dist) { if (this.passes.dof) { this.passes.dof.uniforms.focus.value = dist; } }
  setSpeedBlur(dirX, dirY, amount) { if (this.passes.grade && this.settings.values.mblur) { this.passes.grade.uniforms.blurDir.value.set(dirX, dirY); this.passes.grade.uniforms.blurAmount.value = amount; } }
  setGtaoBox(box) { if (this.passes.gtao) this.passes.gtao.setSceneClipBox(box); }

  render() { this.r.info.reset(); if (this.composer) this.composer.render(); else this.r.render(this.scene, this.camera); }
  dispose() { if (this.composer) this.composer.dispose(); }
}
