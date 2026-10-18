/**
 * CharacterSystem: all characters (player + bots) rendered with a handful of
 * InstancedMeshes (one per body part), animated procedurally and simulated
 * as locked-rotation capsules in Rapier. When hit, a character swaps to a
 * jointed ragdoll (6 bodies, 5 spherical joints) and blends back afterwards.
 */
import * as THREE from 'three';
import { GROUP, groups, FIXED_DT } from '../core/Physics.js';
import { patternAtlas, eyeTexture, toTexture } from '../gfx/Textures.js';
import { HATS } from './Skins.js';

export const STATE = { GROUND: 0, AIR: 1, DIVE: 2, RAGDOLL: 3, GETUP: 4, DEAD: 5, FINISHED: 6, SINK: 7 };

// Model dimensions (meters). Feet at y = 0.
const DIM = {
  bodyR: 0.42, bodyY: 0.78, bodySy: 1.18, bodySz: 0.92,
  headR: 0.34, headY: 1.42,
  shoulderX: 0.40, shoulderY: 1.0, armR: 0.10, armLen: 0.34,
  hipX: 0.17, hipY: 0.42, legR: 0.12, legLen: 0.28,
  eyeX: 0.125, eyeY: 1.45, eyeZ: 0.285, eyeR: 0.085,
  capsuleHalf: 0.45, capsuleR: 0.36, center: 0.82,
};
export const MOVE = { speed: 7.6, groundAccel: 48, airAccel: 16, jump: 9.2, coyote: 0.1, buffer: 0.12, diveSpeed: 9.5, diveUp: 3.2, diveTime: 0.55, ragdollMin: 1.1, ragdollMax: 3.2, getupTime: 0.45 };

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Character {
  constructor(sys, index, skin, opts = {}) {
    this.sys = sys; this.index = index; this.skin = skin; this.name = opts.name || 'Boneco'; this.isPlayer = !!opts.isPlayer;
    this.state = STATE.GROUND; this.stateTime = 0;
    this.pos = new THREE.Vector3(); this.prevPos = new THREE.Vector3(); this.renderPos = new THREE.Vector3();
    this.vel = new THREE.Vector3(); this.yaw = 0; this.targetYaw = 0;
    this.ctrl = { x: 0, z: 0, jump: false, dive: false, mag: 0 };
    this.grounded = false; this.groundNormal = new THREE.Vector3(0, 1, 0); this.groundBody = null; this.groundData = null; this.lastGrounded = -10; this.jumpBuffered = -10; this.airTime = 0;
    this.platformVel = new THREE.Vector3();
    this.runPhase = 0; this.speed = 0; this.squash = 0; this.stretch = 0; this.lean = new THREE.Vector2(); this.lastVy = 0;
    this.blinkT = 1 + Math.random() * 3; this.blinking = 0;
    this.eliminated = false; this.finished = false; this.finishTime = 0; this.progress = 0; this.rank = 0; this.lastSafe = new THREE.Vector3();
    this.body = null; this.collider = null; this.ragdoll = null; this.ragdollPose = null; this.getupFrom = null;
    this.fanForce = new THREE.Vector3(); this.inFans = 0;
    this.visible = true; this.hitCooldown = 0; this.celebrate = 0;
    this.lod = 0; this.events = [];
  }

  // ------------- physics body -------------
  spawn(p, yaw = 0) {
    const R = this.sys.physics.R, world = this.sys.physics.world;
    this.pos.copy(p); this.prevPos.copy(p); this.renderPos.copy(p); this.vel.set(0, 0, 0); this.yaw = this.targetYaw = yaw; this.lastSafe.copy(p);
    if (!this.body) {
      const desc = R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y + DIM.center, p.z).lockRotations().setLinearDamping(0).setCcdEnabled(this.isPlayer).setCanSleep(false);
      this.body = world.createRigidBody(desc);
      const cd = R.ColliderDesc.capsule(DIM.capsuleHalf, DIM.capsuleR).setFriction(0).setRestitution(0).setDensity(1.0)
        .setCollisionGroups(groups(GROUP.CHAR, GROUP.STATIC | GROUP.PLATFORM | GROUP.CHAR | GROUP.SENSOR)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      this.collider = world.createCollider(cd, this.body);
      this.sys.physics.userData.set(this.collider.handle, { type: 'char', char: this });
      this.sys.physics.bodyData.set(this.body.handle, { type: 'char', char: this });
    } else {
      this.body.setEnabled(true); this.body.setTranslation({ x: p.x, y: p.y + DIM.center, z: p.z }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.state = STATE.GROUND; this.stateTime = 0; this.eliminated = false; this.finished = false; this.visible = true; this.progress = 0; this.celebrate = 0;
    this._destroyRagdoll();
  }

  /** Called once per fixed step before physics.step() */
  preStep(dt, time) {
    this.stateTime += dt; this.hitCooldown -= dt;
    if (this.state === STATE.DEAD) return;
    if (this.state === STATE.SINK) { this.pos.y -= dt * 1.2; this.stateTime > 0.9 && this._finishSink(); return; }
    if (this.state === STATE.RAGDOLL) { this._ragdollStep(dt); return; }
    if (this.state === STATE.GETUP) { if (this.stateTime >= MOVE.getupTime) { this.state = STATE.GROUND; this.stateTime = 0; } }

    const b = this.body; const t = b.translation(); const lv = b.linvel();
    this.pos.set(t.x, t.y - DIM.center, t.z); this.vel.set(lv.x, lv.y, lv.z);
    this._groundCheck();
    const c = this.ctrl;
    const control = (this.state === STATE.GROUND || this.state === STATE.AIR) ? 1 : (this.state === STATE.GETUP ? 0.0 : 0);

    // platform carry: velocity of kinematic ground at our feet
    this.platformVel.set(0, 0, 0);
    if (this.grounded && this.groundBody && this.groundBody.isKinematic()) {
      const bl = this.groundBody.linvel(), ba = this.groundBody.angvel(), bp = this.groundBody.translation();
      _v.set(ba.x, ba.y, ba.z); _v2.set(this.pos.x - bp.x, this.pos.y - bp.y, this.pos.z - bp.z); _v3.crossVectors(_v, _v2);
      this.platformVel.set(bl.x + _v3.x, bl.y + _v3.y, bl.z + _v3.z);
    }
    if (this.grounded && this.groundData && this.groundData.conveyor) this.platformVel.add(this.groundData.conveyor);
    const slippery = this.grounded && this.groundData && this.groundData.slippery;

    // desired horizontal velocity
    const wantX = c.x * MOVE.speed * control, wantZ = c.z * MOVE.speed * control;
    const accel = this.grounded ? (slippery ? 7 : MOVE.groundAccel) : MOVE.airAccel;
    let vx = this.vel.x - this.platformVel.x, vz = this.vel.z - this.platformVel.z;
    if (this.state === STATE.DIVE) {
      // dive: keep momentum, mild drag
      vx *= (1 - dt * (this.grounded ? 4 : 0.4)); vz *= (1 - dt * (this.grounded ? 4 : 0.4));
    } else {
      const dx = wantX - vx, dz = wantZ - vz; const dl = Math.hypot(dx, dz); const maxStep = accel * dt;
      if (dl > maxStep) { vx += dx / dl * maxStep; vz += dz / dl * maxStep; } else { vx = wantX; vz = wantZ; }
    }
    let vy = this.vel.y;
    if (this.grounded && this.state !== STATE.DIVE) { if (vy < 0) vy = Math.max(vy, -2); if (this.platformVel.y !== 0) vy = Math.max(vy, this.platformVel.y) ; }

    // jump (with coyote time + input buffer)
    if (c.jump) { this.jumpBuffered = time; c.jump = false; }
    const canJump = (time - this.lastGrounded) < MOVE.coyote && this.state !== STATE.DIVE && control > 0;
    if (canJump && (time - this.jumpBuffered) < MOVE.buffer) {
      vy = MOVE.jump + Math.max(0, this.platformVel.y); this.jumpBuffered = -10; this.lastGrounded = -10; this.grounded = false; this.stretch = 1; this.state = STATE.AIR; this.stateTime = 0;
      this.events.push('jump');
    }
    // dive
    if (c.dive && control > 0 && this.state !== STATE.DIVE && this.hitCooldown <= 0) {
      c.dive = false; const fy = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      vx = fy * MOVE.diveSpeed; vz = fz * MOVE.diveSpeed; vy = Math.max(vy, 0) + MOVE.diveUp; this.state = STATE.DIVE; this.stateTime = 0; this.grounded = false; this.events.push('dive');
    } else c.dive = false;
    if (this.state === STATE.DIVE && this.stateTime > MOVE.diveTime && this.grounded) { this.state = STATE.GETUP; this.stateTime = MOVE.getupTime * 0.4; }
    if (this.state === STATE.DIVE && this.stateTime > 2.5) { this.state = STATE.AIR; this.stateTime = 0; }

    // fans (continuous force regions)
    if (this.inFans > 0) { const capY = vy > 9 ? 0.1 : 1; vx += this.fanForce.x * dt; vy += this.fanForce.y * dt * capY; vz += this.fanForce.z * dt; if (this.state === STATE.GROUND) { this.state = STATE.AIR; this.stateTime = 0; } }
    this.fanForce.set(0, 0, 0);

    // ground -> air transitions and landing
    if (this.state === STATE.GROUND && !this.grounded && (time - this.lastGrounded) > MOVE.coyote) { this.state = STATE.AIR; this.stateTime = 0; }
    if (this.state === STATE.AIR && this.grounded) {
      const impact = -this.lastVy;
      this.state = STATE.GROUND; this.stateTime = 0; this.squash = Math.min(1, impact / 14); this.events.push(impact > 9 ? 'landHard' : 'land');
      if (impact > 23.5) { this.knock(_v.set(vx * 0.4, 2.5, vz * 0.4), 'fall'); return; }
    }
    this.lastVy = this.vel.y;

    // facing
    if (c.faceYaw != null && control > 0 && this.state !== STATE.DIVE) this.targetYaw = c.faceYaw; // steered heading (player camera modes)
    else if (c.mag > 0.05 && control > 0 && this.state !== STATE.DIVE) this.targetYaw = Math.atan2(c.x, c.z);
    let dy = this.targetYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 14);

    b.setLinvel({ x: vx + this.platformVel.x, y: vy, z: vz + this.platformVel.z }, true);
    this.speed = Math.hypot(vx, vz);
    if (this.grounded && !this.groundBody?.isKinematic() && this.state === STATE.GROUND && this.pos.y > -2) this.lastSafe.copy(this.pos);
  }

  _groundCheck() {
    const ph = this.sys.physics; const R = ph.R;
    const t = this.body.translation();
    const len = DIM.capsuleHalf + DIM.capsuleR + 0.14;
    let best = null;
    const offs = [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]];
    const filter = groups(GROUP.CHAR, GROUP.STATIC | GROUP.PLATFORM);
    for (const [ox, oz] of offs) {
      const hit = ph.ray({ x: t.x + ox, y: t.y, z: t.z + oz }, { x: 0, y: -1, z: 0 }, len, this.body, filter);
      if (hit && (!best || hit.toi < best.toi)) best = hit;
    }
    const wasGrounded = this.grounded;
    if (best && this.vel.y < 4.0 && best.normal.y > 0.45) {
      this.grounded = true; this.lastGrounded = ph.time; this.groundNormal.set(best.normal.x, best.normal.y, best.normal.z);
      this.groundBody = best.collider.parent(); this.groundData = ph.userData.get(best.collider.handle) || null;
    } else { this.grounded = false; this.groundBody = null; this.groundData = null; }
    if (!wasGrounded && this.grounded) this.airTime = 0;
  }

  // ------------- ragdoll -------------
  /** Launch into ragdoll with an initial velocity (world units). */
  knock(vel, reason = 'hit') {
    if (this.state === STATE.RAGDOLL || this.state === STATE.DEAD || this.state === STATE.SINK || this.hitCooldown > 0) return;
    this.hitCooldown = 0.5;
    this.events.push(reason === 'fall' ? 'flop' : 'hit');
    const ph = this.sys.physics, R = ph.R, world = ph.world;
    // current limb world positions from last rendered pose (fallback: rest pose)
    const pose = this.sys.computePose(this, 1, true);
    const q = _q.setFromAxisAngle(UP, this.yaw);
    const mk = (kind, pos, rot, half, radius, density) => {
      const desc = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
        .setLinvel(this.vel.x + vel.x, this.vel.y + vel.y, this.vel.z + vel.z).setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 })
        .setLinearDamping(1.1).setAngularDamping(2.0).setCanSleep(true);
      const body = world.createRigidBody(desc);
      const cd = (kind === 'ball' ? R.ColliderDesc.ball(radius) : R.ColliderDesc.capsule(half, radius)).setFriction(1.0).setRestitution(0.1).setDensity(density)
        .setCollisionGroups(groups(GROUP.RAGDOLL, GROUP.STATIC | GROUP.PLATFORM | GROUP.RAGDOLL));
      const col = world.createCollider(cd, body); ph.userData.set(col.handle, { type: 'ragdoll', char: this });
      const e = ph.track(body); return { body, col, track: e };
    };
    const rd = {};
    rd.torso = mk('ball', pose.body.p, pose.body.q, 0, DIM.bodyR * 0.9, 1.0); rd.torso.body.enableCcd(true);
    rd.head = mk('ball', pose.head.p, pose.head.q, 0, DIM.headR, 0.6);
    rd.armL = mk('capsule', pose.armL.p, pose.armL.q, DIM.armLen * 0.5, DIM.armR, 0.4);
    rd.armR = mk('capsule', pose.armR.p, pose.armR.q, DIM.armLen * 0.5, DIM.armR, 0.4);
    rd.legL = mk('capsule', pose.legL.p, pose.legL.q, DIM.legLen * 0.5, DIM.legR, 0.5);
    rd.legR = mk('capsule', pose.legR.p, pose.legR.q, DIM.legLen * 0.5, DIM.legR, 0.5);
    // joints: anchors in each body's local frame
    const J = (a, b, la, lb) => { const d = R.JointData.spherical(la, lb); const j = world.createImpulseJoint(d, a.body, b.body, true); return j; };
    rd.joints = [
      J(rd.torso, rd.head, { x: 0, y: DIM.bodyR * DIM.bodySy * 0.8, z: 0 }, { x: 0, y: -DIM.headR * 0.85, z: 0 }),
      J(rd.torso, rd.armL, { x: -DIM.shoulderX, y: DIM.shoulderY - DIM.bodyY, z: 0 }, { x: 0, y: DIM.armLen * 0.5 + DIM.armR * 0.5, z: 0 }),
      J(rd.torso, rd.armR, { x: DIM.shoulderX, y: DIM.shoulderY - DIM.bodyY, z: 0 }, { x: 0, y: DIM.armLen * 0.5 + DIM.armR * 0.5, z: 0 }),
      J(rd.torso, rd.legL, { x: -DIM.hipX, y: DIM.hipY - DIM.bodyY, z: 0 }, { x: 0, y: DIM.legLen * 0.5 + DIM.legR * 0.5, z: 0 }),
      J(rd.torso, rd.legR, { x: DIM.hipX, y: DIM.hipY - DIM.bodyY, z: 0 }, { x: 0, y: DIM.legLen * 0.5 + DIM.legR * 0.5, z: 0 }),
    ];
    this.ragdoll = rd;
    this.body.setEnabled(false);
    this.state = STATE.RAGDOLL; this.stateTime = 0; this.grounded = false; this.ctrl.mag = 0;
  }

  _ragdollStep(dt) {
    const rd = this.ragdoll; if (!rd) return;
    const t = rd.torso.body.translation(); const lv = rd.torso.body.linvel();
    this.pos.set(t.x, t.y - DIM.bodyY, t.z); this.vel.set(lv.x, lv.y, lv.z);
    const sp = Math.hypot(lv.x, lv.y, lv.z);
    if (this.stateTime > MOVE.ragdollMin && (sp < 1.6 || this.stateTime > MOVE.ragdollMax)) this._recover();
  }

  _recover() {
    const ph = this.sys.physics; const rd = this.ragdoll;
    // snapshot the ragdoll pose to blend from
    this.getupFrom = this.sys.poseFromRagdoll(this, 1);
    const t = rd.torso.body.translation();
    this._destroyRagdoll();
    const p = { x: t.x, y: t.y - DIM.bodyY + 0.35 + DIM.center, z: t.z };
    this.body.setTranslation(p, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setEnabled(true);
    this.pos.set(p.x, p.y - DIM.center, p.z); this.vel.set(0, 0, 0);
    this.state = STATE.GETUP; this.stateTime = 0; this.events.push('getup');
  }

  _destroyRagdoll() {
    const rd = this.ragdoll; if (!rd) return; const ph = this.sys.physics;
    for (const j of rd.joints) ph.world.removeImpulseJoint(j, true);
    for (const k of ['torso', 'head', 'armL', 'armR', 'legL', 'legR']) { ph.userData.delete(rd[k].col.handle); ph.removeBody(rd[k].body); }
    this.ragdoll = null;
  }

  // ------------- elimination / finish -------------
  eliminate(kind = 'fall') {
    if (this.eliminated) return;
    this.eliminated = true; this.events.push(kind === 'lava' ? 'lava' : 'eliminated'); this.deathInfo = { kind, y: Math.round(this.pos.y), x: Math.round(this.pos.x), z: Math.round(this.pos.z), state: this.state };
    if (kind === 'lava') { this._toSink(); } else { this._hide(); }
  }
  _toSink() {
    if (this.state === STATE.RAGDOLL) { const t = this.ragdoll.torso.body.translation(); this.pos.set(t.x, t.y - DIM.bodyY, t.z); this._destroyRagdoll(); }
    this.body.setEnabled(false); this.state = STATE.SINK; this.stateTime = 0;
  }
  _finishSink() { this._hide(); }
  _hide() { if (this.ragdoll) this._destroyRagdoll(); this.body.setEnabled(false); this.state = STATE.DEAD; this.visible = false; }
  finish(time) { if (this.finished || this.eliminated) return; this.finished = true; this.finishTime = time; this.state = STATE.FINISHED; this.stateTime = 0; this.celebrate = 1; this.events.push('finish'); }

  despawn() { this._destroyRagdoll(); if (this.body) { this.sys.physics.userData.delete(this.collider.handle); this.sys.physics.bodyData.delete(this.body.handle); this.sys.physics.world.removeRigidBody(this.body); this.body = null; this.collider = null; } }
}

