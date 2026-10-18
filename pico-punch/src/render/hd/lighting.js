// Filtro de iluminação 2D: luz do sol direcional com sombras projetadas (raymarch no mapa de tiles),
// luzes pontuais com oclusão, oclusão de ambiente nos cantos, normal maps, emissivos e água
// (refração + cáusticas + linha de superfície). Opera sobre a textura difusa do mundo.
import { Filter, GlProgram, Texture, BufferImageSource, defaultFilterVert } from 'pixi.js';
import { T, isSolidType, isWaterType } from '../../world/tilemap.js';

const MAX_LIGHTS = 16;
const frag = `
precision highp float;
in vec2 vTextureCoord; out vec4 finalColor;
uniform sampler2D uTexture; uniform sampler2D uNormalTex; uniform sampler2D uTileTex;
uniform vec4 uInputSize; uniform vec4 uInputClamp;
uniform vec2 uScreen; uniform vec2 uCam; uniform float uScalePx; uniform vec2 uMapPx;
uniform vec3 uAmbient; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uShadow; uniform vec3 uBgTint;
uniform vec4 uLights[${MAX_LIGHTS}]; uniform vec4 uLightColors[${MAX_LIGHTS}]; uniform float uLightCount; uniform float uTime;
uniform vec3 uWaterTint; uniform float uQuality; uniform float uAO; uniform float uDebug;

vec4 tileAt(vec2 wp) { return texture(uTileTex, wp / uMapPx); }
float solidAt(vec2 wp) { return tileAt(wp).r; }

float shadowRay(vec2 wp, vec2 dir, bool selfSolid, float jitter) {
  float sh = 0.0; bool exited = !selfSolid;
  for (int i = 1; i <= 12; i++) {
    vec2 p = wp + dir * ((float(i) - jitter) * 7.0);
    float s = solidAt(p);
    if (!exited) { if (s < 0.5) exited = true; continue; }
    if (s > 0.5) { sh = 1.0 - float(i) / 15.0; break; }
  }
  return sh;
}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float sunShadow(vec2 wp, bool selfSolid) {
  vec2 dir = normalize(vec2(uSunDir.x, -uSunDir.y)); vec2 perp = vec2(-dir.y, dir.x);
  float j = hash12(floor(wp * 2.0)) * 0.9;
  float a = shadowRay(wp + perp * 2.5, dir, selfSolid, j);
  float b = shadowRay(wp - perp * 2.5, dir, selfSolid, 0.9 - j);
  return (a + b) * 0.5;
}
float ao(vec2 wp) {
  float a = 0.0; float r = 9.0;
  a += solidAt(wp + vec2(-r, -r)); a += solidAt(wp + vec2(r, -r)); a += solidAt(wp + vec2(-r, r)); a += solidAt(wp + vec2(r, r));
  a += solidAt(wp + vec2(0.0, -r * 1.4)); a += solidAt(wp + vec2(0.0, r * 1.4)); a += solidAt(wp + vec2(-r * 1.4, 0.0)); a += solidAt(wp + vec2(r * 1.4, 0.0));
  return a / 8.0;
}
void main() {
  vec2 spx = vTextureCoord * uInputSize.xy;
  vec2 uvN = spx / uScreen;
  vec4 nrm = texture(uNormalTex, uvN);
  vec2 wp = uCam + spx / uScalePx;
  vec4 tile = tileAt(wp);
  if (uDebug > 0.5) { vec4 nn = texture(uNormalTex, uvN); if (uDebug > 2.5) { float ss = sunShadow(wp, tile.r > 0.5); finalColor = vec4(vec3(ss), 1.0); return; } finalColor = uDebug > 1.5 ? vec4(nn.rgb, 1.0) : vec4(tile.r, tile.g, nn.a, 1.0); return; }
  bool inWater = tile.g > 0.5;
  vec2 uv = vTextureCoord;
  if (inWater) { // refração
    float w1 = sin(wp.y * 0.21 + uTime * 2.1) + sin(wp.x * 0.13 - uTime * 1.3);
    float w2 = sin(wp.x * 0.33 + uTime * 1.7 + wp.y * 0.1);
    vec2 off = vec2(w1 * 1.3, w2 * 0.9) * uScalePx / uInputSize.xy;
    uv = clamp(vTextureCoord + off, uInputClamp.xy, uInputClamp.zw);
    nrm = texture(uNormalTex, uv * uInputSize.xy / uScreen);
  }
  vec4 base = texture(uTexture, uv);
  bool geo = nrm.a > 0.5;
  vec3 color;
  if (!geo) {
    color = base.rgb * uBgTint;
  } else {
    vec2 nxy = nrm.rg * 2.0 - 1.0; float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
    vec3 n = normalize(vec3(nxy, nz));
    float emis = nrm.b;
    bool selfSolid = tile.r > 0.5;
    // sol
    vec3 sd = normalize(uSunDir);
    float ndl = max(0.0, dot(n, sd));
    float sh = uQuality > 0.5 ? sunShadow(wp, selfSolid) * uShadow : 0.0;
    vec3 light = uAmbient * (1.0 - sh * 0.25) + uSunColor * (ndl * 0.85 + 0.15) * (1.0 - sh * 0.9);
    // AO em pixels de ar perto de sólidos
    if (!selfSolid && uAO > 0.0) { float a = ao(wp); light *= 1.0 - a * 0.45 * uAO; }
    // luzes pontuais
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (float(i) >= uLightCount) break;
      vec4 L = uLights[i]; vec2 d = L.xy - wp; float dist = length(d);
      if (dist > L.z) continue;
      float att = pow(1.0 - dist / L.z, 1.7) * L.w;
      vec3 ldir = normalize(vec3(d.x, -d.y, 22.0));
      float nl = max(0.0, dot(n, ldir)) * 0.75 + 0.25;
      float occ = 0.0;
      if (uQuality > 0.5 && dist > 10.0) {
        bool exited = !selfSolid; vec2 st = d / 7.0;
        for (int k = 1; k < 7; k++) { vec2 p = wp + st * float(k); float s = solidAt(p); if (!exited) { if (s < 0.5) exited = true; continue; } if (s > 0.5) { occ = 1.0; break; } }
      }
      light += uLightColors[i].rgb * att * nl * (1.0 - occ * 0.8);
    }
    // especular sutil do sol (metal/vidro têm normais mais pronunciadas)
    vec3 h = normalize(sd + vec3(0.0, 0.0, 1.0)); float spec = pow(max(0.0, dot(n, h)), 24.0) * 0.18 * (1.0 - sh);
    color = base.rgb * light + spec * uSunColor + base.rgb * emis * 1.6 + vec3(emis * 0.25);
  }
  if (inWater) {
    float c1 = sin(wp.x * 0.35 + uTime * 1.5 + sin(wp.y * 0.3 + uTime)) ; float c2 = sin(wp.y * 0.41 - uTime * 1.1 + sin(wp.x * 0.27 - uTime * 0.7));
    float caust = pow(max(0.0, c1 * c2), 3.0) * 0.5;
    color = mix(color, color * uWaterTint, 0.45) + caust * uWaterTint * 0.6;
    float surface = tile.a > 0.75 ? smoothstep(2.5, 0.0, fract(wp.y / 16.0) * 16.0 - 2.0 - sin(wp.x * 0.3 + uTime * 2.0) * 0.8) : 0.0;
    color += vec3(surface * 0.35);
  }
  finalColor = vec4(color, base.a);
}`;

