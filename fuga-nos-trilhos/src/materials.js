// Materiais PBR compartilhados, construídos a partir das texturas procedurais.
// Inclui injeções de shader (onBeforeCompile): UV em espaço de mundo para
// prédios instanciados, giro das moedas no vertex shader e "molhado" global.
import * as THREE from 'three';
import { RNG } from './utils.js';
import * as T from './textures.js';

/** Uniforms globais compartilhados por vários materiais. */
export const globalUniforms = {
  uTime: { value: 0 },
  uWet: { value: 0 },      // 0..1 chuva/chão molhado
  uNight: { value: 0 },    // 0..1 intensidade de luzes noturnas
};

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

/** Injeção: molhado (reduz roughness, escurece difuso). */
function injectWet(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWet = globalUniforms.uWet;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, roughnessFactor * 0.18, uWet);')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.62, uWet);');
  };
  mat.customProgramCacheKey = () => 'wet';
  return mat;
}

/** Injeção: fachadas com UV em espaço de mundo (janelas de tamanho constante). */
function injectWorldUV(mat, winScale) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWinScale = { value: new THREE.Vector2(winScale[0], winScale[1]) };
    shader.uniforms.uNight = globalUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNormal;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wp4 = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          vWNormal = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
        #else
          vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
          vWNormal = normalize(mat3(modelMatrix) * objectNormal);
        #endif
        vWPos = wp4.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNormal; uniform vec2 uWinScale; uniform float uNight;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec3 an = abs(vWNormal);
        vec2 wuv = an.x > 0.5 ? vec2(vWPos.z, vWPos.y) : (an.y > 0.5 ? vec2(vWPos.x, vWPos.z) : vec2(vWPos.x, vWPos.y));
        wuv *= uWinScale;
        float roofMask = step(0.5, an.y);`)
      .replace('#include <map_fragment>', `
        vec4 sampledDiffuseColor = texture2D( map, wuv );
        diffuseColor *= mix(sampledDiffuseColor, vec4(0.22, 0.22, 0.24, 1.0), roofMask);`)
      .replace('#include <emissivemap_fragment>', `
        vec4 emissiveColor = texture2D( emissiveMap, wuv );
        totalEmissiveRadiance *= emissiveColor.rgb * (1.0 - roofMask);`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        vec4 texelRoughness = texture2D( roughnessMap, wuv );
        roughnessFactor *= mix(texelRoughness.g, 0.9, roofMask);`);
  };
  mat.customProgramCacheKey = () => 'worlduv' + winScale.join('_');
  return mat;
}

