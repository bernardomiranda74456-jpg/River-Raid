// Modelos de obstáculos (trens, barreiras, cones, rampas, tapumes, arcos) e
// seus pools. Cada obstáculo ativo é um registro simples usado pela colisão.
import * as THREE from 'three';
import { Pool } from './utils.js';
import { TRAIN_W, TRAIN_H, TRAIN_CAR_LEN, LANE_W } from './config.js';
import { mergeGeoms, box, cyl, wedge } from './geom.js';
import { warningSign, toTexture } from './textures.js';

export const OB = {
  TRAIN: 1, TRAIN_MOVING: 2, LOW: 3, HIGH: 4, CONE: 5, HOARDING: 6, RAMP: 7, ARCH: 8,
};

/** Alturas usadas pela colisão. */
export const OB_DIM = {
  [OB.LOW]: { top: 0.95, depth: 0.5 },
  [OB.CONE]: { top: 0.72, depth: 0.5 },
  [OB.HOARDING]: { top: 1.35, depth: 0.3 },
  [OB.HIGH]: { bottom: 1.15, top: 2.6, depth: 0.5 },
  [OB.ARCH]: { bottom: 1.2, top: 3.0, depth: 1.2 },
};

/* ----------------------------------------------------------- trem */
function flipFaceU(geom, faceIndex) {
  const uv = geom.attributes.uv;
  for (let i = faceIndex * 4; i < faceIndex * 4 + 4; i++) uv.setX(i, 1 - uv.getX(i));
}

function buildBogie() {
  const parts = [];
  parts.push(box(2.0, 0.3, 2.6, 0, 0.55, 0));                   // quadro
  parts.push(box(0.25, 0.25, 2.8, -0.9, 0.5, 0)); parts.push(box(0.25, 0.25, 2.8, 0.9, 0.5, 0));
  for (const z of [-0.9, 0.9]) {
    parts.push(cyl(0.05, 0.05, 1.6, 6, 0, 0.42, z, Math.PI / 2));   // eixo
    for (const x of [-0.72, 0.72]) parts.push(cyl(0.42, 0.42, 0.12, 20, x, 0.42, z, Math.PI / 2));
  }
  parts.push(box(0.6, 0.3, 0.6, 0, 0.75, 0));
  return mergeGeoms(parts);
}
let BOGIE = null, ROOF_AC = null, PANTO = null;

export function buildTrain(M, setIndex, cars, withCab = true) {
  if (!BOGIE) {
    BOGIE = buildBogie();
    ROOF_AC = mergeGeoms([box(1.6, 0.35, 2.4), box(1.2, 0.1, 1.8, 0, 0.22, 0), cyl(0.3, 0.3, 0.12, 12, 0, 0.3, 0.6), cyl(0.3, 0.3, 0.12, 12, 0, 0.3, -0.6)]);
    PANTO = mergeGeoms([box(1.4, 0.06, 0.1, 0, 0.9, 0), box(0.05, 0.9, 0.05, -0.3, 0.45, 0.3), box(0.05, 0.9, 0.05, 0.3, 0.45, 0.3), box(0.05, 0.9, 0.05, -0.3, 0.45, -0.3), box(0.05, 0.9, 0.05, 0.3, 0.45, -0.3), box(1.2, 0.08, 0.9, 0, 0.05, 0)]);
  }
  const set = M.trainSets[setIndex % M.trainSets.length];
  const g = new THREE.Group();
  const floorY = 0.85, bodyH = TRAIN_H - floorY;
  const bogies = [];
  for (let c = 0; c < cars; c++) {
    const z0 = c * (TRAIN_CAR_LEN + 0.6);
    const geo = new THREE.BoxGeometry(TRAIN_W, bodyH, TRAIN_CAR_LEN);
    flipFaceU(geo, 1); // só a face -x fica espelhada por padrão
    const isFront = c === 0, isBack = c === cars - 1;
    const mats = [set.side, set.side, M.trainRoof, M.trainUnder, (isBack && withCab) ? set.front : M.trainUnder, (isFront && withCab) ? set.front : M.trainUnder];
    const body = new THREE.Mesh(geo, mats);
    body.position.set(0, floorY + bodyH / 2, z0 + TRAIN_CAR_LEN / 2);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // cantos arredondados do teto (calhas)
    const roofEdge = new THREE.Mesh(box(TRAIN_W + 0.06, 0.12, TRAIN_CAR_LEN), M.trainUnder);
    roofEdge.position.set(0, TRAIN_H - 0.06, z0 + TRAIN_CAR_LEN / 2);
    g.add(roofEdge);
    // saia inferior
    const skirt = new THREE.Mesh(box(TRAIN_W - 0.2, 0.5, TRAIN_CAR_LEN - 1), M.trainUnder);
    skirt.position.set(0, floorY - 0.25, z0 + TRAIN_CAR_LEN / 2);
    g.add(skirt);
    for (const bz of [3.2, TRAIN_CAR_LEN - 3.2]) {
      const b = new THREE.Mesh(BOGIE, M.steelDark);
      b.position.set(0, 0, z0 + bz);
      b.castShadow = true;
      g.add(b); bogies.push(b);
    }
    for (const az of [4.5, TRAIN_CAR_LEN - 4.5]) {
      const ac = new THREE.Mesh(ROOF_AC, M.steelDark);
      ac.position.set(0, TRAIN_H + 0.17, z0 + az);
      ac.castShadow = true;
      g.add(ac);
    }
    if (c === 0 || c === cars - 1) {
      const p = new THREE.Mesh(PANTO, M.steelDark);
      p.position.set(0, TRAIN_H, z0 + (c === 0 ? 9 : 9));
      g.add(p);
    }
    if (c < cars - 1) { // engate/fole
      const bellows = new THREE.Mesh(box(TRAIN_W - 0.5, bodyH - 0.4, 0.7), M.rubber);
      bellows.position.set(0, floorY + bodyH / 2, z0 + TRAIN_CAR_LEN + 0.3);
      g.add(bellows);
    }
  }
  // faróis (geometria emissiva) nas extremidades
  const lights = [];
  const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const tailGeo = new THREE.SphereGeometry(0.1, 8, 6);
  const total = cars * (TRAIN_CAR_LEN + 0.6) - 0.6;
  for (const [z, front] of [[0, true], [total, false]]) {
    if (!withCab) break;
    for (const x of [-0.74, 0.74]) {
      const h = new THREE.Mesh(headGeo, M.headlight);
      h.position.set(x, floorY + bodyH * 0.32, z + (front ? -0.02 : 0.02));
      g.add(h); lights.push(h);
      const t = new THREE.Mesh(tailGeo, M.taillight);
      t.position.set(x * 1.35, floorY + bodyH * 0.3, z + (front ? -0.02 : 0.02));
      g.add(t); lights.push(t);
    }
  }
  g.userData = { cars, length: total, bogies, lights, setIndex };
  return g;
}

