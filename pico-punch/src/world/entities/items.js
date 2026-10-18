// Itens coletáveis, marcadores (bandeira, checkpoint, loja), efeitos visuais e projéteis.
import { Entity } from './entity.js';
import { moveBody, GRAVITY, MAX_FALL } from '../physics.js';
import { isSolidType } from '../tilemap.js';
import { rng } from '../../core/math.js';

export class Pickup extends Entity {
  constructor(type, x, y, popUp = false) {
    super(type, x, y, 12, 12); this.ox = -2; this.oy = -3; this.layer = 'mid'; this.punchable = false;
    if (popUp) { this.vy = -170; this.vx = 0; this.popping = true; } this.bob = rng.next() * 6; this.lifeT = 0; this.collectable = !popUp;
    this.light = type === 'moneybag' || type === 'bigbag' ? { r: 1, g: 0.85, b: 0.3, radius: 20, intensity: 0.35 } : { r: 1, g: 0.6, b: 0.6, radius: 20, intensity: 0.3 };
  }
  update(dt, level) {
    this.anim += dt; this.lifeT += dt; if (this.lifeT > 0.25) this.collectable = true;
    if (this.popping) { this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL); moveBody(this, level.map, dt); if (this.onGround) { this.popping = false; this.vx = 0; } }
    else { this.frame = this.type === 'moneybag' ? (Math.floor(this.anim * 3) % 2 ? 'f1' : 'f0') : 'f0'; this.oy = -3 + Math.round(Math.sin(this.anim * 3 + this.bob) * 1.5); }
    if (this.y > level.map.pixelH + 20) this.remove = true;
  }
  onHeroTouch(level, hero) {
    if (!this.collectable) return;
    this.remove = true;
    switch (this.type) {
      case 'moneybag': level.addMoney(10); level.sfx('money'); level.fx.sparkle(this.cx, this.cy, 6); level.floatText('+10', this.cx, this.y); break;
      case 'bigbag': level.addMoney(50); level.sfx('money'); level.fx.sparkle(this.cx, this.cy, 10); level.floatText('+50', this.cx, this.y); break;
      case 'heart': level.addLife(); level.sfx('oneUp'); level.floatText('1UP', this.cx, this.y); break;
      case 'star': level.addScore(500); level.sfx('item'); level.floatText('500', this.cx, this.y); break;
      case 'capsule': hero.items.capsule = 10; level.sfx('item'); level.floatText('INVENCÍVEL', this.cx, this.y); break;
      case 'moto': case 'heli': case 'boat': level.mountVehicle(this.type); break;
      default: level.giveItem(this.type); level.sfx('item'); break;
    }
  }
}

export class Flag extends Entity {
  constructor(x, y) { super('flag', x, y, 10, 32); this.ox = -2; this.oy = 0; this.punchable = false; this.layer = 'back'; this.shadow = false; }
  update(dt, level) { this.anim += dt; this.frame = Math.floor(this.anim * 4) % 2 ? 'f1' : 'f0'; }
  onHeroTouch(level, hero) { level.reachGoal(); }
}

export class Checkpoint extends Entity {
  constructor(x, y) { super('bell', x, y, 12, 14); this.ox = -2; this.oy = -2; this.frame = 'off'; this.on = false; this.shadow = false; this.layer = 'back'; }
  update(dt, level) { this.anim += dt; if (this.on) { this.light = { r: 1, g: 0.9, b: 0.4, radius: 26, intensity: 0.6 }; this.rotation = Math.sin(this.anim * 12) * Math.max(0, 0.3 - (this.anim - this.onT) * 0.15); } }
  onHeroTouch(level, hero) { if (this.on) return; this.on = true; this.onT = this.anim; this.frame = 'on'; level.setCheckpoint(this.x - 8, this.y + this.h - 22); level.sfx('checkpoint'); level.floatText('CHECKPOINT', this.cx, this.y - 6); level.fx.sparkle(this.cx, this.cy, 8); }
}

