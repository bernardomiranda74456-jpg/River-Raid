'use strict';
// The stroke gesture, v2: one left-thumb drag carries power and direction at
// once. Length is power, sideways travel is where the ball goes, and a bowed
// path is a lob. The colour ramp is the player's only gauge, so it lives here
// next to the numbers it describes rather than in the renderer.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Stroke = (function () {
  // Power runs 0..1.15. The ramp's waypoints are the whole language: orange
  // ends exactly on the baseline, pink is the ball painting the line, and red
  // is past the point.
  const RAMP = [
    { p: 0.00, c: [158, 240, 26], name: 'verde claro' },
    { p: 0.13, c: [ 43, 147, 72], name: 'verde escuro' },
    { p: 0.26, c: [181, 163,  0], name: 'amarelo escuro' },
    { p: 0.40, c: [255, 214, 10], name: 'amarelo' },
    { p: 0.53, c: [255, 136,  0], name: 'laranja' },
    { p: 0.66, c: [255,  93, 162], name: 'rosa' },
    { p: 0.78, c: [224,  30,  30], name: 'vermelho' },
    { p: 0.92, c: [122,  11,  11], name: 'vermelho escuro' },
  ];
  const BASELINE = 22;          // ft: past this the ball is long

  // Power to landing depth, in feet from the net, with the waypoints tied to
  // the ramp so colour and outcome can never disagree: orange lands deep near
  // the line, pink paints the line itself, and red is already past it.
  const DEPTH = [
    [0.00,  3.0], [0.53, 19.5], [0.66, 21.6], [0.78, 22.0], [0.92, 24.5], [1.15, 29.0],
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function colorAt(power) {
    const p = Math.max(0, Math.min(RAMP[RAMP.length - 1].p, power));
    let i = 0;
    while (i < RAMP.length - 2 && p > RAMP[i + 1].p) i++;
    const a = RAMP[i], b = RAMP[i + 1];
    const t = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
    const c = [0, 1, 2].map(k => Math.round(lerp(a.c[k], b.c[k], Math.max(0, Math.min(1, t)))));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function nameAt(power) {
    let best = RAMP[0];
    for (const s of RAMP) if (power >= s.p) best = s;
    return best.name;
  }

  function depthAt(power) {
    const p = Math.max(0, Math.min(DEPTH[DEPTH.length - 1][0], power));
    for (let i = 0; i < DEPTH.length - 1; i++) {
      const [p0, d0] = DEPTH[i], [p1, d1] = DEPTH[i + 1];
      if (p <= p1) return lerp(d0, d1, (p - p0) / (p1 - p0));
    }
    return DEPTH[DEPTH.length - 1][1];
  }

  const goesOut = power => depthAt(power) > BASELINE;

  // ── reading the path ──────────────────────────────────────────────────────
  // A gesture is measured against the screen height so it feels the same on any
  // device. `pts` are raw screen points, oldest first.
  const FULL = 0.52;        // fraction of the screen height that means full power
  const SIDE = 0.30;        // sideways travel that means "all the way to the line"
  const MIN  = 0.030;       // below this it is a touch, not a stroke
  const ARC  = 0.26;        // bow-to-chord ratio that reads as a lob

  function measure(pts, H) {
    if (!pts || pts.length < 2) return null;
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const chord = Math.hypot(dx, dy);
    if (chord < H * MIN) return null;

    // how far the path bows away from the straight line between its ends
    let bow = 0;
    for (const q of pts) {
      const d = Math.abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / chord;
      if (d > bow) bow = d;
    }
    const arc = bow / chord;

    // Travel along the path, not the chord: a bowed lob is a long gesture even
    // when its two ends are close together.
    let travel = 0;
    for (let i = 1; i < pts.length; i++) travel += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);

    const lob = arc > ARC && travel > H * 0.12;
    const len = lob ? travel : chord;
    return {
      power: Math.max(0, Math.min(1.15, len / (H * FULL))),
      lateral: Math.max(-1, Math.min(1, dx / (H * SIDE))),
      arc, lob,
      up: -dy,
      chord, travel,
    };
  }

  return { RAMP, BASELINE, colorAt, nameAt, depthAt, goesOut, measure, FULL, SIDE, MIN, ARC };
})();
