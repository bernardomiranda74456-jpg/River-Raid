/**
 * Player camera with three modes:
 *  - follow: third person, always swings behind the character's heading (default)
 *  - first:  first person, at the character's eyes, looking where it faces
 *  - free:   third person orbit driven only by the mouse / right stick
 * Shared: smoothing, scenery collision (raycast), speed-driven FOV, impact shake.
 */
import * as THREE from 'three';
import { GROUP, groups } from './Physics.js';

const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class ThirdPersonCamera {
  constructor(camera, physics) {
    this.cam = camera; this.physics = physics;
    this.yaw = Math.PI; this.pitch = 0.3; this.dist = 7.0; this.curDist = 7.0;
    this.target = new THREE.Vector3(); this.smoothTarget = new THREE.Vector3(); this.pos = new THREE.Vector3();
    this.shake = 0; this.shakeT = 0; this.baseFov = 58; this.fovSpeed = 0; this.sens = 1;
    this.lookAhead = new THREE.Vector3(); this.first = true;
    this.filter = groups(GROUP.CHAR, GROUP.STATIC);
    this.intro = 0; this.introFrom = new THREE.Vector3(); this.introLook = new THREE.Vector3();
  }
  /** Cinematic fly-in: starts at `from` looking at `look`, blends into the follow camera over `dur` seconds. */
  startIntro(from, look, dur = 4) { this.intro = dur; this.introDur = dur; this.introFrom.copy(from); this.introLook.copy(look); }
  reset(targetPos, yaw) { this.yaw = yaw + Math.PI; this.pitch = 0.34; this.smoothTarget.copy(targetPos); this.first = true; this.shake = 0; }
  addShake(a) { this.shake = Math.min(1.2, this.shake + a); }

  /** First person: camera at the eyes, looking along the heading; pitch from mouse / stick. */
  _firstPerson(dt, eye, speedFactor) {
    if (!this.wasFirst) { this.pitch = 0.08; this.wasFirst = true; }
    const fwd = _d.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); // camera yaw = heading + PI
    this.pos.copy(eye).addScaledVector(fwd, 0.12);
    if (this.shake > 0) { this.shakeT += dt * 40; const s = this.shake * 0.08; this.pos.x += Math.sin(this.shakeT * 1.3) * s; this.pos.y += Math.cos(this.shakeT * 1.7) * s; this.shake = Math.max(0, this.shake - dt * 2.2); }
    const c = Math.cos(this.pitch);
    _v.set(this.pos.x + fwd.x * c, this.pos.y - Math.sin(this.pitch), this.pos.z + fwd.z * c);
    this.cam.position.copy(this.pos); this.cam.lookAt(_v);
    // keep the third-person state warm so switching back is seamless
    this.smoothTarget.copy(eye); this.curDist = 1.2;
    const fov = 74 + speedFactor * 10; this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 5); this.cam.updateProjectionMatrix();
  }
  /**
   * @param {object} o  optional: { followYaw: heading to stay behind (follow mode), eye: Vector3 eye position (first person) }
   */
  update(dt, targetPos, vel, lookX, lookY, speedFactor = 0, o = {}) {
    if (o.followYaw != null) {
      // follow mode: the heading is steered by the player; the camera swings behind it
      const want = o.followYaw + Math.PI; let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * (o.eye ? 30 : 9)));
    } else this.yaw -= lookX * 0.0022 * this.sens;
    this.pitch += lookY * 0.0022 * this.sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, o.eye ? -1.2 : -0.35, 1.2);
    if (o.eye && this.intro <= 0) return this._firstPerson(dt, o.eye, speedFactor);
    // target: character chest + velocity look-ahead
    this.target.copy(targetPos).y += 1.35;
    this.lookAhead.lerp(_v.set(vel.x, 0, vel.z).multiplyScalar(0.12), Math.min(1, dt * 3));
    this.target.add(this.lookAhead);
    if (this.first) { this.smoothTarget.copy(this.target); this.first = false; }
    const k = 1 - Math.exp(-dt * 10); this.smoothTarget.lerp(this.target, k);
    // vertical smoothing is slower to hide jump jitter but must keep up with falls
    _d.set(Math.cos(this.pitch) * Math.sin(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch) * Math.cos(this.yaw));
    const want = this.dist;
    // scenery collision: ray from target towards the camera
    const hit = this.physics.ray({ x: this.smoothTarget.x, y: this.smoothTarget.y, z: this.smoothTarget.z }, { x: _d.x, y: _d.y, z: _d.z }, want + 0.3, null, this.filter);
    const maxD = hit ? Math.max(1.2, hit.toi - 0.35) : want;
    this.curDist += ((maxD < this.curDist) ? (maxD - this.curDist) : (maxD - this.curDist) * Math.min(1, dt * 4));
    this.pos.copy(this.smoothTarget).addScaledVector(_d, this.curDist);
    // shake
    if (this.shake > 0) { this.shakeT += dt * 40; const s = this.shake * 0.25; this.pos.x += Math.sin(this.shakeT * 1.3) * s; this.pos.y += Math.cos(this.shakeT * 1.7) * s; this.pos.z += Math.sin(this.shakeT * 0.9) * s; this.shake = Math.max(0, this.shake - dt * 2.2); }
    if (this.intro > 0) {
      this.intro -= dt; const k = THREE.MathUtils.smootherstep(1 - this.intro / this.introDur, 0, 1);
      this.pos.lerpVectors(this.introFrom, this.pos, k); _v.lerpVectors(this.introLook, this.smoothTarget, k);
      this.cam.position.copy(this.pos); this.cam.lookAt(_v); this.cam.fov += (this.baseFov - this.cam.fov) * Math.min(1, dt * 5); this.cam.updateProjectionMatrix(); return;
    }
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.smoothTarget);
    this.wasFirst = false;
    const fov = this.baseFov + speedFactor * 14; this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 5); this.cam.updateProjectionMatrix();
  }
}
