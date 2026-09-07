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
  const UI = (a, b, c) => `rgb(${Math.round(a*255)},${Math.round(b*255)},${Math.round(c*255)})`;

  function Cam(vp, side, focusX) {
    // Two rigs. A wide frame gets the television angle: low and far back, which
    // is what makes a broadcast read — the court lies flat and wide, the near
    // pair large, the far pair small. A narrow frame cannot afford that (the
    // court would be a thin strip), so it keeps a higher, closer camera.
    const wide = vp.w >= vp.h * 1.3;
    const camY = wide ? 12.5 : 24;
    const camZ = wide ? -56 : -60;
    const aimY = 2.0, aimZ = 6;
    const pitch = Math.atan2(camY - aimY, aimZ - camZ);
    const sin = Math.sin(pitch), cos = Math.cos(pitch);
    const czOf = z => camY * sin + (z - camZ) * cos;
    const vOf = z => -((-camY) * cos + (z - camZ) * sin) / czOf(z);

    const BACK = C.HALF_L + BACK_ROOM;
    const halfNear = C.HALF_W / czOf(-C.HALF_L);
    const span = vOf(-BACK) - vOf(BACK);
    // width first — both partners must fit — then a cap so the length fits too
    const focal = Math.min(
      (wide ? 0.66 : 0.98) * vp.w / (2 * halfNear),
      (wide ? 0.74 : 0.86) * vp.h / span
    );

    this.side = side; this.sin = sin; this.cos = cos; this.focal = focal;
    this.y = camY; this.z = camZ;
    this.x = (side === 1 ? -1 : 1) * focusX * 0.25;
    this.cx = vp.x + vp.w / 2;
    // broadcasts put the near baseline around three quarters down the frame and
    // leave the run-back below it; a narrow frame anchors the run-back instead
    this.cy = wide
      ? vp.y + vp.h * 0.76 - focal * vOf(-C.HALF_L)
      : vp.y + vp.h * 0.99 - focal * vOf(-BACK);
    this.horizonY = this.cy - focal * (sin / cos);
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
  // Everything below works in local feet: x is lateral on screen, y is height
  // off the court. Joints are solved with two-bone IK, then projected by the
  // player's depth scale, so a near player and a far one share one rig.
  const BODY = {
    ankle: 0.30, knee: 1.62, hip: 2.88, waist: 3.34, shoulder: 4.70,
    head: 5.42, headR: 0.37,
    shoulderHalf: 0.58, hipHalf: 0.40,
    upperArm: 1.06, foreArm: 0.98,
    thigh: 1.26, shin: 1.32,
  };

  // Two-bone IK: elbow/knee position for a limb reaching from a to b.
  function ik(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay;
    let d = Math.hypot(dx, dy);
    if (d < 1e-4) { d = 1e-4; dx = 1e-4; }
    const dd = Math.min(d, l1 + l2 - 0.002);
    const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
    let h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    // a folded limb would throw the joint far out to the side; ease it back in
    h *= Math.max(0.18, Math.min(1, (dd - 0.45) / 0.9));
    const ux = dx / d, uy = dy / d;
    return { x: ax + ux * a - uy * h * bend, y: ay + uy * a + ux * h * bend };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function mix(p1, p2, t) { return { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) }; }

  // Keep a hand inside the arm's reach, so no pose can stretch a limb.
  function reachable(sh, target, len) {
    const dx = target.x - sh.x, dy = target.y - sh.y;
    const d = Math.hypot(dx, dy);
    if (d <= len || d < 1e-4) return target;
    const k = len / d;
    return { x: sh.x + dx * k, y: sh.y + dy * k };
  }

  const Char = {
    // Deterministic look per player: skin, hair and paddle stay put all match.
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

    draw(ctx, cam, p, base, s, isMe) {
      const look = this.look(p);
      const kit = COL.team[p.team];
      const skin = COL.skin[look.skin];
      const skinDark = COL.skinDark[look.skin];
      const facing = cam.side === p.team ? 1 : -1;   // 1 = we see their back
      const hand = facing;                            // right-handed, mirrored on the far side
      const P = {
        s,
        X: v => base.x + v * s,
        Y: v => base.y - v * s,
      };

      const crouch = p.crouch || 0;
      const stride = p.speedN || 0;
      const ph = p.runPhase || 0;
      const mir = cam.side === 1 ? -1 : 1;
      const lean = (p.lean || 0) * mir;
      const yaw = (p.yaw || 0) * mir;              // body turn, in screen terms
      const bob = Math.abs(Math.sin(ph)) * 0.10 * stride;
      const hipY = BODY.hip - crouch * 0.85 - bob + (p.hop || 0);
      const shY = hipY + (BODY.shoulder - BODY.hip) - crouch * 0.12;

      // ── swing phase: -1 loaded, 0 contact, +1 follow through ─────────────
      const swinging = p.swingT > 0;
      const prog = swinging ? 1 - p.swingT / (p.swingDur || 0.42) : 0;
      const coilAmt = swinging ? (prog < 0.32 ? 1 - prog / 0.32 : 0) : (p.prep || 0);
      const kind = p.swingKind || 'ground';
      const fore = p.swingFore !== false;
      const coil = coilAmt * (fore ? 0.55 : -0.42) * hand;

      // the shoulders carry the run turn plus the swing coil; the hips follow
      // at about half of it, which is what separates a stride from a shuffle
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

      // ── legs ─────────────────────────────────────────────────────────────
      // Once the body is turned, most of the stride happens along the way the
      // player faces, which on screen is depth: feet lift and land instead of
      // sliding out to the sides.
      const resid = (p.runAngle || 0) - (p.yaw || 0);   // sideways part left over
      const strideLat = Math.sin(resid) * stride * mir;
      const strideDep = Math.cos(resid) * stride;
      const stanceHalf = BODY.hipHalf + 0.08 + crouch * 0.20;
      const legs = [];
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const phase = ph + (i === 0 ? Math.PI : 0);
        const sw = Math.sin(phase);
        const hipJ = side < 0 ? hipL : hipR;
        const ahead = sw * strideDep;                       // stride into depth
        const lift = Math.max(0, sw) * stride * 0.55;
        const footX = side * stanceHalf + sw * strideLat * 1.15 + lean * 0.8 + ahead * 0.18;
        const footY = BODY.ankle + lift * 0.42 + Math.max(0, ahead) * 0.30;
        const knee = ik(hipJ.x, hipJ.y, footX, footY, BODY.thigh, BODY.shin, side * 0.42);
        legs.push({
          side, hip: hipJ, knee, foot: { x: footX, y: footY },
          back: ahead < 0, depth: ahead,
        });
      }

      // ── arms ─────────────────────────────────────────────────────────────
      const hitDX = p.swingHit ? p.swingHit.dx * mir : 0;
      const hitY = p.swingHit ? p.swingHit.dy : shY - 0.4;
      const swA = Math.sin(ph + Math.PI) * stride;
      // ready: paddle up in front of the chest, elbow in — not held out wide
      const ready = {
        x: hand * (0.62 + 0.12 * Math.cos(turn)) + Math.sin(turn) * 0.3 - swA * 0.18,
        y: shY - 0.86 + swA * 0.12,
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

      let handP;
      if (swinging) {
        handP = prog < 0.32
          ? mix(load, contact, ease(prog / 0.32))
          : mix(contact, follow, ease((prog - 0.32) / 0.68));
      } else {
        handP = mix(ready, load, ease(p.prep || 0));
      }

      const shPad = hand > 0 ? shR : shL;
      const shFree = hand > 0 ? shL : shR;
      const armLen = (BODY.upperArm + BODY.foreArm) * 0.97;
      handP = reachable(shPad, handP, armLen);
      // the free arm pumps against the legs and tucks in as the body turns
      const freeHand = {
        x: -hand * (0.86 + Math.abs(swA) * 0.26) + Math.sin(turn) * 0.42 - swA * 0.26,
        y: shY - 1.06 + swA * 0.34 + coilAmt * 0.42,
      };
      const freeHandR = reachable(shFree, freeHand, armLen);
      const freeElbow = ik(shFree.x, shFree.y, freeHandR.x, freeHandR.y,
                           BODY.upperArm, BODY.foreArm, hand * 0.75);
      const elbow = ik(shPad.x, shPad.y, handP.x, handP.y, BODY.upperArm, BODY.foreArm, -hand * 0.8);

      // ── paint, back to front ─────────────────────────────────────────────
      this.shadow(ctx, P, base, s, stanceHalf, isMe, p);

      const backLeg = legs[0].depth <= legs[1].depth ? legs[0] : legs[1];
      const frontLeg = backLeg === legs[0] ? legs[1] : legs[0];
      const freeInFront = swA > 0;
      this.leg(ctx, P, backLeg, kit, skinDark, COL.shoe, 0.86);
      if (!freeInFront) this.arm(ctx, P, shFree, freeElbow, freeHandR, kit, skinDark, 0.9);
      this.torso(ctx, P, shL, shR, hipL, hipR, kit);
      this.head(ctx, P, shL, shR, shY, skin, skinDark, look, turn, facing);
      this.leg(ctx, P, frontLeg, kit, skin, COL.shoe, 1);
      if (freeInFront) this.arm(ctx, P, shFree, freeElbow, freeHandR, kit, skin, 1);
      this.arm(ctx, P, shPad, elbow, handP, kit, skin, 1);
      this.paddle(ctx, P, elbow, handP, look, hand, swinging, prog);
    },

    shadow(ctx, P, base, s, stanceHalf, isMe, p) {
      ctx.save();
      const g = ctx.createRadialGradient(base.x, base.y, s * 0.1, base.x, base.y, s * 1.5);
      g.addColorStop(0, 'rgba(0,0,0,0.34)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, s * (1.5 + stanceHalf), s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (isMe) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, s * 1.25, s * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.ctrl === 'human') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, s * 0.045);
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, s * 1.15, s * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },

    // A tapered capsule: the building block for every limb segment.
    // `round` fills it, then two thin strips give it a cylindrical read.
    limb(ctx, P, ax, ay, bx, by, w1, w2, color, volume) {
      const x1 = P.X(ax), y1 = P.Y(ay), x2 = P.X(bx), y2 = P.Y(by);
      const r1 = Math.max(0.6, (w1 * P.s) / 2), r2 = Math.max(0.5, (w2 * P.s) / 2);
      const dx = x2 - x1, dy = y2 - y1;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
      ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
      ctx.lineTo(x2 - nx * r2, y2 - ny * r2);
      ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x1, y1, r1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, r2, 0, Math.PI * 2);
      ctx.fill();
      if (volume === false || r1 < 2.2) return;
      // light comes from the upper left
      const lightSide = (nx * -0.7 + ny * -0.7) >= 0 ? 1 : -1;
      const strip = (off, wf, col) => {
        const ox = nx * off * lightSide, oy = ny * off * lightSide;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x1 + ox + nx * r1 * wf, y1 + oy + ny * r1 * wf);
        ctx.lineTo(x2 + ox + nx * r2 * wf, y2 + oy + ny * r2 * wf);
        ctx.lineTo(x2 + ox - nx * r2 * wf, y2 + oy - ny * r2 * wf);
        ctx.lineTo(x1 + ox - nx * r1 * wf, y1 + oy - ny * r1 * wf);
        ctx.closePath();
        ctx.fill();
      };
      strip(r1 * 0.42, 0.34, 'rgba(255,255,255,0.13)');
      strip(-r1 * 0.52, 0.30, 'rgba(0,0,0,0.16)');
    },

    leg(ctx, P, L, kit, skin, shoeCol, shade) {
      const dim = shade < 1;
      this.limb(ctx, P, L.hip.x, L.hip.y, L.knee.x, L.knee.y, 0.46, 0.30, dim ? kit.shorts2 : kit.shorts);
      this.limb(ctx, P, L.knee.x, L.knee.y, L.foot.x, L.foot.y + 0.06, 0.28, 0.19, skin);
      // sock
      this.limb(ctx, P, L.foot.x, L.foot.y + 0.34, L.foot.x, L.foot.y + 0.12, 0.22, 0.22, '#eef3f7');
      // shoe: upper, stripe and sole
      const toe = L.foot.x + (L.side * 0.06);
      this.limb(ctx, P, L.foot.x, L.foot.y + 0.05, toe, L.foot.y - 0.02, 0.26, 0.30, shoeCol);
      this.limb(ctx, P, L.foot.x, L.foot.y + 0.02, toe, L.foot.y + 0.01, 0.07, 0.07,
                kit.shirt2, false);
      ctx.save();
      ctx.fillStyle = 'rgba(16,26,38,0.65)';
      ctx.beginPath();
      ctx.ellipse(P.X(toe), P.Y(L.foot.y - 0.06), P.s * 0.21, P.s * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    arm(ctx, P, sh, elbow, hand, kit, skin, shade) {
      this.limb(ctx, P, sh.x, sh.y, elbow.x, elbow.y, 0.32, 0.24, skin);
      this.limb(ctx, P, elbow.x, elbow.y, hand.x, hand.y, 0.24, 0.17, skin);
      // short sleeve: starts inside the shoulder so it reads as cloth on the
      // arm rather than a ball stuck to the torso
      const t = 0.40;
      this.limb(ctx, P, sh.x * 0.55 + elbow.x * 0.05, sh.y - 0.10,
                sh.x + (elbow.x - sh.x) * t, sh.y + (elbow.y - sh.y) * t,
                0.30, 0.26, shade < 1 ? kit.shirt2 : kit.shirt, false);
      // wristband and hand
      const wx = elbow.x + (hand.x - elbow.x) * 0.86, wy = elbow.y + (hand.y - elbow.y) * 0.86;
      this.limb(ctx, P, wx, wy, hand.x, hand.y, 0.21, 0.19, kit.trim, false);
      ctx.beginPath();
      ctx.arc(P.X(hand.x), P.Y(hand.y), Math.max(1, P.s * 0.12), 0, Math.PI * 2);
      ctx.fillStyle = skin;
      ctx.fill();
    },

    torso(ctx, P, shL, shR, hipL, hipR, kit) {
      const midY = (shL.y + hipL.y) / 2;
      ctx.beginPath();
      ctx.moveTo(P.X(shL.x), P.Y(shL.y - 0.06));
      ctx.quadraticCurveTo(P.X((shL.x + shR.x) / 2), P.Y(shL.y + 0.20), P.X(shR.x), P.Y(shR.y - 0.06));
      ctx.quadraticCurveTo(P.X(shR.x + 0.06), P.Y(midY), P.X(hipR.x + 0.14), P.Y(hipR.y + 0.02));
      ctx.lineTo(P.X(hipL.x - 0.14), P.Y(hipL.y + 0.02));
      ctx.quadraticCurveTo(P.X(shL.x - 0.06), P.Y(midY), P.X(shL.x), P.Y(shL.y - 0.06));
      ctx.closePath();
      ctx.fillStyle = kit.shirt;
      ctx.fill();
      // round the shirt out with light across the chest
      const gx0 = P.X(Math.min(shL.x, hipL.x) - 0.2), gx1 = P.X(Math.max(shR.x, hipR.x) + 0.2);
      const grad = ctx.createLinearGradient(gx0, 0, gx1, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.14)');
      grad.addColorStop(0.42, 'rgba(255,255,255,0.02)');
      grad.addColorStop(1, 'rgba(0,0,0,0.20)');
      ctx.fillStyle = grad;
      ctx.fill();
      // hem and collar catch the light differently
      ctx.beginPath();
      ctx.moveTo(P.X(hipL.x - 0.12), P.Y(hipL.y));
      ctx.lineTo(P.X(hipR.x + 0.12), P.Y(hipR.y));
      ctx.lineTo(P.X(hipR.x + 0.12), P.Y(hipR.y - 0.16));
      ctx.lineTo(P.X(hipL.x - 0.12), P.Y(hipL.y - 0.16));
      ctx.closePath();
      ctx.fillStyle = kit.shirt2;
      ctx.fill();
      // collar
      ctx.beginPath();
      ctx.moveTo(P.X(shL.x + 0.14), P.Y(shL.y + 0.02));
      ctx.quadraticCurveTo(P.X((shL.x + shR.x) / 2), P.Y(shL.y + 0.26), P.X(shR.x - 0.14), P.Y(shR.y + 0.02));
      ctx.quadraticCurveTo(P.X((shL.x + shR.x) / 2), P.Y(shL.y + 0.10), P.X(shL.x + 0.14), P.Y(shL.y + 0.02));
      ctx.closePath();
      ctx.fillStyle = kit.trim;
      ctx.fill();
      // shorts: a panel across the hips, not a bar
      ctx.beginPath();
      ctx.moveTo(P.X(hipL.x - 0.16), P.Y(hipL.y + 0.30));
      ctx.lineTo(P.X(hipR.x + 0.16), P.Y(hipR.y + 0.30));
      ctx.lineTo(P.X(hipR.x + 0.20), P.Y(hipR.y - 0.26));
      ctx.lineTo(P.X(hipL.x - 0.20), P.Y(hipL.y - 0.26));
      ctx.closePath();
      ctx.fillStyle = kit.shorts;
      ctx.fill();
    },

    head(ctx, P, shL, shR, shY, skin, skinDark, look, coil, facing) {
      const cx = (shL.x + shR.x) / 2 + Math.sin(coil) * 0.14;
      const headY = shY + (BODY.head - BODY.shoulder) + 0.06;
      const R = BODY.headR;
      this.limb(ctx, P, cx, shY - 0.04, cx, headY - R * 0.62, 0.27, 0.24, skinDark, false);
      ctx.beginPath();
      ctx.ellipse(P.X(cx), P.Y(headY), P.s * R * 0.92, P.s * R, 0, 0, Math.PI * 2);
      ctx.fillStyle = skin;
      ctx.fill();
      const hg = ctx.createLinearGradient(P.X(cx - R), 0, P.X(cx + R), 0);
      hg.addColorStop(0, 'rgba(255,255,255,0.12)');
      hg.addColorStop(0.55, 'rgba(0,0,0,0)');
      hg.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = hg;
      ctx.fill();

      // hair: a cap that reads from the front and the back, plus one flourish
      ctx.save();
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      if (look.style === 3) {
        // visor cap
        ctx.ellipse(P.X(cx), P.Y(headY + R * 0.22), P.s * R * 1.0, P.s * R * 0.72, 0, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(P.X(cx), P.Y(headY + R * 0.1), P.s * R * 1.25, P.s * R * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = look.hair;
        ctx.fill();
      } else {
        ctx.ellipse(P.X(cx), P.Y(headY + R * 0.10), P.s * R * 1.06, P.s * R * 0.98,
                    0, Math.PI * 0.88, Math.PI * 2.12);
        ctx.fill();
        if (look.style === 1) {
          // ponytail, swinging a touch behind the head
          const tx = cx - 0.02, ty = headY - R * 0.2;
          this.limb(ctx, P, tx, ty, tx + Math.sin(coil) * 0.1, ty - 0.45, 0.24, 0.14, look.hair);
        } else if (look.style === 2) {
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(P.X(cx + i * R * 0.62), P.Y(headY + R * 0.5), P.s * R * 0.42, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();

      // a hint of a face only when we are looking at it, and only as shading
      if (facing < 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(40,25,15,0.45)';
        const eyeR = Math.max(0.5, P.s * R * 0.11);
        ctx.beginPath();
        ctx.arc(P.X(cx - R * 0.32), P.Y(headY - R * 0.08), eyeR, 0, Math.PI * 2);
        ctx.arc(P.X(cx + R * 0.32), P.Y(headY - R * 0.08), eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },

    paddle(ctx, P, elbow, hand, look, side, swinging, prog) {
      const dx = hand.x - elbow.x, dy = hand.y - elbow.y;
      const len = Math.hypot(dx, dy) || 1;
      let ux = dx / len, uy = dy / len;
      // during the strike the face squares up to the ball instead of trailing
      if (swinging && prog > 0.2 && prog < 0.55) {
        ux = lerp(ux, side * 0.35, 0.5);
        uy = lerp(uy, 0.9, 0.5);
        const n = Math.hypot(ux, uy) || 1;
        ux /= n; uy /= n;
      }
      const gripX = hand.x + ux * 0.16, gripY = hand.y + uy * 0.16;
      const faceX = hand.x + ux * 0.78, faceY = hand.y + uy * 0.78;
      this.limb(ctx, P, gripX, gripY, hand.x - ux * 0.12, hand.y - uy * 0.12, 0.16, 0.16, '#1a232f');
      const ang = Math.atan2(-(P.Y(faceY) - P.Y(gripY)), P.X(faceX) - P.X(gripX));
      ctx.save();
      ctx.translate(P.X(faceX), P.Y(faceY));
      ctx.rotate(-ang + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, P.s * 0.35, P.s * 0.46, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#141d28';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, P.s * 0.29, P.s * 0.40, 0, 0, Math.PI * 2);
      ctx.fillStyle = look.paddle;
      ctx.fill();
      ctx.restore();
    },
  };

  function spaced(s) { return s.split('').join('\u2009'); }

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
      // predicted bounce marker
      const pr = m.pred && m.pred.landing;
      if (pr && m.ball.live) {
        const q = cam.proj(pr.x, 0.02, pr.z);
        const inb = C.inBounds(pr.x, pr.z);
        ctx.save();
        ctx.strokeStyle = inb ? 'rgba(255,255,255,0.75)' : 'rgba(255,120,110,0.85)';
        ctx.lineWidth = Math.max(1.5, q.s * 0.06);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, q.s * 0.85, q.s * 0.3, 0, 0, Math.PI * 2);
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
        ctx.arc(q.x, q.y, Math.max(0.8, q.s * C.BALL_R * 0.9), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const q = cam.proj(b.x, b.y, b.z);
      const r = Math.max(3.0, q.s * C.BALL_R * 1.5);
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
      const k = Math.max(0.62, Math.min(1.05, rect.w / 900));
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

  Renderer.COL = COL;
  Renderer.Cam = Cam;
  return Renderer;
})();
