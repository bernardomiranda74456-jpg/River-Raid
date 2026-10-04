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

  // A slice always goes into the opponent's kitchen. Its length only says
  // where in it: a short flick dies by the net, a long one lands a step short
  // of the kitchen line. The far end stays inside the 7 ft band on purpose.
  const SLICE = [[0.06, 3.0], [0.46, 6.2]];
  function sliceDepth(power) {
    const [[p0, d0], [p1, d1]] = SLICE;
    return lerp(d0, d1, Math.max(0, Math.min(1, (power - p0) / (p1 - p0))));
  }
  const SLICE_COLOR = 'rgb(158,240,26)';   // the soft end of the ramp

  // ── reading the path ──────────────────────────────────────────────────────
  // A gesture is measured against a ruler, one per axis: `{ w, h }` in pixels,
  // the pull that means full power sideways and up. In the game that is the
  // strike zone's own size. A plain number is the older form, a screen height,
  // and reads as the same ruler on both axes. `pts` are raw screen points,
  // oldest first.
  const FULL = 0.52;        // fraction of a screen-height ruler that means full power
  const SIDE = 0.30;        // (kept for older callers) sideways travel of a full pull
  // The side of a shot is the TILT of the stroke, not how far it travelled
  // sideways: straight up is straight ahead, and a stroke leaning SIDE_DEG
  // or more from vertical is all the way to that side.
  const SIDE_DEG = 70;
  const SIDE_SIN = Math.sin(SIDE_DEG * Math.PI / 180);
  const tilt = (dx, len) => len > 0 ? Math.max(-1, Math.min(1, (dx / len) / SIDE_SIN)) : 0;
  const MIN  = 0.030;       // below this it is a touch, not a stroke
  const ARC  = 0.26;        // bow-to-chord ratio that reads as a lob
  const LOB_SIDE = 0.75;    // how far toward its side a lob's arc sends it

  // Which way the path bulges on screen, -1 left or +1 right: the middle of
  // the path against the middle of its chord, which reads the same whether the
  // stroke went up or down the screen.
  function bulge(pts, a, b) {
    const mid = pts[Math.floor(pts.length / 2)];
    const off = mid.x - (a.x + b.x) / 2;
    return Math.abs(off) < 1 ? 0 : Math.sign(off);
  }

  function rulerOf(r) {
    if (typeof r === 'number') { const f = r * FULL; return { w: f, h: f }; }
    return { w: Math.max(1, r.w), h: Math.max(1, r.h) };
  }

  function measure(pts, ruler) {
    if (!pts || pts.length < 2) return null;
    const R = rulerOf(ruler);
    // the size thresholds scale with the vertical ruler, as they did with the screen
    const H = R.h / FULL;
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const chord = Math.hypot(dx, dy);
    if (chord < H * MIN) return null;
    // the chord in ruler units: 1 is a pull across the whole zone on that axis
    const chordN = Math.hypot(dx / R.w, dy / R.h);

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

    // Only a stroke that goes up the screen can be a lob. A stroke that comes
    // down is a slice, the short game: however it bends, it is never a lob.
    const slice = dy > 0;
    const lob = !slice && arc > ARC && travel > H * 0.12;
    // A lob's travel is scaled the way its chord was, so a bowed path that
    // leans sideways gains power at the sideways rate.
    const lenN = lob ? travel * (chordN / chord) : chordN;
    // A lob's side is the side its arc bulges to: a C (bulging left) sends it
    // left, a reversed C sends it right. Where the stroke ends up still adds on.
    // The side is the real angle of the finger, whatever the ruler.
    const lateral = lob
      ? Math.max(-1, Math.min(1, LOB_SIDE * bulge(pts, a, b) + tilt(dx, chord)))
      : tilt(dx, chord);
    return {
      power: Math.max(0, Math.min(1.15, lenN)),
      lateral,
      arc, lob, slice,
      up: -dy,
      chord, travel,
    };
  }

  return { RAMP, BASELINE, colorAt, nameAt, depthAt, goesOut, sliceDepth, SLICE_COLOR, measure, rulerOf, tilt, bulge, FULL, SIDE, SIDE_DEG, MIN, ARC, LOB_SIDE };
})();