/** Injeção: moedas giram no vertex shader (sem atualizar matrizes na CPU). */
function injectSpin(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float spinPh = uTime * 4.0 + instanceMatrix[3][2] * 0.9;
        float cs = cos(spinPh), sn = sin(spinPh);
        mat2 spinM = mat2(cs, -sn, sn, cs);
        objectNormal.xz = spinM * objectNormal.xz;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.xz = spinM * transformed.xz;
        transformed.y += sin(uTime * 3.0 + instanceMatrix[3][2]) * 0.06;`);
  };
  mat.customProgramCacheKey = () => 'spin';
  return mat;
}

export function scaleUV(geometry, sx, sy) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Constrói todos os materiais. Executa em etapas assíncronas para animar a
 * barra de carregamento.
 */
export async function buildMaterials(preset, onProgress) {
  const M = {};
  const r = T.texRng;
  const N = 512;                                  // texturas de ruído (tiling)
  const big = preset.textureSize >= 1024;         // texturas desenhadas (livery, grafite)
  const aniso = preset.anisotropy;
  const steps = [];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const tex = (c, o) => T.toTexture(c, Object.assign({ aniso }, o));

  steps.push(['Concreto', () => {
    const s = T.concreteSet(N, { seed: 1 });
    M.concrete = injectWet(std({ map: tex(s.map, { srgb: true }), normalMap: tex(s.normal), roughnessMap: tex(s.rough), normalScale: new THREE.Vector2(0.9, 0.9) }));
    M.concreteCanvas = s.map; M.concreteNormal = M.concrete.normalMap;
    const d = T.concreteSet(N, { seed: 9, tint: 0x6a6a68, dark: 0x2b2b2a, soot: 1, cracks: 6 });
    M.concreteDark = std({ map: tex(d.map, { srgb: true }), normalMap: tex(d.normal), roughnessMap: tex(d.rough) });
    const p = T.concreteSet(N, { seed: 4, tint: 0x9c998f, dark: 0x6a6862, cracks: 2, stains: 3 });
    M.concreteLight = injectWet(std({ map: tex(p.map, { srgb: true }), normalMap: tex(p.normal), roughnessMap: tex(p.rough) }));
    M.sleeper = std({ map: tex(p.map, { srgb: true, repeat: [0.4, 0.1] }), normalMap: M.concreteLight.normalMap, roughness: 0.9, color: 0x8a867c });
  }]);
  steps.push(['Asfalto e brita', () => {
    const a = T.asphaltSet(N);
    M.asphalt = injectWet(std({ map: tex(a.map, { srgb: true }), normalMap: tex(a.normal), roughnessMap: tex(a.rough), normalScale: new THREE.Vector2(0.7, 0.7) }));
    const b = T.ballastSet(N);
    M.ballast = injectWet(std({ map: tex(b.map, { srgb: true }), normalMap: tex(b.normal), roughnessMap: tex(b.rough), normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 0.35 }));
  }]);
  steps.push(['Metais', () => {
    const m = T.rustMetalSet(N, { seed: 4 });
    M.rustMetal = std({ map: tex(m.map, { srgb: true }), roughnessMap: tex(m.rough), metalnessMap: tex(m.metal), normalMap: tex(m.normal), metalness: 1, roughness: 1 });
    const y = T.rustMetalSet(N, { seed: 8, base: 0xd8a800, rust: 0x6a3a18, amount: 0.3 });
    M.yellowMetal = std({ map: tex(y.map, { srgb: true }), roughnessMap: tex(y.rough), metalnessMap: tex(y.metal), normalMap: tex(y.normal), metalness: 1, roughness: 1 });
    const rd = T.rustMetalSet(N, { seed: 15, base: 0xc8102e, rust: 0x5a2a12, amount: 0.3 });
    M.redMetal = std({ map: tex(rd.map, { srgb: true }), roughnessMap: tex(rd.rough), metalnessMap: tex(rd.metal), normalMap: tex(rd.normal), metalness: 1, roughness: 1 });
    const railR = T.genPixels(N, 32, (u, v, o) => { const n = T.vnoise(u * 512, v * 8, 512); o[0] = o[1] = o[2] = (0.2 + n * 0.25) * 255; });
    M.rail = phys({ color: 0x70757a, metalness: 1, roughness: 0.42, roughnessMap: tex(railR), clearcoat: 0.2, clearcoatRoughness: 0.3 });
    M.railWeb = std({ color: 0x5a4a3e, metalness: 0.7, roughness: 0.85, map: tex(m.map, { srgb: true, repeat: [8, 1] }) });
    M.steelDark = std({ color: 0x2a2d31, metalness: 0.9, roughness: 0.55 });
    M.steelLight = phys({ color: 0xc9ccd0, metalness: 1, roughness: 0.3, clearcoat: 0.5 });
    M.wire = std({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.5 });
    M.rubber = std({ color: 0x141414, roughness: 0.95, metalness: 0 });
    M.chrome = phys({ color: 0xffffff, metalness: 1, roughness: 0.08 });
  }]);
  steps.push(['Paredes e tijolos', () => {
    const b = T.brickSet(N, { seed: 5 });
    M.brick = injectWet(std({ map: tex(b.map, { srgb: true }), normalMap: tex(b.normal), roughnessMap: tex(b.rough), normalScale: new THREE.Vector2(1, 1) }));
    const b2 = T.brickSet(N, { seed: 21, tint: 0x6e5a52, mortar: 0x7e7a72 });
    M.brickDark = injectWet(std({ map: tex(b2.map, { srgb: true }), normalMap: tex(b2.normal), roughnessMap: tex(b2.rough) }));
    M.graffiti = [];
    const gw = big ? 2048 : 1024, gh = gw / 4;
    for (let i = 0; i < 8; i++) {
      const base = i % 2 ? b.map : M.concreteCanvas;
      const c = T.graffitiWall(base, gw, gh, r);
      const nm = i % 2 ? M.brick.normalMap : M.concreteNormal;
      const m = injectWet(std({ map: tex(c, { srgb: true, wrap: false }), normalMap: nm, roughness: 0.85, normalScale: new THREE.Vector2(0.7, 0.7) }));
      m.userData.wide = true;
      M.graffiti.push(m);
    }
    const w = T.woodSet(N);
    M.wood = std({ map: tex(w.map, { srgb: true }), normalMap: tex(w.normal), roughnessMap: tex(w.rough) });
    const w2 = T.woodSet(N, { tint: 0x5b4a3a, seed: 9, planks: 8 });
    M.woodDark = std({ map: tex(w2.map, { srgb: true }), normalMap: tex(w2.normal), roughnessMap: tex(w2.rough) });
    M.corrugated = [0x2f5f8a, 0x8a2f2f, 0x4f7a3a, 0x8a7a2f, 0x55585c].map((c, i) => {
      const s = T.corrugatedSet(N, { tint: c, seed: 7 + i });
      return std({ map: tex(s.map, { srgb: true }), normalMap: tex(s.normal), roughnessMap: tex(s.rough), metalnessMap: tex(s.metal), metalness: 1, roughness: 1 });
    });
    const t = T.tileSet(N);
    M.tiles = injectWet(std({ map: tex(t.map, { srgb: true }), normalMap: tex(t.normal), roughnessMap: tex(t.rough) }));
    M.tactile = std({ color: 0xe8c21a, roughness: 0.8, normalMap: M.tiles.normalMap });
  }]);
  steps.push(['Trens', () => {
    const lw = big ? 2048 : 1024, lh = big ? 512 : 256, fs = big ? 1024 : 512;
    const liveries = [
      { body: 0xc8102e, accent: 0xf2f2f2, stripe: 0x1c1c1c, line: 'LINHA 9' },
      { body: 0x1f4e9c, accent: 0xf7d117, stripe: 0x14213d, line: 'EXPRESSO' },
      { body: 0x2e7d4f, accent: 0xd9d9d9, stripe: 0x1b1b1b, line: 'PÁTIO' },
      { body: 0xe07b1a, accent: 0x222222, stripe: 0x3a3a3a, line: 'CARGA' },
      { body: 0x8e8e93, accent: 0xc8102e, stripe: 0x2a2a2a, line: 'LINHA 9' },
    ];
    M.trainSets = liveries.map((l, i) => {
      const side = T.trainLiverySet(lw, lh, Object.assign({ seed: 10 + i, number: 1100 + i * 137 }, l));
      const front = T.trainFrontSet(fs, Object.assign({ seed: 20 + i }, l));
      const sideMat = phys({
        map: tex(side.map, { srgb: true, wrap: false }), roughnessMap: tex(side.rough, { wrap: false }), metalnessMap: tex(side.metal, { wrap: false }),
        normalMap: tex(side.normal, { wrap: false }), normalScale: new THREE.Vector2(0.5, 0.5), emissiveMap: tex(side.emissive, { srgb: true, wrap: false }),
        emissive: 0xffffff, emissiveIntensity: 0, metalness: 1, roughness: 1, clearcoat: 0.6, clearcoatRoughness: 0.3,
      });
      const frontMat = phys({
        map: tex(front.map, { srgb: true, wrap: false }), roughnessMap: tex(front.rough, { wrap: false }), emissiveMap: tex(front.emissive, { srgb: true, wrap: false }),
        emissive: 0xffffff, emissiveIntensity: 0.4, metalness: 0.2, roughness: 1, clearcoat: 0.6, clearcoatRoughness: 0.3,
      });
      return { side: sideMat, front: frontMat, body: l.body };
    });
    const roof = T.trainRoofSet(N);
    M.trainRoof = std({ map: tex(roof.map, { srgb: true, repeat: [4, 1] }), roughnessMap: tex(roof.rough, { repeat: [4, 1] }), metalness: 0.4, roughness: 1 });
    M.trainUnder = std({ color: 0x1a1a1c, roughness: 0.95, metalness: 0.3 });
    M.glass = phys({ color: 0x0b1420, metalness: 0, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
    M.headlight = std({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 6 });
    M.taillight = std({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 4 });
  }]);
  steps.push(['Prédios e cidade', () => {
    const fsz = big ? 1024 : 512;
    M.facades = ['office', 'residential', 'old'].map((kind, i) => {
      const f = T.facadeSet(fsz, { kind, seed: 13 + i });
      const m = std({ map: tex(f.map, { srgb: true }), emissiveMap: tex(f.emissive, { srgb: true }), emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: tex(f.rough), roughness: 1, metalness: 0.05 });
      // a textura cobre N colunas/linhas de janelas: ~2 m por janela, 3 m por andar
      const cols = kind === 'office' ? 6 : kind === 'residential' ? 5 : 4, rows = kind === 'office' ? 6 : 5;
      return injectWorldUV(m, [1 / (cols * 2.2), 1 / (rows * 3.1)]);
    });
    const sk = T.skylineStrip(4096, 512, r);
    M.skyline = new THREE.MeshBasicMaterial({ map: tex(sk.map, { srgb: true, wrap: true }), transparent: true, depthWrite: false, fog: false, side: THREE.BackSide });
    M.skylineEmissive = tex(sk.emissive, { srgb: true, wrap: true });
    M.signs = {};
    const names = ['Aurora', 'Pátio Norte', 'Vila Catenária', 'Largo do Viaduto', 'Jardim Fumaça', 'Ponte Seca'];
    M.stationSigns = names.map((n) => new THREE.MeshStandardMaterial({ map: tex(T.stationSign(1024, 192, n), { srgb: true, wrap: false }), roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
    M.stationNames = names;
    M.warning = std({ map: tex(T.warningSign(512, 256, 'CUIDADO'), { srgb: true, wrap: false }), roughness: 0.6 });
    M.warning2 = std({ map: tex(T.warningSign(512, 256, 'NÃO ULTRAPASSE'), { srgb: true, wrap: false }), roughness: 0.6 });
    M.ads = [];
    for (let i = 0; i < 6; i++) M.ads.push(std({ map: tex(T.adPoster(1024, 512, r), { srgb: true, wrap: false }), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 }));
    M.ads.forEach((a) => { a.emissiveMap = a.map; });
    M.neons = [['NÉON', '#ff2d95'], ['AURORA', '#00e5ff'], ['24h', '#ffd60a'], ['RÁDIO 9', '#7dff5a'], ['TRILHO', '#ff7a00']].map(([t, c]) =>
      new THREE.MeshBasicMaterial({ map: tex(T.neonSign(512, 128, t, c), { srgb: true, wrap: false }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(c).multiplyScalar(2.5), fog: true }));
    M.lampGlow = std({ color: 0xffe9b0, emissive: 0xffd080, emissiveIntensity: 0 });
    M.tunnelLight = std({ color: 0xffffff, emissive: 0xdfe8ff, emissiveIntensity: 0.6 });
    M.cone = std({ color: 0xff6a00, roughness: 0.6, metalness: 0 });
    M.coneStripe = std({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.1 });
    M.plastic = std({ color: 0x222222, roughness: 0.6 });
    M.barrierPaint = M.yellowMetal;
    M.hoarding = M.wood;
  }]);
  steps.push(['Coletáveis', () => {
    M.coin = injectSpin(phys({ color: 0xffc83d, metalness: 1, roughness: 0.22, emissive: 0xff9a00, emissiveIntensity: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
    M.key = phys({ color: 0xffe066, metalness: 1, roughness: 0.25, emissive: 0xffaa00, emissiveIntensity: 0.4 });
    M.magnet = phys({ color: 0xd0d0d0, metalness: 0.9, roughness: 0.3 });
    M.magnetRed = phys({ color: 0xff2a2a, metalness: 0.2, roughness: 0.35, clearcoat: 1 });
    M.jet = phys({ color: 0x3a8dff, metalness: 0.6, roughness: 0.3, clearcoat: 1 });
    M.sneaker = phys({ color: 0x33e07a, metalness: 0.1, roughness: 0.4, clearcoat: 0.8 });
    M.multi = phys({ color: 0xff4fd8, metalness: 0.3, roughness: 0.3, emissive: 0xff2fb0, emissiveIntensity: 0.5 });
    M.board = phys({ color: 0x1fd8ff, metalness: 0.5, roughness: 0.2, clearcoat: 1, emissive: 0x0a7cff, emissiveIntensity: 0.6 });
    M.powerGlow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    M.ramp = std({ map: M.rustMetal.map, normalMap: M.rustMetal.normalMap, roughnessMap: M.rustMetal.roughnessMap, metalnessMap: M.rustMetal.metalnessMap, metalness: 1, roughness: 1, color: 0x9a9a9a });
  }]);
  steps.push(['Sprites', () => {
    const rr = new RNG(77);
    M.sprites = {
      soft: tex(T.spriteSoft(64), { wrap: false }), spark: tex(T.spriteSpark(64), { wrap: false }),
      streak: tex(T.spriteStreak(16, 64), { wrap: false }), smoke: tex(T.spriteSmoke(128, rr), { wrap: false }),
      leaf: tex(T.spriteLeaf(32), { wrap: false }), ring: tex(T.spriteRing(64), { wrap: false }), flare: tex(T.spriteFlare(256), { wrap: false }),
    };
    const fab = T.fabricSet(256, 0xffffff);
    M.fabricNormal = tex(fab.normal, { repeat: [2, 2] });
    M.skin = (c) => phys({ color: c, roughness: 0.55, metalness: 0, sheen: 0.3, sheenColor: new THREE.Color(0xffd0b0) });
    M.cloth = (c) => std({ color: c, roughness: 0.85, metalness: 0, normalMap: M.fabricNormal, normalScale: new THREE.Vector2(0.4, 0.4) });
    M.shiny = (c) => phys({ color: c, roughness: 0.3, metalness: 0.1, clearcoat: 0.8 });
    M.hair = (c) => std({ color: c, roughness: 0.6, metalness: 0 });
  }]);

  for (let i = 0; i < steps.length; i++) {
    if (onProgress) onProgress(i / steps.length, steps[i][0]);
    await nextFrame();
    steps[i][1]();
  }
  if (onProgress) onProgress(1, 'Pronto');
  return M;
}
