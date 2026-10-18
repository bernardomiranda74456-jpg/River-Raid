// Entidade base: AABB (x,y,w,h), velocidade, dica de render (art/frame/flip/offset).
let nextId = 1;
export class Entity {
  constructor(type, x, y, w, h) {
    this.id = nextId++; this.type = type;
    this.x = x; this.y = y; this.w = w; this.h = h; this.px = x; this.py = y; // px/py: posição anterior (interpolação)
    this.vx = 0; this.vy = 0; this.onGround = false; this.dir = 1; this.dead = false; this.remove = false;
    this.art = type; this.frame = 'f0'; this.flip = false; this.ox = 0; this.oy = 0; this.visible = true; this.layer = 'mid';
    this.hurtsHero = false; this.punchable = false; this.solidToHero = false; this.timer = 0; this.anim = 0;
    this.light = null; // {r,g,b,radius,intensity,flicker} para o modo HD
    this.shadow = true; this.scaleX = 1; this.scaleY = 1; this.rotation = 0; this.alpha = 1; this.hitFlash = 0;
  }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; } get right() { return this.x + this.w; }
  overlaps(o) { return this.x < o.x + o.w && this.x + this.w > o.x && this.y < o.y + o.h && this.y + this.h > o.y; }
  overlapsRect(x, y, w, h) { return this.x < x + w && this.x + this.w > x && this.y < y + h && this.y + this.h > y; }
  savePrev() { this.px = this.x; this.py = this.y; }
  update(dt, level) {}
  /** Chamado quando o soco acerta; retorna true se consumiu o golpe. */
  onPunch(level, hero) { return false; }
  onHeroTouch(level, hero) {}
}
