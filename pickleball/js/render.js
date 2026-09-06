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
    surround: '#0f5c4a', court: '#2b7fbd', kitchen: '#1a5c8e',
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
  };

  const FENCE_Z = 34, FENCE_H = 10, FENCE_X = 26;

  function Cam(vp, side, focusX) {
    const camY = 20, camZ = -45, aimY = 2.0, aimZ = 8;
    const pitch = Math.atan2(camY - aimY, aimZ - camZ);
    const sin = Math.sin(pitch), cos = Math.cos(pitch);
    const czOf = z => camY * sin + (z - camZ) * cos;
    const vOf = z => -((-camY) * cos + (z - camZ) * sin) / czOf(z);

    // Fit: portrait accepts the near sidelines running off screen (the camera
    // pans with the player), landscape is limited by height instead.
    const portrait = vp.h > vp.w * 1.2;
    const halfNear = C.HALF_W / czOf(-18);
    const span = vOf(-23.5) - vOf(22);
    const focal = Math.min((portrait ? 1.25 : 1.45) * vp.w / (2 * halfNear), 0.74 * vp.h / span);

    this.side = side; this.sin = sin; this.cos = cos; this.focal = focal;
    this.y = camY; this.z = camZ;
    this.x = (side === 1 ? -1 : 1) * focusX * 0.55;
    this.cx = vp.x + vp.w / 2;
    this.cy = vp.y + vp.h * 0.98 - focal * vOf(-23.5);
    this.horizonY = this.cy - focal * (sin / cos);
    this.vp = vp;
  }

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
    shoulderHalf: 0.66, hipHalf: 0.42,
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
      const lean = (p.lean || 0) * (cam.side === 1 ? -1 : 1);
      const bob = Math.abs(Math.sin(ph)) * 0.10 * stride;
      const hipY = BODY.hip - crouch * 1.00 - bob + (p.hop || 0);
      const shY = hipY + (BODY.shoulder - BODY.hip) - crouch * 0.12;

      // how much of the run reads sideways vs into the screen
      const spd = Math.hypot(p.vx, p.vz) || 0.001;
      const latFrac = Math.min(1, Math.abs(p.vx) / spd) * stride;
      const depFrac = Math.min(1, Math.abs(p.vz) / spd) * stride;

      // ── swing phase: -1 loaded, 0 contact, +1 follow through ─────────────
      const swinging = p.swingT > 0;
      const prog = swinging ? 1 - p.swingT / (p.swingDur || 0.42) : 0;
      const coilAmt = swinging ? (prog < 0.32 ? 1 - prog / 0.32 : 0) : (p.prep || 0);
      const kind = p.swingKind || 'ground';
      const fore = p.swingFore !== false;
      const coil = coilAmt * (fore ? 0.55 : -0.42) * hand;

      // shoulders rotate with the coil; a squash sells the turn in 2D
      const shHalf = BODY.shoulderHalf * (0.74 + 0.26 * Math.cos(coil * 1.4));
      const shOff = Math.sin(coil) * 0.34 + lean * 0.55;
      const hipOff = Math.sin(coil) * 0.10 + lean * 0.3;
      const shL = { x: -shHalf + shOff, y: shY };
      const shR = { x: shHalf + shOff, y: shY };
      const hipL = { x: -BODY.hipHalf + hipOff, y: hipY };
      const hipR = { x: BODY.hipHalf + hipOff, y: hipY };

      // ── legs ─────────────────────────────────────────────────────────────
      const stanceHalf = BODY.hipHalf + 0.16 + crouch * 0.26;
      const legs = [];
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const phase = ph + (i === 0 ? Math.PI : 0);
        const sw = Math.sin(phase);
        const lift = Math.max(0, sw) * stride * 0.62;
        const hipJ = side < 0 ? hipL : hipR;
        const footX = side * stanceHalf + sw * latFrac * 1.05 + lean * 0.8;
        const footY = BODY.ankle + lift * (0.30 + depFrac * 0.75);
        const knee = ik(hipJ.x, hipJ.y, footX, footY, BODY.thigh, BODY.shin, side);
        legs.push({ side, hip: hipJ, knee, foot: { x: footX, y: footY }, back: sw < 0 });
      }

      // ── paddle arm ───────────────────────────────────────────────────────
      const hitDX = p.swingHit ? p.swingHit.dx * (cam.side === 1 ? -1 : 1) : 0;
      const hitY = p.swingHit ? p.swingHit.dy : shY - 0.4;
      const ready = { x: hand * 1.16, y: shY - 0.64 };
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
      const elbow = ik(shPad.x, shPad.y, handP.x, handP.y, BODY.upperArm, BODY.foreArm, -hand);

      // free arm counterbalances the gait
      const swA = Math.sin(ph + Math.PI) * stride;
      const freeHand = {
        x: -hand * (0.98 + Math.abs(swA) * 0.30) + swA * latFrac * 0.6 - Math.sin(coil) * 0.5,
        y: shY - 1.10 + swA * 0.34 + coilAmt * 0.5,
      };
      const freeHandR = reachable(shFree, freeHand, armLen);
      const freeElbow = ik(shFree.x, shFree.y, freeHandR.x, freeHandR.y,
                           BODY.upperArm, BODY.foreArm, hand);

      // ── paint, back to front ─────────────────────────────────────────────
      this.shadow(ctx, P, base, s, stanceHalf, isMe, p);

      const backLeg = legs[0].back ? legs[0] : legs[1];
      const frontLeg = backLeg === legs[0] ? legs[1] : legs[0];
      this.leg(ctx, P, backLeg, kit, skinDark, COL.shoe, 0.86);
      this.arm(ctx, P, shFree, freeElbow, freeHandR, kit, skinDark, 0.9);
      this.torso(ctx, P, shL, shR, hipL, hipR, kit);
      this.head(ctx, P, shL, shR, shY, skin, skinDark, look, coil, facing);
      this.leg(ctx, P, frontLeg, kit, skin, COL.shoe, 1);
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
    limb(ctx, P, ax, ay, bx, by, w1, w2, color) {
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
    },

    leg(ctx, P, L, kit, skin, shoeCol, shade) {
      const dim = shade < 1;
      this.limb(ctx, P, L.hip.x, L.hip.y, L.knee.x, L.knee.y, 0.46, 0.30, dim ? kit.shorts2 : kit.shorts);
      this.limb(ctx, P, L.knee.x, L.knee.y, L.foot.x, L.foot.y + 0.06, 0.28, 0.19, skin);
      // sock
      this.limb(ctx, P, L.foot.x, L.foot.y + 0.34, L.foot.x, L.foot.y + 0.12, 0.22, 0.22, '#eef3f7');
      // shoe, pointing the way the player leans
      const toe = L.foot.x + (L.side * 0.06);
      this.limb(ctx, P, L.foot.x, L.foot.y + 0.05, toe, L.foot.y - 0.02, 0.26, 0.30, shoeCol);
      ctx.save();
      ctx.fillStyle = 'rgba(20,30,42,0.55)';
      ctx.beginPath();
      ctx.ellipse(P.X(toe), P.Y(L.foot.y - 0.06), P.s * 0.2, P.s * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    arm(ctx, P, sh, elbow, hand, kit, skin, shade) {
      this.limb(ctx, P, sh.x, sh.y, elbow.x, elbow.y, 0.32, 0.24, skin);
      this.limb(ctx, P, elbow.x, elbow.y, hand.x, hand.y, 0.24, 0.17, skin);
      // short sleeve capping the upper arm
      const t = 0.34;
      this.limb(ctx, P, sh.x * 0.86, sh.y - 0.02,
                sh.x + (elbow.x - sh.x) * t, sh.y + (elbow.y - sh.y) * t,
                0.34, 0.27, shade < 1 ? kit.shirt2 : kit.shirt);
      // hand
      ctx.beginPath();
      ctx.arc(P.X(hand.x), P.Y(hand.y), Math.max(1, P.s * 0.115), 0, Math.PI * 2);
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
      const headY = shY + (BODY.head - BODY.shoulder) - 0.14;
      const R = BODY.headR;
      this.limb(ctx, P, cx, shY - 0.06, cx, headY - R * 0.55, 0.30, 0.26, skinDark);
      ctx.beginPath();
      ctx.ellipse(P.X(cx), P.Y(headY), P.s * R * 0.92, P.s * R, 0, 0, Math.PI * 2);
      ctx.fillStyle = skin;
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
      this.drawHud(ctx, m);
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

    drawFence(ctx, cam) {
      const F = cam.side === 1 ? -1 : 1;
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
      // side fences first, then the back wall
      const FZ = FENCE_Z * F;
      for (const sx of [-FENCE_X, FENCE_X]) {
        mesh([[sx, 0, -30 * F], [sx, FENCE_H, -30 * F], [sx, FENCE_H, FZ], [sx, 0, FZ]], 'rgba(16,32,42,0.55)');
      }
      mesh([[-FENCE_X, 0, FZ], [-FENCE_X, FENCE_H, FZ], [FENCE_X, FENCE_H, FZ], [FENCE_X, 0, FZ]], 'rgba(14,28,38,0.72)');
      // fence mesh lines + a sponsor band, the thing that reads as "a real venue"
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -FENCE_X; i <= FENCE_X; i += 3) {
        const a = cam.proj(i, 0, FZ), b = cam.proj(i, FENCE_H, FZ);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      for (let hgt = 1; hgt < FENCE_H; hgt += 2) {
        const a = cam.proj(-FENCE_X, hgt, FZ), b = cam.proj(FENCE_X, hgt, FZ);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      const bz = FZ - 0.05 * F;
      mesh([[-FENCE_X, 2.2, bz], [-FENCE_X, 4.6, bz], [FENCE_X, 4.6, bz], [FENCE_X, 2.2, bz]], 'rgba(20,90,120,0.85)');
      const a = cam.proj(0, 3.4, bz - 0.01 * F);
      ctx.save();
      ctx.font = `700 ${Math.max(7, a.s * 0.9)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('P I C K L E B A L L', a.x, a.y + a.s * 0.3);
      ctx.restore();
    }

    // Grandstand and light towers, drawn in world space so they sit correctly
    // behind the fence in every viewport shape.
    drawStands(ctx, cam) {
      const Z = 41 * (cam.side === 1 ? -1 : 1), X = 52, H = 21;
      const poly = (pts, fill) => {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p = cam.proj(pts[i][0], pts[i][1], pts[i][2]);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      // seating block
      poly([[-X, 0, Z], [-X, H, Z], [X, H, Z], [X, 0, Z]], '#152535');
      const rows = 9;
      for (let i = 0; i < rows; i++) {
        const y0 = 2 + (i * (H - 3)) / rows;
        const y1 = y0 + (H - 3) / rows - 0.45;
        poly([[-X, y0, Z], [-X, y1, Z], [X, y1, Z], [X, y0, Z]], i % 2 ? '#1b2f42' : '#16283a');
        // crowd
        const seen = cam.proj(0, y0, Z);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(216,231,242,0.20)' : 'rgba(255,208,120,0.16)';
        for (let k = -26; k <= 26; k += 1.6) {
          const q = cam.proj(k + (i % 2) * 0.7, y0 + 0.55, Z);
          const rr = Math.max(0.8, q.s * 0.36);
          ctx.fillRect(q.x - rr / 2, q.y - rr, rr, rr);
        }
        void seen;
      }
      poly([[-X, H, Z], [-X, H + 2.4, Z], [X, H + 2.4, Z], [X, H, Z]], '#0e1a26');

      // floodlights
      for (const px of [-23, 23]) {
        const zz = Z + (Z < 0 ? 4 : -4);
        const base = cam.proj(px, 0, zz), top = cam.proj(px, 32, zz);
        ctx.strokeStyle = '#1a2a3a';
        ctx.lineWidth = Math.max(2, base.s * 0.5);
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
        const lamp = cam.proj(px, 33.5, zz);
        const r = Math.max(6, lamp.s * 4.5);
        const glow = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, r);
        glow.addColorStop(0, 'rgba(255,246,214,0.55)');
        glow.addColorStop(1, 'rgba(255,246,214,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(lamp.x, lamp.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fdf3cd';
        ctx.fillRect(lamp.x - r * 0.28, lamp.y - r * 0.16, r * 0.56, r * 0.3);
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
      if (m.state === 'ready' && me && m.players[m.serverIdx] === me) {
        this.centerText(ctx, r, 'DESLIZE PARA SACAR', r.y + r.h * 0.62, 15, 'rgba(255,255,255,0.92)');
        this.centerText(ctx, r, 'curto = curto  •  longo = fundo', r.y + r.h * 0.62 + 18, 11, 'rgba(255,255,255,0.6)');
      } else if (m.state === 'ready' && me && m.players[m.receiverIdx] === me) {
        this.centerText(ctx, r, 'DEIXE O SAQUE QUICAR', r.y + r.h * 0.62, 13, 'rgba(255,255,255,0.7)');
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

    drawHud(ctx, m) {
      const w = this.w;
      const boxW = 168, boxH = 44;
      const x = w / 2 - boxW / 2;
      // in split screen the scoreboard sits on the seam so both players read it
      const y = m.versus ? Math.round(this.h / 2 - boxH / 2) : 10;
      ctx.save();
      ctx.fillStyle = 'rgba(8,14,22,0.78)';
      this.roundRect(ctx, x, y, boxW, boxH, 10);
      ctx.fill();

      const s = m.servingTeam;
      ctx.font = '700 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(m.scoreText(), x + boxW / 2, y + 27);
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillStyle = COL.team[s].shirt;
      ctx.fillText('SACA  ' + (s === 0 ? 'TIME 1' : 'TIME 2'), x + boxW / 2, y + 39);
      ctx.restore();
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