export class ShopDoor extends Entity {
  constructor(x, y) { super('shop', x, y, 32, 32); this.ox = 0; this.oy = 0; this.layer = 'back'; this.shadow = false; this.light = { r: 1, g: 0.75, b: 0.35, radius: 44, intensity: 0.7, flicker: 0.2 }; this.cool = 0; }
  update(dt, level) { if (this.cool > 0) this.cool -= dt; }
  onHeroTouch(level, hero) { if (this.cool > 0) return; if (level.input.pressed.up && hero.onGround) { this.cool = 1.5; level.openShop(this); } }
}

/** Efeito temporário (pop, cacos de bloco). */
export class Effect extends Entity {
  constructor(kind, x, y) {
    super('effect', x - 8, y - 8, 16, 16); this.kind = kind; this.art = kind === 'pop' ? 'pop0' : kind; this.frame = 'f0'; this.life = 0.3; this.hurtsHero = false; this.shadow = false; this.layer = 'front';
  }
  update(dt, level) { this.life -= dt; this.anim += dt; if (this.kind === 'pop') this.art = this.anim < 0.12 ? 'pop0' : 'pop1'; if (this.life <= 0) this.remove = true; }
}

/** Texto flutuante (+10 etc.) — renderizado pelo HUD. */
export class FloatText extends Entity {
  constructor(text, x, y) { super('text', x, y, 1, 1); this.text = text; this.life = 0.9; this.vy = -40; this.shadow = false; this.layer = 'front'; }
  update(dt) { this.life -= dt; this.y += this.vy * dt; this.vy = Math.min(this.vy + 60 * dt, 0); if (this.life <= 0) this.remove = true; }
}

export class Projectile extends Entity {
  constructor(kind, x, y, vx, vy) {
    super('bolt', x - 4, y - 4, 8, 8); this.kind = kind; this.vx = vx; this.vy = vy; this.ox = -4; this.oy = -4; this.life = 2.2; this.shadow = false; this.layer = 'front';
    this.hurtsHero = kind === 'enemyBolt'; this.fromHero = kind === 'bolt'; this.light = { r: 0.6, g: 0.8, b: 1, radius: 22, intensity: 0.7 };
    if (kind === 'enemyBolt') { this.light = { r: 1, g: 0.3, b: 0.2, radius: 22, intensity: 0.7 }; }
  }
  update(dt, level) {
    this.anim += dt; this.life -= dt; this.frame = Math.floor(this.anim * 12) % 2 ? 'f1' : 'f0'; this.flip = this.vx < 0;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.life <= 0 || isSolidType(level.map.getAt(this.cx, this.cy))) { this.remove = true; level.fx.sparks(this.cx, this.cy, 3); return; }
    if (this.fromHero) for (const e of level.entities) { if (e.punchable && !e.remove && e.overlaps(this)) { e.hp -= 1; if (e.hp <= 0) e.die(level, this.vx > 0 ? 1 : -1); else { e.hitFlash = 0.1; level.sfx('hit'); } this.remove = true; break; } }
  }
  onHeroTouch(level, hero) { if (this.hurtsHero) { hero.hurt(level, 'enemy'); this.remove = true; } }
}

/** Fantasminha amigo: orbita o herói e derrota inimigos que toca. */
export class GhostBuddy extends Entity {
  constructor(hero) { super('ghostbuddy', hero.x, hero.y, 12, 12); this.hero = hero; this.art = 'ghostbuddy'; this.frame = 'f0'; this.ox = -2; this.oy = -2; this.shadow = false; this.layer = 'front'; this.alpha = 0.9; this.light = { r: 0.8, g: 0.95, b: 1, radius: 30, intensity: 0.5 }; this.hurtsHero = false; this.active = true; }
  update(dt, level) {
    this.anim += dt; const h = this.hero; const a = this.anim * 3; this.x = h.cx + Math.cos(a) * 22 - 6; this.y = h.cy + Math.sin(a) * 14 - 6; this.flip = Math.cos(a) < 0; this.oy = -2 + Math.round(Math.sin(this.anim * 5) * 1.5);
    if (!h.items.ghostbuddy || h.state === 'dead') { this.remove = true; return; }
    for (const e of level.entities) { if (e.punchable && !e.remove && e.active && e.overlaps(this)) { e.hp -= 1; if (e.hp <= 0) e.die(level, 1); else { e.hitFlash = 0.1; level.sfx('hit'); } } }
  }
}
