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
      { shirt: '#ffd24a', shirt2: '#e8ac1f', skin: '#c98a5a', shorts: '#182231' },
      { shirt: '#ff5f6d', shirt2: '#d63b53', skin: '#8d5a3b', shorts: '#1d1730' },
    ],
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
      const col = COL.team[p.team];
      const facing = cam.side === p.team ? 1 : -1;   // 1 = seen from behind

      const hipY = base.y - s * 1.85;
      const shoulderY = base.y - s * 3.55;
      const headY = shoulderY - s * 0.42;
      const bw = s * 0.62;

      // active-player ring
      if (p === me) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, s * 1.15, s * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.ctrl === 'human') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, s * 1.05, s * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // legs
      ctx.strokeStyle = col.shorts;
      ctx.lineWidth = Math.max(2, s * 0.2);
      ctx.lineCap = 'round';
      const stride = Math.min(1, Math.hypot(p.vx, p.vz) / 12) * s * 0.42;
      ctx.beginPath();
      ctx.moveTo(base.x - s * 0.16, hipY); ctx.lineTo(base.x - s * 0.2 - stride * 0.5, base.y);
      ctx.moveTo(base.x + s * 0.16, hipY); ctx.lineTo(base.x + s * 0.2 + stride * 0.5, base.y);
      ctx.stroke();

      // torso
      ctx.fillStyle = col.shirt;
      ctx.beginPath();
      ctx.moveTo(base.x - bw * 0.5, hipY);
      ctx.lineTo(base.x + bw * 0.5, hipY);
      ctx.lineTo(base.x + bw * 0.62, shoulderY);
      ctx.lineTo(base.x - bw * 0.62, shoulderY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col.shirt2;
      ctx.fillRect(base.x - bw * 0.5, hipY - s * 0.18, bw, s * 0.18);

      // neck + head
      ctx.fillStyle = col.skin;
      ctx.fillRect(base.x - s * 0.11, shoulderY - s * 0.22, s * 0.22, s * 0.3);
      ctx.beginPath();
      ctx.arc(base.x, headY, s * 0.40, 0, Math.PI * 2);
      ctx.fill();

      // paddle arm
      const swing = Math.max(0, p.swingT) / 0.28;
      const side = (p.swingDir || 1) * facing;
      const ang = -0.5 + swing * 1.9 * side;
      const ax = base.x + Math.cos(ang) * s * 1.05 * side;
      const ay = shoulderY + s * 0.25 - Math.sin(Math.abs(ang)) * s * 0.5;
      ctx.strokeStyle = col.skin;
      ctx.lineWidth = Math.max(1.5, s * 0.14);
      ctx.beginPath();
      ctx.moveTo(base.x + bw * 0.45 * side, shoulderY + s * 0.15);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang * 0.6);
      ctx.fillStyle = '#1d2a3a';
      ctx.beginPath();
      ctx.ellipse(s * 0.22 * side, -s * 0.18, s * 0.34, s * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d5c7a';
      ctx.beginPath();
      ctx.ellipse(s * 0.22 * side, -s * 0.18, s * 0.24, s * 0.33, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // name tag for the far side so you know who is who
      if (p.ctrl === 'human' && p !== me) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = `${Math.max(9, s * 0.5)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.name, base.x, headY - s * 0.6);
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
