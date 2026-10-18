// Pós-processamento: EffectComposer com GTAO, bloom, passe final (motion blur
// radial, aberração cromática, vinheta, color grading, lens flare), OutputPass
// (ACES + sRGB) e SMAA. Cada efeito pode ser ligado/desligado.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    tFlare: { value: null },
    uBlur: { value: 0 },          // força do motion blur radial
    uChroma: { value: 0 },        // aberração cromática
    uVignette: { value: 0.35 },
    uSat: { value: 1.05 },
    uContrast: { value: 1.04 },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSunPos: { value: new THREE.Vector2(0.5, 0.5) },
    uFlare: { value: 0 },
    uFlareColor: { value: new THREE.Color(1, 0.85, 0.6) },
    uAspect: { value: 1.77 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tFlare;
    uniform float uBlur, uChroma, uVignette, uSat, uContrast, uFlare, uAspect, uFlash, uTime;
    uniform vec3 uLift, uGain, uFlareColor;
    uniform vec2 uSunPos;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 center = vec2(0.5, 0.42);
      vec2 d = uv - center;
      float r = length(d * vec2(uAspect, 1.0));
      // motion blur radial (amostras ao longo da direção ao centro)
      vec3 col = vec3(0.0);
      float blur = uBlur * smoothstep(0.25, 0.9, r);
      if (blur > 0.001) {
        const int N = 8;
        float jitter = hash(uv + uTime) * 0.5;
        float w = 0.0;
        for (int i = 0; i < N; i++) {
          float t = (float(i) + jitter) / float(N);
          vec2 suv = uv - d * blur * t;
          col += texture2D(tDiffuse, suv).rgb; w += 1.0;
        }
        col /= w;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }
      // aberração cromática nas bordas
      if (uChroma > 0.001) {
        float ca = uChroma * smoothstep(0.45, 1.0, r);
        col.r = texture2D(tDiffuse, uv - d * ca).r;
        col.b = texture2D(tDiffuse, uv + d * ca).b;
      }
      // lens flare do sol (sprite + fantasmas ao longo do eixo)
      if (uFlare > 0.001) {
        vec2 sp = uSunPos;
        vec2 toSun = (uv - sp) * vec2(uAspect, 1.0);
        float ds = length(toSun);
        vec3 f = uFlareColor * uFlare;
        col += f * 0.35 * exp(-ds * ds * 14.0);               // glow central
        col += f * 0.08 * exp(-ds * 3.0);                       // halo amplo
        vec2 axis = (vec2(0.5) - sp);
        for (int i = 1; i <= 5; i++) {
          float k = float(i) * 0.45;
          vec2 gp = sp + axis * k;
          float gd = length((uv - gp) * vec2(uAspect, 1.0));
          float sz = 0.025 + float(i) * 0.012;
          vec3 gc = mix(uFlareColor, vec3(0.5, 0.8, 1.0), float(i) / 5.0);
          col += gc * uFlare * 0.07 * smoothstep(sz, sz * 0.6, gd);
        }
        // anel
        float ring = smoothstep(0.03, 0.0, abs(length((uv - (sp + axis * 1.3)) * vec2(uAspect, 1.0)) - 0.22));
        col += uFlareColor * uFlare * 0.05 * ring;
      }
      // color grading: lift/gain, contraste, saturação
      col = col * uGain + uLift;
      col = (col - 0.5) * uContrast + 0.5;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      // vinheta
      float v = 1.0 - uVignette * smoothstep(0.35, 1.25, r);
      col *= v;
      col += uFlash;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, preset, settings) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.preset = preset; this.settings = settings;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const w = Math.floor(size.x * pr), h = Math.floor(size.y * pr);
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: preset.msaa || 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.gtao = null;
    if (preset.ao) {
      // GTAO em resolução reduzida (aoScale): o passe de normais/profundidade é o mais caro
      const aoS = preset.aoScale || 0.5;
      this.gtao = new GTAOPass(scene, camera, Math.floor(w * aoS), Math.floor(h * aoS));
      const gtaoSetSize = this.gtao.setSize.bind(this.gtao);
      this.gtao.setSize = (ww, hh) => gtaoSetSize(Math.max(1, Math.floor(ww * aoS)), Math.max(1, Math.floor(hh * aoS)));
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.2, thickness: 1.2, scale: 1.0, samples: preset.msaa ? 16 : 12, distanceFallOff: 1, screenSpaceRadius: false });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 3, radiusExponent: 1, rings: 2, samples: 8 });
      this.gtao.blendIntensity = 0.85;
      this.composer.addPass(this.gtao);
    }
    this.bloom = null;
    if (preset.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.6, 1.0);
      this.composer.addPass(this.bloom);
    }
    this.final = new ShaderPass(FinalShader);
    this.final.uniforms.uAspect.value = w / h;
    this.composer.addPass(this.final);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.smaa = null;
    if (preset.smaa) {
      this.smaa = new SMAAPass(w, h);
      this.composer.addPass(this.smaa);
    }
    this.blurTarget = 0;
    this.applySettings();
  }
  applySettings() {
    const s = this.settings;
    if (this.gtao) this.gtao.enabled = s.ao;
    if (this.bloom) this.bloom.enabled = s.bloom;
    if (this.smaa) this.smaa.enabled = s.smaa;
  }
  setSize(w, h) {
    // o composer guarda o próprio pixel ratio: precisa acompanhar o do renderer
    this.composer.setPixelRatio(this.renderer.getPixelRatio()); // já redimensiona todos os passes
    this.composer.setSize(w, h);
    this.final.uniforms.uAspect.value = w / h;
  }
  /** Atualiza uniforms do passe final. */
  update(dt, { speedT, flash, sunScreen, flareAmt, timeOfDayTint, tunnel, night, rain, dead }) {
    const u = this.final.uniforms;
    const s = this.settings;
    const blur = s.motionBlur ? speedT * speedT * 0.045 * (dead ? 0.1 : 1) : 0;
    u.uBlur.value = blur;
    u.uChroma.value = s.chroma ? Math.max(0, speedT - 0.4) * 0.0022 + (dead ? 0.0015 : 0) : 0;
    u.uFlash.value = flash;
    u.uTime.value += dt;
    u.uSunPos.value.copy(sunScreen);
    u.uFlare.value = s.flare ? flareAmt : 0;
    u.uVignette.value = 0.32 + night * 0.15 + tunnel * 0.2;
    // grading por hora do dia
    const warm = timeOfDayTint; // 0 = neutro, 1 = quente (pôr do sol), -1 = frio (noite/chuva)
    u.uGain.value.set(1 + Math.max(warm, 0) * 0.06, 1 + Math.max(warm, 0) * 0.015 - Math.max(-warm, 0) * 0.02, 1 - Math.max(warm, 0) * 0.08 + Math.max(-warm, 0) * 0.07);
    u.uLift.value.set(Math.max(-warm, 0) * -0.01, 0, Math.max(-warm, 0) * 0.02);
    u.uSat.value = 1.08 - rain * 0.2 - night * 0.05;
    u.uContrast.value = 1.09 + night * 0.04;
    if (this.bloom) {
      this.bloom.strength = 0.3 + night * 0.35 + tunnel * 0.2 + rain * 0.1;
      this.bloom.threshold = night > 0.5 ? 0.85 : 1.0;
    }
  }
  render() { this.composer.render(); }
}
