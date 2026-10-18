// Geração infinita da pista: chunks pooled, zonas, props, prédios instanciados,
// padrões de obstáculos com rota garantida, trens em movimento e rebase do mundo.
import * as THREE from 'three';
import { RNG, clamp, lerp, smoothstep, Pool } from './utils.js';
import { CHUNK_LEN, CHUNK_COUNT, LANE_W, TRAIN_CAR_LEN, TRAIN_H, JET_HEIGHT } from './config.js';
import { mergeGeoms, box, floorPlane, railGeometry } from './geom.js';
import { OB, OB_DIM, makeRecord, laneX } from './obstacles.js';
import { PropPools, placeSided } from './props.js';
import { PU } from './collectibles.js';

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _col = new THREE.Color();

const ZONES = ['urban', 'station', 'yard', 'viaduct', 'tunnel', 'industrial'];
const ZONE_LEN = { urban: [3, 6], station: [2, 3], yard: [3, 5], viaduct: [3, 5], tunnel: [3, 5], industrial: [3, 5] };
const ZONE_WEIGHT = { urban: 30, station: 15, yard: 14, viaduct: 13, tunnel: 15, industrial: 13 };

/* -------------------------------------------------------- prédios */
class BuildingField {
  constructor(scene, M, slotsPerChunk) {
    this.slots = slotsPerChunk;
    this.meshes = M.facades.map((mat) => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      const im = new THREE.InstancedMesh(geo, mat, slotsPerChunk * CHUNK_COUNT);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true; im.receiveShadow = true;
      im.frustumCulled = false;
      for (let i = 0; i < im.count; i++) { im.setMatrixAt(i, _m.makeScale(0, 0, 0)); im.setColorAt(i, _col.setRGB(1, 1, 1)); }
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      scene.add(im);
      return im;
    });
    this.data = new Float32Array(this.meshes.length * slotsPerChunk * CHUNK_COUNT * 7); // x,y,z,w,h,d,active
  }
  clearChunk(ci) {
    for (let k = 0; k < this.meshes.length; k++) {
      const im = this.meshes[k];
      for (let s = 0; s < this.slots; s++) { const i = ci * this.slots + s; im.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.data[(k * this.slots * CHUNK_COUNT + i) * 7 + 6] = 0; }
      im.instanceMatrix.needsUpdate = true;
    }
  }
  set(ci, slot, kind, x, y, z, w, h, d, tint) {
    const im = this.meshes[kind];
    const i = ci * this.slots + slot;
    _m.compose(_v.set(x, y, z), _q.identity(), _s.set(w, h, d));
    im.setMatrixAt(i, _m);
    im.setColorAt(i, _col.setRGB(tint, tint, tint));
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    const o = (kind * this.slots * CHUNK_COUNT + i) * 7;
    this.data[o] = x; this.data[o + 1] = y; this.data[o + 2] = z; this.data[o + 3] = w; this.data[o + 4] = h; this.data[o + 5] = d; this.data[o + 6] = 1;
  }
  shift(dz) {
    for (let k = 0; k < this.meshes.length; k++) {
      const im = this.meshes[k];
      for (let i = 0; i < im.count; i++) {
        const o = (k * this.slots * CHUNK_COUNT + i) * 7;
        if (!this.data[o + 6]) continue;
        this.data[o + 2] += dz;
        _m.compose(_v.set(this.data[o], this.data[o + 1], this.data[o + 2]), _q.identity(), _s.set(this.data[o + 3], this.data[o + 4], this.data[o + 5]));
        im.setMatrixAt(i, _m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
}

/* ------------------------------------------------------------ chunk */
function buildChunkStatic(M) {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(floorPlane(14.5, CHUNK_LEN, 0.19), M.ballast);
  ground.position.set(0, -0.25, CHUNK_LEN / 2); ground.receiveShadow = true;
  g.add(ground);
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(box(1.6, 0.22, CHUNK_LEN, s * 7.6, -0.2, CHUNK_LEN / 2, 0.25), M.concreteLight);
    walk.receiveShadow = true; g.add(walk);
  }
  const railGeo = railGeometry(CHUNK_LEN);
  const rails = [];
  for (let l = 0; l < 3; l++) for (const dx of [-0.72, 0.72]) rails.push(railGeo.clone().translate(laneX(l) + dx, -0.08, 0));
  const railMesh = new THREE.Mesh(mergeGeoms(rails), M.rail);
  railMesh.receiveShadow = true; railMesh.castShadow = true;
  g.add(railMesh);
  const n = Math.floor(CHUNK_LEN / 0.65);
  const sleepers = new THREE.InstancedMesh(box(2.5, 0.16, 0.26), M.sleeper, n * 3);
  let k = 0;
  for (let l = 0; l < 3; l++) for (let i = 0; i < n; i++) { _m.makeTranslation(laneX(l), -0.17, i * 0.65 + 0.3); sleepers.setMatrixAt(k++, _m); }
  sleepers.instanceMatrix.needsUpdate = true; sleepers.receiveShadow = true; sleepers.castShadow = false;
  sleepers.frustumCulled = false;
  g.add(sleepers);
  return g;
}

export class Track {
  constructor(scene, M, preset, env, obPools, coins, powerups, seed = 1) {
    this.scene = scene; this.M = M; this.preset = preset; this.env = env;
    this.ob = obPools; this.coins = coins; this.pu = powerups;
    this.rng = new RNG(seed);
    this.props = new PropPools(scene, M, this.rng, preset.buildings);
    this.buildings = new BuildingField(scene, M, Math.round(10 * preset.buildings));
    this.recPool = new Pool(makeRecord);
    this.recPool.warm(120);
    this.moving = [];              // registros de trens em movimento (mundo)
    this.lampPos = []; for (let i = 0; i < 40; i++) this.lampPos.push(new THREE.Vector3());
    this.tunnelPos = []; for (let i = 0; i < 8; i++) this.tunnelPos.push(new THREE.Vector3());
    this.emitters = [];            // {pos: Vector3, kind: 'smoke'|'steam'} (world)
    for (let i = 0; i < 16; i++) this.emitters.push({ pos: new THREE.Vector3(), kind: '', active: false });
    this.stats = { chunksBuilt: 0 };
    this.chunks = [];
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const group = buildChunkStatic(M);
      scene.add(group);
      this.chunks.push({ index: i, group, z: 0, zone: 'urban', zoneIndex: 0, zoneLen: 1, props: [], obstacles: [], coins: new Int32Array(240), nCoins: 0, laneClear: [true, true, true], movingLane: -1, lamps: [], tunnelLamps: [], emitters: [] });
    }
    // skyline distante
    const skyGeo = new THREE.CylinderGeometry(760, 760, 150, 64, 1, true);
    const skyMat = new THREE.MeshStandardMaterial({ map: M.skyline.map, emissiveMap: M.skylineEmissive, emissive: 0xffffff, emissiveIntensity: 0, transparent: true, side: THREE.BackSide, roughness: 1, metalness: 0, depthWrite: false, fog: true, envMapIntensity: 0 });
    skyMat.map.repeat.set(3, 1);
    skyMat.emissiveMap.repeat.set(3, 1);
    this.skyline = new THREE.Mesh(skyGeo, skyMat);
    this.skyline.position.y = 40;
    this.skyline.renderOrder = -5;
    scene.add(this.skyline);
    this.reset();
  }

  reset() {
    for (const c of this.chunks) this.clearChunk(c);
    for (const r of this.moving) this.releaseMoving(r, false);
    this.moving.length = 0;
    this.nextZ = -CHUNK_LEN;
    this.zone = { name: 'urban', remaining: 4, index: 0, len: 4 };
    this.golden = { lane: 1, lastChangeZ: -100 };
    this.prevLaneClear = [true, true, true];
    this.prevMovingLane = -1;
    this.distance = 0;
    this.tunnelRange = null;
    this.jetActive = false;
    for (let i = 0; i < CHUNK_COUNT; i++) this.fillChunk(this.chunks[i]);
    this.head = 0; // índice do chunk mais antigo
  }

  clearChunk(c) {
    for (const p of c.props) this.props.release(p);
    c.props.length = 0;
    for (const r of c.obstacles) this.releaseObstacle(r);
    c.obstacles.length = 0;
    for (let i = 0; i < c.nCoins; i++) this.coins.remove(c.coins[i]);
    c.nCoins = 0;
    this.pu.releaseChunk(c);
    this.buildings.clearChunk(c.index);
    c.lamps.length = 0; c.tunnelLamps.length = 0; c.emitters.length = 0;
    c.movingLane = -1;
  }

  releaseObstacle(r) {
    if (r.mesh) {
      if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
      if (r.type === OB.TRAIN || r.type === OB.TRAIN_MOVING) this.ob.releaseTrain(r.mesh);
      else this.ob.release(r.poolType, r.mesh);
      r.mesh = null;
    }
    this.recPool.release(r);
  }

  releaseMoving(r, splice = true) {
    if (splice) { const i = this.moving.indexOf(r); if (i >= 0) this.moving.splice(i, 1); }
    this.releaseObstacle(r);
  }

  /* --------------------------------------------------------- zonas */
  nextZone() {
    const prev = this.zone.name;
    let total = 0;
    for (const z of ZONES) if (z !== prev) total += ZONE_WEIGHT[z];
    let r = this.rng.next() * total, pick = 'urban';
    for (const z of ZONES) { if (z === prev) continue; r -= ZONE_WEIGHT[z]; if (r <= 0) { pick = z; break; } }
    const [a, b] = ZONE_LEN[pick];
    const len = this.rng.int(a, b);
    this.zone = { name: pick, remaining: len, index: 0, len };
  }

  /* ---------------------------------------------------- preencher */
  fillChunk(c) {
    const rng = this.rng;
    this.nextZ += CHUNK_LEN;
    c.z = this.nextZ;
    c.group.position.set(0, 0, c.z);
    if (this.zone.remaining <= 0) this.nextZone();
    c.zone = this.zone.name; c.zoneIndex = this.zone.index; c.zoneLen = this.zone.len;
    this.zone.remaining--; this.zone.index++;
    this.stats.chunksBuilt++;
    const zone = c.zone;
    const first = c.zoneIndex === 0, last = this.zone.remaining === 0;
    const add = (type, side, z) => { const p = this.props.acquire(type); placeSided(p, side, z); c.group.add(p); c.props.push(p); return p; };
    const addLamp = (p) => {
      if (p.userData.lamp) c.lamps.push(p);
      if (p.userData.lamps) c.lamps.push(p);
    };
    // ---- props por zona
    const hasWires = zone !== 'tunnel';
    if (hasWires) add('wires', 1, 0);
    if (zone === 'urban') {
      add('floorAsphalt', 1, 0);
      for (const s of [-1, 1]) for (let z = 0; z < CHUNK_LEN; z += 20) add('wall', s, z);
      addLamp(add('lamp', 1, 12)); addLamp(add('lamp', -1, 42));
      add('catenary', 1, 30);
      if (rng.chance(0.3)) addLamp(add('overpass', 1, rng.range(15, 45)));
      for (const s of [-1, 1]) { if (rng.chance(0.6)) add('tree', s, rng.range(2, 58)); if (rng.chance(0.5)) add('trash', s, rng.range(2, 58)); }
      if (rng.chance(0.5)) add('signal', rng.sign(), rng.range(5, 55));
      if (rng.chance(0.35)) { const v = add('vent', rng.sign(), rng.range(5, 55)); c.emitters.push(v); }
      this.placeBuildings(c, 0, 1.0);
    } else if (zone === 'station') {
      add('floorAsphalt', 1, 0);
      for (const s of [-1, 1]) { addLamp(add('platform', s, 0)); add('stationWall', s, 0); }
      this.placeBuildings(c, 0, 0.7);
    } else if (zone === 'yard') {
      add('floorBallast', 1, 0);
      for (const s of [-1, 1]) {
        add('sideTrack', s, 0);
        if (rng.chance(0.75)) { const t = this.props.acquire('yardTrain'); t.position.set(s * rng.pick([10.6, 13.8]), -0.05, rng.range(-10, 20)); c.group.add(t); c.props.push(t); }
        if (rng.chance(0.6)) add('containers', s, rng.range(5, 50));
        if (rng.chance(0.5)) addLamp(add('gantry', s, rng.range(5, 55)));
        if (rng.chance(0.35)) add('warehouse', s, rng.range(0, 15));
        if (rng.chance(0.4)) add('barrels', s, rng.range(5, 55));
      }
      add('catenary', 1, 15); add('catenary', 1, 45);
      if (rng.chance(0.5)) add('signal', rng.sign(), rng.range(5, 55));
      this.placeBuildings(c, 0, 0.35, 40);
    } else if (zone === 'viaduct') {
      for (const s of [-1, 1]) addLamp(add('parapet', s, 0));
      add('deckUnder', 1, 0);
      add('pillar', 1, 30);
      add('catenary', 1, 20);
      this.placeBuildings(c, -42, 1.1, 10);
    } else if (zone === 'tunnel') {
      const seg = add('tunnelSeg', 1, 0);
      c.tunnelLamps.push(seg);
      if (first) add('portal', 1, 0);
      if (last) { const p = add('portal', 1, CHUNK_LEN); p.rotation.y = Math.PI; }
      if (first) this.tunnelRange = { z0: c.z, z1: c.z + this.zone.len * CHUNK_LEN };
      if (rng.chance(0.4)) add('signal', rng.sign(), rng.range(5, 55));
    } else if (zone === 'industrial') {
      add('floorAsphalt', 1, 0);
      for (const s of [-1, 1]) {
        if (rng.chance(0.6)) add('fence', s, 0); else add('pipes', s, 0);
        if (rng.chance(0.5)) add('factory', s, rng.range(0, 10));
        if (rng.chance(0.45)) { const ch = add('chimney', s, rng.range(10, 50)); c.emitters.push(ch); }
        if (rng.chance(0.4)) add('tank', s, rng.range(5, 55));
        if (rng.chance(0.4)) addLamp(add('billboard', s, rng.range(5, 55)));
        if (rng.chance(0.5)) add('barrels', s, rng.range(5, 55));
        if (rng.chance(0.3)) { const v = add('vent', s, rng.range(5, 55)); c.emitters.push(v); }
      }
      addLamp(add('lamp', -1, 20)); addLamp(add('lamp', 1, 50));
      add('catenary', 1, 35);
      if (rng.chance(0.4)) add('signal', rng.sign(), rng.range(5, 55));
      this.placeBuildings(c, 0, 0.6, 30);
    }
    // ---- obstáculos e moedas
    this.populateGameplay(c);
  }

  placeBuildings(c, baseY, density, minX = 15) {
    const rng = this.rng;
    const B = this.buildings;
    const perMesh = B.slots;
    const slotUse = [0, 0, 0];
    const n = Math.round(perMesh * 3 * density);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 3) {
      tries++;
      const kind = rng.int(0, 2);
      if (slotUse[kind] >= perMesh) continue;
      const side = rng.sign();
      const near = rng.chance(0.5);
      const w = rng.range(9, 22), d = rng.range(9, 24);
      let h = near ? rng.range(6, 18) : rng.range(14, 55);
      if (baseY < 0) h = rng.range(12, 50);
      const x = side * (near ? minX + 5 + w / 2 + rng.range(0, 8) : minX + 26 + rng.range(0, 45));
      const z = c.z + rng.range(0, CHUNK_LEN);
      B.set(c.index, slotUse[kind]++, kind, x, baseY, z, w, h, d, rng.range(0.55, 1.0));
      placed++;
    }
  }

  /* ----------------------------------------------- gameplay / padrões */
  populateGameplay(c) {
    const rng = this.rng;
    const z0 = c.z;
    const dist = Math.max(0, z0);
    const d = clamp(dist / 4500, 0, 1);         // dificuldade 0..1
    const zone = c.zone;
    c.laneClear[0] = c.laneClear[1] = c.laneClear[2] = true;
    // trechos iniciais: só moedas
    if (z0 < 100) {
      this.coinLine(c, this.golden.lane, z0 + 20, 8, 0.9);
      this.prevLaneClear = [true, true, true];
      return;
    }
    const rowGap = lerp(23, 13, d);
    const rows = Math.max(2, Math.floor((CHUNK_LEN - 8) / rowGap));
    const rowZ = [];
    for (let i = 0; i < rows; i++) rowZ.push(z0 + 6 + i * rowGap + rng.range(0, 2));
    // caminho dourado
    const goldenLanes = [];
    const incomingLane = this.golden.lane; // pista dourada vinda do chunk anterior (até a 1ª linha)
    const minGap = Math.max(rowGap, 14);
    for (let i = 0; i < rows; i++) {
      const zr = rowZ[i];
      if (zr - this.golden.lastChangeZ > minGap && rng.chance(0.4)) {
        const dir = this.golden.lane === 0 ? 1 : this.golden.lane === 2 ? -1 : rng.sign();
        this.golden.lane += dir; this.golden.lastChangeZ = zr;
      }
      goldenLanes.push(this.golden.lane);
    }
    // ocupação: grid[row][lane] = tipo (0 livre)
    const grid = [];
    for (let i = 0; i < rows; i++) grid.push([0, 0, 0]);
    const trainCover = [[], [], []]; // por pista: [z0,z1] de trens
    // corredor dourado: a pista dourada da linha i vale de rowZ[i] até rowZ[i+1]
    // (a primeira começa no início do chunk); trens não podem invadir o corredor
    // nem uma margem de 8 m usada para a troca de pista.
    const MARGIN = 12;
    const goldenAt = (lane, za, zb) => {
      if (lane === incomingLane && za < rowZ[0] + MARGIN && zb > z0 - 1) return true;
      for (let i = 0; i < rows; i++) {
        if (goldenLanes[i] !== lane) continue;
        const cA = i === 0 ? z0 - 1 : rowZ[i];
        const cB = i + 1 < rows ? rowZ[i + 1] : z0 + CHUNK_LEN + 1;
        if (za < cB + MARGIN && zb > cA - MARGIN) return true;
      }
      return false;
    };
    // pista reservada por trem em movimento do chunk anterior (primeiros 25 m)
    const reservedLane = this.prevMovingLane;
    // trens parados
    const pTrain = zone === 'station' ? 0.75 : zone === 'yard' ? 0.6 : lerp(0.3, 0.6, d);
    for (let lane = 0; lane < 3; lane++) {
      if (!rng.chance(pTrain)) continue;
      const cars = rng.chance(0.5) ? 1 : rng.chance(0.7) ? 2 : 3;
      const len = cars * (TRAIN_CAR_LEN + 0.6) - 0.6;
      let zs = z0 + rng.range(2, Math.max(2.5, CHUNK_LEN - len - 2));
      if (lane === reservedLane && zs < z0 + 25) zs = z0 + 25;
      if (zs + len > z0 + CHUNK_LEN - 1) continue;
      if (goldenAt(lane, zs, zs + len)) continue;
      const hasRamp = rng.chance(zone === 'station' ? 0.35 : 0.5) && zs - 7 > z0 + 1;
      const rec = this.addTrain(c, lane, zs, cars, rng.int(0, this.M.trainSets.length - 1), false, 0);
      if (hasRamp) {
        rec.hasRamp = true;
        const ramp = this.recPool.acquire();
        ramp.type = OB.RAMP; ramp.lane = lane; ramp.x = laneX(lane); ramp.z0 = zs - 7; ramp.z1 = zs; ramp.top = TRAIN_H; ramp.bottom = 0; ramp.rampLen = 7; ramp.hit = false; ramp.chunk = c;
        ramp.poolType = 'ramp'; ramp.mesh = this.ob.acquire('ramp');
        ramp.mesh.position.set(ramp.x, 0, ramp.z0 - c.z); c.group.add(ramp.mesh);
        c.obstacles.push(ramp);
        // moedas em cima do trem
        this.coinLine(c, lane, zs + 2, Math.min(10, Math.floor((len - 4) / 1.6)), TRAIN_H + 0.9);
      }
      trainCover[lane].push([zs - (hasRamp ? 7 : 0), zs + len]);
      for (let i = 0; i < rows; i++) if (rowZ[i] > zs - 9 && rowZ[i] < zs + len + 2) grid[i][lane] = OB.TRAIN;
      if (zs + len > z0 + CHUNK_LEN - 15) c.laneClear[lane] = false;
    }
    // trem em movimento
    const pMove = zone === 'station' ? lerp(0.05, 0.22, d) : lerp(0.03, 0.3, d);
    c.movingLane = -1;
    if (rng.chance(pMove)) {
      const cand = [];
      for (let lane = 0; lane < 3; lane++) {
        if (trainCover[lane].length) continue;
        if (!this.prevLaneClear[lane]) continue;
        if (goldenLanes.includes(lane)) continue;
        if (lane === reservedLane) continue;
        cand.push(lane);
      }
      if (cand.length) {
        const lane = rng.pick(cand);
        const cars = rng.int(2, 3);
        const rec = this.addTrain(c, lane, z0 + CHUNK_LEN + 12, cars, rng.int(0, this.M.trainSets.length - 1), true, lerp(14, 22, d));
        rec.mesh.visible = false;
        c.movingLane = lane;
        for (let i = 0; i < rows; i++) grid[i][lane] = OB.TRAIN_MOVING;
        c.laneClear[lane] = false;
      }
    }
    // barreiras por linha
    const gW = d < 0.25 ? [62, 14, 10, 8, 6] : [48, 17, 15, 10, 10]; // none, low, high, cone, hoarding
    const oW = [30, 20, 15, 10, 10, 15];                                 // + arch
    for (let i = 0; i < rows; i++) {
      const zr = rowZ[i];
      for (let lane = 0; lane < 3; lane++) {
        if (grid[i][lane]) continue;
        if (lane === reservedLane && zr < z0 + 25) continue;
        const g = goldenLanes[i] === lane;
        const w = g ? gW : oW;
        let r = rng.next() * w.reduce((a, b) => a + b, 0), type = 0;
        const types = [0, OB.LOW, OB.HIGH, OB.CONE, OB.HOARDING, OB.ARCH];
        for (let k = 0; k < w.length; k++) { r -= w[k]; if (r <= 0) { type = types[k]; break; } }
        if (zone === 'tunnel' && type === OB.HOARDING) type = OB.ARCH;
        if (type === 0) {
          if (g) {
            if (rng.chance(0.75)) this.coinLine(c, lane, zr - 4, rng.int(5, 8), 0.9);
            if (rng.chance(0.07)) this.addPowerup(c, lane, zr + 3);
            else if (rng.chance(0.015)) this.pu.add(PU.KEY, laneX(lane), 1.1, zr + 3, c);
          } else if (rng.chance(0.3)) this.coinLine(c, lane, zr - 3, rng.int(3, 6), 0.9);
          continue;
        }
        this.addBarrier(c, type, lane, zr);
        grid[i][lane] = type;
        if (g && (type === OB.LOW || type === OB.CONE || type === OB.HOARDING)) this.coinArc(c, lane, zr);
        if (zr > z0 + CHUNK_LEN - 15) c.laneClear[lane] = false;
      }
    }
    if (this.jetActive) this.addJetCoins(c);
    this.prevLaneClear = [c.laneClear[0], c.laneClear[1], c.laneClear[2]];
    this.prevMovingLane = c.movingLane;
  }

  addTrain(c, lane, zs, cars, livery, moving, speed) {
    const rec = this.recPool.acquire();
    const len = cars * (TRAIN_CAR_LEN + 0.6) - 0.6;
    rec.type = moving ? OB.TRAIN_MOVING : OB.TRAIN; rec.lane = lane; rec.x = laneX(lane);
    rec.z0 = zs; rec.z1 = zs + len; rec.top = TRAIN_H; rec.bottom = 0; rec.hit = false; rec.chunk = c;
    rec.speed = speed; rec.hasRamp = false; rec.livery = livery; rec.hornPlayed = false; rec.sparkT = 0; rec.passed = false; rec.scored = false; rec.active = false;
    rec.mesh = this.ob.acquireTrain(cars, livery);
    if (moving) {
      rec.mesh.position.set(rec.x, -0.05, zs);
      this.scene.add(rec.mesh);
      rec.active = false;
      this.moving.push(rec);
    } else {
      rec.mesh.position.set(rec.x, -0.05, zs - c.z);
      c.group.add(rec.mesh);
      c.obstacles.push(rec);
    }
    return rec;
  }

  addBarrier(c, type, lane, z) {
    const rec = this.recPool.acquire();
    const dim = OB_DIM[type];
    rec.type = type; rec.lane = lane; rec.x = laneX(lane); rec.z0 = z - dim.depth / 2; rec.z1 = z + dim.depth / 2;
    rec.top = dim.top; rec.bottom = dim.bottom || 0; rec.hit = false; rec.scored = false; rec.chunk = c;
    rec.poolType = type === OB.LOW ? 'low' : type === OB.HIGH ? 'high' : type === OB.CONE ? 'cone' : type === OB.HOARDING ? 'hoarding' : 'arch';
    rec.mesh = this.ob.acquire(rec.poolType);
    rec.mesh.position.set(rec.x, 0, z - c.z);
    if (type === OB.CONE) { // 2 ou 3 cones alinhados
      rec.mesh.position.x += this.rng.range(-0.4, 0.4);
    }
    c.group.add(rec.mesh);
    c.obstacles.push(rec);
    return rec;
  }

  coinLine(c, lane, z, n, y) {
    for (let i = 0; i < n; i++) {
      if (c.nCoins >= c.coins.length) return;
      const idx = this.coins.add(laneX(lane), y, z + i * 1.6);
      if (idx >= 0) c.coins[c.nCoins++] = idx;
    }
  }
  coinArc(c, lane, z) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      if (c.nCoins >= c.coins.length) return;
      const t = i / (n - 1);
      const y = 0.9 + Math.sin(t * Math.PI) * 1.5;
      const idx = this.coins.add(laneX(lane), y, z - 4.5 + t * 9);
      if (idx >= 0) c.coins[c.nCoins++] = idx;
    }
  }
  addJetCoins(c) {
    const lane = this.rng.int(0, 2);
    for (let i = 0; i < 3; i++) {
      const z = c.z + 5 + i * 18;
      const shape = this.rng.int(0, 1);
      for (let k = 0; k < 8; k++) {
        if (c.nCoins >= c.coins.length) return;
        const y = JET_HEIGHT + (shape ? Math.sin(k / 7 * Math.PI) * 1.4 : 0) - 0.3;
        const idx = this.coins.add(laneX(lane), y, z + k * 1.6);
        if (idx >= 0) c.coins[c.nCoins++] = idx;
      }
    }
  }
  addPowerup(c, lane, z) {
    const kinds = [PU.MAGNET, PU.JETPACK, PU.SNEAKERS, PU.MULTIPLIER, PU.HOVERBOARD];
    this.pu.add(this.rng.pick(kinds), laneX(lane), 1.15, z, c);
  }

  /** Chamado quando o jato ativa: adiciona moedas altas nos chunks à frente. */
  onJetpack(playerZ) {
    for (const c of this.chunks) if (c.z > playerZ + 20) this.addJetCoins(c);
  }

  /* ---------------------------------------------------------- update */
  update(dt, playerZ, playerX, game) {
    // reciclagem
    for (let n = 0; n < CHUNK_COUNT; n++) {
      const c = this.chunks[this.head];
      if (c.z + CHUNK_LEN < playerZ - 45) {
        this.clearChunk(c);
        this.fillChunk(c);
        this.head = (this.head + 1) % CHUNK_COUNT;
      } else break;
    }
    // trens em movimento
    for (let i = this.moving.length - 1; i >= 0; i--) {
      const r = this.moving[i];
      if (!r.active) {
        if (playerZ > r.chunk.z - 70) { r.active = true; r.mesh.visible = true; }
        else continue;
      }
      const dz = r.speed * dt;
      r.z0 -= dz; r.z1 -= dz;
      r.mesh.position.z = r.z0;
      if (r.z1 < playerZ - 60) { this.releaseMoving(r); continue; }
      if (!r.hornPlayed && r.z0 - playerZ < 110) { r.hornPlayed = true; if (game) game.onTrainHorn(r); }
    }
    // faróis dos 2 trens em movimento mais próximos à frente
    let h = 0;
    for (let i = 0; i < this.moving.length && h < 2; i++) {
      const r = this.moving[i];
      if (!r.active || r.z0 < playerZ - 5) continue;
      _v.set(r.x, 1.3, r.z0 - 0.3);
      this.env.setHeadlight(h++, true, _v, _s.set(0, -0.06, -1));
    }
    for (; h < 2; h++) this.env.setHeadlight(h, false);
    // luzes de poste mais próximas
    let nl = 0;
    for (const c of this.chunks) {
      if (c.z + CHUNK_LEN < playerZ - 20 || c.z > playerZ + 90) continue;
      for (const p of c.lamps) {
        if (p.userData.lamp) { if (nl < this.lampPos.length) { p.localToWorld(this.lampPos[nl++].copy(p.userData.lamp)); } }
        if (p.userData.lamps) for (const l of p.userData.lamps) { if (nl < this.lampPos.length) p.localToWorld(this.lampPos[nl++].copy(l)); }
      }
    }
    // ordenar por distância (insertion sort pequeno)
    for (let i = 1; i < nl; i++) { const v = this.lampPos[i]; let j = i - 1; while (j >= 0 && Math.abs(this.lampPos[j].z - playerZ - 15) > Math.abs(v.z - playerZ - 15)) { this.lampPos[j + 1] = this.lampPos[j]; j--; } this.lampPos[j + 1] = v; }
    this.env.updateLamps(this.lampPos, nl, playerZ);
    // túnel
    let nt = 0;
    for (const c of this.chunks) {
      if (c.zone !== 'tunnel' || c.z + CHUNK_LEN < playerZ - 10 || c.z > playerZ + 70) continue;
      for (const seg of c.tunnelLamps) for (const l of seg.userData.lamps) { if (nt < this.tunnelPos.length && Math.abs(l.z + c.z - playerZ - 15) < 40) seg.localToWorld(this.tunnelPos[nt++].copy(l)); }
    }
    this.env.setTunnelLights(this.tunnelPos, Math.min(nt, 2));
    // emissores (fumaça/vapor)
    let ne = 0;
    for (const c of this.chunks) {
      if (c.z + CHUNK_LEN < playerZ - 30 || c.z > playerZ + 160) continue;
      for (const p of c.emitters) {
        if (ne >= this.emitters.length) break;
        const e = this.emitters[ne++];
        if (p.userData.smoke) { p.localToWorld(e.pos.copy(p.userData.smoke)); e.kind = 'smoke'; } else { p.localToWorld(e.pos.copy(p.userData.steam)); e.kind = 'steam'; }
        e.active = true;
      }
    }
    for (let i = ne; i < this.emitters.length; i++) this.emitters[i].active = false;
    // skyline segue a câmera
    this.skyline.position.x = playerX * 0.2; this.skyline.position.z = playerZ;
    this.skyline.material.emissiveIntensity = this.env.nightLights * 1.5;
  }

  /** 0..1: quanto o jogador está dentro de um túnel (com transição nos portais). */
  tunnelAmount(playerZ) {
    let best = 0;
    for (const c of this.chunks) {
      if (c.zone !== 'tunnel') continue;
      const a = smoothstep(c.z - 12, c.z + 6, playerZ) * (c.zoneIndex === 0 ? 1 : 1);
      const isLast = c.zoneIndex === c.zoneLen - 1;
      const b = isLast ? 1 - smoothstep(c.z + CHUNK_LEN - 6, c.z + CHUNK_LEN + 12, playerZ) : 1;
      const inside = (c.zoneIndex === 0 ? a : 1) * b * (playerZ > c.z - 12 && playerZ < c.z + CHUNK_LEN + 12 ? 1 : 0);
      if (inside > best) best = inside;
    }
    return best;
  }

  chunkAt(z) {
    for (const c of this.chunks) if (z >= c.z && z < c.z + CHUNK_LEN) return c;
    return null;
  }
  chunkAfter(c) {
    let best = null;
    for (const o of this.chunks) if (o.z > c.z && (!best || o.z < best.z)) best = o;
    return best;
  }

  /** Desloca o mundo inteiro em -dz (rebase para precisão de float). */
  rebase(dz) {
    for (const c of this.chunks) {
      c.z -= dz; c.group.position.z = c.z;
      for (const r of c.obstacles) { r.z0 -= dz; r.z1 -= dz; }
    }
    for (const r of this.moving) { r.z0 -= dz; r.z1 -= dz; r.mesh.position.z = r.z0; }
    this.nextZ -= dz;
    this.golden.lastChangeZ -= dz;
    if (this.tunnelRange) { this.tunnelRange.z0 -= dz; this.tunnelRange.z1 -= dz; }
    this.coins.shift(-dz);
    this.pu.shift(-dz);
    this.buildings.shift(-dz);
  }
}