/* ------------------------------------------------------ barreiras */
let STRIPES = null;
function stripesMat() {
  if (!STRIPES) {
    const c = warningSign(256, 64, '');
    STRIPES = new THREE.MeshStandardMaterial({ map: toTexture(c, { srgb: true, repeat: [2, 1] }), roughness: 0.55, metalness: 0.2 });
  }
  return STRIPES;
}

export function buildLowBarrier(M) {
  const g = new THREE.Group();
  const post = cyl(0.05, 0.06, 0.95, 8);
  for (const x of [-1.0, 1.0]) { const p = new THREE.Mesh(post, M.rustMetal); p.position.set(x, 0.475, 0); p.castShadow = true; g.add(p); }
  const bar = new THREE.Mesh(box(2.3, 0.22, 0.08), stripesMat());
  bar.position.set(0, 0.84, 0); bar.castShadow = true;
  g.add(bar);
  const bar2 = new THREE.Mesh(box(2.2, 0.06, 0.06), M.rustMetal);
  bar2.position.set(0, 0.45, 0); g.add(bar2);
  const base = new THREE.Mesh(box(2.4, 0.08, 0.5), M.concreteDark);
  base.position.set(0, 0.04, 0); base.receiveShadow = true; g.add(base);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), M.taillight);
  lamp.position.set(0, 1.0, 0); g.add(lamp);
  g.userData.bar = bar;
  return g;
}

export function buildHighBarrier(M) {
  const g = new THREE.Group();
  const post = box(0.12, 2.6, 0.12);
  for (const x of [-1.08, 1.08]) { const p = new THREE.Mesh(post, M.rustMetal); p.position.set(x, 1.3, 0); p.castShadow = true; g.add(p); }
  const panel = new THREE.Mesh(box(2.3, 1.1, 0.06), M.warning2);
  panel.position.set(0, 1.75, 0); panel.castShadow = true; g.add(panel);
  const top = new THREE.Mesh(box(2.4, 0.1, 0.2), stripesMat());
  top.position.set(0, 2.5, 0); g.add(top);
  const bar = new THREE.Mesh(box(2.3, 0.08, 0.08), M.rustMetal);
  bar.position.set(0, 1.18, 0); g.add(bar);
  return g;
}

export function buildCone(M) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(cyl(0.05, 0.22, 0.68, 14, 0, 0.36, 0), M.cone);
  c.castShadow = true; g.add(c);
  const stripe = new THREE.Mesh(cyl(0.105, 0.145, 0.12, 14, 0, 0.42, 0), M.coneStripe);
  g.add(stripe);
  const base = new THREE.Mesh(box(0.5, 0.04, 0.5, 0, 0.02, 0), M.plastic);
  g.add(base);
  return g;
}

