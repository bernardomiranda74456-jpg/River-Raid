// Preenchimentos de painel fiéis a cada modo.
// HD: cantos arredondados e transparência real. Retrô: o Master System não mistura cores, então painéis
// são opacos (cor da paleta SMS) e "transparências" viram malha xadrez de 1 px ou cintilação (flicker).
import { Graphics, Texture, TilingSprite } from 'pixi.js';
import { makeCanvas } from '../render/pixelart.js';

/** Aproxima uma cor 0xRRGGBB para a paleta de 64 cores do SMS (2 bits por canal). */
export const smsColor = (c) => { const q = (v) => Math.round(v / 85) * 85; return (q((c >> 16) & 255) << 16) | (q((c >> 8) & 255) << 8) | q(c & 255); };

/** Desenha um painel em `g`: HD = roundRect translúcido; retrô = retângulo opaco em cor SMS. */
export function panelRect(game, g, x, y, w, h, { color = 0x0a0a1a, alpha = 0.9, radius = 4, stroke = 0x5a5a9a } = {}) {
  if (game.mode === 'retro') { g.rect(x, y, w, h).fill({ color: smsColor(color) }); if (stroke != null) g.rect(x + 0.5, y + 0.5, w - 1, h - 1).stroke({ color: smsColor(stroke), width: 1 }); }
  else { g.roundRect(x, y, w, h, radius).fill({ color, alpha }); if (stroke != null) g.roundRect(x, y, w, h, radius).stroke({ color: stroke, width: 1 }); }
  return g;
}

const meshTex = new Map();
/** Textura 2×2 xadrez (malha) na cor dada — a "transparência de 50%" dos jogos de 8 bits. */
function meshTexture(color) {
  const key = color; if (meshTex.has(key)) return meshTex.get(key);
  const c = makeCanvas(2, 2); const ctx = c.getContext('2d'); ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
  const t = Texture.from(c); t.source.scaleMode = 'nearest'; t.source.addressMode = 'repeat'; meshTex.set(key, t); return t;
}

/** Véu sobre a tela/área: HD = retângulo com alpha; retrô = opaco (alpha ≥ 0.8) ou malha xadrez. Retorna o display object. */
export function dimRect(game, x, y, w, h, { color = 0x0a0a1a, alpha = 0.9 } = {}) {
  if (game.mode !== 'retro') { const g = new Graphics(); g.rect(x, y, w, h).fill({ color, alpha }); return g; }
  if (alpha >= 0.8) { const g = new Graphics(); g.rect(x, y, w, h).fill({ color: smsColor(color) }); return g; }
  const s = new TilingSprite({ texture: meshTexture(smsColor(color)), width: w, height: h }); s.x = x; s.y = y; return s;
}

/** Esmaecer um sprite: HD = alpha; retrô = cintilação (visível em metade dos quadros) com alpha 1. */
export function fadeSprite(game, s, alpha, t) {
  if (game.mode !== 'retro') { s.alpha = alpha; s.visible = true; return; }
  s.alpha = 1; s.visible = alpha >= 1 ? true : Math.floor(t * 30) % 2 === 0;
}
