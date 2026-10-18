// Pós-processamento HD: bloom (downsample + blur separável + composição), color grading por fase,
// vinheta, aberração cromática em impactos, calor tremulando; e filtro CRT (compartilhado com o retrô).
import { Filter, GlProgram, RenderTexture, Sprite, TexturePool, defaultFilterVert } from 'pixi.js';

// ----- Bloom -------------------------------------------------------------------------------------
const brightFrag = `precision highp float; in vec2 vTextureCoord; out vec4 finalColor; uniform sampler2D uTexture; uniform float uThreshold;
void main(){ vec4 c = texture(uTexture, vTextureCoord); float l = dot(c.rgb, vec3(0.3,0.59,0.11)); float k = smoothstep(uThreshold, uThreshold + 0.35, l); finalColor = vec4(c.rgb * k, 1.0); }`;
const blurFrag = `precision highp float; in vec2 vTextureCoord; out vec4 finalColor; uniform sampler2D uTexture; uniform vec2 uDir; uniform vec4 uInputSize;
void main(){ vec2 px = uDir * uInputSize.zw; vec4 s = texture(uTexture, vTextureCoord) * 0.227;
 s += texture(uTexture, vTextureCoord + px * 1.385) * 0.316; s += texture(uTexture, vTextureCoord - px * 1.385) * 0.316;
 s += texture(uTexture, vTextureCoord + px * 3.23) * 0.07; s += texture(uTexture, vTextureCoord - px * 3.23) * 0.07; finalColor = s; }`;
const combineFrag = `precision highp float; in vec2 vTextureCoord; out vec4 finalColor; uniform sampler2D uTexture; uniform sampler2D uBloom; uniform float uStrength; uniform vec4 uInputSize; uniform vec2 uBloomScale;
void main(){ vec4 c = texture(uTexture, vTextureCoord); vec3 b = texture(uBloom, vTextureCoord * uBloomScale).rgb; finalColor = vec4(c.rgb + b * uStrength, c.a); }`;
export class BloomFilter extends Filter {
  constructor() {
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: combineFrag, name: 'bloom-combine' }), resources: { bloomUniforms: { uStrength: { value: 0.7, type: 'f32' }, uBloomScale: { value: new Float32Array([1, 1]), type: 'vec2<f32>' } }, uBloom: RenderTexture.create({ width: 4, height: 4 }).source } });
    this.bright = new Filter({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: brightFrag, name: 'bloom-bright' }), resources: { bu: { uThreshold: { value: 0.62, type: 'f32' } } } });
    this.blurH = new Filter({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: blurFrag, name: 'bloom-blur' }), resources: { bu: { uDir: { value: new Float32Array([1, 0]), type: 'vec2<f32>' } } } });
    this.blurV = new Filter({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: blurFrag, name: 'bloom-blur' }), resources: { bu: { uDir: { value: new Float32Array([0, 1]), type: 'vec2<f32>' } } } });
    this.strength = 0.7; this.threshold = 0.62;
  }
  apply(fm, input, output, clear) {
    const res = Math.max(0.05, input.source._resolution * 0.25);
    const a = TexturePool.getOptimalTexture({ width: input.frame.width, height: input.frame.height, resolution: res, antialias: false });
    const b = TexturePool.getOptimalTexture({ width: input.frame.width, height: input.frame.height, resolution: res, antialias: false });
    this.bright.resources.bu.uniforms.uThreshold = this.threshold;
    fm.applyFilter(this.bright, input, a, true); fm.applyFilter(this.blurH, a, b, true); fm.applyFilter(this.blurV, b, a, true); fm.applyFilter(this.blurH, a, b, true); fm.applyFilter(this.blurV, b, a, true);
    this.resources.uBloom = a.source; const u = this.resources.bloomUniforms.uniforms; u.uStrength = this.strength;
    // a textura de bloom é 1/4 do tamanho: as coordenadas do filtro já são normalizadas pelo quadro de entrada;
    // ambas as texturas cobrem o mesmo quadro, então a escala é a razão entre as frações usadas.
    u.uBloomScale[0] = input.source.width / a.source.width; u.uBloomScale[1] = input.source.height / a.source.height;
    fm.applyFilter(this, input, output, clear);
    TexturePool.returnTexture(a); TexturePool.returnTexture(b);
  }
}

