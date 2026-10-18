/**
 * Unified input: keyboard, mouse look (pointer lock), Gamepad API, and touch.
 * Produces a normalized state read by the game every physics step.
 */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };      // -1..1, x = strafe, y = forward
    this.look = { x: 0, y: 0 };      // accumulated mouse delta since last read
    this.jump = false; this.jumpPressed = false;
    this.dive = false; this.divePressed = false;
    this.pausePressed = false;
    this.anyPressed = false;
    this.pointerLocked = false;
    this.touch = { active: false, x: 0, y: 0, jump: false, dive: false, lookId: -1, lastX: 0, lastY: 0 };
    this.gamepadIndex = -1;
    this._prevButtons = [];
    this.enabled = true;
    this.sensitivity = 1;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.anyPressed = true;
      if (e.code === 'Space') { this.jumpPressed = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') this.divePressed = true;
      if (e.code === 'Escape') this.pausePressed = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.look.x += e.movementX; this.look.y += e.movementY;
    });
    canvas.addEventListener('mousedown', () => { this.anyPressed = true; });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === canvas; });

    // touch: look by dragging on the right half of the screen (outside UI)
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (this.touch.lookId === -1 && t.clientX > window.innerWidth * 0.4) { this.touch.lookId = t.identifier; this.touch.lastX = t.clientX; this.touch.lastY = t.clientY; }
      }
      this.anyPressed = true;
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.lookId) {
          this.look.x += (t.clientX - this.touch.lastX) * 2.2; this.look.y += (t.clientY - this.touch.lastY) * 2.2;
          this.touch.lastX = t.clientX; this.touch.lastY = t.clientY;
        }
      }
    }, { passive: true });
    const endTouch = (e) => { for (const t of e.changedTouches) if (t.identifier === this.touch.lookId) this.touch.lookId = -1; };
    canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);

    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = -1; });
  }

  requestPointerLock() {
    if (this.pointerLocked || this.touch.active) return;
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
  exitPointerLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  /** Poll all devices and return the current frame's state. Pressed flags are consumed. */
  poll() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    let jump = this.keys.has('Space');
    let dive = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyE');

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (pad) {
      const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
      const gx = dz(pad.axes[0] || 0), gy = -dz(pad.axes[1] || 0);
      if (Math.abs(gx) > 0 || Math.abs(gy) > 0) { x = gx; y = gy; }
      const rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
      this.look.x += rx * 14; this.look.y += ry * 14;
      const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const prev = this._prevButtons;
      if (b(0)) { jump = true; if (!prev[0]) this.jumpPressed = true; }
      if (b(2) || b(1)) { dive = true; if (!prev[2] && !prev[1]) this.divePressed = true; }
      if (b(9) && !prev[9]) this.pausePressed = true;
      if (b(0) || b(9)) this.anyPressed = true;
      this._prevButtons = pad.buttons.map((bt) => bt.pressed);
    }

    // touch
    if (this.touch.active) {
      x = this.touch.x; y = this.touch.y;
      if (this.touch.jump) { jump = true; }
      if (this.touch.dive) { dive = true; }
    }

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.move.x = x; this.move.y = y;
    this.jump = jump; this.dive = dive;
    const out = {
      move: this.move, jump, dive, jumpPressed: this.jumpPressed, divePressed: this.divePressed,
      pausePressed: this.pausePressed, lookX: this.look.x * this.sensitivity, lookY: this.look.y * this.sensitivity, anyPressed: this.anyPressed,
    };
    this.jumpPressed = false; this.divePressed = false; this.pausePressed = false; this.anyPressed = false;
    this.look.x = 0; this.look.y = 0;
    return out;
  }
}
