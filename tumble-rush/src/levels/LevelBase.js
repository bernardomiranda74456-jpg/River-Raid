/**
 * LevelBase: builder helpers that create a mesh + Rapier collider in one go,
 * kinematic movers (pendulums, spinners, sliding platforms), sensors
 * (hazards, jump pads, fans, finish) and collision-event dispatch.
 */
import * as THREE from 'three';
import { GROUP, groups } from '../core/Physics.js';
import { Environment } from '../gfx/Environment.js';
import { mergeGeos } from '../entities/Character.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();

export class LevelBase {
  constructor(game) {
    this.game = game; this.scene = game.scene; this.physics = game.physics; this.R = game.physics.R; this.M = game.materials; this.settings = game.settings;
    this.root = new THREE.Group(); this.root.name = 'level'; this.scene.add(this.root);
    this.bodies = []; this.movers = []; this.sensors = new Map(); this.waypoints = []; this.spawns = []; this.disposables = []; this.ownMats = [];
    this.env = null; this.time = 0; this.name = 'Level'; this.kind = 'race'; this.qualify = 16; this.duration = 120; this.killY = -50;
    this.fanOccupants = new Map();
  }

  // ---------- geometry + collider helpers ----------
  /** Static or kinematic box. size [w,h,d]; pos; rot euler (rad); mat; options { kinematic, sensor, data, groups, uv } */
  box(size, pos, rot = [0, 0, 0], mat = this.M.concrete, o = {}) {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    if (o.uv !== false) scaleBoxUV(geo, size, o.uv || 0.5);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = o.castShadow !== false; mesh.receiveShadow = true; mesh.userData.batch = !o.kinematic && !o.body && !o.parent && o.batch !== false;
    mesh.position.set(pos[0], pos[1], pos[2]); if (o.quat) mesh.quaternion.copy(o.quat); else mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (!o.noMesh) (o.parent || this.root).add(mesh);
    if (o.noCollider) return { mesh };
    const cd = this.R.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2);
    return this._attach(mesh, cd, o);
  }
  cylinder(radius, height, pos, rot = [0, 0, 0], mat = this.M.metal, o = {}) {
    const geo = new THREE.CylinderGeometry(o.radiusTop ?? radius, radius, height, o.segments || 24);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = o.castShadow !== false; mesh.receiveShadow = true; mesh.userData.batch = !o.kinematic && !o.body && !o.parent && o.batch !== false;
    mesh.position.set(pos[0], pos[1], pos[2]); if (o.quat) mesh.quaternion.copy(o.quat); else mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (!o.noMesh) (o.parent || this.root).add(mesh);
    if (o.noCollider) return { mesh };
    const cd = this.R.ColliderDesc.cylinder(height / 2, radius);
    return this._attach(mesh, cd, o);
  }
  sphere(radius, pos, mat = this.M.metal, o = {}) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.set(pos[0], pos[1], pos[2]); mesh.userData.batch = !o.parent && o.batch !== false;
    (o.parent || this.root).add(mesh);
    if (o.noCollider) return { mesh };
    return this._attach(mesh, this.R.ColliderDesc.ball(radius), o);
  }
  /** Clone of a library material owned by this level (animated maps etc.); disposed with the level. */
  ownMaterial(base, fn) { const m = base.clone(); if (base.map) { m.map = base.map.clone(); m.map.needsUpdate = true; } if (fn) fn(m); this.M.register(m); this.ownMats.push(m); return m; }
  /** Decorative mesh only (no collider). */
  deco(mesh, batch = true) { if (batch && mesh.isMesh && !mesh.userData.noBatch) mesh.userData.batch = true; this.root.add(mesh); return mesh; }

  _attach(mesh, cd, o) {
    const R = this.R; const world = this.physics.world;
    mesh.updateMatrixWorld(); const p = mesh.position, q = mesh.quaternion;
    let body;
    if (o.body) body = o.body; // attach to an existing (kinematic) body with local offsets
    else {
      const desc = o.kinematic ? R.RigidBodyDesc.kinematicPositionBased() : R.RigidBodyDesc.fixed();
      desc.setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      body = world.createRigidBody(desc); this.bodies.push(body);
    }
    if (o.body) { cd.setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); }
    const member = o.sensor ? GROUP.SENSOR : (o.kinematic || o.body ? GROUP.PLATFORM : GROUP.STATIC);
    const filter = o.sensor ? GROUP.CHAR : (o.hazardSolid ? GROUP.RAGDOLL : (GROUP.CHAR | GROUP.RAGDOLL));
    cd.setCollisionGroups(groups(member, filter)).setFriction(o.friction ?? 0.8).setRestitution(o.restitution ?? 0);
    if (o.sensor) { cd.setSensor(true).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS); }
    const col = world.createCollider(cd, body);
    if (o.data || o.sensor) { this.physics.userData.set(col.handle, o.data || {}); if (o.sensor) this.sensors.set(col.handle, o.data); }
    return { mesh, body, col };
  }

  /** Create a kinematic mover: a group mesh + body whose pose is driven by fn(t) -> { pos: Vector3, quat: Quaternion }. */
  mover(group, fn, o = {}) {
    const R = this.R; const world = this.physics.world;
    const p0 = fn(0);
    const desc = R.RigidBodyDesc.kinematicPositionBased().setTranslation(p0.pos.x, p0.pos.y, p0.pos.z).setRotation({ x: p0.quat.x, y: p0.quat.y, z: p0.quat.z, w: p0.quat.w });
    const body = world.createRigidBody(desc); this.bodies.push(body);
    group.position.copy(p0.pos); group.quaternion.copy(p0.quat); this.root.add(group);
    const track = this.physics.track(body, group);
    const m = { group, body, fn, track, data: o.data }; this.movers.push(m);
    this.physics.bodyData.set(body.handle, o.data || { type: 'platform' });
    return m;
  }
  /** Add a collider shape to a mover (local offset). kind: 'box' | 'cylinder' | 'ball' */
  moverShape(m, kind, dims, pos = [0, 0, 0], rot = [0, 0, 0], o = {}) {
    const R = this.R; let cd;
    if (kind === 'box') cd = R.ColliderDesc.cuboid(dims[0] / 2, dims[1] / 2, dims[2] / 2);
    else if (kind === 'cylinder') cd = R.ColliderDesc.cylinder(dims[1] / 2, dims[0]);
    else cd = R.ColliderDesc.ball(dims[0]);
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
    cd.setTranslation(pos[0], pos[1], pos[2]).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    const member = o.sensor ? GROUP.SENSOR : GROUP.PLATFORM;
    const filter = o.sensor ? GROUP.CHAR : (o.hazardSolid ? GROUP.RAGDOLL : (GROUP.CHAR | GROUP.RAGDOLL));
    cd.setCollisionGroups(groups(member, filter)).setFriction(o.friction ?? 0.9);
    if (o.sensor) cd.setSensor(true).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
    const col = this.physics.world.createCollider(cd, m.body);
    const data = o.data ? { ...o.data, body: m.body } : null;
    if (data) { this.physics.userData.set(col.handle, data); if (o.sensor) this.sensors.set(col.handle, data); }
    return col;
  }

  /** Box sensor region (finish line, jump pad, fan, kill zone). */
  sensorBox(size, pos, data, rot = [0, 0, 0]) { return this.box(size, pos, rot, null, { sensor: true, data, noMesh: true, uv: false }); }

  // ---------- waypoints / spawns ----------
  wp(x, y, z, flags = {}) { const w = { p: new THREE.Vector3(x, y, z), ...flags }; this.waypoints.push(w); return w; }

  /**
   * Merge all static meshes that share a material into one mesh per material.
   * Cuts hundreds of draw calls (x4 with shadow cascades) down to a dozen.
   */
  batchStatics() {
    const groups = new Map(); const remove = [];
    this.root.updateMatrixWorld(true);
    this.root.traverse((o) => {
      if (!o.isMesh || !o.userData.batch || o.isInstancedMesh || !o.material || o.parent !== this.root) return;
      const key = o.material.uuid; if (!groups.has(key)) groups.set(key, { mat: o.material, geos: [], cast: false, recv: false });
      const g = groups.get(key); const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); g.geos.push(geo); g.cast = g.cast || o.castShadow; g.recv = g.recv || o.receiveShadow; remove.push(o);
    });
    for (const o of remove) { this.root.remove(o); o.geometry.dispose(); }
    let n = 0;
    for (const g of groups.values()) {
      const merged = mergeGeos(g.geos); for (const geo of g.geos) geo.dispose();
      const m = new THREE.Mesh(merged, g.mat); m.castShadow = g.cast; m.receiveShadow = g.recv; m.name = 'batch'; this.root.add(m); n++;
    }
    this.batchCount = n;
  }

  // ---------- lifecycle ----------
  build() {}
  /** Per fixed step before physics: drive kinematic movers, custom logic. */
  preStep(dt, time) {
    this.time = time;
    for (const m of this.movers) {
      const r = m.fn(time);
      m.body.setNextKinematicTranslation({ x: r.pos.x, y: r.pos.y, z: r.pos.z });
      m.body.setNextKinematicRotation({ x: r.quat.x, y: r.quat.y, z: r.quat.z, w: r.quat.w });
    }
    // continuous fan regions
    for (const [ch, fans] of this.fanOccupants) { if (!fans.size) continue; for (const f of fans) { ch.fanForce.add(f.force); } ch.inFans = fans.size; }
  }
  /** After physics: process collision events. */
  postStep(chars) {
    const ph = this.physics; const ud = ph.userData;
    ph.events.drainCollisionEvents((h1, h2, started) => {
      let s = this.sensors.get(h1), other = h2; if (!s) { s = this.sensors.get(h2); other = h1; }
      if (!s) return;
      const d = ud.get(other); if (!d || d.type !== 'char') return;
      this.onSensor(s, d.char, started);
    });
    for (const ch of chars) {
      if (ch.state === 5) continue;
      if (ch.pos.y < this.killY) ch.eliminate('fall');
    }
    this.fanOccupants.forEach((set, ch) => { ch.inFans = set.size; });
  }
  onSensor(s, ch, started) {
    const game = this.game;
    switch (s.type) {
      case 'finish': if (started) game.onFinish(ch); break;
      case 'kill': if (started) ch.eliminate('fall'); break;
      case 'jumppad': if (started && ch.body) { const lv = ch.body.linvel(); ch.body.setLinvel({ x: lv.x, y: s.power || 16, z: lv.z }, true); ch.state = 1; ch.stateTime = 0; ch.stretch = 1; ch.events.push('boing'); } break;
      case 'fan': { let set = this.fanOccupants.get(ch); if (!set) { set = new Set(); this.fanOccupants.set(ch, set); } if (started) set.add(s); else set.delete(s); break; }
      case 'hazard': if (started) this.knockFromHazard(s, ch); break;
      case 'bumper': if (started) this.bump(s, ch); break;
      case 'bounce': if (started && ch.body) { const c = s.center; const dir = new THREE.Vector3(ch.pos.x - c.x, 0, ch.pos.z - c.z).normalize(); const lv = ch.body.linvel(); ch.body.setLinvel({ x: dir.x * (s.power || 9), y: Math.max(lv.y, 4), z: dir.z * (s.power || 9) }, true); ch.state = 1; ch.stateTime = 0; ch.events.push('boing'); } break;
      default: break;
    }
  }
  /** Compute hazard surface velocity at the character and launch it into ragdoll. */
  knockFromHazard(s, ch) {
    const body = s.body; const t = body.translation(); const lv = body.linvel(), av = body.angvel();
    _v.set(av.x, av.y, av.z); const r = new THREE.Vector3(ch.pos.x - t.x, ch.pos.y + 0.8 - t.y, ch.pos.z - t.z); const surf = new THREE.Vector3().crossVectors(_v, r).add(new THREE.Vector3(lv.x, lv.y, lv.z));
    const out = new THREE.Vector3(r.x, 0, r.z).normalize();
    const knock = surf.multiplyScalar(s.mul || 1.3).addScaledVector(out, s.push || 3).add(new THREE.Vector3(0, s.up ?? 5, 0));
    const mag = knock.length(); const max = s.max || 22; if (mag > max) knock.multiplyScalar(max / mag); if (mag < 6) knock.setLength(6 + (s.up ?? 5));
    ch.knock(knock, 'hit'); this.game.onHit(ch, s);
  }
  bump(s, ch) {
    const c = s.center; const dir = new THREE.Vector3(ch.pos.x - c.x, 0, ch.pos.z - c.z).normalize(); const k = dir.multiplyScalar(s.power || 12).add(new THREE.Vector3(0, 5, 0));
    ch.knock(k, 'hit'); this.game.onHit(ch, s, true);
  }

  /** Race progress for a character (waypoint index + fraction), searched around its last known index. */
  progressOf(ch) {
    const wps = this.waypoints; if (!wps.length) return ch.pos.y;
    let hint = ch.wpHint || 0; let best = hint, bd = 1e9;
    for (let i = Math.max(0, hint - 2); i < Math.min(wps.length, hint + 6); i++) { const w = wps[i]; const d = Math.hypot(w.p.x - ch.pos.x, w.p.z - ch.pos.z) + Math.abs(w.p.y - ch.pos.y) * 0.5; if (d < bd) { bd = d; best = i; } }
    ch.wpHint = best; const w = wps[best]; const nxt = wps[Math.min(best + 1, wps.length - 1)];
    const seg = nxt.p.clone().sub(w.p); const L = seg.length() || 1; const t = THREE.MathUtils.clamp(ch.pos.clone().sub(w.p).dot(seg) / (L * L), 0, 0.99);
    return best + t;
  }

  /** Visual-only per-frame update (shaders, decorations). */
  update(dt, time, camPos, playerPos) { if (this.env) this.env.update(dt, playerPos); }

  dispose() {
    for (const m of this.movers) this.physics.untrack(m.body);
    for (const b of this.bodies) this.physics.world.removeRigidBody(b);
    this.bodies.length = 0; this.movers.length = 0; this.sensors.clear(); this.physics.userData.clear(); this.physics.bodyData.clear();
    this.root.traverse((o) => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); });
    this.scene.remove(this.root);
    for (const d of this.disposables) d.dispose();
    for (const m of this.ownMats) { this.M.unregister(m); m.dispose(); }
    if (this.env) this.env.dispose();
  }
}

