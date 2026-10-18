// Personagem: modelo procedural por geometria, animação procedural (corrida,
// pulo, rolamento, troca de pista, tropeço, ragdoll, prancha, jato) e física
// (cápsula/AABB contra os registros de obstáculos).
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, easeOutCubic } from './utils.js';
import { LANES, LANE_W, GRAVITY, JUMP_V, SUPER_JUMP_V, ROLL_TIME, LANE_CHANGE_TIME, PLAYER_RADIUS, PLAYER_HEIGHT, ROLL_HEIGHT, JET_HEIGHT, TRAIN_H, CHUNK_LEN } from './config.js';
import { OB } from './obstacles.js';
import { mergeGeoms, box, cyl } from './geom.js';
import { SKINS } from './skins.js';

export const PS = { RUN: 0, JUMP: 1, ROLL: 2, STUMBLE: 3, DEAD: 4, CAUGHT: 5 };

const _v = new THREE.Vector3();

/** Constrói o modelo do personagem a partir de uma skin (cores/acessórios). */
export function buildCharacter(M, skin) {
  const g = new THREE.Group();
  const mats = {
    skin: M.skin(skin.skin), shirt: M.cloth(skin.shirt), pants: M.cloth(skin.pants), shoes: M.shiny(skin.shoes),
    hair: M.hair(skin.hair), accent: M.shiny(skin.accent), pack: M.cloth(skin.pack), dark: M.cloth(0x1a1a1a),
    eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }),
  };
  const parts = {};
  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = false; (parent || g).add(m); return m; };
  // quadril (raiz do corpo)
  const hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips); parts.hips = hips;
  mk(new THREE.CapsuleGeometry(0.19, 0.12, 4, 10).rotateZ(Math.PI / 2), mats.pants, hips);
  // tronco
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso); parts.torso = torso;
  const torsoMesh = mk(new THREE.CapsuleGeometry(0.21, 0.32, 4, 12), mats.shirt, torso); torsoMesh.position.y = 0.3; torsoMesh.scale.set(1.15, 1, 0.8);
  if (skin.vest) { const v = mk(box(0.46, 0.4, 0.3), mats.accent, torso); v.position.y = 0.3; v.position.z = 0.02; }
  // pescoço e cabeça
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head); parts.head = head;
  mk(cyl(0.06, 0.07, 0.1, 8, 0, -0.03, 0), mats.skin, head);
  const headMesh = mk(new THREE.SphereGeometry(0.15, 18, 14), mats.skin, head); headMesh.position.y = 0.12; headMesh.scale.set(0.95, 1.08, 1);
  // cabelo / capuz / boné
  if (skin.hood) {
    const hood = mk(new THREE.SphereGeometry(0.175, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), mats.pack, head); hood.position.y = 0.13;
  } else {
    const hair = mk(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hair, head); hair.position.y = 0.14; hair.scale.set(1, 1.1, 1.05);
    if (skin.ponytail) { const tail = mk(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), mats.hair, head); tail.position.set(0, 0.05, -0.17); tail.rotation.x = 0.5; parts.tail = tail; }
    if (skin.cap) {
      const cap = mk(new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.accent, head); cap.position.y = 0.14;
      const peak = mk(box(0.2, 0.02, 0.14), mats.accent, head); peak.position.set(0, 0.15, 0.18);
    }
  }
  if (skin.ears) { for (const x of [-0.1, 0.1]) { const e = mk(new THREE.ConeGeometry(0.05, 0.11, 8), mats.accent, head); e.position.set(x, 0.3, 0); } }
  if (skin.antenna) { const a = mk(cyl(0.01, 0.01, 0.18, 6, 0, 0.36, 0), mats.accent, head); const b = mk(new THREE.SphereGeometry(0.03, 8, 6), M.headlight, head); b.position.y = 0.45; }
  if (skin.visor) { const v = mk(box(0.28, 0.07, 0.05), M.glass, head); v.position.set(0, 0.14, 0.14); }
  else { for (const x of [-0.055, 0.055]) { const e = mk(new THREE.SphereGeometry(0.018, 8, 6), mats.eye, head); e.position.set(x, 0.14, 0.14); } }
  // mochila
  const pack = mk(box(0.3, 0.36, 0.16), mats.pack, torso); pack.position.set(0, 0.3, -0.2); parts.pack = pack;
  mk(box(0.22, 0.12, 0.08), mats.dark, torso).position.set(0, 0.12, -0.26);
  // jetpack (oculto até o power-up)
  const jet = new THREE.Group(); jet.position.set(0, 0.3, -0.3); torso.add(jet); jet.visible = false; parts.jet = jet;
  for (const x of [-0.12, 0.12]) { const c = mk(cyl(0.08, 0.08, 0.42, 12, x, 0, 0), M.jet, jet); const n = mk(cyl(0.05, 0.08, 0.1, 8, x, -0.26, 0), M.steelDark, jet); const _ = c + n; }
  // braços
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.22, 4, 8).translate(0, -0.13, 0);
  const foreGeo = new THREE.CapsuleGeometry(0.05, 0.2, 4, 8).translate(0, -0.12, 0);
  parts.arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.26, 0.5, 0); torso.add(sh);
    mk(armGeo, mats.shirt, sh);
    const el = new THREE.Group(); el.position.y = -0.26; sh.add(el);
    mk(foreGeo, skin.sleeves ? mats.shirt : mats.skin, el);
    const hand = mk(new THREE.SphereGeometry(0.055, 8, 6), mats.skin, el); hand.position.y = -0.26;
    parts.arms.push({ sh, el });
  }
  // pernas
  const thighGeo = new THREE.CapsuleGeometry(0.08, 0.3, 4, 10).translate(0, -0.17, 0);
  const shinGeo = new THREE.CapsuleGeometry(0.065, 0.3, 4, 10).translate(0, -0.17, 0);
  parts.legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.11, -0.02, 0); hips.add(hip);
    mk(thighGeo, mats.pants, hip);
    const knee = new THREE.Group(); knee.position.y = -0.38; hip.add(knee);
    mk(shinGeo, mats.pants, knee);
    const shoe = mk(box(0.12, 0.09, 0.26), mats.shoes, knee); shoe.position.set(0, -0.4, 0.05);
    const sole = mk(box(0.12, 0.03, 0.26), mats.dark, knee); sole.position.set(0, -0.455, 0.05);
    parts.legs.push({ hip, knee, shoe });
  }
  // prancha (oculta)
  const board = new THREE.Group(); board.visible = false; g.add(board); parts.board = board;
  const bm = mk(box(0.55, 0.07, 1.3), M.board, board); bm.position.y = 0.1;
  const glow = mk(box(0.45, 0.03, 1.1), M.headlight, board); glow.position.y = 0.05;
  // sombra de contato falsa (disco escuro)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; g.add(blob); parts.blob = blob;
  g.userData.parts = parts;
  g.userData.mats = mats;
  const _ = bm + glow;
  return g;
}