export class LightingFilter extends Filter {
  constructor() {
    const lights = new Float32Array(MAX_LIGHTS * 4), lightColors = new Float32Array(MAX_LIGHTS * 4);
    const uniforms = {
      uScreen: { value: new Float32Array([1, 1]), type: 'vec2<f32>' }, uCam: { value: new Float32Array([0, 0]), type: 'vec2<f32>' }, uScalePx: { value: 6, type: 'f32' }, uMapPx: { value: new Float32Array([16, 16]), type: 'vec2<f32>' },
      uAmbient: { value: new Float32Array([0.4, 0.4, 0.5]), type: 'vec3<f32>' }, uSunDir: { value: new Float32Array([-0.4, 0.8, 0.5]), type: 'vec3<f32>' }, uSunColor: { value: new Float32Array([1, 0.95, 0.85]), type: 'vec3<f32>' },
      uShadow: { value: 1, type: 'f32' }, uBgTint: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' }, uLights: { value: lights, type: 'vec4<f32>', size: MAX_LIGHTS }, uLightColors: { value: lightColors, type: 'vec4<f32>', size: MAX_LIGHTS },
      uLightCount: { value: 0, type: 'f32' }, uTime: { value: 0, type: 'f32' }, uWaterTint: { value: new Float32Array([0.55, 0.85, 1.0]), type: 'vec3<f32>' }, uQuality: { value: 1, type: 'f32' }, uAO: { value: 1, type: 'f32' }, uDebug: { value: 0, type: 'f32' },
    };
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: frag, name: 'lighting' }), resources: { lightUniforms: uniforms, uNormalTex: Texture.WHITE.source, uTileTex: Texture.WHITE.source } });
    this.u = this.resources.lightUniforms.uniforms; this.lightsArr = lights; this.lightColorsArr = lightColors; this.tileTex = null; this.tileMapVersion = -1; this.tileMapRef = null;
  }
  setNormal(tex) { this.resources.uNormalTex = tex.source; }
  /** Atualiza textura de informação de tiles (R sólido, G água, B lava, A superfície da água). */
  updateTileInfo(map) {
    if (this.tileMapRef === map && this.tileMapVersion === map.version) return;
    const w = map.w, h = map.h; const data = this.tileData && this.tileData.length === w * h * 4 ? this.tileData : (this.tileData = new Uint8Array(w * h * 4));
    for (let i = 0; i < w * h; i++) { const t = map.tiles[i]; const o = i * 4; data[o] = isSolidType(t) ? 255 : 0; data[o + 1] = isWaterType(t) ? 255 : 0; data[o + 2] = t === T.LAVA ? 255 : 0; data[o + 3] = t === T.WATER_TOP ? 255 : (t === T.PLATFORM ? 128 : 0); }
    if (!this.tileTex || this.tileMapRef !== map) {
      if (this.tileTex) this.tileTex.destroy(true);
      const src = new BufferImageSource({ resource: data, width: w, height: h, format: 'rgba8unorm', scaleMode: 'nearest', alphaMode: 'no-premultiply-alpha', addressMode: 'clamp-to-edge' });
      this.tileTex = new Texture({ source: src }); this.resources.uTileTex = src;
    } else { this.tileTex.source.update(); }
    this.tileMapRef = map; this.tileMapVersion = map.version; this.u.uMapPx[0] = w * 16; this.u.uMapPx[1] = h * 16;
  }
  setLights(list) {
    const n = Math.min(MAX_LIGHTS, list.length);
    for (let i = 0; i < n; i++) { const L = list[i]; this.lightsArr[i * 4] = L.x; this.lightsArr[i * 4 + 1] = L.y; this.lightsArr[i * 4 + 2] = L.radius; this.lightsArr[i * 4 + 3] = L.intensity; this.lightColorsArr[i * 4] = L.r; this.lightColorsArr[i * 4 + 1] = L.g; this.lightColorsArr[i * 4 + 2] = L.b; this.lightColorsArr[i * 4 + 3] = 1; }
    this.u.uLightCount = n;
  }
}

