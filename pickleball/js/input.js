'use strict';
// Touch model, v2: the screen is split down the middle. The RIGHT side runs,
// the LEFT side strikes. Nothing is read as both, so a stroke never shoves the
// player and a run never fires a shot.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Input = (function () {
  // thumb speed, as a fraction of the viewport height per second, that means
  // "run flat out"; the small dead zone swallows a resting finger's tremor
  const MOVE_FULL = 0.34, MOVE_DEAD = 0.04, MOVE_SMOOTH = 0.045, MOVE_GAIN = 0.72;

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.pointers = {};
      this.swipeFx = [];
      this.serveSlots = { p1: false };
      this.state = { p1: { mx: 0, mz: 0, swipe: null } };
      // the live path under the striking thumb, read by the renderer
      this.strokes = { p1: null };
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

    // The viewport, in canvas pixels. One player, so it is the whole canvas.
    rectFor() {
      return { x: 0, y: 0, w: this.canvas.clientWidth, h: this.canvas.clientHeight };
    }

    // Right half runs, left half strikes.
    roleFor(x) {
      const r = this.rectFor();
      return x < r.x + r.w / 2 ? 'strike' : 'move';
    }

    slotFor() {
      return 'p1';
    }

    local(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    down(e) {
      if (!this.enabled) return;
      e.preventDefault();
      const p = this.local(e);
      const slot = this.slotFor();
      const role = this.roleFor(p.x);
      this.pointers[e.pointerId] = {
        id: e.pointerId, slot, role, x: p.x, y: p.y, x0: p.x, y0: p.y,
        dx: 0, dy: 0, mover: role === 'move', active: true,
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
      if (pt.path) {
        const last = pt.path[pt.path.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) > 2) pt.path.push({ x: p.x, y: p.y });
        if (pt.path.length > 220) pt.path.shift();
        const m = PB.Stroke.measure(pt.path, this.strokeH());
        const st = this.strokes[pt.slot];
        if (st) { st.power = m ? m.power : 0; st.lob = !!(m && m.lob); }
      }
    }

    // Gestures are measured against the height of one player's viewport, so a
    // stroke means the same thing on a phone and on a tablet.
    strokeH() {
      return this.canvas.clientHeight;
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
      // The move thumb only ever moves: a fast drag is a sprint, not a swing,
      // and lifting it after a run never serves. A plain tap, which moved
      // nothing, still sends the gentle serve.
      const tap = Math.hypot(pt.x - pt.x0, pt.y - pt.y0) < 16;
      if (tap && this.serveSlots[pt.slot] && !this.state[pt.slot].swipe) {
        this.state[pt.slot].swipe = { lateral: 0, power: 0.42, lob: false, arc: 0 };
      }
      delete this.pointers[e.pointerId];
    }

    // Called once per frame: turn the thumb's speed into a run speed.
    //
    // The reading is the drag accumulated over the frame, blended with a short
    // memory (about 45 ms) so a 60 Hz touch stream does not stutter and a thumb
    // that stops brings the player to a stop within a few frames. The response
    // is a curve, not a line: strong gain on a slow slide, for the small
    // adjustments beside the ball, and flat out once the thumb moves at
    // MOVE_FULL of the viewport height per second. A calm drag that used to
    // command a quarter of top speed now commands about half of it.
    sample(dt) {
      dt = Math.max(1 / 240, Math.min(0.1, dt || 1 / 60));
      const H = this.canvas.clientHeight;
      const full = H * MOVE_FULL;
      const blend = Math.min(1, dt / MOVE_SMOOTH);
      this.state.p1.mx = 0; this.state.p1.mz = 0;
      const now = performance.now();
      for (const k in this.pointers) {
        const pt = this.pointers[k];
        if (!pt.mover) { pt.dx = 0; pt.dy = 0; continue; }
        if (pt.lock > now) { pt.dx = 0; pt.dy = 0; pt.vx = 0; pt.vy = 0; continue; }
        const rx = pt.dx / dt / full, ry = -pt.dy / dt / full;
        pt.vx = (pt.vx || 0) + (rx - (pt.vx || 0)) * blend;
        pt.vy = (pt.vy || 0) + (ry - (pt.vy || 0)) * blend;
        pt.dx = 0; pt.dy = 0;
        const st = this.state[pt.slot];
        const mag = Math.hypot(pt.vx, pt.vy);
        const out = Input.runCurve(mag);
        if (out > 0) { st.mx = pt.vx / mag * out; st.mz = pt.vy / mag * out; }
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
      this.strokes = { p1: null };
      this.state.p1 = { mx: 0, mz: 0, swipe: null };
    }
  }

  // thumb speed (1 = MOVE_FULL) -> commanded run speed, 0..1
  Input.runCurve = function (mag) {
    if (!(mag > MOVE_DEAD)) return 0;
    return Math.min(1, Math.pow((mag - MOVE_DEAD) / (1 - MOVE_DEAD), MOVE_GAIN));
  };
  Input.MOVE_FULL = MOVE_FULL;
  return Input;
})();