export class Player {
  constructor(scene, M, skinId = 0) {
    this.scene = scene; this.M = M;
    this.model = null;
    this.setSkin(skinId);
    this.reset();
  }

  setSkin(id) {
    if (this.model) { this.scene.remove(this.model); }
    this.skin = SKINS[id] || SKINS[0];
    this.model = buildCharacter(this.M, this.skin);
    this.scene.add(this.model);
    this.parts = this.model.userData.parts;
  }

  reset() {
    this.lane = 1; this.targetLane = 1;
    this.x = 0; this.y = 0; this.z = 0; this.prevZ = 0; this.prevX = 0; this.prevY = 0;
    this.vy = 0; this.grounded = true; this.groundY = 0;
    this.state = PS.RUN;
    this.laneT = 1; this.laneFrom = 0; this.laneTo = 0;
    this.rollT = 0; this.stumbleT = 0; this.deadT = 0;
    this.runPhase = 0;
    this.jetpack = 0; this.sneakers = 0; this.magnet = 0; this.multiplier = 0; this.hoverboard = 0; this.invuln = 0;
    this.onTrain = false; this.lastGroundY = 0;
    this.speedScale = 1;
    this.ragdoll = null;
    this.lean = 0; this.tilt = 0;
    this.footstep = 0;
    this.queued = null;
    this.model.visible = true;
    this.parts.jet.visible = false; this.parts.board.visible = false;
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this.resetPose();
  }

