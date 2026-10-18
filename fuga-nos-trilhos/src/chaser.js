// Perseguidor original: fiscal de pátio com lanterna + cachorro. Aparecem atrás
// do jogador no tropeço e somem ao se afastar; dois tropeços = captura.
import * as THREE from 'three';
import { damp, lerp, clamp } from './utils.js';
import { box, cyl } from './geom.js';

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();

function buildInspector(M) {
  const g = new THREE.Group();
  const skin = M.skin(0xc89070), uni = M.cloth(0x2b3a55), vest = M.shiny(0xff6a00), dark = M.cloth(0x111111), capM = M.shiny(0x1c2a44);
  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; (parent || g).add(m); return m; };
  const parts = {};
  const hips = new THREE.Group(); hips.position.y = 1.0; g.add(hips); parts.hips = hips;
  mk(new THREE.CapsuleGeometry(0.22, 0.14, 4, 10).rotateZ(Math.PI / 2), uni, hips);
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso); parts.torso = torso;
  const tm = mk(new THREE.CapsuleGeometry(0.26, 0.34, 4, 12), uni, torso); tm.position.y = 0.32; tm.scale.set(1.2, 1, 0.9);
  const belly = mk(new THREE.SphereGeometry(0.26, 12, 10), uni, torso); belly.position.set(0, 0.2, 0.08); belly.scale.set(1, 0.8, 0.9);
  const v = mk(box(0.55, 0.42, 0.36), vest, torso); v.position.set(0, 0.35, 0.02);
  const strip = mk(box(0.56, 0.05, 0.37), M.coneStripe, torso); strip.position.set(0, 0.3, 0.02);
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head); parts.head = head;
  const hm = mk(new THREE.SphereGeometry(0.16, 16, 12), skin, head); hm.position.y = 0.12;
  const must = mk(box(0.12, 0.03, 0.04), dark, head); must.position.set(0, 0.07, 0.15);
  const cap = mk(cyl(0.17, 0.17, 0.09, 16, 0, 0.26, 0), capM, head);
  const peak = mk(box(0.26, 0.02, 0.16), capM, head); peak.position.set(0, 0.22, 0.2);
  const badge = mk(cyl(0.04, 0.04, 0.02, 8, 0, 0.27, 0.16, 0, Math.PI / 2), M.key, head);
  parts.arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.3, 0.52, 0); torso.add(sh);
    mk(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8).translate(0, -0.14, 0), uni, sh);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    mk(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8).translate(0, -0.13, 0), uni, el);
    const hand = mk(new THREE.SphereGeometry(0.06, 8, 6), skin, el); hand.position.y = -0.28;
    parts.arms.push({ sh, el, hand });
  }
  // lanterna na mão direita
  const torch = new THREE.Group(); torch.position.y = -0.3; parts.arms[1].el.add(torch); parts.torch = torch;
  mk(cyl(0.035, 0.035, 0.2, 8), dark, torch).rotation.x = Math.PI / 2;
  const lens = mk(cyl(0.05, 0.035, 0.05, 10, 0, 0, 0.12, 0, Math.PI / 2), M.headlight, torch);
  parts.legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.13, -0.02, 0); hips.add(hip);
    mk(new THREE.CapsuleGeometry(0.095, 0.32, 4, 10).translate(0, -0.18, 0), uni, hip);
    const knee = new THREE.Group(); knee.position.y = -0.4; hip.add(knee);
    mk(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10).translate(0, -0.17, 0), uni, knee);
    const shoe = mk(box(0.14, 0.1, 0.3), dark, knee); shoe.position.set(0, -0.42, 0.05);
    parts.legs.push({ hip, knee });
  }
  const _ = belly + strip + must + cap + peak + badge + lens;
  g.userData.parts = parts;
  return g;
}

function buildDog(M) {
  const g = new THREE.Group();
  const fur = M.cloth(0x7a5a3a), furD = M.cloth(0x3a2a1a), collar = M.shiny(0xc8102e);
  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; (parent || g).add(m); return m; };
  const parts = {};
  const body = new THREE.Group(); body.position.y = 0.5; g.add(body); parts.body = body;
  const bm = mk(new THREE.CapsuleGeometry(0.17, 0.5, 4, 12).rotateX(Math.PI / 2), fur, body);
  const neck = new THREE.Group(); neck.position.set(0, 0.1, 0.35); body.add(neck); parts.neck = neck;
  const head = mk(new THREE.SphereGeometry(0.15, 14, 10), fur, neck); head.position.set(0, 0.08, 0.1);
  const snout = mk(box(0.12, 0.1, 0.16), furD, neck); snout.position.set(0, 0.03, 0.26);
  const nose = mk(new THREE.SphereGeometry(0.03, 8, 6), M.rubber, neck); nose.position.set(0, 0.06, 0.34);
  for (const s of [-1, 1]) { const ear = mk(box(0.06, 0.12, 0.03), furD, neck); ear.position.set(s * 0.12, 0.2, 0.05); ear.rotation.z = s * 0.4; }
  const col = mk(new THREE.TorusGeometry(0.13, 0.03, 6, 16), collar, neck); col.rotation.x = Math.PI / 2; col.position.set(0, 0.02, 0.0);
  const tail = mk(new THREE.CapsuleGeometry(0.03, 0.25, 4, 6).translate(0, 0.14, 0), fur, body); tail.position.set(0, 0.1, -0.4); tail.rotation.x = -0.8; parts.tail = tail;
  parts.legs = [];
  for (const [x, z] of [[-0.1, 0.25], [0.1, 0.25], [-0.1, -0.25], [0.1, -0.25]]) {
    const leg = new THREE.Group(); leg.position.set(x, -0.08, z); body.add(leg);
    mk(new THREE.CapsuleGeometry(0.045, 0.3, 4, 6).translate(0, -0.18, 0), fur, leg);
    const paw = mk(box(0.08, 0.05, 0.1), furD, leg); paw.position.set(0, -0.4, 0.02);
    parts.legs.push(leg);
  }
  const _ = bm + head + snout + nose + col;
  g.userData.parts = parts;
  return g;
}

