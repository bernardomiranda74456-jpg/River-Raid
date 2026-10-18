// Props de cenário (pooled). Cada builder recebe (M, rng) e devolve um Group em
// coordenadas locais do chunk. Props "sided" são construídos no lado +x e
// rotacionados 180° para o lado -x (rotação, não espelhamento: textos legíveis).
import * as THREE from 'three';
import { Pool } from './utils.js';
import { CHUNK_LEN, LANE_W } from './config.js';
import { mergeGeoms, mergeByMaterial, box, cyl, wallPlane, floorPlane, railGeometry } from './geom.js';
import { buildTrain } from './obstacles.js';

const L = CHUNK_LEN;
let EXTRA = null;
function extra(M) {
  if (!EXTRA) {
    EXTRA = {
      leaf: new THREE.MeshStandardMaterial({ color: 0x24401f, roughness: 1, metalness: 0 }),
      leaf2: new THREE.MeshStandardMaterial({ color: 0x3a5222, roughness: 1, metalness: 0 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 }),
      earth: new THREE.MeshStandardMaterial({ map: M.ballast.map, color: 0x4a3f33, roughness: 1, normalMap: M.ballast.normalMap }),
      tunnelIn: (() => { const m = M.concreteDark.clone(); m.side = THREE.BackSide; return m; })(),
      signalRed: new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 3 }),
      signalGreen: new THREE.MeshStandardMaterial({ color: 0x003000, emissive: 0x30ff60, emissiveIntensity: 3 }),
      vending: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9fd0ff, emissiveIntensity: 1.2, roughness: 0.3 }),
      floodGlow: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 0 }),
    };
  }
  return EXTRA;
}
export const extraMats = extra;

const sh = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
/** Decal de luz no chão (sob um poste/luminária). */
function lampPool(M, x, y, z, r = 6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), M.lampPool);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.userData.keep = true; m.renderOrder = 2;
  return m;
}