  resetPose() {
    const p = this.parts;
    p.hips.position.set(0, 0.95, 0); p.hips.rotation.set(0, 0, 0);
    p.torso.rotation.set(0, 0, 0); p.head.rotation.set(0, 0, 0);
    for (const a of p.arms) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
    for (const l of p.legs) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
  }

  get height() { return this.state === PS.ROLL ? ROLL_HEIGHT : PLAYER_HEIGHT; }
  get alive() { return this.state !== PS.DEAD && this.state !== PS.CAUGHT; }

  /* --------------------------------------------------------- inputs */
  moveLane(dir, game) {
    if (!this.alive) return;
    const t = clamp(this.targetLane + dir, 0, 2);
    if (t === this.targetLane) return;
    this.laneFrom = this.x; this.laneTo = LANES[t]; this.laneT = 0; this.targetLane = t;
    this.tilt = dir;
    if (game) game.audio.play('swish');
  }
  jump(game) {
    if (!this.alive) return;
    if (this.jetpack > 0) return;
    if (!this.grounded) { this.queued = 'jump'; return; }
    if (this.state === PS.ROLL) { this.state = PS.RUN; }
    this.vy = this.sneakers > 0 ? SUPER_JUMP_V : JUMP_V;
    this.grounded = false; this.state = PS.JUMP;
    if (game) { game.audio.play('jump'); game.stats.jumps++; }
  }
  roll(game) {
    if (!this.alive) return;
    if (this.jetpack > 0) return;
    if (!this.grounded) { this.vy = Math.min(this.vy, -12); this.queued = 'roll'; return; }
    this.state = PS.ROLL; this.rollT = 0;
    if (game) { game.audio.play('roll'); game.stats.rolls++; }
  }

