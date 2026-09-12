'use strict';
// Touch model, v2: the screen is split down the middle for each player. The
// RIGHT side runs, the LEFT side strikes. Nothing is read as both, so a stroke
// never shoves the player and a run never fires a shot.
//
// Two humans sharing one screen cannot use that split, because there the two
// halves are already the two players. That mode keeps the v1 model: the first
// finger in a half runs, any finger flicks.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Input = (function () {
  const SAMPLE_MS = 150;

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.pointers = {};
      this.swipeFx = [];
      this.split = false;
      this.coop = false;
      this.coopFlip = false;
      this.serveSlots = { p1: false, p2: false };
      this.state = {
        p1: { mx: 0, mz: 0, swipe: null },
        p2: { mx: 0, mz: 0, swipe: null },
      };
      // the live path under the striking thumb, read by the renderer
      this.strokes = { p1: null, p2: null };
      this.enabled = true;
      this.bind();
    }

    bind() {
      const c = this.canvas;
      const opt = { passive: false };
      c.addEventListener('pointerdown', e => this.down(e), opt);
      c.addEventListener('pointermove', e => this.move(e), opt);
      c.addEventListener('pointerup', e => this.up(e), opt);
      c.addEventListener('pointercancel', e => this.up(e), opt);
      c.addEventListener('touchstart', e => e.preventDefault(), opt);
      c.addEventListener('touchmove', e => e.preventDefault(), opt);
      c.addEventListener('contextmenu', e => e.preventDefault());
      // keyboard fallback so the game is playable on a desktop too
      this.keys = {};
      window.addEventListener('keydown', e => {
        if (!this.enabled) return;              // menus own the keyboard
        this.keys[e.code] = true;
        if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) e.preventDefault();
        if (e.code === 'Space') this.kbSwipe('p1', 0, 0.58);          // rebatida funda
        if (e.code === 'KeyQ') this.kbSwipe('p1', -0.7, 0.5);
        if (e.code === 'KeyE') this.kbSwipe('p1', 0.7, 0.5);
        if (e.code === 'KeyS') this.kbSwipe('p1', 0, 0.12);            // bola curta
        if (e.code === 'KeyW') this.kbSwipe('p1', 0, 0.6, true);       // lob
      });
      window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    }

    kbSwipe(slot, lateral, power, lob) {
      this.state[slot].swipe = { lateral, power, lob: !!lob, arc: lob ? 0.4 : 0 };
    }

    // Which viewport belongs to this slot, in canvas pixels.
    rectFor(slot) {
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (this.split) return { x: 0, y: slot === 'p2' ? 0 : h / 2, w, h: h / 2 };
      if (this.coop) {
        const leftIsP1 = !this.coopFlip;
        const left = (slot === 'p1') === leftIsP1;
        return { x: left ? 0 : w / 2, y: 0, w: w / 2, h };
      }
      return { x: 0, y: 0, w, h };
    }

    // Right half runs, left half strikes. Shared-screen co-op has no room for
    // the split, so there every finger keeps the old double duty.
    roleFor(x, slot) {
      if (this.coop) return null;
      const r = this.rectFor(slot);
      return x < r.x + r.w / 2 ? 'strike' : 'move';
    }

    // Split screen: top half is P2. Shared screen with two humans on the same
    // team: each half of the screen drives the partner standing on that side,
    // and the mapping follows them when they switch courts after a point.
    slotFor(x, y) {
      if (this.split) return y < this.canvas.clientHeight / 2 ? 'p2' : 'p1';
      if (!this.coop) return 'p1';
      const left = x < this.canvas.clientWidth / 2;
      return left === !!this.coopFlip ? 'p1' : 'p2';
    }

    local(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    down(e) {
      if (!this.enabled) return;
      e.preventDefault();
      const p = this.local(e);
      const slot = this.slotFor(p.x, p.y);
      const role = this.roleFor(p.x, slot);
      // co-op falls back to the old rule: the first finger in a half runs
      const owner = Object.keys(this.pointers).some(k => this.pointers[k].slot === slot && this.pointers[k].mover);
      const mover = role ? role === 'move' : !owner;
      this.pointers[e.pointerId] = {
        id: e.pointerId, slot, role, x: p.x, y: p.y, x0: p.x, y0: p.y,
        dx: 0, dy: 0, mover, active: true,
        samples: [{ t: performance.now(), x: p.x, y: p.y }],
        path: role === 'strike' ? [{ x: p.x, y: p.y }] : null,
        lock: 0,
      };
      if (role === 'strike') this.strokes[slot] = { pts: this.pointers[e.pointerId].path, power: 0 };
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    move(e) {
      const pt = this.pointers[e.pointerId];
      if (!pt || !this.enabled) return;
      e.preventDefault();
      const p = this.local(e);
      pt.dx += p.x - pt.x;
      pt.dy += p.y - pt.y;
      pt.x = p.x; pt.y = p.y;
      const now = performance.now();
      pt.samples.push({ t: now, x: p.x, y: p.y });
      while (pt.samples.length > 2 && now - pt.samples[0].t > SAMPLE_MS) pt.samples.shift();
      if (pt.path) {
        const last = pt.path[pt.path.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) > 2) pt.path.push({ x: p.x, y: p.y });
        if (pt.path.length > 220) pt.path.shift();
        const m = PB.Stroke.measure(pt.path, this.strokeH());
        const st = this.strokes[pt.slot];
        if (st) { st.power = m ? m.power : 0; st.lob = !!(m && m.lob); }
      } else {
        this.detectSwipe(pt, now);
      }
    }

    // Gestures are measured against the height of one player's viewport, so a
    // stroke means the same thing on a phone, a tablet and a split screen.
    strokeH() {
      return this.canvas.clientHeight * (this.split ? 0.5 : 1);
    }

    up(e) {
      const pt = this.pointers[e.pointerId];
      if (!pt) return;
      if (pt.path) {
        // The stroke reads on release: the whole path is the gesture, and only
        // then is its power and its bow settled.
        const m = PB.Stroke.measure(pt.path, this.strokeH());
        if (m && (m.up > 0 || m.lob)) {
          this.state[pt.slot].swipe = {
            lateral: m.lateral, power: m.power, lob: m.lob, arc: m.arc,
          };
          this.swipeFx.push({ pts: pt.path.slice(), power: m.power, life: 1 });
        } else if (this.serveSlots[pt.slot]) {
          // a plain tap still serves, gently, down the middle
          this.state[pt.slot].swipe = { lateral: 0, power: 0.42, lob: false, arc: 0 };
        }
        this.strokes[pt.slot] = null;
        delete this.pointers[e.pointerId];
        return;
      }
      this.detectSwipe(pt, performance.now(), true);
      // A serve is not a timed shot, so a deliberate stroke or a plain tap both
      // send it, at whatever power the stroke carried.
      if (this.serveSlots[pt.slot] && !this.state[pt.slot].swipe) {
        const dx = pt.x - pt.x0, dy = pt.y - pt.y0;
        const H = this.strokeH();
        const len = Math.hypot(dx, dy);
        if (-dy > H * 0.02 || len < 16) {
          this.state[pt.slot].swipe = {
            lateral: Math.max(-1, Math.min(1, dx / (H * PB.Stroke.SIDE))),
            power: Math.max(0.3, Math.min(1.15, len / (H * PB.Stroke.FULL))),
            lob: false, arc: 0,
          };
        }
      }
      delete this.pointers[e.pointerId];
    }

    // Co-op on a shared screen only: one finger does both jobs, so the swing is
    // still read from a speed spike. Power and direction follow the same scale
    // as the two-thumb stroke, and a slow long flick stands in for the arc.
    detectSwipe(pt, now, release) {
      if (pt.lock > now) return;
      const s0 = pt.samples[0];
      if (!s0) return;
      const dt = Math.max(0.016, (now - s0.t) / 1000);
      const dx = pt.x - s0.x, dy = pt.y - s0.y;
      const len = Math.hypot(dx, dy);
      const H = this.strokeH();
      const speed = len / dt / H;
      if (-dy < H * 0.055) return;
      if (speed < 0.75 && !(release && len > H * 0.16)) return;

      const S = PB.Stroke;
      this.state[pt.slot].swipe = {
        lateral: Math.max(-1, Math.min(1, dx / (H * S.SIDE))),
        power: Math.max(0, Math.min(1.15, len / (H * S.FULL))),
        lob: speed < 1.75 && len > H * 0.19,
        arc: 0,
      };
      this.swipeFx.push({
        pts: [{ x: s0.x, y: s0.y }, { x: pt.x, y: pt.y }],
        power: Math.max(0, Math.min(1.15, len / (H * S.FULL))),
        life: 1,
      });
      pt.lock = now + 260;
      pt.dx = 0; pt.dy = 0;
      pt.samples = [{ t: now, x: pt.x, y: pt.y }];
    }

    // Called once per frame: turn accumulated drag into a movement vector.
    sample(dt) {
      const H = this.canvas.clientHeight * (this.split ? 0.5 : 1);
      const full = H * 0.5;                        // px/s that means "run flat out"
      for (const slot of ['p1', 'p2']) { this.state[slot].mx = 0; this.state[slot].mz = 0; }
      const now = performance.now();
      for (const k in this.pointers) {
        const pt = this.pointers[k];
        if (!pt.mover) { pt.dx = 0; pt.dy = 0; continue; }
        if (pt.lock > now) { pt.dx = 0; pt.dy = 0; continue; }
        const st = this.state[pt.slot];
        st.mx = Math.max(-1, Math.min(1, pt.dx / dt / full));
        st.mz = Math.max(-1, Math.min(1, -pt.dy / dt / full));
        pt.dx = 0; pt.dy = 0;
      }
      // keyboard
      const k = this.keys || {};
      let kx = 0, kz = 0;
      if (k.ArrowLeft) kx -= 1;
      if (k.ArrowRight) kx += 1;
      if (k.ArrowUp) kz += 1;
      if (k.ArrowDown) kz -= 1;
      if (kx || kz) { this.state.p1.mx = kx; this.state.p1.mz = kz; }

      for (let i = this.swipeFx.length - 1; i >= 0; i--) {
        this.swipeFx[i].life -= dt * 3;
        if (this.swipeFx[i].life <= 0) this.swipeFx.splice(i, 1);
      }
      return this.state;
    }

    reset() {
      this.pointers = {};
      this.swipeFx.length = 0;
      this.strokes = { p1: null, p2: null };
      this.state.p1 = { mx: 0, mz: 0, swipe: null };
      this.state.p2 = { mx: 0, mz: 0, swipe: null };
    }
  }

  return Input;
})();