/** Presets de luz por "hora" da fase. */
export const LIGHT_PRESETS = {
  morning: { ambient: [0.42, 0.44, 0.54], sunDir: [-0.62, 0.62, 0.5], sun: [1.0, 0.94, 0.8], shadow: 0.9, bg: [1, 1, 1], water: [0.5, 0.85, 1.0] },
  day: { ambient: [0.5, 0.5, 0.55], sunDir: [-0.2, 0.85, 0.5], sun: [1.0, 0.98, 0.9], shadow: 0.9, bg: [1, 1, 1], water: [0.45, 0.8, 1.0] },
  sunset: { ambient: [0.45, 0.36, 0.42], sunDir: [0.75, 0.35, 0.5], sun: [1.0, 0.68, 0.42], shadow: 1.0, bg: [1, 0.95, 0.9], water: [0.8, 0.6, 0.7] },
  night: { ambient: [0.22, 0.25, 0.4], sunDir: [0.3, 0.8, 0.55], sun: [0.45, 0.55, 0.85], shadow: 0.7, bg: [0.85, 0.9, 1], water: [0.3, 0.5, 0.9] },
  cave: { ambient: [0.13, 0.11, 0.16], sunDir: [0.0, 0.9, 0.45], sun: [0.25, 0.2, 0.28], shadow: 0.4, bg: [0.8, 0.8, 0.9], water: [0.4, 0.7, 0.9] },
  underwater: { ambient: [0.3, 0.42, 0.55], sunDir: [-0.1, 0.9, 0.45], sun: [0.6, 0.85, 1.0], shadow: 0.6, bg: [1, 1, 1], water: [0.5, 0.85, 1.0] },
  castle: { ambient: [0.25, 0.22, 0.3], sunDir: [-0.3, 0.8, 0.5], sun: [0.5, 0.45, 0.6], shadow: 0.8, bg: [0.9, 0.9, 1], water: [0.4, 0.7, 0.9] },
};