// ----- Grading + vinheta + aberração + calor ------------------------------------------------------
const gradeFrag = `precision highp float; in vec2 vTextureCoord; out vec4 finalColor; uniform sampler2D uTexture; uniform vec4 uInputSize; uniform vec4 uInputClamp;
uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma; uniform float uSat; uniform float uVignette; uniform float uAberr; uniform float uHeat; uniform float uTime; uniform float uFlash; uniform vec3 uFlashColor; uniform float uUnderwater;
void main(){
  vec2 uv = vTextureCoord; vec2 frameUv = uv * uInputSize.xy / (uInputClamp.zw * uInputSize.xy);
  if (uHeat > 0.0) { float y = frameUv.y; float amp = uHeat * smoothstep(0.35, 1.0, y) * 1.6; uv.x += sin(y * 90.0 + uTime * 3.0) * amp * uInputSize.z; uv.y += cos(frameUv.x * 60.0 + uTime * 2.2) * amp * 0.5 * uInputSize.w; }
  if (uUnderwater > 0.0) { uv.x += sin(frameUv.y * 18.0 + uTime * 1.5) * 2.0 * uInputSize.z * uUnderwater; uv.y += cos(frameUv.x * 14.0 + uTime * 1.2) * 1.5 * uInputSize.w * uUnderwater; }
  uv = clamp(uv, uInputClamp.xy, uInputClamp.zw);
  vec2 d = (frameUv - 0.5) * uAberr * uInputSize.zw * 6.0;
  vec3 c; if (uAberr > 0.001) { c.r = texture(uTexture, clamp(uv + d, uInputClamp.xy, uInputClamp.zw)).r; c.g = texture(uTexture, uv).g; c.b = texture(uTexture, clamp(uv - d, uInputClamp.xy, uInputClamp.zw)).b; } else c = texture(uTexture, uv).rgb;
  c = pow(max(vec3(0.0), c * uGain + uLift), vec3(1.0 / uGamma));
  float l = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(vec3(l), c, uSat);
  vec2 v = frameUv - 0.5; float vig = 1.0 - dot(v, v) * uVignette; c *= clamp(vig, 0.0, 1.0);
  c = mix(c, uFlashColor, uFlash);
  finalColor = vec4(c, 1.0);
}`;
export class GradeFilter extends Filter {
  constructor() {
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: gradeFrag, name: 'grade' }), resources: { gu: {
      uLift: { value: new Float32Array([0, 0, 0]), type: 'vec3<f32>' }, uGain: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' }, uGamma: { value: 1, type: 'f32' }, uSat: { value: 1.05, type: 'f32' }, uVignette: { value: 0.55, type: 'f32' },
      uAberr: { value: 0, type: 'f32' }, uHeat: { value: 0, type: 'f32' }, uTime: { value: 0, type: 'f32' }, uFlash: { value: 0, type: 'f32' }, uFlashColor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' }, uUnderwater: { value: 0, type: 'f32' } } } });
    this.u = this.resources.gu.uniforms;
  }
  setPreset(p) { this.u.uLift.set(p.lift); this.u.uGain.set(p.gain); this.u.uGamma = p.gamma; this.u.uSat = p.sat; this.u.uVignette = p.vignette; this.u.uHeat = p.heat || 0; }
}
export const GRADE_PRESETS = {
  morning: { lift: [0.02, 0.015, 0.0], gain: [1.05, 1.0, 0.95], gamma: 1.02, sat: 1.1, vignette: 0.5 },
  day: { lift: [0, 0, 0], gain: [1.02, 1.02, 1.0], gamma: 1.0, sat: 1.12, vignette: 0.45 },
  sunset: { lift: [0.03, 0.0, 0.02], gain: [1.12, 0.95, 0.85], gamma: 1.02, sat: 1.15, vignette: 0.6 },
  night: { lift: [0.0, 0.01, 0.05], gain: [0.85, 0.9, 1.1], gamma: 1.0, sat: 0.95, vignette: 0.7 },
  cave: { lift: [0.0, 0.0, 0.015], gain: [1.0, 0.95, 1.0], gamma: 0.98, sat: 1.0, vignette: 0.85 },
  underwater: { lift: [0.0, 0.02, 0.05], gain: [0.8, 0.98, 1.1], gamma: 1.0, sat: 1.05, vignette: 0.65 },
  castle: { lift: [0.01, 0.0, 0.02], gain: [0.95, 0.92, 1.0], gamma: 1.0, sat: 0.95, vignette: 0.75 },
  desert: { lift: [0.03, 0.02, 0.0], gain: [1.1, 1.02, 0.9], gamma: 1.0, sat: 1.1, vignette: 0.5, heat: 0.6 },
};