/** Scales box UVs so textures tile in world units (tile size in meters). */
export function scaleBoxUV(geo, size, tile = 0.5) {
  const uv = geo.attributes.uv; const n = geo.attributes.normal; const [w, h, d] = size;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let su, sv; if (nx > 0.5) { su = d; sv = h; } else if (ny > 0.5) { su = w; sv = d; } else { su = w; sv = h; }
    uv.setXY(i, uv.getX(i) * su * tile, uv.getY(i) * sv * tile);
  }
  uv.needsUpdate = true;
}

/** Helper for local-frame segment construction: maps local (x,y,z) to world with a yaw rotation. */
export class Frame {
  constructor(origin, yaw) { this.o = origin.clone(); this.yaw = yaw; this.c = Math.cos(yaw); this.s = Math.sin(yaw); }
  pos(x, y, z) { return [this.o.x + x * this.c + z * this.s, this.o.y + y, this.o.z - x * this.s + z * this.c]; }
  vec(x, y, z) { return new THREE.Vector3(x * this.c + z * this.s, y, -x * this.s + z * this.c); }
  v3(x, y, z) { const p = this.pos(x, y, z); return new THREE.Vector3(p[0], p[1], p[2]); }
  rot(rx, ry, rz) { return [rx, this.yaw + ry, rz]; }
  quat(rx, ry, rz) { return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))); }
}
