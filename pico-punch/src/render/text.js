// Texto bitmap (fonte própria 8×8) para HUD e menus. Glifos brancos com tint.
import { Container, Sprite, Texture, CanvasSource, Rectangle } from 'pixi.js';
import { glyph, FONT_CHARS } from './art/font.js';
import { makeCanvas } from './pixelart.js';

let fontAtlas = null;
function buildFont() {
  const chars = FONT_CHARS; const cols = 16, rows = Math.ceil(chars.length / cols);
  const c = makeCanvas(cols * 8, rows * 8); const ctx = c.getContext('2d'); const img = ctx.createImageData(c.width, c.height);
  const frames = {};
  chars.forEach((ch, i) => {
    const g = glyph(ch); const cx = (i % cols) * 8, cy = Math.floor(i / cols) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (g[y][x] === '#') { const k = ((cy + y) * c.width + cx + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = img.data[k + 3] = 255; }
    frames[ch] = new Rectangle(cx, cy, 8, 8);
  });
  ctx.putImageData(img, 0, 0);
  const source = new CanvasSource({ resource: c, scaleMode: 'nearest' });
  const tex = {}; for (const ch in frames) tex[ch] = new Texture({ source, frame: frames[ch] });
  fontAtlas = { tex, source };
}
export function fontTexture(ch) { if (!fontAtlas) buildFont(); const c = ch.toUpperCase(); return fontAtlas.tex[c] || fontAtlas.tex[ch] || fontAtlas.tex['?']; }

/** Linha de texto bitmap com pool de glifos. */
export class BitmapLine extends Container {
  constructor(text = '', opts = {}) {
    super(); this.glyphs = []; this.tint = opts.tint ?? 0xffffff; this.shadow = opts.shadow ?? false; this.spacing = opts.spacing ?? 8; this.scaleF = opts.scale ?? 1;
    this.shadowGlyphs = []; this.align = opts.align || 'left'; this._text = null; this.setText(text);
  }
  setText(text) {
    if (text === this._text) return; this._text = text;
    const chars = Array.from(text);
    while (this.glyphs.length < chars.length) {
      if (this.shadow) { const s = new Sprite(); s.tint = 0x000000; this.shadowGlyphs.push(s); this.addChild(s); }
      const g = new Sprite(); this.glyphs.push(g); this.addChild(g);
    }
    const total = chars.length * this.spacing * this.scaleF; const x0 = this.align === 'center' ? -total / 2 : this.align === 'right' ? -total : 0;
    for (let i = 0; i < this.glyphs.length; i++) {
      const g = this.glyphs[i]; const sh = this.shadowGlyphs[i];
      if (i < chars.length) {
        g.visible = true; g.texture = fontTexture(chars[i]); g.tint = this.tint; g.x = x0 + i * this.spacing * this.scaleF; g.y = 0; g.scale.set(this.scaleF);
        if (sh) { sh.visible = true; sh.texture = g.texture; sh.x = g.x + this.scaleF; sh.y = this.scaleF; sh.scale.set(this.scaleF); }
      } else { g.visible = false; if (sh) sh.visible = false; }
    }
    this.textWidth = total;
  }
  setTint(t) { this.tint = t; for (const g of this.glyphs) g.tint = t; }
}