export function buildHoarding(M) {
  const g = new THREE.Group();
  const planks = [];
  for (let i = 0; i < 7; i++) planks.push(box(0.28, 1.3, 0.04, -0.96 + i * 0.32, 0.7, 0));
  planks.push(box(2.3, 0.12, 0.05, 0, 0.35, -0.04)); planks.push(box(2.3, 0.12, 0.05, 0, 1.1, -0.04));
  const m = new THREE.Mesh(mergeGeoms(planks), M.woodDark);
  m.castShadow = true; g.add(m);
  for (const x of [-1.05, 1.05]) { const p = new THREE.Mesh(box(0.08, 1.35, 0.08), M.rustMetal); p.position.set(x, 0.68, -0.06); g.add(p); }
  const sign = new THREE.Mesh(box(1.1, 0.5, 0.02), M.warning);
  sign.position.set(0.3, 0.9, 0.03); g.add(sign);
  return g;
}

export function buildRamp(M) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(wedge(TRAIN_W - 0.1, TRAIN_H + 0.02, 7), M.ramp);
  m.castShadow = true; m.receiveShadow = true; g.add(m);
  const sl = new THREE.Mesh(box(0.08, 0.12, 7.2, -TRAIN_W / 2 + 0.02, 0, 3.6), M.yellowMetal);
  const sr = new THREE.Mesh(box(0.08, 0.12, 7.2, TRAIN_W / 2 - 0.02, 0, 3.6), M.yellowMetal);
  g.add(sl, sr);
  g.userData.len = 7;
  return g;
}

export function buildArch(M) {
  const g = new THREE.Group();
  const d = OB_DIM[OB.ARCH];
  for (const x of [-1.15, 1.15]) { const p = new THREE.Mesh(box(0.35, d.top, d.depth, x, d.top / 2, 0, 0.5), M.concreteDark); p.castShadow = true; p.receiveShadow = true; g.add(p); }
  const lintel = new THREE.Mesh(box(2.7, d.top - d.bottom, d.depth, 0, (d.top + d.bottom) / 2, 0, 0.5), M.concreteDark);
  lintel.castShadow = true; g.add(lintel);
  const sign = new THREE.Mesh(box(1.6, 0.4, 0.02), M.warning);
  sign.position.set(0, d.bottom + 0.35, -d.depth / 2 - 0.02); g.add(sign);
  const lamp = new THREE.Mesh(box(0.6, 0.05, 0.1), M.tunnelLight);
  lamp.position.set(0, d.bottom - 0.03, 0); g.add(lamp);
  return g;
}

/* -------------------------------------------------------- pools */
export class ObstaclePools {
  constructor(scene, M) {
    this.scene = scene;
    this.M = M;
    const mk = (fn) => new Pool(() => { const g = fn(M); g.visible = false; scene.add(g); return g; }, (g) => { g.visible = true; g.rotation.set(0, 0, 0); g.position.set(0, 0, 0); });
    this.low = mk(buildLowBarrier);
    this.high = mk(buildHighBarrier);
    this.cone = mk(buildCone);
    this.hoarding = mk(buildHoarding);
    this.ramp = mk(buildRamp);
    this.arch = mk(buildArch);
    // trens: pools por número de vagões (1..3) alternando pinturas
    this.trains = [null, [], [], []];
    for (let cars = 1; cars <= 3; cars++) {
      for (let li = 0; li < M.trainSets.length; li++) {
        const pool = new Pool(() => { const g = buildTrain(M, li, cars); g.visible = false; scene.add(g); return g; }, (g) => { g.visible = true; g.rotation.set(0, 0, 0); });
        this.trains[cars].push(pool);
      }
    }
  }
  warm() {
    this.low.warm(14); this.high.warm(10); this.cone.warm(16); this.hoarding.warm(8); this.ramp.warm(6); this.arch.warm(6);
    this.trains[1].forEach((p) => p.warm(2)); this.trains[2].forEach((p) => p.warm(2)); this.trains[3].forEach((p) => p.warm(1));
  }
  acquireTrain(cars, livery) { const pools = this.trains[cars]; return pools[livery % pools.length].acquire(); }
  releaseTrain(g) { g.visible = false; this.trains[g.userData.cars][g.userData.setIndex].release(g); }
  acquire(type) { return this[type].acquire(); }
  release(type, g) { g.visible = false; this[type].release(g); }
}

/** Registro de obstáculo ativo (sem alocação: reutilizado via pool de registros). */
export function makeRecord() {
  return { type: 0, lane: 1, x: 0, z0: 0, z1: 0, top: 0, bottom: 0, mesh: null, poolType: '', speed: 0, hit: false, scored: false, passed: false, active: false, chunk: null, rampLen: 0, hasRamp: false, livery: 0, hornPlayed: false, sparkT: 0 };
}

export const laneX = (lane) => (lane - 1) * LANE_W;