export class Chaser {
  constructor(scene, M, env) {
    this.scene = scene; this.env = env;
    this.inspector = buildInspector(M); this.dog = buildDog(M);
    scene.add(this.inspector); scene.add(this.dog);
    this.ip = this.inspector.userData.parts; this.dp = this.dog.userData.parts;
    this.reset();
  }
  reset() {
    this.visible = true; this.timer = 2.6;          // aparece no início da corrida
    this.dist = 3.8; this.targetDist = 3.8;          // distância atrás do jogador
    this.x = 0; this.phase = 0; this.catching = false; this.catchT = 0;
    this.inspector.visible = true; this.dog.visible = true;
  }
  /** Chamado em um tropeço: aproxima o perseguidor por alguns segundos. */
  alert(seconds) { this.visible = true; this.timer = seconds; this.targetDist = 3.0; }
  startCatch() { this.catching = true; this.catchT = 0; this.visible = true; this.targetDist = 0.9; }
  shift(dz) { this.inspector.position.z -= dz; this.dog.position.z -= dz; }

  update(dt, player, speed, time) {
    if (!this.catching) {
      if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0) this.visible = false; }
      if (!this.visible) this.targetDist = 14; else this.targetDist = Math.max(this.targetDist, 3.0);
    } else { this.catchT += dt; }
    this.dist = damp(this.dist, this.targetDist, this.catching ? 6 : 1.8, dt);
    const show = this.dist < 13.5;
    this.inspector.visible = show; this.dog.visible = show;
    if (!show) { this.env.setFlashlight(false); return; }
    const px = player.renderX || 0, pz = player.renderZ || 0;
    this.x = damp(this.x, px + 0.55, 4, dt); // levemente deslocado para não cobrir o jogador
    const gy = player.groundY > 1 ? 0 : player.groundY; // o fiscal não sobe em trens
    // fiscal
    const ins = this.inspector;
    ins.position.set(this.x, gy, pz - this.dist);
    const ph = this.phase += dt * (2.0 + speed * 0.1) * Math.PI * 2;
    const p = this.ip;
    p.hips.position.y = 1.0 + Math.abs(Math.sin(ph)) * 0.06;
    p.hips.rotation.x = 0.12 + speed * 0.004;
    p.torso.rotation.y = Math.sin(ph) * 0.12;
    p.head.rotation.x = -0.15;
    for (let i = 0; i < 2; i++) {
      const lp = ph + (i ? Math.PI : 0);
      p.legs[i].hip.rotation.x = Math.sin(lp) * 0.65; p.legs[i].knee.rotation.x = Math.max(0, Math.sin(lp - 1.2)) * 1.4 + 0.1;
      p.arms[i].sh.rotation.x = i === 1 ? -1.3 : Math.sin(lp + Math.PI) * 0.8 - 0.2; p.arms[i].sh.rotation.z = (i ? -1 : 1) * 0.3;
      p.arms[i].el.rotation.x = i === 1 ? -0.3 : -1.1;
    }
    if (this.catching) { p.arms[0].sh.rotation.x = -1.6; p.arms[1].sh.rotation.x = -1.6; p.arms[0].el.rotation.x = p.arms[1].el.rotation.x = -0.2; }
    // lanterna aponta para o jogador
    _v.set(this.x + 0.3, 1.5, pz - this.dist + 0.4);
    _t.set(px, 0.9 + (player.renderY || 0), pz + 2);
    this.env.setFlashlight(true, _v, _t);
    // cachorro: à frente do fiscal, um pouco ao lado
    const d = this.dog;
    const side = Math.sin(time * 0.7) * 0.8;
    d.position.set(this.x + side, gy, pz - this.dist + 1.6);
    const dp = this.dp, dph = ph * 1.4;
    dp.body.position.y = 0.5 + Math.abs(Math.sin(dph)) * 0.08;
    dp.body.rotation.x = Math.sin(dph) * 0.12;
    dp.neck.rotation.x = -0.2 + Math.sin(dph) * 0.1;
    dp.tail.rotation.x = -0.8 + Math.sin(time * 14) * 0.4;
    for (let i = 0; i < 4; i++) dp.legs[i].rotation.x = Math.sin(dph + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.4) * 0.8;
  }
}