/* ------------------------------------------------------------ builders */
export const BUILDERS = {
  wall(M, rng) {
    const g = new THREE.Group();
    const len = 30, h = 3.7, x = 8.6;
    const useGraf = rng.chance(0.75);
    const mat = useGraf ? rng.pick(M.graffiti) : rng.pick([M.brick, M.brickDark, M.concrete]);
    const front = new THREE.Mesh(useGraf ? new THREE.PlaneGeometry(len, h) : wallPlane(len, h, 0.25), mat);
    front.rotation.y = -Math.PI / 2; front.position.set(x, h / 2 - 0.3, len / 2);
    sh(front, false, true); g.add(front);
    const back = sh(new THREE.Mesh(box(1.0, h, len, x + 0.5, h / 2 - 0.3, len / 2, 0.25), M.concreteDark));
    g.add(back);
    const cap = sh(new THREE.Mesh(box(1.2, 0.18, len, x + 0.5, h - 0.3 + 0.09, len / 2, 0.25), M.concreteLight));
    g.add(cap);
    if (rng.chance(0.45)) { // cartaz
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), rng.pick(M.ads));
      p.rotation.y = -Math.PI / 2; p.position.set(x - 0.03, 1.9, rng.range(3, len - 3)); g.add(p);
    }
    if (rng.chance(0.3)) { // néon
      const n = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), rng.pick(M.neons));
      n.rotation.y = -Math.PI / 2; n.position.set(x - 0.08, 2.8, rng.range(4, len - 4)); g.add(n);
    }
    if (rng.chance(0.4)) { // caixa de cabos
      const b = sh(new THREE.Mesh(box(0.3, 0.8, 0.6, x - 0.15, 1.3, rng.range(2, len - 2)), M.steelDark));
      g.add(b);
    }
    g.userData.len = len;
    return g;
  },
  lamp(M) {
    const g = new THREE.Group();
    const x = 7.7;
    g.add(sh(new THREE.Mesh(cyl(0.07, 0.11, 7.5, 10, x, 3.75 - 0.3, 0), M.rustMetal)));
    g.add(sh(new THREE.Mesh(box(0.5, 0.25, 0.5, x, 0.1 - 0.3, 0), M.concreteLight)));
    g.add(new THREE.Mesh(cyl(0.05, 0.05, 1.8, 8, x - 0.9, 6.9, 0, Math.PI / 2), M.rustMetal));
    g.add(sh(new THREE.Mesh(box(0.7, 0.18, 0.35, x - 1.8, 6.95, 0), M.steelDark)));
    g.add(new THREE.Mesh(box(0.6, 0.04, 0.28, x - 1.8, 6.85, 0), M.lampGlow));
    g.userData.lamp = new THREE.Vector3(x - 1.8, 6.6, 0);
    g.add(lampPool(M, x - 2.2, -0.19, 0, 6.5));
    g.userData.len = 0;
    return g;
  },
  catenary(M) {
    const g = new THREE.Group();
    const parts = [];
    for (const x of [-7.9, 7.9]) { parts.push(box(0.3, 9.4, 0.3, x, 4.4, 0)); parts.push(box(0.7, 0.3, 0.7, x, -0.15, 0)); }
    parts.push(box(16.2, 0.35, 0.35, 0, 9.0, 0));
    parts.push(box(16.2, 0.12, 0.12, 0, 8.5, 0));
    for (let i = 0; i < 12; i++) parts.push(box(0.08, 0.5, 0.08, -7.5 + i * 1.36, 8.75, 0));
    g.add(sh(new THREE.Mesh(mergeGeoms(parts), M.rustMetal)));
    const ins = [];
    for (let l = 0; l < 3; l++) { const x = (l - 1) * LANE_W; ins.push(cyl(0.06, 0.09, 0.6, 8, x, 8.1, 0)); ins.push(box(0.5, 0.06, 0.06, x, 7.75, 0)); ins.push(box(0.04, 0.3, 0.04, x, 7.6, 0)); }
    g.add(new THREE.Mesh(mergeGeoms(ins), M.plastic));
    g.userData.len = 0;
    return g;
  },
  overpass(M, rng) {
    const g = new THREE.Group();
    const w = 44, y = 9.6;
    g.add(sh(new THREE.Mesh(box(w, 1.3, 7, 0, y + 0.65, 0, 0.25), M.concreteLight)));
    g.add(sh(new THREE.Mesh(box(w, 0.1, 7.1, 0, y - 0.02, 0, 0.25), M.concreteDark)));
    for (const z of [-3.6, 3.6]) g.add(sh(new THREE.Mesh(box(w, 1.1, 0.3, 0, y + 1.85, z, 0.25), M.concreteLight)));
    // grade de proteção
    const fence = [];
    for (let i = 0; i <= 22; i++) { fence.push(box(0.06, 2.2, 0.06, -w / 2 + i * 2, y + 3.4, -3.6)); fence.push(box(0.06, 2.2, 0.06, -w / 2 + i * 2, y + 3.4, 3.6)); }
    fence.push(box(w, 0.06, 0.06, 0, y + 4.5, -3.6)); fence.push(box(w, 0.06, 0.06, 0, y + 4.5, 3.6));
    g.add(new THREE.Mesh(mergeGeoms(fence), M.steelDark));
    for (const x of [-9.4, 9.4]) g.add(sh(new THREE.Mesh(box(1.6, y, 2.4, x, y / 2 - 0.3, 0, 0.25), M.concrete)));
    g.add(sh(new THREE.Mesh(box(1.0, 0.8, 7.2, 0, y - 0.45, 0), M.concreteDark)));
    // poste no viaduto
    g.add(new THREE.Mesh(cyl(0.07, 0.1, 6, 8, 0, y + 1.3 + 3, 3.2), M.rustMetal));
    g.add(new THREE.Mesh(box(0.6, 0.15, 0.3, 0, y + 7.3, 2.6), M.lampGlow));
    g.userData.lamp = new THREE.Vector3(0, y + 7, 2.4);
    if (rng.chance(0.6)) { const ad = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), rng.pick(M.ads)); ad.position.set(0, y + 2.3, -3.8); ad.rotation.y = Math.PI; g.add(ad); }
    g.userData.len = 0;
    return g;
  },
  tree(M, rng) {
    const E = extra(M);
    const g = new THREE.Group();
    const x = 11 + rng.range(0, 3), hgt = rng.range(3, 4.5);
    g.add(sh(new THREE.Mesh(cyl(0.12, 0.22, hgt, 7, x, hgt / 2 - 0.3, 0), E.trunk)));
    const spheres = [];
    for (let i = 0; i < 5; i++) spheres.push(new THREE.SphereGeometry(rng.range(1.2, 2.0), 10, 8).translate(x + rng.range(-1.2, 1.2), hgt - 0.3 + rng.range(0, 1.8), rng.range(-1.2, 1.2)));
    g.add(sh(new THREE.Mesh(mergeGeoms(spheres), rng.chance(0.5) ? E.leaf : E.leaf2)));
    g.userData.len = 0;
    return g;
  },
  trash(M) {
    const g = new THREE.Group();
    g.add(sh(new THREE.Mesh(cyl(0.32, 0.3, 0.95, 12, 7.7, 0.475 - 0.3, 0), M.corrugated[4])));
    g.add(new THREE.Mesh(cyl(0.34, 0.34, 0.08, 12, 7.7, 0.68, 0), M.steelDark));
    g.userData.len = 0;
    return g;
  },
  floorAsphalt(M) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) { const f = new THREE.Mesh(floorPlane(90, L, 0.2), M.asphalt); f.position.set(s * (7 + 45), -0.28, L / 2); f.receiveShadow = true; g.add(f); }
    g.userData.len = L;
    return g;
  },
  floorBallast(M) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(floorPlane(10, L, 0.3), M.ballast); f.position.set(s * 12, -0.27, L / 2); f.receiveShadow = true; g.add(f);
      const a = new THREE.Mesh(floorPlane(80, L, 0.2), M.asphalt); a.position.set(s * (17 + 40), -0.3, L / 2); a.receiveShadow = true; g.add(a);
    }
    g.userData.len = L;
    return g;
  },
  platform(M, rng) {
    const E = extra(M);
    const g = new THREE.Group();
    const x0 = 7.1, x1 = 13.6, top = 1.0;
    const body = sh(new THREE.Mesh(box(x1 - x0, top + 0.3, L, (x0 + x1) / 2, (top - 0.3) / 2, L / 2, 0.25), M.concreteLight), false, true);
    g.add(body);
    const floor = new THREE.Mesh(floorPlane(x1 - x0, L, 0.5), M.tiles); floor.position.set((x0 + x1) / 2, top + 0.005, L / 2); floor.receiveShadow = true; g.add(floor);
    const tact = new THREE.Mesh(floorPlane(0.6, L, 0.5), M.tactile); tact.position.set(x0 + 0.5, top + 0.01, L / 2); tact.receiveShadow = true; g.add(tact);
    const edge = new THREE.Mesh(box(0.1, 0.06, L, x0 + 0.05, top + 0.03, L / 2), M.yellowMetal); g.add(edge);
    // cobertura
    const roofY = 8.0;
    g.add(sh(new THREE.Mesh(box(x1 - x0 - 0.4, 0.25, L, (x0 + x1) / 2 + 0.2, roofY, L / 2, 0.25), M.concreteLight)));
    g.add(new THREE.Mesh(box(x1 - x0 - 0.4, 0.05, L, (x0 + x1) / 2 + 0.2, roofY - 0.15, L / 2), M.steelDark));
    g.add(sh(new THREE.Mesh(box(0.35, 0.5, L, x0 + 0.1, roofY - 0.1, L / 2), M.redMetal)));
    const cols = [];
    for (let z = 6; z < L; z += 12) { cols.push(cyl(0.22, 0.26, roofY - top, 12, 10.6, top + (roofY - top) / 2, z)); cols.push(box(0.5, 0.5, 0.5, 10.6, roofY - 0.3, z)); }
    g.add(sh(new THREE.Mesh(mergeGeoms(cols), M.steelLight)));
    // luminárias penduradas
    const lamps = [];
    g.userData.lamps = [];
    for (let z = 6; z < L; z += 12) { lamps.push(box(1.6, 0.08, 0.25, 9.3, roofY - 0.45, z)); lamps.push(box(0.04, 0.3, 0.04, 9.3, roofY - 0.28, z)); g.userData.lamps.push(new THREE.Vector3(9.3, roofY - 0.8, z)); g.add(lampPool(M, 9.3, top + 0.02, z, 5)); }
    g.add(new THREE.Mesh(mergeGeoms(lamps), M.lampGlow));
    // bancos
    for (let z = 12; z < L; z += 18) {
      g.add(sh(new THREE.Mesh(box(0.5, 0.06, 1.8, 11.5, top + 0.45, z), M.wood)));
      g.add(sh(new THREE.Mesh(box(0.08, 0.5, 1.8, 11.78, top + 0.75, z), M.wood)));
      g.add(new THREE.Mesh(mergeGeoms([box(0.5, 0.06, 0.08, 11.5, top + 0.2, z - 0.8), box(0.5, 0.06, 0.08, 11.5, top + 0.2, z + 0.8), box(0.06, 0.45, 0.06, 11.3, top + 0.22, z - 0.8), box(0.06, 0.45, 0.06, 11.3, top + 0.22, z + 0.8), box(0.06, 0.45, 0.06, 11.7, top + 0.22, z - 0.8), box(0.06, 0.45, 0.06, 11.7, top + 0.22, z + 0.8)]), M.steelDark));
    }
    // máquina de venda + lixeira
    const vm = sh(new THREE.Mesh(box(1.0, 1.9, 0.8, 12.9, top + 0.95, 30), M.corrugated[0])); g.add(vm);
    const vf = new THREE.Mesh(box(0.7, 1.2, 0.02, 12.9, top + 1.1, 29.58), E.vending); g.add(vf);
    g.add(sh(new THREE.Mesh(cyl(0.3, 0.28, 0.9, 10, 12.8, top + 0.45, 40), M.steelDark)));
    // placa pendurada
    const signIdx = rng.int(0, M.stationSigns.length - 1);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 0.1), [M.steelDark, M.steelDark, M.steelDark, M.steelDark, M.stationSigns[signIdx], M.stationSigns[signIdx]]);
    sign.position.set(9.6, roofY - 1.0, 30); g.add(sign);
    g.add(new THREE.Mesh(mergeGeoms([box(0.04, 0.5, 0.04, 8.0, roofY - 0.4, 30), box(0.04, 0.5, 0.04, 11.2, roofY - 0.4, 30)]), M.steelDark));
    g.userData.len = L;
    return g;
  },
  stationWall(M, rng) {
    const g = new THREE.Group();
    const x = 13.7, h = 6.5;
    g.add(sh(new THREE.Mesh(box(1.2, h, L, x + 0.6, h / 2 - 0.3, L / 2, 0.25), rng.chance(0.5) ? M.brick : M.concrete)));
    g.add(sh(new THREE.Mesh(box(1.4, 0.2, L, x + 0.6, h - 0.2, L / 2, 0.25), M.concreteLight)));
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), M.ads[(i + rng.int(0, 5)) % M.ads.length]);
      p.rotation.y = -Math.PI / 2; p.position.set(x - 0.02, 3.0, 10 + i * 20); g.add(p);
      const fr = new THREE.Mesh(box(4.2, 2.2, 0.06, x + 0.02, 3.0, 10 + i * 20), M.steelDark); g.add(fr);
    }
    const n = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), rng.pick(M.neons));
    n.rotation.y = -Math.PI / 2; n.position.set(x - 0.1, 5.2, 30); g.add(n);
    g.userData.len = L;
    return g;
  },
  sideTrack(M) {
    const g = new THREE.Group();
    const bal = new THREE.Mesh(floorPlane(8, L, 0.3), M.ballast); bal.position.set(12.2, -0.27, L / 2); bal.receiveShadow = true; g.add(bal);
    const rails = [];
    const railGeo = railGeometry(L);
    for (const tx of [10.6, 13.8]) for (const dx of [-0.72, 0.72]) rails.push(railGeo.clone().translate(tx + dx, -0.08, 0));
    g.add(sh(new THREE.Mesh(mergeGeoms(rails), M.rail), false, true));
    const n = Math.floor(L / 0.65);
    const sl = new THREE.InstancedMesh(box(2.5, 0.16, 0.26), M.sleeper, n * 2);
    const m = new THREE.Matrix4();
    let k = 0;
    for (const tx of [10.6, 13.8]) for (let i = 0; i < n; i++) { m.makeTranslation(tx, -0.17, i * 0.65 + 0.3); sl.setMatrixAt(k++, m); }
    sl.instanceMatrix.needsUpdate = true; sl.receiveShadow = true;
    g.add(sl);
    g.userData.len = L;
    return g;
  },
  containers(M, rng) {
    const g = new THREE.Group();
    const n = rng.int(2, 5);
    for (let i = 0; i < n; i++) {
      const lvl = i < 3 ? 0 : 1;
      const x = 19 + (i % 3) * 2.6, y = lvl * 2.7 + 1.3 - 0.3, z = rng.range(-1, 1) + (lvl ? 0 : 0);
      const c = sh(new THREE.Mesh(box(2.4, 2.6, 6.1, x, y, z, 0.3), rng.pick(M.corrugated)));
      c.rotation.y = rng.range(-0.03, 0.03);
      g.add(c);
    }
    g.userData.len = 0;
    return g;
  },
  gantry(M) {
    const E = extra(M);
    const g = new THREE.Group();
    const x = 16.5, h = 15;
    const parts = [box(0.5, h, 0.5, x, h / 2 - 0.3, 0), box(1.2, 0.5, 1.2, x, -0.05, 0), box(3.4, 0.3, 0.3, x - 1.2, h - 0.5, 0)];
    for (let i = 0; i < 8; i++) parts.push(box(0.08, 0.08, 0.6, x - 0.21, 1 + i * 1.7, 0));
    g.add(sh(new THREE.Mesh(mergeGeoms(parts), M.rustMetal)));
    const f1 = new THREE.Mesh(box(0.8, 0.5, 0.4, x - 2.4, h - 0.9, 0), M.steelDark); f1.rotation.x = 0.5; g.add(f1);
    const f2 = new THREE.Mesh(box(0.8, 0.5, 0.4, x - 1.2, h - 0.9, 0), M.steelDark); f2.rotation.x = 0.5; g.add(f2);
    const glow = new THREE.Mesh(mergeGeoms([box(0.7, 0.05, 0.3, x - 2.4, h - 1.15, 0.12), box(0.7, 0.05, 0.3, x - 1.2, h - 1.15, 0.12)]), M.lampGlow);
    glow.rotation.x = 0.5; g.add(glow);
    g.userData.lamp = new THREE.Vector3(x - 2, h - 1.5, 1);
    g.add(lampPool(M, x - 4, -0.19, 2, 9));
    g.userData.len = 0;
    const _ = E;
    return g;
  },
  warehouse(M, rng) {
    const g = new THREE.Group();
    const x = 34, w = 26, h = 11, d = 44;
    const body = sh(new THREE.Mesh(box(w, h, d, x, h / 2 - 0.3, d / 2, 0.15), rng.pick(M.corrugated)));
    g.add(body);
    g.add(sh(new THREE.Mesh(box(w + 1, 0.4, d + 1, x, h - 0.1, d / 2, 0.15), M.concreteLight)));
    g.add(sh(new THREE.Mesh(box(w * 0.4, 0.8, d * 0.6, x, h + 0.3, d / 2), M.corrugated[4])));
    g.add(new THREE.Mesh(box(0.1, 5, 6, x - w / 2 - 0.02, 2.2, 12), M.steelDark));
    g.add(new THREE.Mesh(box(0.1, 5, 6, x - w / 2 - 0.02, 2.2, 32), M.steelDark));
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), rng.pick(M.ads)); ad.rotation.y = -Math.PI / 2; ad.position.set(x - w / 2 - 0.06, 7.5, d / 2); g.add(ad);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), rng.pick(M.neons)); n.rotation.y = -Math.PI / 2; n.position.set(x - w / 2 - 0.1, 10, d / 2 - 12); g.add(n);
    g.userData.len = d;
    return g;
  },
  parapet(M) {
    const g = new THREE.Group();
    const x = 7.5;
    g.add(sh(new THREE.Mesh(box(0.6, 1.3, L, x, 0.35, L / 2, 0.25), M.concreteLight)));
    const rails = [box(0.05, 0.05, L, x, 1.65, L / 2), box(0.05, 0.05, L, x, 1.35, L / 2)];
    for (let z = 0; z <= L; z += 2.5) rails.push(box(0.06, 0.8, 0.06, x, 1.35, z));
    g.add(new THREE.Mesh(mergeGeoms(rails), M.steelDark));
    g.userData.lamps = [];
    for (const z of [15, 45]) {
      g.add(sh(new THREE.Mesh(cyl(0.06, 0.09, 5.5, 8, x, 1.0 + 2.75, z), M.rustMetal)));
      g.add(new THREE.Mesh(cyl(0.04, 0.04, 1.4, 6, x - 0.7, 6.3, z, Math.PI / 2), M.rustMetal));
      g.add(new THREE.Mesh(box(0.6, 0.14, 0.3, x - 1.4, 6.3, z), M.steelDark));
      g.add(new THREE.Mesh(box(0.5, 0.03, 0.24, x - 1.4, 6.22, z), M.lampGlow));
      g.userData.lamps.push(new THREE.Vector3(x - 1.4, 6.0, z));
      g.add(lampPool(M, x - 2.0, -0.19, z, 6));
    }
    g.userData.len = L;
    return g;
  },
  pillar(M) {
    const g = new THREE.Group();
    g.add(sh(new THREE.Mesh(box(9, 40, 3, 0, -20.5, 0, 0.12), M.concrete)));
    g.add(sh(new THREE.Mesh(box(17, 1.6, 3.2, 0, -1.3, 0, 0.12), M.concreteLight)));
    g.userData.len = 0;
    return g;
  },
  deckUnder(M) {
    const g = new THREE.Group();
    g.add(sh(new THREE.Mesh(box(16.5, 1.6, L, 0, -1.1, L / 2, 0.12), M.concreteDark), false, false));
    g.userData.len = L;
    return g;
  },
  tunnelSeg(M) {
    const E = extra(M);
    const g = new THREE.Group();
    const r = 7.7, cy = 0.4;
    const arch = new THREE.CylinderGeometry(r, r, L, 36, 1, true, 0, Math.PI);
    arch.rotateX(Math.PI / 2); // eixo ao longo de Z (metade +x)
    arch.rotateZ(Math.PI / 2); // metade +x → metade +y (abóbada)
    const uv = arch.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 15);
    const am = new THREE.Mesh(arch, E.tunnelIn); am.position.set(0, cy, L / 2); am.receiveShadow = true; g.add(am);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wallPlane(L, cy + 0.5, 0.25), M.concreteDark); w.rotation.y = s * Math.PI / 2 * -1; w.position.set(s * r, (cy - 0.5) / 2, L / 2); w.receiveShadow = true; g.add(w);
      // bandeja de cabos e cabos
      g.add(new THREE.Mesh(box(0.35, 0.08, L, s * (r - 0.25), 2.6, L / 2), M.steelDark));
      g.add(new THREE.Mesh(mergeGeoms([cyl(0.04, 0.04, L, 6, s * (r - 0.3), 2.72, L / 2, 0, Math.PI / 2), cyl(0.03, 0.03, L, 6, s * (r - 0.2), 2.7, L / 2, 0, Math.PI / 2)]), M.rubber));
      // passarela de serviço
      g.add(new THREE.Mesh(box(1.2, 0.25, L, s * (r - 0.7), -0.15, L / 2, 0.25), M.concreteLight));
    }
    // luminárias no teto
    const lamps = [];
    g.userData.lamps = [];
    for (let z = 8; z < L; z += 14) { lamps.push(box(0.4, 0.08, 1.8, 0, cy + r - 0.3, z)); g.userData.lamps.push(new THREE.Vector3(0, cy + r - 1.2, z)); g.add(lampPool(M, 0, -0.19, z, 7)); }
    for (let z = 15; z < L; z += 28) for (const s of [-1, 1]) lamps.push(box(0.1, 0.3, 0.9, s * (r - 0.15), 3.5, z));
    g.add(new THREE.Mesh(mergeGeoms(lamps), M.tunnelLight));
    // catenária rígida
    const bars = [];
    for (let l = 0; l < 3; l++) bars.push(box(0.12, 0.12, L, (l - 1) * LANE_W, 6.6, L / 2));
    for (let z = 5; z < L; z += 10) bars.push(box(15, 0.08, 0.08, 0, 6.7, z));
    g.add(new THREE.Mesh(mergeGeoms(bars), M.steelDark));
    g.userData.len = L;
    return g;
  },
  portal(M) {
    const E = extra(M);
    const g = new THREE.Group();
    const r = 7.9, cy = 0.4;
    const shape = new THREE.Shape();
    shape.moveTo(-24, -0.5); shape.lineTo(24, -0.5); shape.lineTo(24, 14); shape.lineTo(-24, 14); shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-r, -0.5); hole.lineTo(-r, cy); hole.absarc(0, cy, r, Math.PI, 0, true); hole.lineTo(r, -0.5); hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: false });
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.15, uv.getY(i) * 0.15);
    const face = sh(new THREE.Mesh(geo, M.concrete)); face.position.z = -1.25; g.add(face);
    g.add(sh(new THREE.Mesh(box(50, 0.6, 3, 0, 14.2, 0, 0.2), M.concreteLight)));
    // talude/aterro atrás do portal
    for (const s of [-1, 1]) {
      const hill = sh(new THREE.Mesh(box(40, 13, 70, s * 44, 6, 36, 0.05), E.earth)); hill.rotation.z = s * 0.25; g.add(hill);
    }
    g.add(sh(new THREE.Mesh(box(48, 13, 70, 0, 20, 36, 0.05), E.earth)));
    const sign = new THREE.Mesh(box(3.2, 1.0, 0.1, 0, 10.5, -1.3), M.warning2); g.add(sign);
    g.userData.len = 0;
    return g;
  },
  factory(M, rng) {
    const g = new THREE.Group();
    const x = 30, w = 28, h = rng.range(12, 18), d = 50;
    g.add(sh(new THREE.Mesh(box(w, h, d, x, h / 2 - 0.3, d / 2), M.facades[2])));
    g.add(sh(new THREE.Mesh(box(w + 0.6, 0.5, d + 0.6, x, h - 0.2, d / 2, 0.15), M.concreteDark)));
    for (let i = 0; i < 4; i++) g.add(sh(new THREE.Mesh(box(3, 1.2, 3, x - 8 + i * 5.5, h + 0.5, 10 + i * 9), M.corrugated[4])));
    g.add(sh(new THREE.Mesh(box(0.2, 6, 8, x - w / 2 - 0.05, 2.7, 20), M.steelDark)));
    g.userData.len = d;
    return g;
  },
  chimney(M) {
    const g = new THREE.Group();
    const x = 21, h = 26;
    g.add(sh(new THREE.Mesh(cyl(1.1, 1.6, h, 16, x, h / 2 - 0.3, 0), M.brickDark)));
    g.add(new THREE.Mesh(cyl(1.3, 1.2, 0.6, 16, x, h - 0.4, 0), M.concreteDark));
    g.add(new THREE.Mesh(mergeGeoms([box(0.1, 0.1, 0.5, x + 1.3, h - 1.5, 0), box(0.1, 0.1, 0.5, x - 1.3, h - 1.5, 0)]), M.signalRed || M.taillight));
    g.userData.smoke = new THREE.Vector3(x, h, 0);
    g.userData.len = 0;
    return g;
  },
  pipes(M) {
    const g = new THREE.Group();
    const x = 8.9;
    g.add(new THREE.Mesh(cyl(0.28, 0.28, L, 12, x, 2.4, L / 2, 0, Math.PI / 2), M.steelDark));
    g.add(new THREE.Mesh(cyl(0.18, 0.18, L, 10, x + 0.3, 3.1, L / 2, 0, Math.PI / 2), M.yellowMetal));
    g.add(new THREE.Mesh(cyl(0.34, 0.34, L, 12, x - 0.1, 3.9, L / 2, 0, Math.PI / 2), M.rustMetal));
    const br = [];
    for (let z = 4; z < L; z += 8) { br.push(box(0.12, 4.4, 0.25, x + 0.6, 1.9, z)); br.push(box(1.5, 0.12, 0.25, x + 0.1, 1.95, z)); br.push(box(1.5, 0.12, 0.25, x + 0.1, 3.5, z)); }
    g.add(sh(new THREE.Mesh(mergeGeoms(br), M.rustMetal)));
    g.userData.len = L;
    return g;
  },
  tank(M, rng) {
    const g = new THREE.Group();
    const x = 22, r = 4.5, h = rng.range(7, 10);
    g.add(sh(new THREE.Mesh(cyl(r, r, h, 24, x, h / 2 - 0.3, 0), rng.pick([M.corrugated[4], M.rustMetal]))));
    g.add(sh(new THREE.Mesh(cyl(0.5, r + 0.1, 1.2, 24, x, h + 0.3, 0), M.steelDark)));
    const rings = [];
    for (let i = 1; i < 4; i++) rings.push(new THREE.TorusGeometry(r + 0.05, 0.08, 6, 32).rotateX(Math.PI / 2).translate(x, i * h / 4 - 0.3, 0));
    g.add(new THREE.Mesh(mergeGeoms(rings), M.steelDark));
    const lad = [];
    for (let y = 0; y < h; y += 0.4) lad.push(box(0.5, 0.05, 0.05, x - r - 0.3, y, 0));
    lad.push(box(0.05, h, 0.05, x - r - 0.55, h / 2 - 0.3, 0)); lad.push(box(0.05, h, 0.05, x - r - 0.05, h / 2 - 0.3, 0));
    g.add(new THREE.Mesh(mergeGeoms(lad), M.rustMetal));
    g.userData.len = 0;
    return g;
  },
  fence(M, rng) {
    const g = new THREE.Group();
    const x = 8.6, h = 2.1;
    const planks = [];
    for (let z = 0; z < L; z += 0.33) planks.push(box(0.05, h, 0.3, x, h / 2 - 0.3, z + 0.16));
    planks.push(box(0.08, 0.15, L, x - 0.05, 0.3, L / 2)); planks.push(box(0.08, 0.15, L, x - 0.05, 1.4, L / 2));
    g.add(sh(new THREE.Mesh(mergeGeoms(planks), rng.chance(0.5) ? M.wood : M.woodDark)));
    const posts = [];
    for (let z = 0; z <= L; z += 4) posts.push(box(0.12, h + 0.2, 0.12, x + 0.1, h / 2 - 0.2, z));
    g.add(new THREE.Mesh(mergeGeoms(posts), M.rustMetal));
    for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), rng.pick(M.ads)); p.rotation.y = -Math.PI / 2; p.position.set(x - 0.04, 0.9, 12 + i * 30 + rng.range(-5, 5)); g.add(p); }
    g.userData.len = L;
    return g;
  },
  billboard(M, rng) {
    const g = new THREE.Group();
    const x = 13, y = 9;
    g.add(sh(new THREE.Mesh(cyl(0.25, 0.35, y, 10, x, y / 2 - 0.3, 0), M.rustMetal)));
    g.add(sh(new THREE.Mesh(box(0.4, 4.4, 9, x + 0.1, y + 2, 0), M.steelDark)));
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4), rng.pick(M.ads)); ad.rotation.y = -Math.PI / 2; ad.position.set(x - 0.12, y + 2, 0); g.add(ad);
    g.add(new THREE.Mesh(mergeGeoms([box(0.3, 0.1, 0.5, x - 0.9, y + 4.5, -2.5), box(0.3, 0.1, 0.5, x - 0.9, y + 4.5, 2.5), box(1, 0.08, 0.08, x - 0.5, y + 4.4, -2.5), box(1, 0.08, 0.08, x - 0.5, y + 4.4, 2.5)]), M.steelDark));
    g.add(new THREE.Mesh(mergeGeoms([box(0.28, 0.03, 0.46, x - 0.9, y + 4.44, -2.5), box(0.28, 0.03, 0.46, x - 0.9, y + 4.44, 2.5)]), M.lampGlow));
    g.userData.lamp = new THREE.Vector3(x - 1, y + 3.5, 0);
    g.userData.len = 0;
    return g;
  },
  barrels(M, rng) {
    const g = new THREE.Group();
    const n = rng.int(3, 6);
    for (let i = 0; i < n; i++) {
      const b = sh(new THREE.Mesh(cyl(0.3, 0.3, 0.9, 12), rng.pick(M.corrugated)));
      b.position.set(8.0 + rng.range(-0.3, 0.6), 0.15, rng.range(-1.5, 1.5));
      if (rng.chance(0.25)) { b.rotation.z = Math.PI / 2; b.position.y = 0.0; }
      g.add(b);
    }
    g.userData.len = 0;
    return g;
  },
  signal(M, rng) {
    const E = extra(M);
    const g = new THREE.Group();
    const x = 7.3;
    g.add(sh(new THREE.Mesh(cyl(0.06, 0.08, 4.2, 8, x, 1.8, 0), M.rustMetal)));
    g.add(sh(new THREE.Mesh(box(0.5, 1.1, 0.3, x, 4.0, 0), M.steelDark)));
    const red = rng.chance(0.5);
    g.add(new THREE.Mesh(cyl(0.12, 0.12, 0.1, 10, x, 4.3, -0.16, 0, Math.PI / 2), red ? E.signalRed : M.plastic));
    g.add(new THREE.Mesh(cyl(0.12, 0.12, 0.1, 10, x, 3.75, -0.16, 0, Math.PI / 2), red ? M.plastic : E.signalGreen));
    const lad = [];
    for (let y = 0.3; y < 3.6; y += 0.35) lad.push(box(0.3, 0.04, 0.04, x + 0.25, y, 0));
    g.add(new THREE.Mesh(mergeGeoms(lad), M.rustMetal));
    g.userData.len = 0;
    return g;
  },
  vent(M) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(box(1.2, 0.12, 1.2, 7.9, -0.22, 0), M.steelDark));
    const slats = [];
    for (let i = 0; i < 6; i++) slats.push(box(1.0, 0.02, 0.08, 7.9, -0.15, -0.45 + i * 0.18));
    g.add(new THREE.Mesh(mergeGeoms(slats), M.rustMetal));
    g.userData.steam = new THREE.Vector3(7.9, -0.1, 0);
    g.userData.len = 0;
    return g;
  },
  wires(M) {
    const g = new THREE.Group();
    const parts = [];
    for (let l = 0; l < 3; l++) {
      const x = (l - 1) * LANE_W;
      parts.push(box(0.025, 0.025, L, x, 6.6, L / 2)); parts.push(box(0.02, 0.02, L, x, 7.5, L / 2));
      for (let z = 3; z < L; z += 6) parts.push(box(0.015, 0.9, 0.015, x, 7.05, z));
    }
    g.add(new THREE.Mesh(mergeGeoms(parts), M.wire));
    g.userData.len = L;
    return g;
  },
};

