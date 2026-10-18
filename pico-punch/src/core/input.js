// Entrada unificada: teclado (remapeável), Gamepad API e toque. Expõe estado "held"/"pressed"/"released".
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'punch', 'pause', 'mode', 'confirm', 'back'];
const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'], punch: ['KeyX', 'KeyK'], pause: ['Escape', 'KeyP', 'Enter'], mode: ['Tab'],
  confirm: ['Enter', 'KeyZ', 'Space'], back: ['Escape', 'KeyX'],
};
// Mapeamento padrão de gamepad (índices do layout "standard").
const PAD_BUTTONS = { jump: [0, 2], punch: [1, 3], pause: [9], mode: [8], confirm: [0], back: [1], up: [12], down: [13], left: [14], right: [15] };

export class Input {
  constructor() {
    this.keys = structuredClone(DEFAULT_KEYS);
    this.held = {}; this.pressed = {}; this.released = {}; this._down = {}; this._prev = {};
    this.touch = {}; this.touchAxis = { x: 0, y: 0 };
    for (const a of ACTIONS) { this.held[a] = false; this.pressed[a] = false; this.released[a] = false; this._down[a] = false; this._prev[a] = false; }
    this.anyKeyTime = 0; this.lastDevice = 'keyboard'; this.remapping = null;
    this.onAnyInput = null; this.padIndex = -1; this.padAxes = { x: 0, y: 0 };
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => { for (const a of ACTIONS) this._down[a] = false; });
    window.addEventListener('gamepadconnected', (e) => { this.padIndex = e.gamepad.index; });
    this.keyDown = Object.create(null);
  }
  loadBindings(saved) { if (saved) for (const a of ACTIONS) if (Array.isArray(saved[a]) && saved[a].length) this.keys[a] = saved[a].slice(); }
  resetBindings() { this.keys = structuredClone(DEFAULT_KEYS); }
  _key(e, down) {
    if (down && this.remapping) { // modo de remapeamento: a próxima tecla vira a 1ª tecla da ação
      if (e.code !== 'Escape') this.keys[this.remapping] = [e.code, ...this.keys[this.remapping].filter((k) => k !== e.code)].slice(0, 2);
      this.remapping = null; e.preventDefault(); return;
    }
    this.keyDown[e.code] = down;
    let used = false;
    for (const a of ACTIONS) if (this.keys[a].includes(e.code)) { used = true; }
    if (used || e.code === 'Tab') { e.preventDefault(); this.lastDevice = 'keyboard'; }
    if (down && this.onAnyInput) this.onAnyInput();
  }
  /** Chamado uma vez por passo fixo. */
  poll() {
    // Teclado
    for (const a of ACTIONS) { let d = false; for (const k of this.keys[a]) if (this.keyDown[k]) { d = true; break; } this._down[a] = d; }
    // Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null; for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.padAxes.x = 0; this.padAxes.y = 0;
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      this.padAxes.x = Math.abs(ax) > 0.35 ? ax : 0; this.padAxes.y = Math.abs(ay) > 0.35 ? ay : 0;
      for (const a of ACTIONS) { const idx = PAD_BUTTONS[a]; if (!idx) continue; for (const i of idx) if (pad.buttons[i] && pad.buttons[i].pressed) { this._down[a] = true; this.lastDevice = 'gamepad'; } }
      if (this.padAxes.x < -0.35) this._down.left = true; if (this.padAxes.x > 0.35) this._down.right = true;
      if (this.padAxes.y < -0.35) this._down.up = true; if (this.padAxes.y > 0.35) this._down.down = true;
      if (this.padAxes.x || this.padAxes.y) this.lastDevice = 'gamepad';
    }
    // Toque
    for (const a of ACTIONS) if (this.touch[a]) { this._down[a] = true; this.lastDevice = 'touch'; }
    if (this.touchAxis.x < -0.3) this._down.left = true; if (this.touchAxis.x > 0.3) this._down.right = true;
    if (this.touchAxis.y < -0.5) this._down.up = true; if (this.touchAxis.y > 0.5) this._down.down = true;
    if (this.touch.jump) this._down.confirm = true; if (this.touch.punch) this._down.back = true;
    for (const a of ACTIONS) {
      this.pressed[a] = this._down[a] && !this._prev[a];
      this.released[a] = !this._down[a] && this._prev[a];
      this.held[a] = this._down[a]; this._prev[a] = this._down[a];
    }
  }
  /** Consome um "pressed" (evita repetir em telas que trocam no mesmo frame). */
  consume(a) { this.pressed[a] = false; }
  axisX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); }
  keyName(code) {
    const names = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'ESPAÇO', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB', ShiftLeft: 'SHIFT' };
    if (names[code]) return names[code]; if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5); return code;
  }
}

/** Controles de toque (DOM). */
export function setupTouch(input) {
  const root = document.getElementById('touch'); if (!root) return;
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  root.classList.add('on');
  for (const el of root.querySelectorAll('.tbtn')) {
    const k = el.dataset.k;
    const on = (e) => { e.preventDefault(); input.touch[k] = true; el.classList.add('pressed'); if (input.onAnyInput) input.onAnyInput(); };
    const off = (e) => { e.preventDefault(); input.touch[k] = false; el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  }
  const pad = document.getElementById('tpad'); const knob = pad.querySelector('.knob');
  let pid = -1;
  const move = (e) => {
    const r = pad.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    input.touchAxis.x = dx; input.touchAxis.y = dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
  };
  pad.addEventListener('pointerdown', (e) => { pid = e.pointerId; pad.setPointerCapture(pid); move(e); if (input.onAnyInput) input.onAnyInput(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
  const end = (e) => { if (e.pointerId !== pid) return; pid = -1; input.touchAxis.x = 0; input.touchAxis.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
}
