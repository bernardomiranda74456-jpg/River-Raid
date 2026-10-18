// Entrada: teclado (setas/WASD/Espaço/Esc) e swipe por pointer events.
// O swipe é reconhecido no movimento (sem esperar o pointerup) para não
// haver atraso; toque duplo ativa a prancha.
export class Input {
  constructor(el, handlers) {
    this.h = handlers;
    this.el = el;
    this.active = false;
    this.sx = 0; this.sy = 0; this.sid = -1; this.consumed = false;
    this.lastTap = 0;
    this.threshold = 24;
    this.enabled = true;
    window.addEventListener('keydown', (e) => this.onKey(e));
    el.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    el.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    el.addEventListener('pointerup', (e) => this.onUp(e), { passive: false });
    el.addEventListener('pointercancel', (e) => this.onUp(e), { passive: false });
    el.addEventListener('touchstart', (e) => { if (this.enabled) e.preventDefault(); }, { passive: false });
    el.addEventListener('touchmove', (e) => { if (this.enabled) e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  onKey(e) {
    const h = this.h;
    const k = e.key.toLowerCase();
    if (k === 'escape' || k === 'p') { h.pause(); e.preventDefault(); return; }
    if (!this.enabled) { if (k === 'enter' || k === ' ') { h.confirm(); e.preventDefault(); } return; }
    switch (k) {
      case 'arrowleft': case 'a': h.left(); break;
      case 'arrowright': case 'd': h.right(); break;
      case 'arrowup': case 'w': h.jump(); break;
      case 'arrowdown': case 's': h.roll(); break;
      case ' ': h.board(); break;
      default: return;
    }
    e.preventDefault();
  }
  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.active = true; this.consumed = false; this.sid = e.pointerId;
    this.sx = e.clientX; this.sy = e.clientY;
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }
  onMove(e) {
    if (!this.active || this.consumed || e.pointerId !== this.sid || !this.enabled) return;
    const dx = e.clientX - this.sx, dy = e.clientY - this.sy;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < this.threshold) return;
    this.consumed = true;
    if (ax > ay) { if (dx > 0) this.h.right(); else this.h.left(); } else { if (dy < 0) this.h.jump(); else this.h.roll(); }
  }
  onUp(e) {
    if (e.pointerId !== this.sid) return;
    const wasActive = this.active;
    this.active = false;
    if (!wasActive) return;
    if (!this.consumed) {
      const now = performance.now();
      if (this.enabled) {
        if (now - this.lastTap < 320) { this.h.board(); this.lastTap = 0; } else this.lastTap = now;
      } else this.h.confirm();
    }
  }
}