// =====================================================================
export class CharacterSystem {
  constructor({ scene, physics, materials, maxChars = 32 }) {
    this.scene = scene; this.physics = physics; this.materials = materials; this.N = maxChars;
    this.chars = []; this.group = new THREE.Group(); this.group.name = 'characters'; scene.add(this.group);
    this.cameraPos = new THREE.Vector3();
    this._buildMeshes();
  }

  _buildMeshes() {
    const N = this.N; const M = this.materials;
    // vinyl material for body (pattern) + limbs/head (instance color)
    const vinylBase = { color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), specularIntensity: 0.6 };
    this.patternTex = toTexture(patternAtlas(1024), { wrap: false, anisotropy: 8 }); this.patternTex.minFilter = THREE.LinearMipmapLinearFilter;
    const bodyMat = new THREE.MeshPhysicalMaterial(vinylBase);
    bodyMat.defines = { USE_UV: '' };
    const patternTex = this.patternTex;
    bodyMat.userData.patch = (shader) => {
      shader.uniforms.patternMap = { value: patternTex };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nattribute vec3 aColA; attribute vec3 aColB; attribute float aPattern; varying vec3 vColA; varying vec3 vColB; varying float vPattern;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvColA = aColA; vColB = aColB; vPattern = aPattern;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D patternMap; varying vec3 vColA; varying vec3 vColB; varying float vPattern;`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n{ float col = mod(vPattern, 4.0); float row = floor(vPattern / 4.0); vec2 puv = vec2((fract(vUv.x * 3.0) + col) / 4.0, (fract(vUv.y * 1.5) * 0.5) + (1.0 - row) * 0.5); float mask = texture2D(patternMap, puv).r; mask = smoothstep(0.35, 0.65, mask); diffuseColor.rgb *= mix(vColA, vColB, mask); }`);
    };
    M.register(bodyMat);
    const limbMat = M.register(new THREE.MeshPhysicalMaterial(vinylBase));
    const eyeMat = M.register(new THREE.MeshPhysicalMaterial({ map: toTexture(eyeTexture(256), { srgb: true, wrap: false }), roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }));
    const mouthMat = M.register(new THREE.MeshPhysicalMaterial({ color: 0x2a1016, roughness: 0.5 }));
    const accMat = M.register(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    const goldMat = M.gold;
    this.mats = { bodyMat, limbMat, eyeMat, mouthMat, accMat };

    const mk = (geo, mat, count, name) => {
      const im = new THREE.InstancedMesh(geo, mat, count); im.name = name; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < count; i++) im.setMatrixAt(i, _m.makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true;
      this.group.add(im); return im;
    };
    const bodyGeo = new THREE.SphereGeometry(DIM.bodyR, 28, 20); bodyGeo.scale(1, DIM.bodySy, DIM.bodySz);
    bodyGeo.setAttribute('aColA', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3));
    bodyGeo.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3));
    bodyGeo.setAttribute('aPattern', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    this.body = mk(bodyGeo, bodyMat, N, 'body');
    this.head = mk(new THREE.SphereGeometry(DIM.headR, 26, 18), limbMat, N, 'head');
    this.arms = mk(new THREE.CapsuleGeometry(DIM.armR, DIM.armLen, 4, 10), limbMat, N * 2, 'arms');
    this.legs = mk(new THREE.CapsuleGeometry(DIM.legR, DIM.legLen, 4, 10), limbMat, N * 2, 'legs');
    const shoeGeo = new THREE.SphereGeometry(0.15, 12, 8); shoeGeo.scale(1, 0.55, 1.25); shoeGeo.translate(0, 0, 0.03);
    this.shoes = mk(shoeGeo, accMat, N * 2, 'shoes');
    const eyeGeo = new THREE.SphereGeometry(DIM.eyeR, 14, 10); eyeGeo.rotateY(Math.PI / 2); // iris faces -Z (lookAt convention)
    this.eyes = mk(eyeGeo, eyeMat, N * 2, 'eyes'); this.eyes.castShadow = false;
    const mouthGeo = new THREE.CapsuleGeometry(0.022, 0.09, 4, 8); mouthGeo.rotateZ(Math.PI / 2);
    this.mouth = mk(mouthGeo, mouthMat, N, 'mouth'); this.mouth.castShadow = false;

    // accessories (one InstancedMesh per type; unused instances have zero scale)
    const acc = this.acc = {};
    const capGeo = new THREE.SphereGeometry(DIM.headR * 1.06, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42); const brim = new THREE.BoxGeometry(0.36, 0.03, 0.22); brim.translate(0, DIM.headR * 0.62, DIM.headR * 1.05);
    acc.cap = mk(mergeGeos([capGeo, brim]), accMat, N, 'cap');
    const crownPts = []; const crownGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.2, 8, 1, true); crownGeo.translate(0, DIM.headR * 1.0, 0); const spikes = []; for (let i = 0; i < 8; i++) { const sp = new THREE.ConeGeometry(0.05, 0.14, 4); const a = i / 8 * Math.PI * 2; sp.translate(Math.cos(a) * 0.24, DIM.headR * 1.0 + 0.16, Math.sin(a) * 0.24); spikes.push(sp); }
    acc.crown = mk(mergeGeos([crownGeo, ...spikes]), goldMat, N, 'crown');
    const antStem = new THREE.CylinderGeometry(0.02, 0.025, 0.34, 8); antStem.translate(0, DIM.headR + 0.15, 0); const antBall = new THREE.SphereGeometry(0.07, 12, 10); antBall.translate(0, DIM.headR + 0.34, 0);
    acc.antenna = mk(mergeGeos([antStem, antBall]), accMat, N, 'antenna');
    const hornL = new THREE.ConeGeometry(0.07, 0.26, 10); hornL.translate(0, 0.13, 0); hornL.rotateZ(0.5); hornL.translate(-0.2, DIM.headR * 0.78, 0); const hornR = hornL.clone(); hornR.scale(-1, 1, 1);
    acc.horns = mk(mergeGeos([hornL, hornR]), accMat, N, 'horns');
    const beanie = new THREE.SphereGeometry(DIM.headR * 1.05, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.35); const stem = new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6); stem.translate(0, DIM.headR + 0.06, 0); const blade = new THREE.BoxGeometry(0.42, 0.012, 0.05); blade.translate(0, DIM.headR + 0.13, 0);
    acc.propeller = mk(mergeGeos([beanie, stem]), accMat, N, 'propeller'); acc.propellerBlade = mk(blade, accMat, N, 'propBlade');
    const topBrim = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24); topBrim.translate(0, DIM.headR * 0.8, 0); const topCyl = new THREE.CylinderGeometry(0.27, 0.29, 0.34, 24); topCyl.translate(0, DIM.headR * 0.8 + 0.17, 0);
    acc.tophat = mk(mergeGeos([topBrim, topCyl]), accMat, N, 'tophat');
    const band = new THREE.TorusGeometry(DIM.headR * 1.0, 0.035, 10, 32); band.rotateX(Math.PI / 2); band.translate(0, DIM.headR * 0.55, 0);
    acc.headband = mk(band, accMat, N, 'headband');

    this.dummyColor = new THREE.Color();
  }

  /** Create a character and register it. */
  add(skin, opts = {}) {
    const i = this.chars.length; if (i >= this.N) throw new Error('too many characters');
    const ch = new Character(this, i, skin, opts); this.chars.push(ch);
    this._applySkin(ch); return ch;
  }

  _applySkin(ch) {
    const i = ch.index, s = ch.skin; const c = this.dummyColor;
    const g = this.body.geometry; c.set(s.colA); g.attributes.aColA.setXYZ(i, c.r, c.g, c.b); c.set(s.colB); g.attributes.aColB.setXYZ(i, c.r, c.g, c.b); g.attributes.aPattern.setX(i, s.pattern);
    g.attributes.aColA.needsUpdate = g.attributes.aColB.needsUpdate = g.attributes.aPattern.needsUpdate = true;
    c.set(s.colA); this.head.setColorAt(i, c); this.arms.setColorAt(i * 2, c); this.arms.setColorAt(i * 2 + 1, c); this.legs.setColorAt(i * 2, c); this.legs.setColorAt(i * 2 + 1, c);
    c.set(s.accent); this.shoes.setColorAt(i * 2, c); this.shoes.setColorAt(i * 2 + 1, c);
    for (const k in this.acc) this.acc[k].setColorAt(i, k === 'crown' ? c.set(0xffffff) : c.set(s.accent));
    for (const im of [this.head, this.arms, this.legs, this.shoes, ...Object.values(this.acc)]) im.instanceColor.needsUpdate = true;
  }

  clear() { for (const ch of this.chars) ch.despawn(); this.chars.length = 0; for (const im of this.allMeshes()) { for (let i = 0; i < im.count; i++) im.setMatrixAt(i, _m.makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; } }
  allMeshes() { return [this.body, this.head, this.arms, this.legs, this.shoes, this.eyes, this.mouth, ...Object.values(this.acc)]; }

  preStep(dt, time) { for (const ch of this.chars) ch.preStep(dt, time); }
  postStep() {
    for (const ch of this.chars) {
      ch.prevPos.copy(ch.pos);
      if (ch.body && ch.state !== STATE.RAGDOLL && ch.state !== STATE.DEAD && ch.state !== STATE.SINK) { const t = ch.body.translation(); ch.pos.set(t.x, t.y - DIM.center, t.z); }
      else if (ch.state === STATE.RAGDOLL && ch.ragdoll) { const t = ch.ragdoll.torso.body.translation(); ch.pos.set(t.x, t.y - DIM.bodyY, t.z); }
    }
  }

  // ------------- posing -------------
  /**
   * Compute the pose (world positions / rotations of each part) for a character.
   * Returns an object with p (Vector3) and q (Quaternion) for body, head, armL, armR, legL, legR, plus scale info.
   */
  computePose(ch, alpha, worldOnly = false) {
    const pose = ch._pose || (ch._pose = makePoseStore());
    const t = this.physics.time + alpha * FIXED_DT;
    const root = pose.root.lerpVectors(ch.prevPos, ch.pos, alpha);
    ch.renderPos.copy(root);
    const yaw = ch.yaw;
    const sp = ch.speed / MOVE.speed; // 0..1
    const st = ch.state; const stt = ch.stateTime + alpha * FIXED_DT;

    // run cycle
    if (st === STATE.GROUND && sp > 0.05) ch.runPhase += FIXED_DT * alpha * 0 + 0; // phase advanced in advance()
    const ph = ch.runPhase;
    const swing = Math.sin(ph), swing2 = Math.sin(ph * 2);

    // squash & stretch (about feet)
    let sx = 1, sy = 1, sz = 1;
    if (ch.squash > 0) { const k = ch.squash; sy *= 1 - 0.32 * k; sx *= 1 + 0.2 * k; sz *= 1 + 0.2 * k; }
    if (ch.stretch > 0) { const k = ch.stretch; sy *= 1 + 0.18 * k; sx *= 1 - 0.1 * k; sz *= 1 - 0.1 * k; }
    // bob
    let bob = (st === STATE.GROUND) ? Math.abs(swing2) * 0.05 * sp + Math.sin(t * 2.2) * 0.01 : 0;
    let leanX = 0, leanZ = 0; // body tilt
    let armL = { x: 0, z: 0 }, armR = { x: 0, z: 0 }, legL = 0, legR = 0;
    let bodyPitch = 0, bodyRoll = 0, headPitch = 0, headYaw = 0;

    if (st === STATE.GROUND || st === STATE.FINISHED) {
      const amp = 0.95 * sp;
      legL = swing * amp; legR = -swing * amp;
      armL.x = -swing * amp * 0.9; armR.x = swing * amp * 0.9; armL.z = -0.25 - sp * 0.15; armR.z = 0.25 + sp * 0.15;
      bodyPitch = 0.28 * sp; bodyRoll = ch.lean.x * 0.25;
      headPitch = -0.1 * sp; headYaw = 0;
      if (sp < 0.05) { // idle breathing
        armL.x = Math.sin(t * 1.7) * 0.06; armR.x = Math.sin(t * 1.7 + 1) * 0.06; bob += Math.sin(t * 1.7) * 0.012;
      }
      if (st === STATE.FINISHED) { const c = stt; armL.x = -2.6 + Math.sin(c * 9) * 0.3; armR.x = -2.6 - Math.sin(c * 9) * 0.3; armL.z = -0.5; armR.z = 0.5; bob += Math.abs(Math.sin(c * 6)) * 0.25; sy *= 1 + Math.abs(Math.sin(c * 6)) * 0.06; }
    } else if (st === STATE.AIR) {
      const vy = ch.vel.y;
      const up = THREE.MathUtils.clamp(vy / 9, -1, 1);
      armL.x = -1.6 - up * 1.2 + Math.sin(stt * 12) * 0.2; armR.x = -1.6 - up * 1.2 - Math.sin(stt * 12) * 0.2; armL.z = -0.7; armR.z = 0.7;
      legL = 0.5 + up * 0.4; legR = -0.3 + up * 0.2; bodyPitch = 0.15 + up * 0.1; headPitch = -0.2 * up;
      if (vy < -9) { armL.x = -2.8 + Math.sin(stt * 20) * 0.5; armR.x = -2.8 - Math.sin(stt * 20) * 0.5; } // flail when falling fast
    } else if (st === STATE.DIVE) {
      bodyPitch = 1.45; armL.x = -2.9; armR.x = -2.9; armL.z = -0.25; armR.z = 0.25; legL = 0.2; legR = -0.2; headPitch = -0.9; bob = 0.25;
    } else if (st === STATE.GETUP) {
      const k = THREE.MathUtils.smoothstep(stt / MOVE.getupTime, 0, 1);
      bodyPitch = (1 - k) * 0.9; armL.x = -(1 - k) * 1.2; armR.x = -(1 - k) * 1.2; legL = (1 - k) * 0.6; legR = (1 - k) * 0.6; bob = -(1 - k) * 0.25; sy *= 1 - (1 - k) * 0.1;
    } else if (st === STATE.SINK) { bodyPitch = 0.2; armL.x = -2.8; armR.x = -2.8; headPitch = -0.3; sx = sy = sz = Math.max(0.1, 1 - stt * 0.6); }

    // eyes: squint on dive, wide on fall
    pose.eyeScale = (st === STATE.DIVE) ? 0.55 : (st === STATE.AIR && ch.vel.y < -6 ? 1.25 : 1);
    if (ch.blinking > 0) pose.eyeScale *= 0.08;

    // ---------- compose matrices ----------
    const rootQ = pose.rootQ.setFromAxisAngle(UP, yaw);
    const tilt = _q2.setFromEuler(pose.euler.set(bodyPitch, 0, bodyRoll)); rootQ.multiply(tilt);
    // body
    _v.set(0, DIM.bodyY * sy + bob, 0).applyQuaternion(rootQ).add(root);
    pose.body.p.copy(_v); pose.body.q.copy(rootQ); pose.body.s.set(sx, sy, sz);
    // head (slight counter tilt + pitch)
    _q.setFromAxisAngle(UP, yaw).multiply(_q2.setFromEuler(pose.euler.set(bodyPitch * 0.6 + headPitch, headYaw, bodyRoll * 0.5)));
    _v.set(0, DIM.headY * sy + bob + (sy - 1) * 0.1, 0).applyQuaternion(rootQ).add(root);
    pose.head.p.copy(_v); pose.head.q.copy(_q); pose.head.s.set(sx, sy, sz);
    // arms: pivot at shoulder, capsule points down (-Y) so rotate by pi then swing
    const limb = (out, px, py, ang, angZ, len, scaleY = 1) => {
      _v.set(px * sx, py * sy + bob, 0).applyQuaternion(rootQ).add(root); // pivot world
      _q.copy(rootQ).multiply(_q2.setFromEuler(pose.euler.set(ang, 0, angZ))).multiply(pose.flip);
      // capsule center is half-length below pivot along local +Y (after flip: down)
      _v2.set(0, len * 0.5 + 0.08, 0).applyQuaternion(_q).add(_v);
      out.p.copy(_v2); out.q.copy(_q); out.pivot.copy(_v); out.s.set(1, scaleY, 1);
    };
    limb(pose.armL, -DIM.shoulderX, DIM.shoulderY, armL.x, armL.z, DIM.armLen);
    limb(pose.armR, DIM.shoulderX, DIM.shoulderY, armR.x, armR.z, DIM.armLen);
    limb(pose.legL, -DIM.hipX, DIM.hipY, legL, 0, DIM.legLen);
    limb(pose.legR, DIM.hipX, DIM.hipY, legR, 0, DIM.legLen);
    // if we are ragdolling, overwrite with physics bodies; if getting up, blend from snapshot
    if (st === STATE.RAGDOLL && ch.ragdoll) this.poseFromRagdoll(ch, alpha, pose);
    else if (st === STATE.GETUP && ch.getupFrom) {
      const k = THREE.MathUtils.smoothstep(stt / (MOVE.getupTime * 0.7), 0, 1);
      if (k < 1) for (const part of ['body', 'head', 'armL', 'armR', 'legL', 'legR']) { const a = ch.getupFrom[part], b = pose[part]; b.p.lerpVectors(a.p, b.p, k); b.q.slerpQuaternions(a.q, b.q, k); }
    }
    return pose;
  }

  /** Pose taken from ragdoll rigid bodies (interpolated). */
  poseFromRagdoll(ch, alpha, pose = null) {
    pose = pose || makePoseStore();
    const rd = ch.ragdoll; if (!rd) return pose;
    const map = { body: 'torso', head: 'head', armL: 'armL', armR: 'armR', legL: 'legL', legR: 'legR' };
    for (const part in map) { const e = rd[map[part]].track; pose[part].p.lerpVectors(e.prevPos, e.pos, alpha); pose[part].q.slerpQuaternions(e.prevRot, e.rot, alpha); pose[part].s.set(1, 1, 1); }
    pose.root.copy(pose.body.p); pose.root.y -= DIM.bodyY; ch.renderPos.copy(pose.root);
    pose.rootQ.copy(pose.body.q); pose.eyeScale = 1.2;
    return pose;
  }

  /** Advance per-frame animation state (phases, squash timers, blinking). Called once per render frame. */
  advance(dt) {
    for (const ch of this.chars) {
      if (!ch.visible) continue;
      const sp = ch.speed / MOVE.speed;
      if (ch.state === STATE.GROUND) ch.runPhase += dt * (6 + 10 * sp) * Math.min(1, sp * 4 + 0.0);
      ch.squash = Math.max(0, ch.squash - dt * 4.5); ch.stretch = Math.max(0, ch.stretch - dt * 5);
      ch.blinkT -= dt; if (ch.blinkT <= 0) { ch.blinking = 0.13; ch.blinkT = 2 + Math.random() * 4; } if (ch.blinking > 0) ch.blinking -= dt;
      // lean from lateral control
      const targetLean = ch.state === STATE.GROUND ? (ch.ctrl.x * Math.cos(ch.yaw) - ch.ctrl.z * Math.sin(ch.yaw)) * 0 : 0;
      ch.lean.x += (targetLean - ch.lean.x) * Math.min(1, dt * 6);
    }
  }

  /** Write all instance matrices for rendering. */
  render(alpha, cameraPos) {
    this.cameraPos.copy(cameraPos);
    const B = this.body, H = this.head, A = this.arms, L = this.legs, S = this.shoes, E = this.eyes, Mo = this.mouth;
    for (const ch of this.chars) {
      const i = ch.index;
      if (!ch.visible) { for (const im of this.allMeshes()) { if (im === A || im === L || im === S || im === E) { im.setMatrixAt(i * 2, _m.makeScale(0, 0, 0)); im.setMatrixAt(i * 2 + 1, _m); } else im.setMatrixAt(i, _m.makeScale(0, 0, 0)); } continue; }
      const dist = ch.renderPos.distanceTo(cameraPos);
      ch.lod = dist > 60 ? 2 : dist > 30 ? 1 : 0;
      const pose = this.computePose(ch, alpha);
      (ch.eyePos || (ch.eyePos = new THREE.Vector3())).set(0, DIM.eyeY - DIM.headY + 0.04, 0).applyQuaternion(pose.head.q).add(pose.head.p);
      B.setMatrixAt(i, _m.compose(pose.body.p, pose.body.q, pose.body.s));
      H.setMatrixAt(i, _m.compose(pose.head.p, pose.head.q, pose.head.s));
      A.setMatrixAt(i * 2, _m.compose(pose.armL.p, pose.armL.q, pose.armL.s)); A.setMatrixAt(i * 2 + 1, _m.compose(pose.armR.p, pose.armR.q, pose.armR.s));
      L.setMatrixAt(i * 2, _m.compose(pose.legL.p, pose.legL.q, pose.legL.s)); L.setMatrixAt(i * 2 + 1, _m.compose(pose.legR.p, pose.legR.q, pose.legR.s));
      // shoes at the end of each leg (local +Y after flip is "down the leg")
      for (let k = 0; k < 2; k++) {
        const leg = k === 0 ? pose.legL : pose.legR; _v.set(0, DIM.legLen * 0.5 + 0.06, 0).applyQuaternion(leg.q).add(leg.p);
        _q.copy(leg.q).multiply(pose.flip); // undo flip so the shoe's +Z points forward
        S.setMatrixAt(i * 2 + k, _m.compose(_v, _q, _s.set(1, 1, 1)));
      }
      // eyes: positioned on head, look at camera with clamp
      const headQ = pose.head.q; _v3.set(0, 0, 1).applyQuaternion(headQ); // head forward
      for (let k = 0; k < 2; k++) {
        _v.set(k === 0 ? -DIM.eyeX : DIM.eyeX, DIM.eyeY - DIM.headY, DIM.eyeZ).applyQuaternion(headQ).add(pose.head.p);
        if (ch.lod === 0 || ch.isPlayer) {
          _v2.subVectors(cameraPos, _v).normalize();
          const d = _v2.dot(_v3); const minDot = 0.42; // ~65 degrees
          if (d < minDot) { _v2.sub(_v3.clone().multiplyScalar(d)).normalize().multiplyScalar(Math.sqrt(1 - minDot * minDot)).add(_v3.clone().multiplyScalar(minDot)); }
          _m2.lookAt(_v2.clone().negate(), new THREE.Vector3(0, 0, 0), UP); _q.setFromRotationMatrix(_m2);
        } else _q.copy(headQ).multiply(pose.flipY);
        E.setMatrixAt(i * 2 + k, _m.compose(_v, _q, _s.set(1, pose.eyeScale, 1)));
      }
      // mouth
      _v.set(0, DIM.eyeY - DIM.headY - 0.17, DIM.headR * 0.95).applyQuaternion(headQ).add(pose.head.p);
      Mo.setMatrixAt(i, _m.compose(_v, headQ, _s.set(1, ch.state === STATE.AIR ? 2.2 : 1, 1)));
      // accessory
      const hat = ch.skin.hat;
      for (const k in this.acc) {
        if (k === hat) this.acc[k].setMatrixAt(i, _m.compose(pose.head.p, headQ, pose.head.s));
        else if (k === 'propellerBlade' && hat === 'propeller') { _q.copy(headQ).multiply(_q2.setFromAxisAngle(UP, this.physics.time * (8 + ch.speed * 3))); this.acc[k].setMatrixAt(i, _m.compose(pose.head.p, _q, pose.head.s)); }
        else this.acc[k].setMatrixAt(i, _m.makeScale(0, 0, 0));
      }
    }
    // first person: hide the player's own head, face and hat so they don't block the view
    for (const ch of this.chars) if (ch.hideHead && ch.visible) { const i = ch.index; _m.makeScale(0, 0, 0); H.setMatrixAt(i, _m); Mo.setMatrixAt(i, _m); E.setMatrixAt(i * 2, _m); E.setMatrixAt(i * 2 + 1, _m); A.setMatrixAt(i * 2, _m); A.setMatrixAt(i * 2 + 1, _m); for (const k in this.acc) this.acc[k].setMatrixAt(i, _m); }
    for (const im of this.allMeshes()) im.instanceMatrix.needsUpdate = true;
  }

  dispose() { this.clear(); this.scene.remove(this.group); for (const im of this.allMeshes()) im.geometry.dispose(); }
}

function makePoseStore() {
  const part = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), pivot: new THREE.Vector3() });
  return { root: new THREE.Vector3(), rootQ: new THREE.Quaternion(), euler: new THREE.Euler(), flip: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), flipY: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
    body: part(), head: part(), armL: part(), armR: part(), legL: part(), legR: part(), eyeScale: 1 };
}

/** Minimal non-indexed geometry merge (keeps position/normal/uv). */
export function mergeGeos(geos) {
  const parts = geos.map((g) => g.index ? g.toNonIndexed() : g);
  let count = 0; for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
