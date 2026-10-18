// Emulação opcional do limite de 8 sprites por linha do Master System (sprites de 8×16 em hardware).
// Cada entidade visível ocupa ceil(w/8) "sprites" por faixa de 16 linhas; além do 8º por scanline,
// os excedentes somem naquele frame. A prioridade gira a cada frame para produzir o flicker clássico.
export class SpriteLimiter {
  constructor() { this.frame = 0; this.rows = new Uint8Array(256); }
  apply(views, camX, camY) {
    this.frame++; const rows = this.rows; rows.fill(0);
    const list = []; for (const v of views) { const s = v.sprite; if (!s.visible || !s.renderable) continue; const e = s.entity; if (!e) continue; list.push(v); v.__hidden = false; }
    // ordem de prioridade rotativa (o herói sempre primeiro)
    const n = list.length; const start = this.frame % Math.max(1, n);
    const order = []; for (let i = 0; i < n; i++) order.push(list[(start + i) % n]); order.sort((a, b) => (a.sprite.entity.type === 'hero' ? -1 : b.sprite.entity.type === 'hero' ? 1 : 0));
    for (const v of order) {
      const s = v.sprite; const e = s.entity; const w = v.w || 16, h = v.h || 16; const sx = Math.round(s.x - w / 2 - camX), sy = Math.round(s.y - h - camY);
      if (sy + h < 0 || sy > 192 || sx + w < 0 || sx > 256) continue;
      const cells = Math.ceil(w / 8); let blocked = false;
      for (let y = Math.max(0, sy); y < Math.min(192, sy + h); y++) if (rows[y] + cells > 8) { blocked = true; break; }
      if (blocked) { s.visible = false; v.__hidden = true; continue; }
      for (let y = Math.max(0, sy); y < Math.min(192, sy + h); y++) rows[y] += cells;
    }
  }
}
