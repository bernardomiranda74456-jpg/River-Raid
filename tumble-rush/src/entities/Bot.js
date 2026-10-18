/**
 * Bot AI: follows the level waypoint polyline with per-bot lateral noise,
 * jumps gaps/obstacles (raycasts ahead), waits for moving platforms, and
 * makes occasional mistakes depending on skill.
 */
import * as THREE from 'three';
import { STATE } from './Character.js';
import { mulberry32 } from '../gfx/Textures.js';
import { GROUP, groups } from '../core/Physics.js';
const RAYF = groups(GROUP.CHAR, GROUP.STATIC | GROUP.PLATFORM);

const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class Bot {
  constructor(ch, level, seed) {
    this.ch = ch; this.level = level; this.rnd = mulberry32(seed);
    this.skill = 0.35 + this.rnd() * 0.65;      // 0.35..1
    this.speedMul = 0.86 + this.skill * 0.14;    // 0.86..1
    this.wp = 0; this.lateral = (this.rnd() - 0.5) * 4; this.lateralT = 0;
    this.hesitate = 0; this.waiting = 0; this.stuck = 0; this.thinkT = this.rnd() * 0.1; this.mistakeT = 2 + this.rnd() * 6;
    this.dir = new THREE.Vector3(); this.reactDelay = 0.15 + (1 - this.skill) * 0.4;
    this.wanderA = this.rnd() * Math.PI * 2; this.target = new THREE.Vector3();
  }

  reset(wp = 0) { this.wp = wp; this.hesitate = 0; this.waiting = 0; this.stuck = 0; }

  think(dt, time) {
    const ch = this.ch, c = ch.ctrl;
    if (ch.eliminated || ch.finished) { c.mag = 0; c.x = c.z = 0; return; }
    if (ch.state === STATE.RAGDOLL || ch.state === STATE.SINK || ch.state === STATE.DEAD) { c.mag = 0; return; }
    this.thinkT -= dt; if (this.thinkT > 0) return; this.thinkT = 0.05;
    const dtt = 0.05;
    if (this.level.kind === 'survival') return this.thinkSurvival(dtt, time);

    const wps = this.level.waypoints; if (!wps.length) return;
    // advance waypoint when close (in XZ, with a height tolerance)
    let w = wps[Math.min(this.wp, wps.length - 1)];
    const reach = w.radius || 1.8;
    const dx = w.p.x - ch.pos.x, dz = w.p.z - ch.pos.z; const dist = Math.hypot(dx, dz);
    if (dist < reach && Math.abs(w.p.y - ch.pos.y) < 3.5) { this.wp = Math.min(this.wp + 1, wps.length - 1); w = wps[this.wp]; }
    // lost? pick nearest forward waypoint
    if (dist > 24) { let best = this.wp, bd = 1e9; for (let i = Math.max(0, this.wp - 3); i < Math.min(wps.length, this.wp + 4); i++) { const d = wps[i].p.distanceTo(ch.pos); if (d < bd) { bd = d; best = i; } } this.wp = best; w = wps[this.wp]; }
    ch.progress = this.wp + Math.max(0, 1 - dist / 20);

    // lateral noise target (bots don't all run the same line)
    this.lateralT -= dtt; if (this.lateralT <= 0) { this.lateralT = 1.5 + this.rnd() * 3; this.lateral = (this.rnd() - 0.5) * (w.spread ?? 4) * (1.2 - this.skill * 0.6); }
    const prev = wps[Math.max(0, this.wp - 1)]; _d.subVectors(w.p, prev.p); _d.y = 0; if (_d.lengthSq() < 0.01) _d.set(1, 0, 0); _d.normalize();
    const side = _v.set(-_d.z, 0, _d.x);
    this.target.copy(w.p).addScaledVector(side, w.noSpread ? 0 : this.lateral * Math.min(1, dist / 6));
    this.dir.set(this.target.x - ch.pos.x, 0, this.target.z - ch.pos.z); const len = this.dir.length(); if (len > 0.01) this.dir.divideScalar(len);

    // mistakes: hesitation
    this.mistakeT -= dtt;
    if (this.mistakeT <= 0) { this.mistakeT = 4 + this.rnd() * 12 * this.skill; if (this.rnd() > this.skill * 0.9) this.hesitate = 0.25 + this.rnd() * 0.6; }
    if (this.hesitate > 0) { this.hesitate -= dtt; c.mag = 0; c.x = c.z = 0; return; }

    // obstacle / gap awareness via raycasts ahead
    let wantJump = false; let speed = this.speedMul;
    if (ch.grounded) {
      const ph = this.level.physics;
      const probe = (d, up, len) => ph.ray({ x: ch.pos.x + this.dir.x * d, y: ch.pos.y + up, z: ch.pos.z + this.dir.z * d }, { x: 0, y: -1, z: 0 }, len, ch.body, RAYF);
      const near = probe(0.7, 1.0, 3.5);     // ground right in front of the feet?
      const mid = probe(1.8, 1.0, 3.5);      // ground a step ahead?
      if (!mid || !near) {
        const h2 = probe(3.2, 1.2, 4.8), h3 = probe(5.2, 1.6, 5.5);   // landing spots at jump range
        const landing = h2 || h3 || w.jump;
        if (!near) { // at the edge: jump at full speed if there is somewhere to land, else wait
          if (landing) { wantJump = true; speed = 1; }
          else if (w.wait !== false) { this.waiting += dtt; c.mag = 0; c.x = c.z = 0; if (this.waiting > 6 && this.rnd() < 0.3) { wantJump = true; this.waiting = 0; } else return; }
        } else if (landing) speed = 1; // sprint towards the edge
        else if (w.wait !== false) { c.mag = 0; c.x = c.z = 0; this.waiting += dtt; return; }
      } else this.waiting = 0;
      // wall ahead at chest height -> jump
      const hw = ph.ray({ x: ch.pos.x, y: ch.pos.y + 0.9, z: ch.pos.z }, { x: this.dir.x, y: 0, z: this.dir.z }, 1.2, ch.body, RAYF);
      if (hw && hw.normal.y < 0.5) wantJump = true;
      // stuck detection
      if (ch.speed < 1 && c.mag > 0.5) { this.stuck += dtt; if (this.stuck > 0.6) { wantJump = true; this.stuck = 0; } } else this.stuck = 0;
    }
    if (w.jump && dist < (w.jumpDist || 2.2) && ch.grounded) wantJump = true;
    if (w.slow) speed *= 0.6;
    c.x = this.dir.x * speed; c.z = this.dir.z * speed; c.mag = speed;
    if (wantJump && this.rnd() < 0.6 + this.skill * 0.4) c.jump = true;
    if (w.dive && dist < 2 && this.rnd() < this.skill) c.dive = true;
  }

  /** Hex-arena behaviour: wander towards existing tiles, avoid edges. */
  thinkSurvival(dt, time) {
    const ch = this.ch, c = ch.ctrl; const lvl = this.level;
    this.lateralT -= dt;
    let len = this.hasTarget ? Math.hypot(this.target.x - ch.pos.x, this.target.z - ch.pos.z) : 0;
    if (this.lateralT <= 0 || !this.hasTarget || len < 0.9) {
      this.lateralT = 1.0 + this.rnd() * 1.5;
      const t = lvl.pickTileFor(ch, this.rnd);
      if (t) { this.target.copy(t); this.hasTarget = true; } else { const n = lvl.nearestTile(ch); if (n) { this.target.copy(n); this.hasTarget = true; } else { c.mag = 0; return; } }
      len = Math.hypot(this.target.x - ch.pos.x, this.target.z - ch.pos.z);
    }
    this.dir.set(this.target.x - ch.pos.x, 0, this.target.z - ch.pos.z);
    if (len < 0.05) { c.mag = 0; return; }
    this.dir.divideScalar(len);
    let sp = 0.6 + this.skill * 0.35;
    // holes: jump over a missing tile ahead when there is a landing spot, otherwise turn around
    if (ch.grounded) {
      const ph = lvl.physics;
      const probe = (d, up, l) => ph.ray({ x: ch.pos.x + this.dir.x * d, y: ch.pos.y + up, z: ch.pos.z + this.dir.z * d }, { x: 0, y: -1, z: 0 }, l, ch.body, RAYF);
      const near = probe(0.9, 1.0, 2.5);
      if (!near) {
        const land = probe(3.0, 1.2, 3.0) || probe(4.6, 1.5, 3.5);
        if (land) { c.jump = true; sp = 1; }
        else { this.lateralT = 0; this.hasTarget = false; this.dir.negate(); }
      }
    }
    c.x = this.dir.x * sp; c.z = this.dir.z * sp; c.mag = sp;
  }
}
