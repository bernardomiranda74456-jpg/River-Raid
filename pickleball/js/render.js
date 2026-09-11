'use strict';
// Pseudo-3D renderer: a pinhole camera sitting behind the baseline, drawing the
// court, net, players and ball straight onto a 2D canvas.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Renderer = (function () {
  const C = PB.Court;

  const COL = {
    skyTop: '#101d33', skyMid: '#24466d', skyGlow: '#e08a58',
    surround: '#1d5b86', court: '#2f86c4', kitchen: '#b8442c', kitchen2: '#a13a25',
    line: '#f0f6fa', net: '#0d1420', tape: '#f4f8fb',
    ball: '#d9ff3d', shadow: 'rgba(0,0,0,0.30)',
    team: [
      { shirt: '#ffd24a', shirt2: '#e8ac1f', trim: '#ffeaa0', shorts: '#1b2634', shorts2: '#111a25' },
      { shirt: '#ff5f6d', shirt2: '#d63b53', trim: '#ffc2c7', shorts: '#221a33', shorts2: '#171126' },
    ],
    skin: ['#e2b083', '#c68a5c', '#9c6640', '#6f462b'],
    skinDark: ['#c9955f', '#a86f45', '#7d4e2f', '#573520'],
    hair: ['#1d150f', '#3b2416', '#7a4a22', '#c9a24a', '#2b2b31', '#8d8d96'],
    shoe: '#f2f5f8',
    paddleFace: ['#2b4a6b', '#6b2b3a', '#1f5a4a', '#4a3a6b'],
    crowd: ['#c8d4e0', '#e0d3b8', '#b8c9e0', '#d9b6b6', '#b6d9c4', '#cbc0dd', '#e8d9a8'],
    crowdSkin: ['#e2b083', '#c68a5c', '#8d5a3b'],
  };

  const FENCE_Z = 30, FENCE_H = 8, FENCE_X = 26;
  const BACK_ROOM = 4.5;   // how far behind the baseline a player may run
  const CROWD_ROWS = 16;      // generated; how many are used depends on the camera
  const ROW_STEP = 1.85;      // real stadium rows, so spectators stay person sized
  // The ball is drawn a quarter over life size, and never under two pixels. A
  // regulation ball is barely five pixels across at the far baseline on a phone,
  // and a ball you cannot see is worse than one slightly too big.
  function ballRadius(s) {
    return Math.max(2.0, s * C.BALL_R * 1.25);
  }
  const UI = (a, b, c) => `rgb(${Math.round(a*255)},${Math.round(b*255)},${Math.round(c*255)})`;

  // Scale and height of the broadcast scoreboard panel. The camera needs both so
  // it never frames a player underneath the panel, so they live outside the
  // renderer and the drawing code reads the same numbers.
  function hudScale(rect) {
    return Math.max(0.55, Math.min(1.05, Math.min(rect.w / 900, rect.h / 520)));
  }
  function hudBand(rect) {
    const k = hudScale(rect);
    return Math.min(0.24, (10 * k + 20 * k + 30 * k * 2 + 15 * k + 6) / rect.h);
  }

  function Cam(vp, side, focusX) {
    // Two rigs. A wide frame gets the television angle: low and far back, which
    // is what makes a broadcast read — the court lies flat and wide, the near
    // pair large, the far pair small. A narrow frame cannot afford that (the
    // court would be a thin strip), so it keeps a higher, closer camera.
    const wide = vp.w >= vp.h * 1.3;
    // Between a broadcast angle and Super Tennis: higher and further back than
    // television, so more of the court reads from above without going top-down.
    // The narrow rig sits higher still, otherwise the court is a thin strip and
    // the stands eat most of a portrait frame.
    const camY = wide ? 20 : 40;
    const camZ = wide ? -75 : -50;
    const aimY = 2.0, aimZ = 6;
    const pitch = Math.atan2(camY - aimY, aimZ - camZ);
    const sin = Math.sin(pitch), cos = Math.cos(pitch);
    const czOf = z => camY * sin + (z - camZ) * cos;
    const vOf = z => -((-camY) * cos + (z - camZ) * sin) / czOf(z);

    const BACK = C.HALF_L + BACK_ROOM;
    const halfNear = C.HALF_W / czOf(-C.HALF_L);
    // Vertical extent measured between what actually has to be on screen: the
    // feet of the deepest near player and the HEAD of the deepest far one.
    const czAt = (y, z) => (y - camY) * -sin + (z - camZ) * cos;
    const vAt = (y, z) => -((y - camY) * cos + (z - camZ) * sin) / czAt(y, z);
    const topV = vAt(6.4, BACK);
    const botV = vAt(0, -BACK);
    // Room the scoreboard needs at the top of this viewport; nothing that must
    // stay legible is framed under it.
    const top = hudBand(vp) + 0.005;
    let focal = Math.min(
      (wide ? 0.66 : 0.98) * vp.w / (2 * halfNear),
      (0.995 - top) * vp.h / (botV - topV)
    );

    this.side = side; this.sin = sin; this.cos = cos; this.focal = focal;
    this.y = camY; this.z = camZ;
    this.x = (side === 1 ? -1 : 1) * focusX * 0.25;
    this.cx = vp.x + vp.w / 2;
    // Preferred framing: the near baseline low in a wide frame, the run-back at
    // the bottom for a narrow one — then slid until nobody is cut off at either
    // edge. Sitting the baseline low keeps the raised camera from leaving a band
    // of empty floor under the near pair.
    let cy = wide
      ? vp.y + vp.h * 0.88 - focal * vOf(-C.HALF_L)
      : vp.y + vp.h * 0.99 - focal * vOf(-BACK);
    cy = Math.max(cy, vp.y + vp.h * top - focal * topV);
    cy = Math.min(cy, vp.y + vp.h * 0.995 - focal * botV);
    this.cy = cy;
    this.horizonY = cy - focal * (sin / cos);
    this.vp = vp;
    this.wide = wide;
  }

  // Inverse of proj at a fixed depth: which world height lands on this screen
  // row? Lets the stadium fit whatever band the camera leaves above the court.
  Cam.prototype.yAtScreen = function (z, screenY) {
    if (this.side === 1) z = -z;
    const dz = z - this.z;
    const v = (this.cy - screenY) / this.focal;
    const den = -v * this.sin - this.cos;
    if (Math.abs(den) < 1e-6) return this.y;
    return this.y + (dz * (this.sin - v * this.cos)) / den;
  };

  Cam.prototype.proj = function (x, y, z) {
    if (this.side === 1) { x = -x; z = -z; }
    const dx = x - this.x, dy = y - this.y, dz = z - this.z;
    const cz = -dy * this.sin + dz * this.cos;
    const cy = dy * this.cos + dz * this.sin;
    const s = this.focal / Math.max(0.8, cz);
    return { x: this.cx + dx * s, y: this.cy - cy * s, s, cz };
  };


  // ── character rig ────────────────────────────────────────────────────────
  // Bodies are drawn from profiled outlines, not primitives: every bone carries
  // a width profile (a thigh swells at the quad and tapers to the knee, a calf
  // bulges high, a forearm narrows to the wrist) and is filled with a gradient
  // laid across the limb, which is what gives a drawn figure its roundness.
  const BODY_ATHLETIC = {
    ankle: 0.32, knee: 1.60, hip: 2.86, waist: 3.34, shoulder: 4.68,
    head: 5.44, headR: 0.36,
    shoulderHalf: 0.62, hipHalf: 0.40,
    upperArm: 1.04, foreArm: 0.98,
    thigh: 1.26, shin: 1.28,
  };
  const BODY_ARCADE = {
    ankle: 0.34, knee: 1.46, hip: 2.58, waist: 3.00, shoulder: 4.22,
    head: 5.02, headR: 0.52,
    shoulderHalf: 0.70, hipHalf: 0.46,
    upperArm: 0.88, foreArm: 0.80,
    thigh: 1.12, shin: 1.16,
  };

  // half-widths in feet along each bone, start joint to end joint
  const PROFILE_MII = {
    arm:   [[0, 0.145], [0.5, 0.15], [1, 0.13]],
    leg:   [[0, 0.195], [0.5, 0.20], [1, 0.17]],
  };

  const PROFILE = {
    thigh:   [[0, 0.30], [0.28, 0.315], [0.68, 0.235], [1, 0.165]],
    shin:    [[0, 0.165], [0.22, 0.205], [0.58, 0.135], [1, 0.088]],
    upper:   [[0, 0.205], [0.32, 0.20], [0.75, 0.145], [1, 0.125]],
    fore:    [[0, 0.125], [0.28, 0.15], [0.72, 0.105], [1, 0.078]],
    neck:    [[0, 0.135], [1, 0.125]],
  };

  // Wii Sports proportions: about three and a half heads tall, thin limbs,
  // no neck, and all the character in the face.
  const BODY_MII = {
    ankle: 0.30, knee: 1.32, hip: 2.42, waist: 2.90, shoulder: 3.94,
    head: 4.92, headR: 0.70,
    shoulderHalf: 0.62, hipHalf: 0.52,
    upperArm: 0.78, foreArm: 0.72,
    thigh: 1.06, shin: 1.02,
  };

  const CHAR_STYLES = {
    boneco:   { body: BODY_MII, limb: 1.00, shade: true, outline: 0, detail: false, kind: 'mii' },
    atletico: { body: BODY_ATHLETIC, limb: 1.00, shade: true, outline: 0.014, detail: true },
    vetor:    { body: BODY_ATHLETIC, limb: 1.22, shade: false, outline: 0.075, detail: false },
    arcade:   { body: BODY_ARCADE,   limb: 1.42, shade: false, outline: 0.055, detail: false },
  };

  let BODY = BODY_ATHLETIC;
  let STYLE = CHAR_STYLES.atletico;
  const OUTLINE_COL = '#131d29';
  const LIGHT = { x: -0.55, y: -0.83 };     // key light, upper left

  // ── colour helpers ───────────────────────────────────────────────────────
  const tintCache = new Map();
  function tint(hex, amt) {
    const key = hex + '|' + amt;
    let v = tintCache.get(key);
    if (v) return v;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) {
      r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
    } else {
      r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
    }
    v = `rgb(${r | 0},${g | 0},${b | 0})`;
    tintCache.set(key, v);
    return v;
  }

  function ik(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay;
    let d = Math.hypot(dx, dy);
    if (d < 1e-4) { d = 1e-4; dx = 1e-4; }
    const dd = Math.min(d, l1 + l2 - 0.002);
    const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
    let h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    h *= Math.max(0.18, Math.min(1, (dd - 0.45) / 0.9));
    const ux = dx / d, uy = dy / d;
    return { x: ax + ux * a - uy * h * bend, y: ay + uy * a + ux * h * bend };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function mix(p1, p2, t) { return { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) }; }
  function reachable(sh, target, len) {
    const dx = target.x - sh.x, dy = target.y - sh.y;
    const d = Math.hypot(dx, dy);
    if (d <= len || d < 1e-4) return target;
    const k = len / d;
    return { x: sh.x + dx * k, y: sh.y + dy * k };
  }

  const Char = {
    look(p) {
      if (!p._look) {
        const i = p.id;
        p._look = {
          skin: i % COL.skin.length,
          hair: COL.hair[(i * 2 + 1) % COL.hair.length],
          style: i % 4,
          paddle: COL.paddleFace[i % COL.paddleFace.length],
        };
      }
      return p._look;
    },

    // ── the drawn limb ─────────────────────────────────────────────────────
    // Walks the width profile up one side and back down the other, smoothing
    // through the points, then rounds both ends. One gradient across the bone
    // does the modelling.
    bone(ctx, P, ax, ay, bx, by, profile, color, opts) {
      const o = opts || {};
      const x1 = P.X(ax), y1 = P.Y(ay), x2 = P.X(bx), y2 = P.Y(by);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      const k = P.s * (o.raw ? 1 : STYLE.limb);
      const pt = (t, w) => [x1 + ux * len * t + nx * w * k, y1 + uy * len * t + ny * w * k];

      const path = new Path2D();
      const side = (sign, reverse) => {
        const list = reverse ? profile.slice().reverse() : profile;
        for (let i = 0; i < list.length; i++) {
          const [t, w] = list[i];
          const [px, py] = pt(t, w * sign);
          if (i === 0 && sign > 0 && !reverse) path.moveTo(px, py);
          else if (i === 0) { /* continues from the cap */ }
          else {
            const [pt0, pw0] = list[i - 1];
            const [mx, my] = pt((t + pt0) / 2, ((w + pw0) / 2) * sign);
            path.quadraticCurveTo(mx, my, px, py);
          }
        }
      };
      const endW = profile[profile.length - 1][1] * k;
      const startW = profile[0][1] * k;
      // Caps are drawn as curves that continue the outline. Arcs here reversed
      // the winding and punched holes through the limb at every joint.
      const cap = (cx, cy, w, dir) => {
        const r1x = cx + nx * w, r1y = cy + ny * w;
        const l1x = cx - nx * w, l1y = cy - ny * w;
        path.bezierCurveTo(r1x + ux * w * 1.34 * dir, r1y + uy * w * 1.34 * dir,
                           l1x + ux * w * 1.34 * dir, l1y + uy * w * 1.34 * dir,
                           l1x, l1y);
      };
      side(1, false);
      cap(x2, y2, endW, 1);
      side(-1, true);
      cap(x1, y1, startW, -1);
      path.closePath();

      if (STYLE.outline > 0) {
        ctx.strokeStyle = OUTLINE_COL;
        ctx.lineWidth = Math.max(1, STYLE.outline * P.s * 2);
        ctx.lineJoin = 'round';
        ctx.stroke(path);
      }
      ctx.fillStyle = STYLE.shade ? this.crossGradient(ctx, x1, y1, x2, y2, nx, ny, startW, color)
                                  : color;
      ctx.fill(path);
      return path;
    },

    // light on one edge, the body colour across the middle, shadow on the other
    crossGradient(ctx, x1, y1, x2, y2, nx, ny, w, color) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const sign = (nx * LIGHT.x + ny * LIGHT.y) >= 0 ? 1 : -1;
      const r = Math.max(2, w * 1.6);
      const g = ctx.createLinearGradient(mx + nx * r * sign, my + ny * r * sign,
                                         mx - nx * r * sign, my - ny * r * sign);
      g.addColorStop(0, tint(color, 0.20));
      g.addColorStop(0.42, color);
      g.addColorStop(1, tint(color, -0.32));
      return g;
    },

    draw(ctx, cam, p, base, s, isMe) {
      STYLE = CHAR_STYLES[Renderer.charStyle] || CHAR_STYLES.atletico;
      BODY = STYLE.body;
      const look = this.look(p);
      const kit = COL.team[p.team];
      const skin = COL.skin[look.skin];
      const facing = cam.side === p.team ? 1 : -1;
      const hand = facing;
      const P = { s, X: v => base.x + v * s, Y: v => base.y - v * s };

      const crouch = p.crouch || 0;
      const stride = p.speedN || 0;
      const ph = p.runPhase || 0;
      const mir = cam.side === 1 ? -1 : 1;
      const lean = (p.lean || 0) * mir;
      const yaw = (p.yaw || 0) * mir;
      const bob = Math.abs(Math.sin(ph)) * 0.10 * stride;
      const hipY = BODY.hip - crouch * 0.85 - bob + (p.hop || 0);
      const shY = hipY + (BODY.shoulder - BODY.hip) - crouch * 0.12;

      const swinging = p.swingT > 0;
      const prog = swinging ? 1 - p.swingT / (p.swingDur || 0.42) : 0;
      const coilAmt = swinging ? (prog < 0.32 ? 1 - prog / 0.32 : 0) : (p.prep || 0);
      const kind = p.swingKind || 'ground';
      const fore = p.swingFore !== false;
      const coil = coilAmt * (fore ? 0.55 : -0.42) * hand;

      const turn = yaw + coil;
      const shHalf = BODY.shoulderHalf * (0.70 + 0.30 * Math.cos(turn * 1.25));
      const shOff = Math.sin(turn) * 0.36 + lean * 0.55;
      const hipTurn = yaw * 0.55 + coil * 0.25;
      const hipHalf = BODY.hipHalf * (0.76 + 0.24 * Math.cos(hipTurn * 1.25));
      const hipOff = Math.sin(hipTurn) * 0.22 + lean * 0.3;
      const shL = { x: -shHalf + shOff, y: shY };
      const shR = { x: shHalf + shOff, y: shY };
      const hipL = { x: -hipHalf + hipOff, y: hipY };
      const hipR = { x: hipHalf + hipOff, y: hipY };

      const resid = (p.runAngle || 0) - (p.yaw || 0);
      const strideLat = Math.sin(resid) * stride * mir;
      const strideDep = Math.cos(resid) * stride;
      // Athletic base: feet wider than the hips, wider still as the knees bend.
      const stanceHalf = BODY.hipHalf + 0.26 + crouch * 0.34;
      const legs = [];
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const phase = ph + (i === 0 ? Math.PI : 0);
        const sw = Math.sin(phase);
        const hipJ = side < 0 ? hipL : hipR;
        const ahead = sw * strideDep;
        const lift = Math.max(0, sw) * stride * 0.55;
        const footX = side * stanceHalf + sw * strideLat * 1.15 + lean * 0.8 + ahead * 0.18;
        const footY = BODY.ankle + lift * 0.42 + Math.max(0, ahead) * 0.30;
        const knee = ik(hipJ.x, hipJ.y, footX, footY, BODY.thigh, BODY.shin, side * 0.42);
        legs.push({ side, hip: hipJ, knee, foot: { x: footX, y: footY }, depth: ahead });
      }

      const hitDX = p.swingHit ? p.swingHit.dx * mir : 0;
      const hitY = p.swingHit ? p.swingHit.dy : shY - 0.4;
      const swA = Math.sin(ph + Math.PI) * stride;
      // Ready position, the way the sport is actually played: paddle up in front
      // of the chest near the midline, tip toward the sky, both hands together,
      // elbows bent down and out. Never hanging at the side.
      const ready = {
        x: hand * (0.48 + 0.10 * Math.cos(turn)) + Math.sin(turn) * 0.30 - swA * 0.10,
        y: shY - 0.18 + swA * 0.10,
      };
      const readyElbow = {
        x: hand * (1.02 + 0.10 * Math.cos(turn)) + Math.sin(turn) * 0.20,
        y: shY - 0.60 + swA * 0.06,
      };
      let load, contact, follow;
      if (kind === 'over') {
        load = { x: hand * 0.95, y: shY - 1.45 };
        contact = { x: Math.max(-1.3, Math.min(1.3, hitDX)), y: Math.max(hitY, shY + 1.25) };
        follow = { x: -hand * 0.85, y: shY - 1.05 };
      } else if (kind === 'soft') {
        load = { x: hand * (fore ? 0.95 : -0.55), y: shY - 1.42 };
        contact = { x: Math.max(-1.8, Math.min(1.8, hitDX)), y: Math.max(0.85, Math.min(2.9, hitY)) };
        follow = { x: hand * 0.34, y: shY - 0.52 };
      } else if (fore) {
        load = { x: hand * 1.42, y: shY - 1.12 };
        contact = { x: Math.max(-2.2, Math.min(2.2, hitDX)), y: Math.max(0.95, Math.min(5.2, hitY)) };
        follow = { x: -hand * 0.88, y: shY + 0.34 };
      } else {
        load = { x: -hand * 0.78, y: shY - 0.98 };
        contact = { x: Math.max(-2.2, Math.min(2.2, hitDX)), y: Math.max(0.95, Math.min(5.2, hitY)) };
        follow = { x: hand * 1.52, y: shY + 0.42 };
      }
      let handP = swinging
        ? (prog < 0.32 ? mix(load, contact, ease(prog / 0.32))
                       : mix(contact, follow, ease((prog - 0.32) / 0.68)))
        : mix(ready, load, ease(p.prep || 0));

      const shPad = hand > 0 ? shR : shL;
      const shFree = hand > 0 ? shL : shR;
      const armLen = (BODY.upperArm + BODY.foreArm) * 0.97;
      handP = reachable(shPad, handP, armLen);
      // How much of the pose is the waiting stance rather than a loaded swing.
      const readyAmt = swinging ? 0 : 1 - ease(p.prep || 0);
      const freeSwing = {
        x: -hand * (0.86 + Math.abs(swA) * 0.26) + Math.sin(turn) * 0.42 - swA * 0.26,
        y: shY - 1.06 + swA * 0.34 + coilAmt * 0.42,
      };
      // The free hand supports the paddle throat rather than dangling.
      const freeReady = {
        x: -hand * 0.14 + Math.sin(turn) * 0.26 - swA * 0.10,
        y: shY - 0.36 + swA * 0.08,
      };
      const freeReadyElbow = {
        x: -hand * (0.80 + 0.10 * Math.cos(turn)) + Math.sin(turn) * 0.16,
        y: shY - 0.58,
      };
      const freeHand = mix(freeSwing, freeReady, readyAmt);
      const freeHandR = reachable(shFree, freeHand, armLen);
      const freeElbow = mix(
        ik(shFree.x, shFree.y, freeHandR.x, freeHandR.y, BODY.upperArm, BODY.foreArm, hand * 0.75),
        freeReadyElbow, readyAmt);
      const elbow = mix(
        ik(shPad.x, shPad.y, handP.x, handP.y, BODY.upperArm, BODY.foreArm, -hand * 0.8),
        readyElbow, readyAmt);

      // Seen from behind, everything the player holds in front of their chest is
      // behind their back — arms and paddle go under the torso, and only what
      // sticks out past the silhouette shows. Facing the camera, they go on top.
      const fromBehind = facing > 0;
      const drawPaddle = () =>
        this.paddle(ctx, P, elbow, handP, look, hand, swinging, prog, readyAmt);

      this.shadow(ctx, P, base, s, stanceHalf, isMe, p);
      if (STYLE.kind === 'mii') {
        this.mii(ctx, P, {
          legs, shL, shR, hipL, hipR, shY, hipY, shPad, shFree,
          elbow, handP, freeElbow, freeHandR, swA,
        }, kit, skin, look, facing, turn, drawPaddle);
        return;
      }
      const backLeg = legs[0].depth <= legs[1].depth ? legs[0] : legs[1];
      const frontLeg = backLeg === legs[0] ? legs[1] : legs[0];
      const freeInFront = swA > 0 && !fromBehind;
      const arms = () => {
        this.arm(ctx, P, shFree, freeElbow, freeHandR, kit, skin, false);
        this.arm(ctx, P, shPad, elbow, handP, kit, skin, false);
      };

      this.leg(ctx, P, backLeg, kit, skin, true);
      if (!freeInFront && !fromBehind) {
        this.arm(ctx, P, shFree, freeElbow, freeHandR, kit, skin, true);
      }
      this.shorts(ctx, P, legs[0], legs[1], hipL, hipR, kit);
      if (fromBehind) { arms(); drawPaddle(); }
      this.torso(ctx, P, shL, shR, hipL, hipR, kit, skin, shY, hipY);
      this.head(ctx, P, shL, shR, shY, skin, look, turn, facing);
      this.leg(ctx, P, frontLeg, kit, skin, false);
      if (!fromBehind) {
        if (freeInFront) this.arm(ctx, P, shFree, freeElbow, freeHandR, kit, skin, false);
        this.arm(ctx, P, shPad, elbow, handP, kit, skin, false);
        drawPaddle();
      }
    },

    // ── Wii-style figure ───────────────────────────────────────────────────
    mii(ctx, P, parts, kit, skin, look, facing, turn, drawPaddle) {
      const { legs, shL, shR, hipL, hipR, shY, hipY, shPad, shFree,
              elbow, handP, freeElbow, freeHandR, swA } = parts;
      const X = P.X, Y = P.Y;
      const soft = (c, a) => tint(c, a);

      // legs, then a small pair of shorts, then the rounded body
      for (const L of [legs[0], legs[1]].sort((a, b) => a.depth - b.depth)) {
        const dim = L === legs[0] && legs[0].depth < legs[1].depth ? -0.10 : 0;
        this.bone(ctx, P, L.hip.x, L.hip.y, L.knee.x, L.knee.y, PROFILE_MII.leg, soft(skin, dim));
        this.bone(ctx, P, L.knee.x, L.knee.y, L.foot.x, L.foot.y + 0.14, PROFILE_MII.leg, soft(skin, dim));
        // shoe: a rounded block, no laces at this scale
        ctx.beginPath();
        ctx.ellipse(X(L.foot.x + L.side * 0.06), Y(L.foot.y + 0.10),
                    P.s * 0.30, P.s * 0.21, 0, 0, Math.PI * 2);
        ctx.fillStyle = soft('#f4f7fa', dim);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(X(L.foot.x + L.side * 0.06), Y(L.foot.y + 0.03),
                    P.s * 0.30, P.s * 0.09, 0, 0, Math.PI * 2);
        ctx.fillStyle = soft(kit.shirt2, dim - 0.1);
        ctx.fill();
      }

      // arms: thin tubes with mitten hands. Rounded caps at the shoulder and the
      // elbow hide the seam where two bones meet at a sharp angle — and in the
      // ready pose the elbows are bent hard, so the seam would show.
      const joint = (x, y, r, c) => {
        ctx.beginPath();
        ctx.ellipse(X(x), Y(y), P.s * r, P.s * r, 0, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
      };
      const arms = () => {
        const armPair = [[shFree, freeElbow, freeHandR, swA <= 0], [shPad, elbow, handP, false]];
        for (const [sh, el, hd, far] of armPair) {
          const dim = far ? -0.10 : 0;
          this.bone(ctx, P, sh.x, sh.y - 0.05, el.x, el.y, PROFILE_MII.arm, soft(skin, dim));
          joint(el.x, el.y, 0.145, soft(skin, dim));
          this.bone(ctx, P, el.x, el.y, hd.x, hd.y, PROFILE_MII.arm, soft(skin, dim));
          joint(sh.x, sh.y - 0.05, 0.145, soft(skin, dim));
          joint(hd.x, hd.y, 0.165, soft(skin, dim + 0.04));
        }
      };
      // From behind, the arms and the paddle are on the far side of the chest.
      const fromBehind = facing > 0;
      if (fromBehind) { arms(); drawPaddle(); }

      const bodyTop = shY + 0.10, bodyBot = hipY - 0.30;
      const halfTop = BODY.shoulderHalf, halfBot = BODY.hipHalf + 0.20;
      const body = new Path2D();
      body.moveTo(X(-halfTop + (shL.x + shR.x) / 2), Y(bodyTop));
      body.bezierCurveTo(X(-halfTop - 0.20 + (shL.x + shR.x) / 2), Y(bodyTop - 0.5),
                         X(-halfBot - 0.10 + (hipL.x + hipR.x) / 2), Y(bodyBot + 0.5),
                         X(-halfBot + (hipL.x + hipR.x) / 2), Y(bodyBot));
      body.quadraticCurveTo(X((hipL.x + hipR.x) / 2), Y(bodyBot - 0.24),
                            X(halfBot + (hipL.x + hipR.x) / 2), Y(bodyBot));
      body.bezierCurveTo(X(halfBot + 0.10 + (hipL.x + hipR.x) / 2), Y(bodyBot + 0.5),
                         X(halfTop + 0.20 + (shL.x + shR.x) / 2), Y(bodyTop - 0.5),
                         X(halfTop + (shL.x + shR.x) / 2), Y(bodyTop));
      body.quadraticCurveTo(X((shL.x + shR.x) / 2), Y(bodyTop + 0.22),
                            X(-halfTop + (shL.x + shR.x) / 2), Y(bodyTop));
      body.closePath();
      const bg = ctx.createLinearGradient(X(-halfTop - 0.4), 0, X(halfTop + 0.4), 0);
      bg.addColorStop(0, tint(kit.shirt, 0.20));
      bg.addColorStop(0.5, kit.shirt);
      bg.addColorStop(1, tint(kit.shirt, -0.24));
      ctx.fillStyle = bg;
      ctx.fill(body);

      if (!fromBehind) arms();

      // head: the whole character lives here
      const cx = (shL.x + shR.x) / 2 + Math.sin(turn) * 0.10;
      const R = BODY.headR;
      const cy = shY + (BODY.head - BODY.shoulder);
      const hg = ctx.createRadialGradient(X(cx - R * 0.4), Y(cy + R * 0.4), P.s * R * 0.1,
                                          X(cx), Y(cy), P.s * R * 1.15);
      hg.addColorStop(0, tint(skin, 0.16));
      hg.addColorStop(0.72, skin);
      hg.addColorStop(1, tint(skin, -0.22));
      ctx.beginPath();
      ctx.ellipse(X(cx), Y(cy), P.s * R * 0.92, P.s * R, 0, 0, Math.PI * 2);
      ctx.fillStyle = hg;
      ctx.fill();
      // ears
      for (const es of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(X(cx + es * R * 0.90), Y(cy - R * 0.05), P.s * R * 0.13, P.s * R * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle = tint(skin, -0.12);
        ctx.fill();
      }
      // hair
      const cap = new Path2D();
      cap.moveTo(X(cx - R * 0.95), Y(cy + R * 0.12));
      cap.quadraticCurveTo(X(cx - R * 1.0), Y(cy + R * 1.10), X(cx), Y(cy + R * 1.12));
      cap.quadraticCurveTo(X(cx + R * 1.0), Y(cy + R * 1.10), X(cx + R * 0.95), Y(cy + R * 0.12));
      if (facing < 0) {
        // seen from the front: a fringe across the brow
        cap.quadraticCurveTo(X(cx + R * 0.5), Y(cy + R * 0.30), X(cx + R * 0.05), Y(cy + R * 0.44));
        cap.quadraticCurveTo(X(cx - R * 0.5), Y(cy + R * 0.58), X(cx - R * 0.95), Y(cy + R * 0.12));
      } else {
        // seen from behind: hair covers the whole skull
        cap.quadraticCurveTo(X(cx), Y(cy - R * 0.55), X(cx - R * 0.95), Y(cy + R * 0.12));
      }
      cap.closePath();
      ctx.fillStyle = look.hair;
      ctx.fill(cap);
      if (look.style === 1) {
        this.bone(ctx, P, cx - R * 0.1, cy + R * 0.7, cx - R * 0.1 + Math.sin(turn) * 0.2, cy - R * 0.2,
                  [[0, 0.2], [0.5, 0.24], [1, 0.08]], look.hair, { raw: true });
      }
      if (facing < 0) this.face(ctx, P, cx, cy, R, look);
      if (!fromBehind) drawPaddle();
    },

    // Two eyes, two brows, one mouth — the Mii formula.
    face(ctx, P, cx, cy, R, look) {
      const X = P.X, Y = P.Y;
      const eyeDX = R * 0.36, eyeY = cy + R * 0.10;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(X(cx + s * eyeDX), Y(eyeY), P.s * R * 0.15, P.s * R * 0.19, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fdfdfd';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(X(cx + s * eyeDX), Y(eyeY - R * 0.02), P.s * R * 0.085, P.s * R * 0.115, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#231a15';
        ctx.fill();
      }
      ctx.strokeStyle = tint(look.hair, -0.1);
      ctx.lineWidth = Math.max(1, P.s * R * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const s of [-1, 1]) {
        ctx.moveTo(X(cx + s * eyeDX - R * 0.17), Y(eyeY + R * 0.34));
        ctx.lineTo(X(cx + s * eyeDX + R * 0.17), Y(eyeY + R * 0.36));
      }
      ctx.stroke();
      ctx.strokeStyle = '#7d4436';
      ctx.lineWidth = Math.max(1, P.s * R * 0.075);
      ctx.beginPath();
      ctx.moveTo(X(cx - R * 0.17), Y(cy - R * 0.34));
      ctx.quadraticCurveTo(X(cx), Y(cy - R * 0.46), X(cx + R * 0.17), Y(cy - R * 0.34));
      ctx.stroke();
    },

    shadow(ctx, P, base, s, stanceHalf, isMe, p) {
      ctx.save();
      const g = ctx.createRadialGradient(base.x, base.y, s * 0.1, base.x, base.y, s * 1.5);
      g.addColorStop(0, 'rgba(0,0,0,0.36)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, s * (1.5 + stanceHalf), s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (isMe || p.ctrl === 'human') {
        ctx.save();
        ctx.strokeStyle = isMe ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1.5, s * (isMe ? 0.06 : 0.045));
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, s * 1.22, s * 0.41, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },

    leg(ctx, P, L, kit, skin, far) {
      const dim = far ? -0.14 : 0;
      const flesh = tint(skin, dim);
      // skin first, the whole leg, so no seam shows at the knee
      this.bone(ctx, P, L.hip.x, L.hip.y + 0.1, L.knee.x, L.knee.y, PROFILE.thigh, flesh);
      this.bone(ctx, P, L.knee.x, L.knee.y, L.foot.x, L.foot.y + 0.08, PROFILE.shin, flesh);

      if (STYLE.detail) {
        this.bone(ctx, P, L.foot.x, L.foot.y + 0.30, L.foot.x, L.foot.y + 0.12,
                  [[0, 0.14], [1, 0.155]], tint('#eef3f7', dim));
      }
      this.shoe(ctx, P, L, dim);
    },

    // toe box, sole plate and heel, pointing the way the foot travels
    shoe(ctx, P, L, dim) {
      const dir = L.side >= 0 ? 1 : -1;
      const x = L.foot.x, y = L.foot.y;
      const p = (dx, dy) => [P.X(x + dx * dir), P.Y(y + dy)];
      const path = new Path2D();
      let q = p(-0.16, 0.30); path.moveTo(q[0], q[1]);
      q = p(0.10, 0.26); path.lineTo(q[0], q[1]);
      const c1 = p(0.34, 0.20), c2 = p(0.42, 0.07);
      path.quadraticCurveTo(c1[0], c1[1], c2[0], c2[1]);
      q = p(0.40, 0.0); path.lineTo(q[0], q[1]);
      q = p(-0.20, 0.0); path.lineTo(q[0], q[1]);
      path.closePath();
      if (STYLE.outline > 0) {
        ctx.strokeStyle = OUTLINE_COL;
        ctx.lineWidth = Math.max(1, STYLE.outline * P.s * 2);
        ctx.stroke(path);
      }
      ctx.fillStyle = tint(COL.shoe, dim);
      ctx.fill(path);
      // sole
      const sole = new Path2D();
      q = p(-0.20, 0.02); sole.moveTo(q[0], q[1]);
      q = p(0.40, 0.02); sole.lineTo(q[0], q[1]);
      q = p(0.40, -0.02); sole.lineTo(q[0], q[1]);
      q = p(-0.20, -0.02); sole.lineTo(q[0], q[1]);
      sole.closePath();
      ctx.fillStyle = tint('#20303f', dim);
      ctx.fill(sole);
    },

    arm(ctx, P, sh, elbow, hand, kit, skin, far) {
      const dim = far ? -0.14 : 0;
      const flesh = tint(skin, dim);
      this.bone(ctx, P, sh.x, sh.y, elbow.x, elbow.y, PROFILE.upper, flesh);
      this.bone(ctx, P, elbow.x, elbow.y, hand.x, hand.y, PROFILE.fore, flesh);
      // sleeve: a cap of shirt over the shoulder end of the upper arm
      const t = 0.46;
      this.bone(ctx, P, sh.x * 0.45, sh.y + 0.02,
                sh.x + (elbow.x - sh.x) * t, sh.y + (elbow.y - sh.y) * t,
                [[0, 0.26], [0.55, 0.27], [1, 0.21]], tint(kit.shirt, dim - 0.05));
      if (STYLE.detail) {
        const wx = elbow.x + (hand.x - elbow.x) * 0.84, wy = elbow.y + (hand.y - elbow.y) * 0.84;
        this.bone(ctx, P, wx, wy, hand.x, hand.y, [[0, 0.115], [1, 0.10]], tint(kit.trim, dim));
      }
      // hand, a mitten rather than a ball
      const ang = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
      ctx.save();
      ctx.translate(P.X(hand.x), P.Y(hand.y));
      ctx.rotate(-ang);
      const hp = new Path2D();
      hp.ellipse(P.s * 0.05, 0, P.s * 0.092, P.s * 0.072, 0, 0, Math.PI * 2);
      if (STYLE.outline > 0.03) {
        ctx.strokeStyle = OUTLINE_COL;
        ctx.lineWidth = Math.max(1, STYLE.outline * P.s * 2);
        ctx.stroke(hp);
      }
      ctx.fillStyle = flesh;
      ctx.fill(hp);
      ctx.restore();
    },

    // One pair of shorts spanning both hips, its hems following each thigh.
    shorts(ctx, P, legA, legB, hipL, hipR, kit) {
      const left = legA.hip.x <= legB.hip.x ? legA : legB;
      const right = left === legA ? legB : legA;
      const X = P.X, Y = P.Y;
      const hemOf = L => {
        const t = 0.60;
        return {
          x: L.hip.x + (L.knee.x - L.hip.x) * t,
          y: L.hip.y + (L.knee.y - L.hip.y) * t,
          nx: (L.knee.y - L.hip.y), ny: -(L.knee.x - L.hip.x),
        };
      };
      const hl = hemOf(left), hr = hemOf(right);
      const norm = h => {
        const d = Math.hypot(h.nx, h.ny) || 1;
        return { x: (h.nx / d) * 0.29, y: (h.ny / d) * 0.29 };
      };
      const nl = norm(hl), nr = norm(hr);
      const path = new Path2D();
      path.moveTo(X(hipL.x - 0.30), Y(hipL.y + 0.30));
      path.lineTo(X(hl.x - nl.x), Y(hl.y - nl.y));
      path.quadraticCurveTo(X(hl.x), Y(hl.y - 0.10), X(hl.x + nl.x), Y(hl.y + nl.y));
      path.quadraticCurveTo(X((hl.x + hr.x) / 2), Y(Math.max(hl.y, hr.y) + 0.62),
                            X(hr.x - nr.x), Y(hr.y + nr.y));
      path.quadraticCurveTo(X(hr.x), Y(hr.y - 0.10), X(hr.x + nr.x), Y(hr.y - nr.y));
      path.lineTo(X(hipR.x + 0.30), Y(hipR.y + 0.30));
      path.closePath();
      if (STYLE.outline > 0) {
        ctx.strokeStyle = OUTLINE_COL;
        ctx.lineWidth = Math.max(1.5, STYLE.outline * P.s * 2);
        ctx.lineJoin = 'round';
        ctx.stroke(path);
      }
      if (STYLE.shade) {
        const g = ctx.createLinearGradient(X(hipL.x - 0.4), 0, X(hipR.x + 0.4), 0);
        g.addColorStop(0, tint(kit.shorts, 0.22));
        g.addColorStop(0.45, kit.shorts);
        g.addColorStop(1, tint(kit.shorts, -0.30));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = kit.shorts;
      }
      ctx.fill(path);
    },

    // A shirt silhouette: deltoid over the shoulder, waist pinch, hem flare.
    torso(ctx, P, shL, shR, hipL, hipR, kit, skin, shY, hipY) {
      const midY = (shY + hipY) / 2;
      const path = new Path2D();
      const X = P.X, Y = P.Y;
      path.moveTo(X(shL.x + 0.10), Y(shY + 0.16));
      path.quadraticCurveTo(X(shL.x - 0.16), Y(shY + 0.10), X(shL.x - 0.20), Y(shY - 0.22));
      path.quadraticCurveTo(X(shL.x - 0.08), Y(midY + 0.10), X(hipL.x - 0.26), Y(hipY + 0.46));
      path.quadraticCurveTo(X((hipL.x + hipR.x) / 2), Y(hipY + 0.24), X(hipR.x + 0.26), Y(hipY + 0.46));
      path.quadraticCurveTo(X(shR.x + 0.10), Y(midY + 0.16), X(shR.x + 0.20), Y(shY - 0.22));
      path.quadraticCurveTo(X(shR.x + 0.16), Y(shY + 0.10), X(shR.x - 0.10), Y(shY + 0.16));
      path.quadraticCurveTo(X(0), Y(shY + 0.02), X(shL.x + 0.10), Y(shY + 0.16));
      path.closePath();

      if (STYLE.outline > 0) {
        ctx.strokeStyle = OUTLINE_COL;
        ctx.lineWidth = Math.max(2, STYLE.outline * P.s * 2);
        ctx.lineJoin = 'round';
        ctx.stroke(path);
      }
      if (STYLE.shade) {
        const g = ctx.createLinearGradient(X(shL.x - 0.3), 0, X(shR.x + 0.3), 0);
        g.addColorStop(0, tint(kit.shirt, 0.18));
        g.addColorStop(0.45, kit.shirt);
        g.addColorStop(1, tint(kit.shirt, -0.28));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = kit.shirt;
      }
      ctx.fill(path);

      const collar = new Path2D();
      collar.moveTo(X(shL.x + 0.12), Y(shY + 0.15));
      collar.quadraticCurveTo(X(0), Y(shY - 0.10), X(shR.x - 0.12), Y(shY + 0.15));
      collar.quadraticCurveTo(X(0), Y(shY + 0.03), X(shL.x + 0.12), Y(shY + 0.15));
      collar.closePath();
      ctx.fillStyle = kit.trim;
      ctx.fill(collar);
    },

    // Skull, jaw and ear — not a circle.
    head(ctx, P, shL, shR, shY, skin, look, coil, facing) {
      const cx = (shL.x + shR.x) / 2 + Math.sin(coil) * 0.14;
      const headY = shY + (BODY.head - BODY.shoulder) + 0.06;
      const R = BODY.headR;
      this.bone(ctx, P, cx, shY - 0.02, cx, headY - R * 0.66, PROFILE.neck, tint(skin, -0.22));

      const X = P.X, Y = P.Y;
      const path = new Path2D();
      path.moveTo(X(cx - R * 0.94), Y(headY + R * 0.12));
      path.quadraticCurveTo(X(cx - R * 0.98), Y(headY + R * 1.05), X(cx), Y(headY + R * 1.06));
      path.quadraticCurveTo(X(cx + R * 0.98), Y(headY + R * 1.05), X(cx + R * 0.94), Y(headY + R * 0.12));
      path.quadraticCurveTo(X(cx + R * 0.86), Y(headY - R * 0.72), X(cx + R * 0.30), Y(headY - R * 1.02));
      path.quadraticCurveTo(X(cx), Y(headY - R * 1.16), X(cx - R * 0.30), Y(headY - R * 1.02));
      path.quadraticCurveTo(X(cx - R * 0.86), Y(headY - R * 0.72), X(cx - R * 0.94), Y(headY + R * 0.12));
      path.closePath();
      if (STYLE.outline > 0) {
        ctx.strokeStyle = OUTLINE_COL;
        ctx.lineWidth = Math.max(1.5, STYLE.outline * P.s * 2);
        ctx.stroke(path);
      }
      if (STYLE.shade) {
        const g = ctx.createLinearGradient(X(cx - R), 0, X(cx + R), 0);
        g.addColorStop(0, tint(skin, 0.16));
        g.addColorStop(0.5, skin);
        g.addColorStop(1, tint(skin, -0.26));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = skin;
      }
      ctx.fill(path);

      // ear on the shaded side
      const es = facing >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(X(cx + es * R * 0.92), Y(headY + R * 0.05), P.s * R * 0.16, P.s * R * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = tint(skin, -0.18);
      ctx.fill();

      this.hair(ctx, P, cx, headY, R, look, coil, facing);
    },

    hair(ctx, P, cx, headY, R, look, coil, facing) {
      const X = P.X, Y = P.Y;
      const col = look.hair;
      const cap = new Path2D();
      cap.moveTo(X(cx - R * 0.99), Y(headY + R * 0.05));
      cap.quadraticCurveTo(X(cx - R * 1.02), Y(headY + R * 1.12), X(cx), Y(headY + R * 1.14));
      cap.quadraticCurveTo(X(cx + R * 1.02), Y(headY + R * 1.12), X(cx + R * 0.99), Y(headY + R * 0.05));
      // fringe sweeping across the brow
      cap.quadraticCurveTo(X(cx + R * 0.55), Y(headY + R * 0.30), X(cx + R * 0.12), Y(headY + R * 0.46));
      cap.quadraticCurveTo(X(cx - R * 0.45), Y(headY + R * 0.62), X(cx - R * 0.99), Y(headY + R * 0.05));
      cap.closePath();
      if (STYLE.outline > 0) {
        ctx.strokeStyle = OUTLINE_COL;
        ctx.lineWidth = Math.max(1, STYLE.outline * P.s * 1.6);
        ctx.stroke(cap);
      }
      if (STYLE.shade) {
        const g = ctx.createLinearGradient(X(cx - R), 0, X(cx + R), 0);
        g.addColorStop(0, tint(col, 0.26));
        g.addColorStop(0.55, col);
        g.addColorStop(1, tint(col, -0.22));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = col;
      }
      ctx.fill(cap);

      if (look.style === 1) {
        const tx = cx - R * 0.15, ty = headY + R * 0.55;
        this.bone(ctx, P, tx, ty, tx + Math.sin(coil) * 0.14, ty - 0.62,
                  [[0, 0.13], [0.45, 0.16], [1, 0.05]], col, { raw: true });
      } else if (look.style === 2) {
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(X(cx + i * R * 0.6), Y(headY + R * 1.0), P.s * R * 0.40, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
        }
      } else if (look.style === 3) {
        const brim = new Path2D();
        brim.moveTo(X(cx - R * 1.0), Y(headY + R * 0.34));
        brim.quadraticCurveTo(X(cx), Y(headY + R * 0.02), X(cx + R * 1.0), Y(headY + R * 0.34));
        brim.quadraticCurveTo(X(cx), Y(headY + R * 0.26), X(cx - R * 1.0), Y(headY + R * 0.34));
        brim.closePath();
        ctx.fillStyle = tint(col, -0.25);
        ctx.fill(brim);
      }

      if (facing < 0) {
        ctx.fillStyle = 'rgba(35,22,14,0.5)';
        const eyeR = Math.max(0.5, P.s * R * 0.10);
        ctx.beginPath();
        ctx.ellipse(X(cx - R * 0.34), Y(headY + R * 0.16), eyeR, eyeR * 1.2, 0, 0, Math.PI * 2);
        ctx.ellipse(X(cx + R * 0.34), Y(headY + R * 0.16), eyeR, eyeR * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // A pickleball paddle: rounded face, throat, grip with a butt cap.
    paddle(ctx, P, elbow, hand, look, side, swinging, prog, readyAmt) {
      const dx = hand.x - elbow.x, dy = hand.y - elbow.y;
      const len = Math.hypot(dx, dy) || 1;
      let ux = dx / len, uy = dy / len;
      // Waiting: the face points at the sky, barely tilted off vertical.
      if (readyAmt > 0.001) {
        ux = lerp(ux, side * 0.28, readyAmt);
        uy = lerp(uy, 0.99, readyAmt);
        const n = Math.hypot(ux, uy) || 1;
        ux /= n; uy /= n;
      }
      if (swinging && prog > 0.2 && prog < 0.55) {
        ux = lerp(ux, side * 0.35, 0.5);
        uy = lerp(uy, 0.9, 0.5);
        const n = Math.hypot(ux, uy) || 1;
        ux /= n; uy /= n;
      }
      const ang = Math.atan2(-(P.Y(hand.y + uy) - P.Y(hand.y)), P.X(hand.x + ux) - P.X(hand.x));
      ctx.save();
      ctx.translate(P.X(hand.x), P.Y(hand.y));
      ctx.rotate(-ang + Math.PI / 2);
      const u = P.s;
      const face = new Path2D();
      const w = 0.33 * u, h = 0.50 * u, top = -1.02 * u;
      face.moveTo(-w * 0.55, -0.30 * u);
      face.quadraticCurveTo(-w, top + h * 0.9, -w * 0.72, top + h * 0.25);
      face.quadraticCurveTo(-w * 0.5, top - 0.02 * u, 0, top);
      face.quadraticCurveTo(w * 0.5, top - 0.02 * u, w * 0.72, top + h * 0.25);
      face.quadraticCurveTo(w, top + h * 0.9, w * 0.55, -0.30 * u);
      face.quadraticCurveTo(0, -0.16 * u, -w * 0.55, -0.30 * u);
      face.closePath();
      const grip = new Path2D();
      grip.moveTo(-0.09 * u, -0.34 * u);
      grip.lineTo(0.09 * u, -0.34 * u);
      grip.lineTo(0.10 * u, 0.06 * u);
      grip.lineTo(-0.10 * u, 0.06 * u);
      grip.closePath();

      ctx.strokeStyle = OUTLINE_COL;
      ctx.lineWidth = Math.max(1, (STYLE.outline || 0.012) * u * 2);
      ctx.stroke(grip);
      ctx.fillStyle = '#1b2530';
      ctx.fill(grip);
      ctx.stroke(face);
      if (STYLE.shade) {
        const g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, tint(look.paddle, 0.22));
        g.addColorStop(1, tint(look.paddle, -0.24));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = look.paddle;
      }
      ctx.fill(face);
      // edge guard
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = Math.max(1, u * 0.035);
      ctx.stroke(face);
      ctx.restore();
    },
  };

  function spaced(s) { return s.split('').join(' '); }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.trail = [];
      this.dpr = 1;
      this.shake = 0;
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h; this.dpr = dpr;
    }

    viewports(m) {
      if (!m.versus) return [{ side: 0, rect: { x: 0, y: 0, w: this.w, h: this.h }, slot: 'p1' }];
      const half = Math.floor(this.h / 2);
      return [
        { side: 1, rect: { x: 0, y: 0, w: this.w, h: half }, slot: 'p2' },
        { side: 0, rect: { x: 0, y: half, w: this.w, h: this.h - half }, slot: 'p1' },
      ];
    }

    // ── frame ──────────────────────────────────────────────────────────────
    draw(m, input) {
      const ctx = this.ctx;
      this.match = m;
      ctx.clearRect(0, 0, this.w, this.h);
      const views = this.viewports(m);

      // ball trail
      if (m.ball.live) {
        this.trail.push({ x: m.ball.x, y: m.ball.y, z: m.ball.z });
        if (this.trail.length > 9) this.trail.shift();
      } else if (this.trail.length) this.trail.length = 0;

      for (const v of views) {
        const id = m.slot[v.slot];
        const me = id !== undefined ? m.players[id] : m.players[0];
        const cam = new Cam(v.rect, v.side, me ? me.x : 0);
        ctx.save();
        ctx.beginPath();
        ctx.rect(v.rect.x, v.rect.y, v.rect.w, v.rect.h);
        ctx.clip();
        this.drawWorld(ctx, m, cam, me);
        this.drawViewHud(ctx, m, v, me);
        ctx.restore();
      }
      if (views.length > 1) {
        ctx.fillStyle = '#0a0f16';
        ctx.fillRect(0, views[1].rect.y - 2, this.w, 4);
      }
      if (input) this.drawTouch(ctx, input);
    }

    drawWorld(ctx, m, cam, me) {
      const vp = cam.vp;
      const g = ctx.createLinearGradient(0, vp.y, 0, vp.y + vp.h);
      g.addColorStop(0, COL.skyTop);
      g.addColorStop(0.5, COL.skyMid);
      g.addColorStop(1, '#37718c');
      ctx.fillStyle = g;
      ctx.fillRect(vp.x, vp.y, vp.w, vp.h);

      this.drawStands(ctx, cam);
      // ground plane, stopping at the back fence (mirrored for the far camera)
      const F = cam.side === 1 ? -1 : 1;
      this.quad(ctx, cam, [[-60, -42 * F], [60, -42 * F], [60, FENCE_Z * F], [-60, FENCE_Z * F]], COL.surround);
      this.drawFence(ctx, cam);
      this.drawCourt(ctx, cam);

      if (m.state === 'ready') {
        this.highlightBox(ctx, cam, 1 - m.servingTeam, -m.serveXSign, 0.9);
      }

      const far = m.players.filter(p => p.team === 1);
      const near = m.players.filter(p => p.team === 0);
      const order = cam.side === 0 ? [far, near] : [near, far];

      this.drawShadows(ctx, cam, m);
      for (const p of order[0]) this.drawPlayer(ctx, cam, p, m, me);
      this.drawNet(ctx, cam);
      for (const p of order[1]) this.drawPlayer(ctx, cam, p, m, me);
      this.drawBall(ctx, cam, m);
    }

    // How much screen room is left above the far edge of the ground, and how the
    // fence and the stand split it. The venue composes itself from this, so it
    // works in portrait, landscape and split screen alike.
    venue(cam) {
      const F = cam.side === 1 ? -1 : 1;
      const vp = cam.vp;
      const baseY = cam.proj(0, 0, FENCE_Z * F).y;
      const band = Math.max(26, baseY - (vp.y + vp.h * 0.015));
      const standZ = (FENCE_Z + 8) * F;
      const yLow = Math.max(0.4, cam.yAtScreen(standZ, baseY - band * 0.30));
      const yHigh = cam.yAtScreen(standZ, baseY - band * 0.99);
      // fill the band with more rows, never with taller people
      const rows = Math.max(3, Math.min(CROWD_ROWS, Math.floor((yHigh - yLow) / ROW_STEP)));
      return {
        F, baseY, band, standZ, rows, step: ROW_STEP,
        fenceH: Math.max(3, cam.yAtScreen(FENCE_Z * F, baseY - band * 0.34)),
        standLow: yLow,
        standHigh: yLow + rows * ROW_STEP,
      };
    }

    drawFence(ctx, cam) {
      const V = this.venue(cam);
      const F = V.F, H = V.fenceH, FZ = FENCE_Z * F;
      const mesh = (pts, fill) => {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p = cam.proj(pts[i][0], pts[i][1], pts[i][2]);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      for (const sx of [-FENCE_X, FENCE_X]) {
        mesh([[sx, 0, -30 * F], [sx, H, -30 * F], [sx, H, FZ], [sx, 0, FZ]], 'rgba(16,32,42,0.55)');
      }
      mesh([[-FENCE_X, 0, FZ], [-FENCE_X, H, FZ], [FENCE_X, H, FZ], [FENCE_X, 0, FZ]], 'rgba(14,28,38,0.72)');
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -FENCE_X; i <= FENCE_X; i += 3) {
        const p1 = cam.proj(i, 0, FZ), p2 = cam.proj(i, H, FZ);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      }
      for (let hgt = H / 4; hgt < H; hgt += H / 4) {
        const p1 = cam.proj(-FENCE_X, hgt, FZ), p2 = cam.proj(FENCE_X, hgt, FZ);
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
      const bz = FZ - 0.05 * F;
      mesh([[-FENCE_X, H * 0.26, bz], [-FENCE_X, H * 0.58, bz],
            [FENCE_X, H * 0.58, bz], [FENCE_X, H * 0.26, bz]], 'rgba(20,90,120,0.85)');
      const anchor = cam.proj(0, H * 0.42, bz - 0.01 * F);
      ctx.save();
      ctx.font = `700 ${Math.max(7, anchor.s * 0.8)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('P I C K L E B A L L', anchor.x, anchor.y + anchor.s * 0.28);
      ctx.restore();
    }

    drawStands(ctx, cam) {
      const V = this.venue(cam);
      const Z = V.standZ, X = 60;
      const lo = V.standLow, hi = V.standHigh;
      const poly = (y0, y1, fill) => {
        ctx.beginPath();
        const pts = [[-X, y0], [-X, y1], [X, y1], [X, y0]];
        for (let i = 0; i < pts.length; i++) {
          const p = cam.proj(pts[i][0], pts[i][1], Z);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      poly(lo - 1.5, hi + 1.4, UI(0.08, 0.15, 0.21));
      const step = V.step;
      for (let i = 0; i < V.rows; i++) {
        const y0 = lo + i * step;
        poly(y0, y0 + step * 0.72, i % 2 === 0 ? UI(0.09, 0.16, 0.23) : UI(0.115, 0.19, 0.27));
      }
      poly(hi + 1.4, hi + 2.6, '#0e1a26');

      this.drawCrowd(ctx, cam, V);

      for (const px of [-23, 23]) {
        const zz = Z - 5 * V.F;
        const base = cam.proj(px, 0, zz), top = cam.proj(px, hi + 9, zz);
        ctx.strokeStyle = '#1a2a3a';
        ctx.lineWidth = Math.max(2, base.s * 0.5);
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
        const lamp = cam.proj(px, hi + 10.5, zz);
        const rr = Math.max(6, lamp.s * 4.5);
        const glow = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, rr);
        glow.addColorStop(0, 'rgba(255,246,214,0.55)');
        glow.addColorStop(1, 'rgba(255,246,214,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(lamp.x, lamp.y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fdf3cd';
        ctx.fillRect(lamp.x - rr * 0.28, lamp.y - rr * 0.16, rr * 0.56, rr * 0.3);
      }
    }

    // Spectators: built once, projected every frame, and drawn batched by
    // colour so a full stand costs a handful of fills.
    crowdSeats() {
      if (this._crowd) return this._crowd;
      const seats = [];
      const rand = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
      for (let row = 0; row < CROWD_ROWS; row++) {
        for (let i = 0; i < 80; i++) {
          const k = row * 149 + i;
          if (rand(k * 3.1) < 0.10) continue;                 // empty seats
          seats.push({
            x: -60 + i * 1.5 + rand(k) * 0.5,
            row,
            shirt: Math.floor(rand(k * 1.7) * COL.crowd.length),
            skin: Math.floor(rand(k * 2.3) * COL.crowdSkin.length),
            ph: rand(k * 5.9) * 6.283,
          });
        }
      }
      this._crowd = seats;
      return seats;
    }

    drawCrowd(ctx, cam, V) {
      const seats = this.crowdSeats();
      const step = V.step;
      const t = performance.now() / 1000;
      const m = this.match;
      const active = m && m.cheerT > 0;
      const age = active ? (m.cheerDur - m.cheerT) : 0;
      const fade = active ? Math.min(1, m.cheerT / 0.6) * (m.cheerLevel || 1) : 0;

      const vp = cam.vp;
      const bodies = [];
      const heads = [];
      for (let i = 0; i < COL.crowd.length; i++) bodies.push(null);
      for (let i = 0; i < COL.crowdSkin.length; i++) heads.push(null);
      let arms = null;

      for (const s of seats) {
        if (s.row >= V.rows) continue;
        // the celebration travels along the stand like a wave
        const wave = ((s.x + 54) / 108) * 0.75;
        const local = active ? Math.max(0, Math.min(1, (age - wave) * 3.2)) * fade : 0;
        const jump = local * Math.abs(Math.sin((age - wave) * 8 + s.ph)) * 0.62;
        const sway = Math.sin(t * 1.2 + s.ph) * 0.05;
        const y = V.standLow + s.row * step + step * 0.34 + (jump + sway) * step * 0.85;

        const base = cam.proj(s.x, y, V.standZ);
        if (base.x < vp.x - 30 || base.x > vp.x + vp.w + 30) continue;
        if (base.y < vp.y - 30 || base.y > vp.y + vp.h + 30) continue;
        const u = base.s * 1.05;                          // a person, not a row
        const bw = u * 0.95, bh = u * 1.35;

        let bp = bodies[s.shirt];
        if (!bp) { bp = bodies[s.shirt] = new Path2D(); }
        bp.moveTo(base.x - bw / 2, base.y);
        bp.lineTo(base.x + bw / 2, base.y);
        bp.lineTo(base.x + bw * 0.40, base.y - bh);
        bp.lineTo(base.x - bw * 0.40, base.y - bh);
        bp.closePath();

        let hp = heads[s.skin];
        if (!hp) { hp = heads[s.skin] = new Path2D(); }
        const hr = Math.max(0.8, u * 0.34);
        hp.moveTo(base.x + hr, base.y - bh - hr * 0.75);
        hp.arc(base.x, base.y - bh - hr * 0.75, hr, 0, Math.PI * 2);

        if (local > 0.25 && u > 3) {
          if (!arms) arms = new Path2D();
          const ax = u * 0.55, ay = u * 1.05;
          arms.moveTo(base.x - bw * 0.35, base.y - bh * 0.85);
          arms.lineTo(base.x - ax, base.y - bh - ay * local);
          arms.moveTo(base.x + bw * 0.35, base.y - bh * 0.85);
          arms.lineTo(base.x + ax, base.y - bh - ay * local);
        }
      }

      for (let i = 0; i < bodies.length; i++) {
        if (!bodies[i]) continue;
        ctx.fillStyle = COL.crowd[i];
        ctx.globalAlpha = 0.85;
        ctx.fill(bodies[i]);
      }
      for (let i = 0; i < heads.length; i++) {
        if (!heads[i]) continue;
        ctx.fillStyle = COL.crowdSkin[i];
        ctx.globalAlpha = 0.9;
        ctx.fill(heads[i]);
      }
      ctx.globalAlpha = 1;
      if (arms) {
        ctx.strokeStyle = 'rgba(240,225,200,0.85)';
        ctx.lineWidth = Math.max(1, cam.proj(0, V.standLow, V.standZ).s * 0.16);
        ctx.lineCap = 'round';
        ctx.stroke(arms);
      }
    }

    quad(ctx, cam, pts, fill) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = cam.proj(pts[i][0], 0, pts[i][1]);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

    line(ctx, cam, x1, z1, x2, z2, w) {
      const hw = (w || C.LINE_W) / 2;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * hw, nz = (dx / len) * hw;
      this.quad(ctx, cam, [
        [x1 + nx, z1 + nz], [x2 + nx, z2 + nz], [x2 - nx, z2 - nz], [x1 - nx, z1 - nz],
      ], COL.line);
    }

    drawCourt(ctx, cam) {
      const W = C.HALF_W, L = C.HALF_L, K = C.KITCHEN;
      this.quad(ctx, cam, [[-W, -L], [W, -L], [W, L], [-W, L]], COL.court);
      this.quad(ctx, cam, [[-W, -K], [W, -K], [W, 0], [-W, 0]], COL.kitchen);
      this.quad(ctx, cam, [[-W, 0], [W, 0], [W, K], [-W, K]], COL.kitchen);
      // lines
      this.line(ctx, cam, -W, -L, W, -L);
      this.line(ctx, cam, -W, L, W, L);
      this.line(ctx, cam, -W, -L, -W, L);
      this.line(ctx, cam, W, -L, W, L);
      this.line(ctx, cam, -W, -K, W, -K);
      this.line(ctx, cam, -W, K, W, K);
      this.line(ctx, cam, 0, -L, 0, -K);
      this.line(ctx, cam, 0, K, 0, L);
    }

    highlightBox(ctx, cam, team, xSign, alpha) {
      const s = C.teamSign(team);
      const x0 = xSign > 0 ? 0 : -C.HALF_W, x1 = xSign > 0 ? C.HALF_W : 0;
      ctx.save();
      ctx.globalAlpha = alpha;
      this.quad(ctx, cam, [
        [x0, s * C.KITCHEN], [x1, s * C.KITCHEN], [x1, s * C.HALF_L], [x0, s * C.HALF_L],
      ], 'rgba(255,255,255,0.18)');
      ctx.restore();
    }

    drawNet(ctx, cam) {
      const N = C.NET_HALF_W;
      const steps = 28;
      // net cloth
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = -N + (2 * N * i) / steps;
        const p = cam.proj(x, C.netHeightAt(x), 0);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      for (let i = steps; i >= 0; i--) {
        const x = -N + (2 * N * i) / steps;
        const p = cam.proj(x, 0, 0);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(11,18,28,0.72)';
      ctx.fill();

      // mesh
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 22; i++) {
        const x = -N + (2 * N * i) / 22;
        const a = cam.proj(x, C.netHeightAt(x), 0), b = cam.proj(x, 0, 0);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      for (let k = 1; k <= 5; k++) {
        for (let i = 0; i <= steps; i++) {
          const x = -N + (2 * N * i) / steps;
          const p = cam.proj(x, (C.netHeightAt(x) * k) / 6, 0);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();

      // tape
      ctx.strokeStyle = COL.tape;
      ctx.lineWidth = Math.max(2, cam.proj(0, 0, 0).s * 0.11);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = -N + (2 * N * i) / steps;
        const p = cam.proj(x, C.netHeightAt(x), 0);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // posts
      for (const px of [-N, N]) {
        const a = cam.proj(px, 0, 0), b = cam.proj(px, C.NET_H_POST + 0.15, 0);
        ctx.strokeStyle = '#20303f';
        ctx.lineWidth = Math.max(2, a.s * 0.22);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    drawShadows(ctx, cam, m) {
      for (const p of m.players) {
        const q = cam.proj(p.x, 0, p.z);
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, q.s * 1.0, q.s * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Both bounce marks are the same circle on the ground, so they read as a
      // pair: MARK_R across, flattened by the camera's own foreshortening.
      const MARK_R = 0.42, MARK_FLAT = 0.353;

      // where the ball actually landed: a solid white disc that fades out over two
      // seconds, so the mark you see is the bounce that already happened, never
      // the one still coming
      if (m.marks && m.marks.length) {
        ctx.save();
        ctx.fillStyle = '#fff';
        for (const k of m.marks) {
          const q = cam.proj(k.x, 0.015, k.z);
          if (q.s <= 0 || q.cz <= 1) continue;
          // solid white for a beat so the bounce reads, then a clean fade out
          ctx.globalAlpha = k.t > 1.75 ? 1 : k.t / 1.75;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, q.s * MARK_R, q.s * MARK_R * MARK_FLAT, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // predicted bounce marker
      const pr = m.pred && m.pred.landing;
      if (pr && m.ball.live) {
        const q = cam.proj(pr.x, 0.02, pr.z);
        const inb = C.inBounds(pr.x, pr.z);
        ctx.save();
        ctx.strokeStyle = inb ? 'rgba(255,255,255,0.75)' : 'rgba(255,120,110,0.85)';
        ctx.lineWidth = Math.max(1.2, q.s * 0.045);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, q.s * MARK_R, q.s * MARK_R * MARK_FLAT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawPlayer(ctx, cam, p, m, me) {
      const base = cam.proj(p.x, 0, p.z);
      const s = base.s;
      if (s <= 0 || base.cz <= 1) return;
      Char.draw(ctx, cam, p, base, s, p === me);
      if (p.ctrl === 'human' && p !== me) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `600 ${Math.max(9, s * 0.5)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.name, base.x, base.y - s * 6.5);
      }
    }

    drawBall(ctx, cam, m) {
      const b = m.ball;
      // shadow under the ball
      const sh = cam.proj(b.x, 0.01, b.z);
      ctx.save();
      ctx.globalAlpha = Math.max(0.08, 0.34 - b.y * 0.03);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, sh.s * 0.22, sh.s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // faint drop line: the single cheapest depth cue in a perspective view
      if (b.live && b.y > 0.6) {
        const top = cam.proj(b.x, b.y, b.z);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(sh.x, sh.y);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const q = cam.proj(t.x, t.y, t.z);
        ctx.save();
        ctx.globalAlpha = (i / this.trail.length) * 0.35;
        ctx.fillStyle = COL.ball;
        ctx.beginPath();
        ctx.arc(q.x, q.y, ballRadius(q.s) * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const q = cam.proj(b.x, b.y, b.z);
      const r = ballRadius(q.s);
      const g = ctx.createRadialGradient(q.x - r * 0.35, q.y - r * 0.4, r * 0.1, q.x, q.y, r);
      g.addColorStop(0, '#f4ffb0');
      g.addColorStop(1, COL.ball);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── overlays ───────────────────────────────────────────────────────────
    drawViewHud(ctx, m, v, me) {
      const r = v.rect;
      this.drawScoreboard(ctx, m, r);
      if (m.banner) this.drawBanner(ctx, m, r);
      if (m.hint) {
        ctx.save();
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,225,120,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 6;
        ctx.fillText(m.hint, r.x + r.w / 2, r.y + r.h - 18);
        ctx.restore();
      }
      const prompt = (label, sub) => {
        const cx = r.x + r.w / 2, cy = r.y + r.h * 0.56;
        ctx.save();
        ctx.font = `700 15px system-ui, sans-serif`;
        const wpx = Math.max(ctx.measureText(label).width, sub ? 210 : 0) + 28;
        ctx.fillStyle = 'rgba(8,14,22,0.62)';
        this.roundRect(ctx, cx - wpx / 2, cy - 17, wpx, sub ? 44 : 28, 8);
        ctx.fill();
        ctx.restore();
        this.centerText(ctx, r, label, cy, 15, 'rgba(255,255,255,0.95)');
        if (sub) this.centerText(ctx, r, sub, cy + 18, 11, 'rgba(255,255,255,0.65)');
      };
      if (m.state === 'ready' && me && m.players[m.serverIdx] === me) {
        prompt('DESLIZE PARA SACAR', 'ou toque  •  curto = curto, longo = fundo');
      } else if (m.state === 'ready' && me && m.players[m.receiverIdx] === me) {
        prompt('DEIXE O SAQUE QUICAR', null);
      }
    }

    centerText(ctx, r, text, y, size, color) {
      ctx.save();
      ctx.font = `700 ${size}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText(text, r.x + r.w / 2, y);
      ctx.restore();
    }

    // Broadcast-style panel: title strip, one row per team with its score box,
    // and a footer carrying the serve. Drawn per viewport, so split screen gives
    // each player their own.
    drawScoreboard(ctx, m, rect) {
      const k = hudScale(rect);
      const pad = 10 * k;
      const w = Math.min(rect.w - pad * 2, 300 * k);
      const head = 20 * k, row = 30 * k, foot = 15 * k;
      const x = rect.x + pad;
      const y = rect.y + pad;
      const h = head + row * 2 + foot;
      const box = 40 * k;

      ctx.save();
      ctx.textBaseline = 'middle';

      // title strip
      ctx.fillStyle = '#0c1622';
      ctx.fillRect(x, y, w, head);
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = `700 ${9.5 * k}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      const title = (m.isDoubles() ? 'DUPLAS' : 'SIMPLES') + ': ATÉ ' + m.cfg.targetPoints + ' PONTOS';
      ctx.fillText(spaced(title), x + 8 * k, y + head / 2);

      // one row per team
      for (let t = 0; t < 2; t++) {
        const ry = y + head + row * t;
        ctx.fillStyle = t === 0 ? 'rgba(14,24,36,0.94)' : 'rgba(20,32,46,0.94)';
        ctx.fillRect(x, ry, w, row);
        ctx.fillStyle = COL.team[t].shirt;
        ctx.fillRect(x, ry, 3.5 * k, row);

        const names = m.mates(t).map(p => p.name).join(' / ');
        ctx.fillStyle = '#eef4f9';
        ctx.font = `700 ${11.5 * k}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(names, x + 12 * k, ry + row / 2);

        // serve indicator, and the server number in doubles
        if (m.servingTeam === t) {
          const bx = x + w - box - 12 * k;
          ctx.fillStyle = COL.ball;
          ctx.beginPath();
          ctx.arc(bx, ry + row / 2, 3.2 * k, 0, Math.PI * 2);
          ctx.fill();
          if (m.isDoubles()) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = `700 ${8.5 * k}px system-ui, sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText(String(m.serverNumber), bx - 5 * k, ry + row / 2);
          }
        }

        // score box
        ctx.fillStyle = t === 0 ? '#1b3552' : '#b4303f';
        ctx.fillRect(x + w - box, ry + 1, box, row - 2);
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${17 * k}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(m.score[t]), x + w - box / 2, ry + row / 2);
      }

      // footer
      ctx.fillStyle = '#0c1622';
      ctx.fillRect(x, y + head + row * 2, w, foot);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `700 ${8 * k}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(spaced('PICKLEBALL'), x + 8 * k, y + head + row * 2 + foot / 2);
      ctx.textAlign = 'right';
      ctx.fillText(m.scoreText(), x + w - 8 * k, y + head + row * 2 + foot / 2);
      ctx.restore();
      return h;
    }

    drawBanner(ctx, m, rect) {
      const t = m.banner;
      const bw = Math.min(236, rect.w - 24), bh = 62;
      const bx = rect.x + rect.w / 2 - bw / 2;
      const by = rect.y + rect.h * 0.42 - bh / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(8,14,22,0.86)';
      this.roundRect(ctx, bx, by, bw, bh, 12);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = COL.team[t.team].shirt;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillText(t.label, bx + bw / 2, by + 26);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(t.sideOut ? 'Troca de saque' : 'Ponto ' + (t.team === 0 ? 'Time 1' : 'Time 2'),
        bx + bw / 2, by + 46);
      ctx.restore();
    }

    drawTouch(ctx, input) {
      for (const k in input.pointers) {
        const p = input.pointers[k];
        if (!p.active) continue;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (const s of input.swipeFx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.strokeStyle = '#ffe27a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
        ctx.restore();
      }
    }

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  Renderer.charStyle = 'boneco';
  Renderer.COL = COL;
  Renderer.Cam = Cam;
  return Renderer;
})();
