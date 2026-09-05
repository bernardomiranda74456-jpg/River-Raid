'use strict';
// Ball flight for a hollow plastic pickleball: gravity + quadratic drag + a light
// Magnus term, plus court bounce and net interaction.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Physics = (function () {
  const C = PB.Court;

  const G        = 32.174;  // ft/s^2
  const DRAG     = 0.0134;  // 1/ft — measured-ish for a 2.9 in, 0.8 oz ball
  const MAGNUS   = 0.0060;  // spin -> lateral/vertical acceleration
  const SPIN_DEC = 0.55;    // spin decay per second
  const REST     = 0.58;    // vertical restitution on the court
  const FRICTION = 0.76;    // horizontal loss on bounce

  function newBall() {
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, live: false, resting: false };
  }

  function speed(b) { return Math.hypot(b.vx, b.vy, b.vz); }

  // One integration step. `ev` collects what happened so callers can react.
  function step(b, dt, ev) {
    const v = speed(b);
    const k = DRAG * v;
    // topspin (spin>0) presses the ball down, backspin floats it
    const ax = -k * b.vx;
    const ay = -k * b.vy - G - MAGNUS * b.spin * v;
    const az = -k * b.vz;

    const px = b.x, py = b.y, pz = b.z;
    b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt;
    b.x  += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.spin -= b.spin * SPIN_DEC * dt;

    // ── net ────────────────────────────────────────────────────────────────
    if (pz !== b.z && Math.sign(pz) !== Math.sign(b.z)) {
      const t = Math.abs(pz) / Math.abs(pz - b.z);
      const cx = px + (b.x - px) * t;
      const cy = py + (b.y - py) * t;
      if (Math.abs(cx) <= C.NET_HALF_W) {
        const top = C.netHeightAt(cx);
        if (cy < top + C.BALL_R) {
          const tape = cy > top - 0.25;   // clipped the tape: it can still trickle over
          b.x = cx; b.y = cy; b.z = Math.sign(pz) * 0.02;
          if (tape) {
            b.vz *= 0.22; b.vy = b.vy * 0.3 + 0.4; b.vx *= 0.5;
          } else {
            b.vz *= -0.16; b.vy = b.vy * 0.28 - 0.6; b.vx *= 0.45;
          }
          b.spin *= 0.2;
          if (ev) { ev.net = true; ev.netTape = tape; }
        }
      }
    }

    // ── court ──────────────────────────────────────────────────────────────
    if (b.y <= C.BALL_R && b.vy < 0) {
      const t = (py - C.BALL_R) / Math.max(1e-6, py - b.y);
      const bx = px + (b.x - px) * t;
      const bz = pz + (b.z - pz) * t;
      b.x = bx; b.z = bz; b.y = C.BALL_R;
      const impact = -b.vy;
      b.vy = impact * REST;
      const spinKick = 1 + Math.max(-0.35, Math.min(0.35, b.spin * 0.05));
      b.vx *= FRICTION * spinKick;
      b.vz *= FRICTION * spinKick;
      b.spin *= 0.45;
      if (ev) { ev.bounce = true; ev.bx = bx; ev.bz = bz; ev.impact = impact; }
      if (impact < 1.6 && Math.hypot(b.vx, b.vz) < 2.2) { b.resting = true; b.vy = 0; }
    }
    return b;
  }

  function advance(b, dt, substeps, ev) {
    const h = dt / substeps;
    for (let i = 0; i < substeps; i++) step(b, h, ev);
    return b;
  }

  function copy(b) { return Object.assign({}, b); }

  // Where does this ball first touch the ground? Returns null if it never does
  // inside `maxT`.
  function predictLanding(b, maxT) {
    const s = copy(b);
    const dt = 1 / 240;
    const ev = {};
    for (let t = 0; t < (maxT || 5); t += dt) {
      ev.bounce = false;
      step(s, dt, ev);
      if (ev.bounce) return { x: ev.bx, z: ev.bz, t: t + dt };
    }
    return null;
  }

  // Position at which the ball crosses `height` on the way down (a strike point).
  function predictAtHeight(b, height, maxT) {
    const s = copy(b);
    const dt = 1 / 240;
    for (let t = 0; t < (maxT || 5); t += dt) {
      const py = s.y;
      step(s, dt, {});
      if (s.vy < 0 && py >= height && s.y <= height) {
        return { x: s.x, y: s.y, z: s.z, t: t + dt };
      }
      if (s.resting) break;
    }
    return null;
  }

  // Sample the trajectory so an AI can pick an interception point.
  function trace(b, maxT, dt) {
    const s = copy(b); const out = []; const ev = {};
    dt = dt || 1 / 90;
    for (let t = 0; t < (maxT || 3); t += dt) {
      ev.bounce = false;
      step(s, dt, ev);
      out.push({ x: s.x, y: s.y, z: s.z, t: t + dt, bounced: !!ev.bounce });
      if (s.resting) break;
    }
    return out;
  }

  return { G, DRAG, newBall, step, advance, copy, speed, predictLanding, predictAtHeight, trace };
})();