// ----- CRT ----------------------------------------------------------------------------------------
const crtFrag = `precision highp float; in vec2 vTextureCoord; out vec4 finalColor; uniform sampler2D uTexture; uniform vec4 uInputSize; uniform vec4 uInputClamp; uniform vec2 uRes; uniform float uCurve; uniform float uScan; uniform float uMask; uniform float uBleed; uniform float uTime; uniform float uLines;
void main(){
  vec2 frameUv = vTextureCoord / uInputClamp.zw; vec2 cc = frameUv - 0.5; float r2 = dot(cc, cc);
  vec2 cuv = frameUv + cc * r2 * uCurve; // curvatura
  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) { finalColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 uv = cuv * uInputClamp.zw; vec2 px = uInputSize.zw;
  // bleed horizontal + blur sutil
  vec3 c = texture(uTexture, uv).rgb * 0.5 + texture(uTexture, clamp(uv + vec2(px.x * uBleed, 0.0), uInputClamp.xy, uInputClamp.zw)).rgb * 0.25 + texture(uTexture, clamp(uv - vec2(px.x * uBleed, 0.0), uInputClamp.xy, uInputClamp.zw)).rgb * 0.25;
  c.r += texture(uTexture, clamp(uv + vec2(px.x * uBleed * 2.0, 0.0), uInputClamp.xy, uInputClamp.zw)).r * 0.08; c.b += texture(uTexture, clamp(uv - vec2(px.x * uBleed * 2.0, 0.0), uInputClamp.xy, uInputClamp.zw)).b * 0.08;
  // scanlines (uma por linha de 192) e máscara de fósforo
  float line = sin(cuv.y * uLines * 3.14159 * 2.0) * 0.5 + 0.5; c *= 1.0 - uScan * (1.0 - line) * 0.9;
  float m = mod(floor(cuv.x * uRes.x), 3.0); vec3 mask = vec3(m == 0.0 ? 1.0 : 1.0 - uMask, m == 1.0 ? 1.0 : 1.0 - uMask, m == 2.0 ? 1.0 : 1.0 - uMask); c *= mask * (1.0 + uMask * 0.55);
  // bloom de fósforo (leve) e vinheta
  c += c * c * 0.18; c *= 1.0 - r2 * 0.9;
  finalColor = vec4(c, 1.0);
}`;
export class CrtFilter extends Filter {
  constructor() {
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: crtFrag, name: 'crt' }), resources: { cu: { uRes: { value: new Float32Array([1024, 768]), type: 'vec2<f32>' }, uCurve: { value: 0.08, type: 'f32' }, uScan: { value: 0.45, type: 'f32' }, uMask: { value: 0.25, type: 'f32' }, uBleed: { value: 1.0, type: 'f32' }, uTime: { value: 0, type: 'f32' }, uLines: { value: 192, type: 'f32' } } } });
    this.u = this.resources.cu.uniforms;
  }
  resize(w, h) { this.u.uRes[0] = w; this.u.uRes[1] = h; }
  setLines(n) { this.u.uLines = n; }
}
