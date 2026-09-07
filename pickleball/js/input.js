'use strict';
// Touch model: drag anywhere to move your player, flick to strike.
// A stroke is continuously read as movement; when its speed spikes upward it is
// also read as a swing, so one thumb can do both and a second finger can flick
// while the first keeps running.
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
        if (e.code === 'Space') this.kbSwipe('p1', 0, 0.65, true, true);
        if (e.code === 'KeyQ') this.kbSwipe('p1', -0.7, 0.4, false, false);
        if (e.code === 'KeyE') this.kbSwipe('p1', 0.7, 0.4, false, false);
        if (e.code === 'KeyW') this.kbSwipe('p1', 0, 0.9, false, true);
      });
      window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    }

    kbSwipe(slot, lateral, depth, fast, long) {
      this.state[slot].swipe = { lateral, depth, fast, long, power: fast ? 0.95 : 0.6 };
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
      const owner = Object.keys(this.pointers).some(k => this.pointers[k].slot === slot && this.pointers[k].mover);
      this.pointers[e.pointerId] = {
        id: e.pointerId, slot, x: p.x, y: p.y, x0: p.x, y0: p.y,
        dx: 0, dy: 0, mover: !owner, active: true,
        samples: [{ t: performance.now(), x: p.x, y: p.y }],
        lock: 0,
      };
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
      this.detectSwipe(pt, now);
    }

    up(e) {
      const pt = this.pointers[e.pointerId];
      if (!pt) return;
      this.detectSwipe(pt, performance.now(), true);
      // The serve is not a timed shot, so it must not demand a fast flick: any
      // deliberate upward stroke sends it, and a plain tap serves down the middle.
      if (this.serveSlots[pt.slot] && !this.state[pt.slot].swipe) {
        const dx = pt.x - pt.x0, dy = pt.y - pt.y0;
        const H = this.canvas.clientHeight * (this.split ? 0.5 : 1);
        const len = Math.hypot(dx, dy);
        if (-dy > H * 0.02 || len < 16) {
          const reach = Math.max(len, H * 0.18);
          this.state[pt.slot].swipe = {
            lateral: Math.max(-1, Math.min(1, dx / Math.max(Math.abs(dy), 1) / 1.4)),
            depth: Math.max(0, Math.min(1, (reach / H - 0.05) / 0.30)),
            fast: false, long: true, power: 0.7,
          };
        }
      }
      delete this.pointers[e.pointerId];
    }

    detectSwipe(pt, now, release) {
      if (pt.lock > now) return;
      const s0 = pt.samples[0];
      if (!s0) return;
      const dt = Math.max(0.016, (now - s0.t) / 1000);
      const dx = pt.x - s0.x, dy = pt.y - s0.y;
      const len = Math.hypot(dx, dy);
      const H = this.canvas.clientHeight * (this.split ? 0.5 : 1);
      const speed = len / dt / H;                  // screen heights per second
      const upward = -dy;
      if (upward < H * 0.055) return;              // must travel toward the net
      if (speed < 0.75 && !(release && len > H * 0.16)) return;

      const long = len > H * 0.19;
      const fast = speed > 1.75;
      const lateral = Math.max(-1, Math.min(1, dx / Math.max(Math.abs(dy), 1) / 1.4));
      const depth = Math.max(0, Math.min(1, (len / H - 0.05) / 0.30));
      this.state[pt.slot].swipe = {
        lateral, depth, fast, long,
        power: Math.max(0.25, Math.min(1, speed / 2.6)),
      };
      this.swipeFx.push({ x0: s0.x, y0: s0.y, x1: pt.x, y1: pt.y, life: 1 });
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
      this.state.p1 = { mx: 0, mz: 0, swipe: null };
      this.state.p2 = { mx: 0, mz: 0, swipe: null };
    }
  }

  return Input;
})();