/** Pools de props com pré-aquecimento. */
export class PropPools {
  constructor(scene, M, rng, buildingScale = 1) {
    this.scene = scene; this.M = M; this.rng = rng;
    this.pools = {};
    const warm = {
      wall: 40, lamp: 18, catenary: 18, overpass: 4, tree: 18, trash: 18, floorAsphalt: 9, floorBallast: 6, platform: 8, stationWall: 8,
      sideTrack: 12, containers: 12, gantry: 12, warehouse: 8, parapet: 12, pillar: 8, deckUnder: 6, tunnelSeg: 8, portal: 3, factory: 10,
      chimney: 10, pipes: 10, tank: 10, fence: 12, billboard: 10, barrels: 20, signal: 9, vent: 10, wires: 9,
    };
    for (const key of Object.keys(BUILDERS)) {
      this.pools[key] = new Pool(() => { const g = mergeByMaterial(BUILDERS[key](M, rng)); g.visible = false; g.userData.type = key; return g; }, (g) => { g.visible = true; g.rotation.set(0, 0, 0); g.position.set(0, 0, 0); });
      this.pools[key].warm(Math.max(1, Math.round(warm[key] * (key === 'tree' || key === 'wall' ? buildingScale : 1))));
    }
    // trens decorativos do pátio
    this.yardTrains = new Pool(() => { const g = buildTrain(M, rng.int(0, M.trainSets.length - 1), rng.int(1, 3), rng.chance(0.5)); g.visible = false; g.userData.type = 'yardTrain'; return g; }, (g) => { g.visible = true; g.rotation.set(0, 0, 0); });
    this.yardTrains.warm(10);
  }
  acquire(type) { return type === 'yardTrain' ? this.yardTrains.acquireRandom(this.rng) : this.pools[type].acquireRandom(this.rng); }
  release(g) { g.visible = false; if (g.parent) g.parent.remove(g); if (g.userData.type === 'yardTrain') this.yardTrains.release(g); else this.pools[g.userData.type].release(g); }
}

/** Posiciona um prop "sided" no chunk: side=+1 (direita) ou -1 (esquerda). */
export function placeSided(g, side, z) {
  const len = g.userData.len || 0;
  if (side > 0) { g.position.set(0, 0, z); g.rotation.y = 0; } else { g.position.set(0, 0, z + len); g.rotation.y = Math.PI; }
}
