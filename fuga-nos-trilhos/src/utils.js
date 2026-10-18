// Utilitários gerais: RNG com seed, easing, pool genérico e helpers sem alocação.

/** RNG determinístico (mulberry32). */
export class RNG {
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
/** Aproximação exponencial independente de frame rate. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const hash1 = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

/**
 * Pool genérico de objetos. `factory()` cria um novo item, `reset(item)` é
 * chamado ao adquirir. Pré-aqueça com `warm(n)` durante o carregamento para que
 * nenhuma alocação aconteça no loop de jogo.
 */
export class Pool {
  constructor(factory, reset = null) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.created = 0;
  }
  warm(n) { for (let i = 0; i < n; i++) { this.free.push(this.factory()); this.created++; } }
  acquire() {
    let item;
    if (this.free.length) item = this.free.pop();
    else { item = this.factory(); this.created++; }
    if (this.reset) this.reset(item);
    return item;
  }
  release(item) { this.free.push(item); }
  /** Retira um item aleatório da lista livre (variação visual entre props pooled). */
  acquireRandom(rng) {
    if (!this.free.length) return this.acquire();
    const i = Math.floor(rng.next() * this.free.length);
    const item = this.free[i];
    this.free[i] = this.free[this.free.length - 1];
    this.free.pop();
    if (this.reset) this.reset(item);
    return item;
  }
}

/** Lista "swap-remove" sem alocação para iterar e remover itens ativos. */
export class ActiveList {
  constructor() { this.items = []; this.n = 0; }
  add(item) { if (this.n < this.items.length) this.items[this.n] = item; else this.items.push(item); this.n++; }
  removeAt(i) { this.n--; this.items[i] = this.items[this.n]; this.items[this.n] = null; }
  clear() { for (let i = 0; i < this.n; i++) this.items[i] = null; this.n = 0; }
}

export function formatNumber(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

export function urlParams() {
  const p = {};
  try { new URLSearchParams(location.search).forEach((v, k) => { p[k] = v; }); } catch (e) { /* noop */ }
  return p;
}
