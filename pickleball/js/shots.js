'use strict';
// Shot solver: given a contact point and a target on the court, find the launch
// velocity that actually gets there *with* drag, and make sure it clears the net.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Shots = (function () {
  const C = PB.Court, P = PB.Physics;

  // Flight-time and spin profile per shot family.
  const STYLES = {
    serve:  { time: 1.05, spin:  0.8, clear: 0.85, power: 1.0 },
    drive:  { time: 0.72, spin:  2.6, clear: 0.55, power: 1.0 },
    ret:    { time: 0.95, spin:  1.6, clear: 0.80, power: 0.9 },
    drop:   { time: 1.15, spin:  0.4, clear: 0.75, power: 0.7 },
    dink:   { time: 0.85, spin:  0.2, clear: 0.42, power: 0.5 },
    lob:    { time: 1.95, spin: -0.6, clear: 4.50, power: 0.8 },
    punch:  { time: 0.55, spin:  1.4, clear: 0.40, power: 0.9 },
    smash:  { time: 0.42, spin:  3.2, clear: 0.30, power: 1.0 },
  };

  const MAX_SPEED = 78; // ft/s — nobody hits a plastic ball much harder than this

  // Fly a candidate launch and report where/when it first reaches `endY`
  // descending, plus how much room it had over the net.
  function fly(from, v, endY) {
    const b = P.newBall();
    b.x = from.x; b.y = from.y; b.z = from.z;
    b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.spin = v.spin || 0;
    const dt = 1 / 240;
    const ev = {};
    let clear = Infinity, crossed = false;
    const wantsHeight = endY > C.BALL_R + 0.005;
    for (let t = dt; t < 6; t += dt) {
      const py = b.y, pz = b.z, pvy = b.vy;
      ev.bounce = false;
      P.step(b, dt, ev);
      if (!crossed && pz !== b.z && Math.sign(pz) !== Math.sign(b.z)) {
        crossed = true;
        clear = b.y - C.netHeightAt(b.x);
      }
      if (wantsHeight && pvy < 0 && py > endY && b.y <= endY) {
        return { x: b.x, z: b.z, t, dist: Math.hypot(b.x - from.x, b.z - from.z), clear, crossed };
      }
      if (ev.bounce) {
        return { x: ev.bx, z: ev.bz, t, dist: Math.hypot(ev.bx - from.x, ev.bz - from.z), clear, crossed };
      }
      if (b.resting) break;
    }
    return { x: b.x, z: b.z, t: 6, dist: Math.hypot(b.x - from.x, b.z - from.z), clear, crossed };
  }

  // Solve for a launch that lands on `to` after roughly `time` seconds.
  function solve(from, to, time, spin) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const d = Math.max(0.4, Math.hypot(dx, dz));
    const ux = dx / d, uz = dz / d;
    let vh = d / time;
    let vy = (to.y - from.y + 0.5 * P.G * time * time) / time;
    let res = null;
    for (let i = 0; i < 6; i++) {
      res = fly(from, { vx: ux * vh, vy, vz: uz * vh, spin: spin || 0 }, to.y);
      const dErr = d - res.dist;
      const tErr = time - res.t;
      if (Math.abs(dErr) < 0.15 && Math.abs(tErr) < 0.02) break;
      vh += dErr / Math.max(0.2, res.t);
      vy += tErr * P.G * 0.5;
      vh = Math.max(1, Math.min(MAX_SPEED, vh));
      vy = Math.max(-45, Math.min(60, vy));
    }
    return { vx: ux * vh, vy, vz: uz * vh, spin: spin || 0, res };
  }

  // Full shot: pick the style, then raise the arc until the net is safely cleared.
  // `power` (0..1) scales how hard the player can actually strike.
  function plan(from, to, styleName, power) {
    const st = STYLES[styleName] || STYLES.drive;
    const want = st.clear + C.BALL_R;
    let time = st.time;
    let best = null;
    for (let i = 0; i < 5; i++) {
      const v = solve(from, to, time, st.spin);
      const sp = Math.hypot(v.vx, v.vy, v.vz);
      if (!best) best = v;
      if (v.res && v.res.crossed && v.res.clear >= want && sp <= MAX_SPEED) { best = v; break; }
      best = v;
      time *= 1.16;                     // higher, slower arc
    }
    // A weak/off-balance contact simply cannot generate the solved speed.
    const cap = MAX_SPEED * st.power * (0.55 + 0.45 * (power === undefined ? 1 : power));
    const sp = Math.hypot(best.vx, best.vy, best.vz);
    if (sp > cap) {
      const k = cap / sp;
      best.vx *= k; best.vy *= k; best.vz *= k;
    }
    best.style = styleName;
    return best;
  }

  return { STYLES, MAX_SPEED, solve, plan, fly };
})();