  /* ---------------------------------------------------------- física */
  step(dt, speed, track, game) {
    this.prevZ = this.z; this.prevX = this.x; this.prevY = this.y;
    if (this.state === PS.DEAD || this.state === PS.CAUGHT) { this.stepDead(dt); return; }
    const sp = speed * this.speedScale;
    this.z += sp * dt;
    // troca de pista
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / LANE_CHANGE_TIME);
      this.x = lerp(this.laneFrom, this.laneTo, easeOutCubic(this.laneT));
      if (this.laneT >= 1) this.lane = this.targetLane;
    }
    // power-ups
    for (const k of ['jetpack', 'sneakers', 'magnet', 'multiplier', 'hoverboard']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.speedScale < 1) this.speedScale = Math.min(1, this.speedScale + dt * 0.5);
    // estados
    if (this.state === PS.ROLL) { this.rollT += dt; if (this.rollT >= ROLL_TIME) this.state = PS.RUN; }
    if (this.state === PS.STUMBLE) { this.stumbleT += dt; if (this.stumbleT >= 0.5) this.state = PS.RUN; }
    // chão: topo de trem / rampa sob o jogador
    const ground = this.groundHeight(track);
    this.groundY = ground;
    if (this.jetpack > 0) {
      const target = JET_HEIGHT;
      this.y = damp(this.y, target, 4, dt); this.vy = 0; this.grounded = false;
      if (this.state === PS.JUMP || this.state === PS.ROLL) this.state = PS.RUN;
    } else {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        if (!this.grounded && this.vy < -2 && game) { game.onLand(this.vy); }
        this.y = ground; this.vy = 0;
        if (!this.grounded) {
          this.grounded = true;
          if (this.state === PS.JUMP) this.state = PS.RUN;
          if (this.queued === 'roll') { this.queued = null; this.roll(game); }
          else if (this.queued === 'jump') { this.queued = null; this.jump(game); }
        }
      } else if (this.y > ground + 0.05) {
        if (this.grounded) { this.grounded = false; if (this.state === PS.RUN) this.state = PS.JUMP; this.vy = Math.min(this.vy, 0); }
      }
    }
    this.onTrain = ground > 1;
    // colisões
    this.collide(track, game);
  }

  /** Altura do chão na posição atual (rampa / topo de trem). */
  groundHeight(track) {
    let g = 0;
    const c = track.chunkAt(this.z);
    const test = (r) => {
      if (Math.abs(r.x - this.x) > LANE_W * 0.5 + 0.15) return;
      if (this.z < r.z0 - 0.2 || this.z > r.z1 + 0.2) return;
      if (r.type === OB.TRAIN) { if (this.y >= r.top - 0.55) g = Math.max(g, r.top); }
      else if (r.type === OB.RAMP) {
        const t = clamp((this.z - r.z0) / r.rampLen, 0, 1);
        const h = t * r.top;
        if (this.y >= h - 0.6) g = Math.max(g, h);
      }
    };
    if (c) { for (const r of c.obstacles) test(r); const n = track.chunkAfter(c); if (n) for (const r of n.obstacles) test(r); const p = this.prevChunk(track, c); if (p) for (const r of p.obstacles) test(r); }
    return g;
  }
  prevChunk(track, c) { let best = null; for (const o of track.chunks) if (o.z < c.z && (!best || o.z > best.z)) best = o; return best; }

  collide(track, game) {
    const c = track.chunkAt(this.z);
    if (!c) return;
    const hx = PLAYER_RADIUS, h = this.height;
    const zFront = this.z + 0.3, zBack = this.z - 0.3;
    const y0 = this.y, y1 = this.y + h;
    const check = (r) => {
      if (r.hit) return;
      if (zFront < r.z0 || zBack > r.z1) return;
      if (Math.abs(r.x - this.x) > hx + 1.15) return;
      if (r.type === OB.RAMP) return;
      if (r.type === OB.TRAIN || r.type === OB.TRAIN_MOVING) {
        if (y0 >= r.top - 0.55) return;                  // em cima
        if (this.jetpack > 0) return;
        // lateral (entrando na troca de pista) ou frontal?
        const enteringSide = this.laneT < 1 && this.prevZ + 0.3 >= r.z0 && Math.abs(this.prevX - r.x) > hx + 1.15;
        if (enteringSide && r.type === OB.TRAIN) { this.bounceBack(game); return; }
        if (this.hoverboard > 0) { game.onBoardBreak(); return; }
        if (this.invuln > 0) return;
        game.onCrash(r);
        r.hit = true;
        return;
      }
      // barreiras
      let pass = false;
      if (r.type === OB.HIGH || r.type === OB.ARCH) pass = (y1 <= r.bottom + 0.1) || (y0 >= r.top - 0.1);
      else pass = y0 >= r.top - 0.12;
      if (pass) { if (!r.scored) { r.scored = true; game.stats.barriers++; } return; }
      if (this.jetpack > 0) return;
      if (this.hoverboard > 0) { r.hit = true; game.onBoardBreak(); return; }
      if (this.invuln > 0) return;
      r.hit = true;
      game.onBarrierHit(r);
      this.stumble(game);
    };
    for (const r of c.obstacles) check(r);
    const n = track.chunkAfter(c); if (n) for (const r of n.obstacles) check(r);
    const p = this.prevChunk(track, c); if (p) for (const r of p.obstacles) check(r);
    for (const r of track.moving) if (r.active) check(r);
  }

  bounceBack(game) {
    // volta para a pista de origem
    const from = this.laneFrom, to = this.laneTo;
    this.laneFrom = this.x; this.laneTo = from; this.laneT = 0.0;
    this.targetLane = LANES.indexOf(from) >= 0 ? LANES.indexOf(from) : this.lane;
    const _ = to;
    this.stumble(game, 'train-side');
  }

  stumble(game, kind = 'barrier') {
    if (this.state === PS.DEAD) return;
    this.state = PS.STUMBLE; this.stumbleT = 0;
    this.speedScale = 0.72;
    game.onStumble(kind);
  }

  die(mode) {
    this.state = mode === 'caught' ? PS.CAUGHT : PS.DEAD;
    this.deadT = 0;
    // ragdoll simples: velocidades angulares aleatórias por membro
    const p = this.parts;
    this.ragdoll = {
      vy: mode === 'caught' ? 2 : 5.5, vz: mode === 'caught' ? -3 : -4.5 - Math.random() * 3, rotX: 0, rotVX: mode === 'caught' ? 4 : 9 + Math.random() * 3,
      limbs: [...p.arms.map((a) => a.sh), ...p.legs.map((l) => l.hip), ...p.arms.map((a) => a.el), ...p.legs.map((l) => l.knee)].map(() => ({ x: (Math.random() - 0.5) * 7, z: (Math.random() - 0.5) * 4 })),
      y: this.y, z: 0, landed: false,
    };
  }

  stepDead(dt) {
    this.deadT += dt;
    const r = this.ragdoll;
    if (!r) return;
    r.vy -= GRAVITY * 0.8 * dt;
    r.y += r.vy * dt; r.z += r.vz * dt;
    if (r.y < this.groundY) { r.y = this.groundY; r.vy = -r.vy * 0.25; r.vz *= 0.6; r.rotVX *= 0.5; if (Math.abs(r.vy) < 0.8) { r.vy = 0; r.landed = true; } }
    r.rotX += r.rotVX * dt;
    if (r.landed) { r.rotVX *= 0.85; }
    this.y = r.y; this.z = this.prevZ + r.vz * dt * 0.3;
    const p = this.parts;
    const limbs = [...p.arms.map((a) => a.sh), ...p.legs.map((l) => l.hip), ...p.arms.map((a) => a.el), ...p.legs.map((l) => l.knee)];
    for (let i = 0; i < limbs.length; i++) {
      const L = r.limbs[i];
      const o = limbs[i];
      o.rotation.x = clamp(o.rotation.x + L.x * dt, -2.4, 2.4); o.rotation.z = clamp(o.rotation.z + L.z * dt * 0.5, -1.2, 1.2);
      L.x *= r.landed ? 0.9 : 0.99; L.z *= r.landed ? 0.9 : 0.99;
    }
    p.hips.rotation.x = r.rotX;
    p.hips.position.y = 0.95;
  }

  /* -------------------------------------------------------- animação */
  animate(dt, time, speed, alpha) {
    const p = this.parts;
    // interpolação de posição
    const ix = lerp(this.prevX, this.x, alpha), iy = lerp(this.prevY, this.y, alpha), iz = lerp(this.prevZ, this.z, alpha);
    this.model.position.set(ix, iy, iz);
    this.renderX = ix; this.renderY = iy; this.renderZ = iz;
    this.tilt = damp(this.tilt, 0, 9, dt);
    if (!this.alive) {
      this.model.rotation.z = 0;
      p.blob.visible = false;
      return;
    }
    const sp = speed * this.speedScale;
    const cadence = 2.2 + sp * 0.12;
    this.runPhase += dt * cadence * Math.PI * 2;
    const ph = this.runPhase;
    const st = this.state;
    const onBoard = this.hoverboard > 0;
    const flying = this.jetpack > 0;
    p.jet.visible = flying;
    p.board.visible = onBoard && !flying;
    p.blob.visible = true;
    p.blob.position.y = this.groundY - iy + 0.02;
    p.blob.material.opacity = 0.35 * clamp(1 - (iy - this.groundY) / 3, 0, 1);
    // inclinação do corpo (velocidade + troca de pista)
    const lean = 0.12 + sp * 0.006;
    this.model.rotation.z = -this.tilt * 0.22;
    this.model.rotation.y = -this.tilt * 0.12;
    const arms = p.arms, legs = p.legs;
    if (flying) {
      p.hips.position.y = 0.95 + Math.sin(time * 3) * 0.04; p.hips.rotation.x = 0.35;
      p.torso.rotation.x = 0.1; p.head.rotation.x = -0.4;
      for (let i = 0; i < 2; i++) { arms[i].sh.rotation.x = -0.5 + Math.sin(time * 2 + i) * 0.1; arms[i].sh.rotation.z = (i ? -1 : 1) * 0.9; arms[i].el.rotation.x = -0.6; legs[i].hip.rotation.x = -0.5 + Math.sin(time * 2.5 + i * 2) * 0.12; legs[i].knee.rotation.x = 0.3; }
      return;
    }
    if (st === PS.ROLL) {
      const t = this.rollT / ROLL_TIME;
      p.hips.position.y = 0.45 + Math.sin(t * Math.PI) * 0.05;
      p.hips.rotation.x = t * Math.PI * 2 + lean;
      p.torso.rotation.x = 0.9; p.head.rotation.x = 0.5;
      for (let i = 0; i < 2; i++) { arms[i].sh.rotation.x = -2.2; arms[i].el.rotation.x = -1.8; legs[i].hip.rotation.x = -2.0; legs[i].knee.rotation.x = 2.2; }
      return;
    }
    if (st === PS.JUMP || !this.grounded) {
      const up = clamp(this.vy / JUMP_V, -1, 1);
      p.hips.position.y = 0.95; p.hips.rotation.x = lean * 0.6;
      p.torso.rotation.x = 0.15 - up * 0.1; p.head.rotation.x = -0.2;
      const tuck = smoothstep(-0.3, 0.6, up);
      for (let i = 0; i < 2; i++) {
        arms[i].sh.rotation.x = -1.6 - up * 0.8 + (i ? 0.3 : -0.3); arms[i].sh.rotation.z = (i ? -1 : 1) * 0.5; arms[i].el.rotation.x = -0.8;
        legs[i].hip.rotation.x = i ? -0.4 - tuck * 1.2 : 0.5 - tuck * 0.6; legs[i].knee.rotation.x = i ? 1.4 : 0.6 + tuck * 0.6;
      }
      return;
    }
    if (st === PS.STUMBLE) {
      const t = this.stumbleT / 0.5;
      const k = Math.sin(t * Math.PI);
      p.hips.position.y = 0.95 - k * 0.2; p.hips.rotation.x = lean + k * 0.8;
      p.torso.rotation.x = k * 0.5; p.head.rotation.x = -k * 0.4;
      for (let i = 0; i < 2; i++) { arms[i].sh.rotation.x = -2.5 * k + Math.sin(ph) * 0.4; arms[i].sh.rotation.z = (i ? -1 : 1) * (0.6 + k); arms[i].el.rotation.x = -1; legs[i].hip.rotation.x = Math.sin(ph + i * Math.PI) * 0.6; legs[i].knee.rotation.x = 0.9; }
      return;
    }
    if (onBoard) {
      p.hips.position.y = 1.05 + Math.sin(time * 4) * 0.03; p.hips.rotation.x = 0.1; p.hips.rotation.y = 0.5;
      p.torso.rotation.x = 0.15; p.head.rotation.x = -0.1; p.head.rotation.y = -0.45;
      for (let i = 0; i < 2; i++) { arms[i].sh.rotation.x = -0.3 + Math.sin(time * 3 + i) * 0.1; arms[i].sh.rotation.z = (i ? -1 : 1) * 0.55; arms[i].el.rotation.x = -0.5; legs[i].hip.rotation.x = -0.35; legs[i].hip.rotation.y = (i ? -0.4 : 0.4); legs[i].knee.rotation.x = 0.7; }
      p.board.position.set(0, 0, 0); p.board.rotation.y = 0.45; p.board.rotation.z = Math.sin(time * 4) * 0.04;
      return;
    }
    // corrida
    p.hips.rotation.y = 0;
    const bob = Math.abs(Math.sin(ph)) * 0.07;
    p.hips.position.y = 0.95 + bob;
    p.hips.rotation.x = lean;
    p.hips.rotation.z = Math.sin(ph) * 0.05;
    p.torso.rotation.x = lean * 0.5; p.torso.rotation.y = Math.sin(ph) * 0.18;
    p.head.rotation.x = -lean * 0.9; p.head.rotation.y = -Math.sin(ph) * 0.1;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const lp = ph + (i ? Math.PI : 0);
      legs[i].hip.rotation.x = Math.sin(lp) * (0.75 + sp * 0.008); legs[i].hip.rotation.y = 0;
      legs[i].knee.rotation.x = Math.max(0, Math.sin(lp - 1.2)) * 1.6 + 0.15;
      arms[i].sh.rotation.x = Math.sin(lp + Math.PI) * (0.9 + sp * 0.01) - 0.2; arms[i].sh.rotation.z = s * 0.28;
      arms[i].el.rotation.x = -1.2 - Math.max(0, Math.sin(lp + Math.PI)) * 0.6;
    }
    if (p.tail) p.tail.rotation.x = 0.5 + Math.sin(ph * 0.5) * 0.25;
    p.pack.position.y = 0.3 - bob * 0.5;
    this.footstep = Math.sin(ph);
  }

  /* --------------------------------------------- posição de câmera */
  getRenderPos(out) { return out.set(this.renderX || 0, this.renderY || 0, this.renderZ || 0); }
  shift(dz) { this.z -= dz; this.prevZ -= dz; if (this.renderZ !== undefined) this.renderZ -= dz; this.model.position.z -= dz; }
}
