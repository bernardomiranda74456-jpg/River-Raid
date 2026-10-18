/**
 * Thin wrapper around Rapier 3D: world creation, body registration,
 * interpolation buffers (previous/current transforms) and query helpers.
 */
import * as THREE from 'three';

export const FIXED_DT = 1 / 60;
export const GROUP = { STATIC: 0x0001, CHAR: 0x0002, RAGDOLL: 0x0004, PLATFORM: 0x0008, SENSOR: 0x0010 };

export class Physics {
  constructor(RAPIER) {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    this.world.timestep = FIXED_DT;
    this.events = new RAPIER.EventQueue(true);
    this.tracked = [];              // { body, prevPos, prevRot, pos, rot } for interpolation
    this.userData = new Map();      // collider handle -> data
    this.bodyData = new Map();      // body handle -> data
    this.kinematics = [];           // kinematic movers { body, update(t) }
    this.time = 0;
  }

  /** Register a dynamic/kinematic body for render interpolation. */
  track(body, mesh = null) {
    const t = body.translation(), r = body.rotation();
    const e = { body, mesh, prevPos: new THREE.Vector3(t.x, t.y, t.z), pos: new THREE.Vector3(t.x, t.y, t.z), prevRot: new THREE.Quaternion(r.x, r.y, r.z, r.w), rot: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
    this.tracked.push(e); return e;
  }
  untrack(body) { const i = this.tracked.findIndex((e) => e.body === body); if (i >= 0) this.tracked.splice(i, 1); }

  step() {
    this.time += FIXED_DT;
    for (const e of this.tracked) { e.prevPos.copy(e.pos); e.prevRot.copy(e.rot); }
    this.world.step(this.events);
    for (const e of this.tracked) {
      const t = e.body.translation(), r = e.body.rotation();
      e.pos.set(t.x, t.y, t.z); e.rot.set(r.x, r.y, r.z, r.w);
    }
  }

  /** Write interpolated transforms to meshes (alpha in 0..1). */
  interpolate(alpha) {
    for (const e of this.tracked) {
      if (!e.mesh) continue;
      e.mesh.position.lerpVectors(e.prevPos, e.pos, alpha);
      e.mesh.quaternion.slerpQuaternions(e.prevRot, e.rot, alpha);
    }
  }
  interpolatedPos(e, alpha, out) { return out.lerpVectors(e.prevPos, e.pos, alpha); }

  /** Cast a ray downward / in a direction. Returns { toi, point, collider, normal } or null. */
  ray(origin, dir, maxToi, excludeBody = null, filterGroups = undefined) {
    const R = this.R; const ray = new R.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxToi, true, undefined, filterGroups, undefined, excludeBody || undefined);
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return { toi: hit.timeOfImpact, point: p, normal: hit.normal, collider: hit.collider };
  }

  removeBody(body) { this.untrack(body); this.world.removeRigidBody(body); }

  dispose() { this.world.free(); this.events.free(); this.tracked.length = 0; this.userData.clear(); this.bodyData.clear(); }
}

/** Build a collision-group bitmask (membership, filter). */
export function groups(member, filter) { return ((member & 0xffff) << 16) | (filter & 0xffff); }
