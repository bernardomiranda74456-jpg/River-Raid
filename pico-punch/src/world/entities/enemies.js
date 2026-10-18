// Inimigos com personalidade: cada um tem um comportamento simples e legível.
import { Entity } from './entity.js';
import { moveBody, GRAVITY, MAX_FALL } from '../physics.js';
import { TILE, T, isSolidType, isWaterType } from '../tilemap.js';
import { approach, sign, rng } from '../../core/math.js';

export class Enemy extends Entity {
  constructor(type, x, y, w, h) {
    super(type, x, y, w, h);
    this.hurtsHero = true; this.punchable = true; this.score = 100; this.hp = 1; this.gravity = true; this.flipRight = true;
    this.ox = -Math.round((16 - w) / 2); this.oy = -(16 - h); this.active = false; this.startX = x; this.startY = y; this.layer = 'mid';
  }
  onPunch(level, hero) {
    this.hp--; this.hitFlash = 0.12;
    if (this.hp <= 0) { this.die(level, hero.facing); return true; }
    this.vx = hero.facing * 90; this.vy = -80; level.sfx('hit'); return true;
  }
  die(level, dir = 1) {
    this.remove = true; level.addScore(this.score); level.fx.pop(this.cx, this.cy); level.sfx('enemyDie');
    level.spawnEffect('pop', this.cx, this.cy); level.onEnemyDefeated(this);
  }
  onHeroTouch(level, hero) { hero.hurt(level, 'enemy'); }
  /** Patrulha: inverte na parede e opcionalmente em bordas. */
  patrol(dt, level, speed, turnAtEdge = true) {
    this.vx = this.dir * speed; if (this.gravity) this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    moveBody(this, level.map, dt);
    if (this.hitWall) this.dir = -this.hitWall;
    if (turnAtEdge && this.onGround) {
      const aheadX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!isSolidType(level.map.getAt(aheadX, this.y + this.h + 1)) && !level.map.anyInRect(aheadX, this.y + this.h, 1, 2, (t) => t === T.PLATFORM || t === T.BRIDGE)) this.dir = -this.dir;
    }
    this.flip = this.flipRight ? this.dir > 0 : this.dir < 0;
  }
  animate(rate = 6) { this.frame = Math.floor(this.anim * rate) % 2 ? 'f1' : 'f0'; }
  update(dt, level) { this.anim += dt; if (this.hitFlash > 0) this.hitFlash -= dt; }
}

/** Saltão: pula em direção ao herói quando perto, senão pula no lugar. */
export class Hopper extends Enemy {
  constructor(x, y) { super('hopper', x, y, 12, 12); this.wait = 1.0 + rng.next() * 0.5; this.dir = -1; }
  update(dt, level) {
    super.update(dt, level);
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    if (this.onGround) {
      this.vx = approach(this.vx, 0, 400 * dt); this.wait -= dt; this.frame = 'f0';
      if (this.wait <= 0) {
        const hero = level.hero; const dx = hero.cx - this.cx;
        const near = Math.abs(dx) < 80 && Math.abs(hero.cy - this.cy) < 40;
        this.dir = near ? sign(dx) || -1 : -this.dir;
        this.vy = near ? -200 : -150; this.vx = this.dir * (near ? 52 : 40); this.wait = 1.1 + rng.next() * 0.6; level.sfx('hop');
      }
    } else { this.frame = 'f1'; }
    moveBody(this, level.map, dt);
    if (this.hitWall) { this.dir = -this.hitWall; this.vx = this.dir * 40; }
    this.flip = this.dir > 0;
  }
}

/** Gralha: voa em linha, e mergulha em curva quando o herói passa embaixo. */
export class Bird extends Enemy {
  constructor(x, y) { super('bird', x, y, 14, 8); this.gravity = false; this.baseY = y; this.dir = -1; this.mode = 'fly'; this.t = 0; this.score = 150; this.shadow = false; }
  update(dt, level) {
    super.update(dt, level); this.animate(8);
    const hero = level.hero;
    if (this.mode === 'fly') {
      this.vx = this.dir * 48; this.vy = Math.sin(this.anim * 3) * 18;
      const dx = hero.cx - this.cx;
      if (Math.abs(dx) < 70 && hero.y > this.y + 16 && hero.y < this.y + 120 && this.t <= 0) { this.mode = 'dive'; this.t = 0; this.diveFrom = this.y; this.diveX = this.cx; this.dir = sign(dx) || this.dir; }
    } else if (this.mode === 'dive') {
      this.t += dt; const p = Math.min(this.t / 0.9, 1);
      this.vx = this.dir * 95; this.vy = Math.sin(p * Math.PI) * 170;
      if (p >= 1) { this.mode = 'rise'; this.t = 0; }
    } else { // sobe de volta à altura base
      this.t += dt; this.vx = this.dir * 60; this.vy = this.y > this.baseY ? -110 : 0;
      if (this.y <= this.baseY + 2) { this.mode = 'fly'; this.t = 1.5; this.y = this.baseY; }
    }
    if (this.mode === 'fly' && this.t > 0) this.t -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < -20 || this.x > level.map.pixelW + 20) this.dir = -this.dir;
    if (isSolidType(level.map.getAt(this.cx + this.dir * 8, this.cy))) this.dir = -this.dir;
    this.flip = this.dir > 0;
  }
}

/** Rolão: pedra que rola numa direção ganhando velocidade; quica em paredes. Precisa de 2 socos. */
export class Roller extends Enemy {
  constructor(x, y) { super('roller', x, y, 14, 14); this.dir = -1; this.hp = 2; this.score = 200; this.speed = 20; }
  update(dt, level) {
    super.update(dt, level);
    this.speed = Math.min(this.speed + 40 * dt, 85); this.vx = this.dir * this.speed;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    moveBody(this, level.map, dt);
    if (this.hitWall) { this.dir = -this.hitWall; this.speed = 20; level.sfx('clank'); level.camera.shake(1, 0.08); }
    this.rotation += this.vx * dt * 0.12; this.frame = Math.floor(this.anim * 6) % 2 ? 'f1' : 'f0';
  }
}

export class Scorpion extends Enemy {
  constructor(x, y) { super('scorpion', x, y, 14, 10); this.dir = -1; this.flipRight = true; }
  update(dt, level) {
    super.update(dt, level); this.animate(6);
    const hero = level.hero; const near = Math.abs(hero.cx - this.cx) < 90 && Math.abs(hero.cy - this.cy) < 32;
    if (near) this.dir = sign(hero.cx - this.cx) || this.dir;
    this.patrol(dt, level, near ? 55 : 28, !near);
  }
}

export class Bat extends Enemy {
  constructor(x, y) { super('bat', x, y, 14, 8); this.gravity = false; this.mode = 'hang'; this.shadow = false; this.score = 120; }
  update(dt, level) {
    super.update(dt, level);
    const hero = level.hero;
    if (this.mode === 'hang') { this.frame = 'f0'; if (Math.abs(hero.cx - this.cx) < 60 && hero.y > this.y) { this.mode = 'fly'; level.sfx('flap'); } return; }
    this.animate(10);
    const tx = hero.cx, ty = hero.cy - 6; const dx = tx - this.cx, dy = ty - this.cy; const d = Math.hypot(dx, dy) || 1;
    this.vx = approach(this.vx, (dx / d) * 60 + Math.sin(this.anim * 5) * 25, 180 * dt); this.vy = approach(this.vy, (dy / d) * 50 + Math.cos(this.anim * 4) * 25, 180 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt; this.flip = this.vx > 0;
  }
}

export class Fish extends Enemy {
  constructor(x, y) { super('fish', x, y, 14, 8); this.gravity = false; this.dir = -1; this.baseY = y; this.shadow = false; }
  update(dt, level) {
    super.update(dt, level); this.animate(5);
    this.vx = this.dir * 40; this.y = this.baseY + Math.sin(this.anim * 2.5) * 6; this.x += this.vx * dt;
    if (!isWaterType(level.map.getAt(this.cx + this.dir * 10, this.cy)) || isSolidType(level.map.getAt(this.cx + this.dir * 10, this.cy))) this.dir = -this.dir;
    this.flip = this.dir > 0;
  }
}

export class Jelly extends Enemy {
  constructor(x, y) { super('jelly', x, y, 12, 12); this.gravity = false; this.baseY = y; this.shadow = false; this.score = 150; this.phase = rng.next() * 6; this.light = { r: 0.9, g: 0.5, b: 1, radius: 36, intensity: 0.6 }; }
  update(dt, level) {
    super.update(dt, level); this.animate(2);
    const t = this.anim * 1.4 + this.phase; this.y = this.baseY + Math.sin(t) * 22; this.vy = Math.cos(t) * 30;
    if (!isWaterType(level.map.getAt(this.cx, this.y))) this.y = this.baseY + 10;
  }
}

/** Fantasma: surpresa ruim do bloco "?" — persegue o herói por alguns segundos e some. */
export class Ghost extends Enemy {
  constructor(x, y, life = 6) { super('ghost', x, y, 14, 14); this.gravity = false; this.life = life; this.hurtsHero = true; this.punchable = false; this.shadow = false; this.score = 0; this.alpha = 0.85; this.light = { r: 0.7, g: 0.9, b: 1, radius: 30, intensity: 0.5 }; }
  update(dt, level) {
    super.update(dt, level); this.animate(3); this.life -= dt;
    const hero = level.hero; const dx = hero.cx - this.cx, dy = hero.cy - 4 - this.cy; const d = Math.hypot(dx, dy) || 1;
    const sp = 58; this.vx = approach(this.vx, (dx / d) * sp, 120 * dt); this.vy = approach(this.vy, (dy / d) * sp, 120 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt; this.flip = this.vx > 0;
    if (this.life < 1) this.alpha = this.life * 0.85; if (this.life <= 0) this.remove = true;
  }
}

export class Knight extends Enemy {
  constructor(x, y) { super('knight', x, y, 12, 14); this.dir = -1; this.hp = 1; this.score = 300; this.flipRight = true; }
  onPunch(level, hero) {
    // escudo na frente: só o soco pelas costas ou por cima/baixo derrota
    const fromBehind = sign(hero.cx - this.cx) === this.dir; // herói está atrás
    if (hero.punchDir === 'fwd' && !fromBehind) { level.fx.sparks(this.cx - this.dir * 6, this.cy, 4); level.sfx('clank'); this.vx = -hero.facing * 20; return true; }
    return super.onPunch(level, hero);
  }
  update(dt, level) {
    super.update(dt, level); this.animate(4); const hero = level.hero; this.turnCd = (this.turnCd ?? 0) - dt;
    if (this.turnCd <= 0 && Math.abs(hero.cx - this.cx) < 120 && Math.abs(hero.cy - this.cy) < 24) { const want = sign(hero.cx - this.cx) || this.dir; if (want !== this.dir) { this.dir = want; this.turnCd = 1.4; } }
    this.patrol(dt, level, 30, true);
  }
}

export class Bee extends Enemy {
  constructor(x, y) { super('bee', x, y, 12, 10); this.gravity = false; this.baseX = x; this.baseY = y; this.shadow = false; this.score = 120; }
  update(dt, level) {
    super.update(dt, level); this.animate(16);
    const hero = level.hero; const dx = hero.cx - this.cx; const chase = Math.abs(dx) < 80 && Math.abs(hero.cy - this.cy) < 60;
    if (chase) { this.vx = approach(this.vx, sign(dx) * 55, 200 * dt); this.vy = approach(this.vy, sign(hero.cy - 8 - this.cy) * 40, 200 * dt); }
    else { this.vx = approach(this.vx, Math.cos(this.anim * 1.5) * 35, 150 * dt); this.vy = approach(this.vy, Math.sin(this.anim * 3) * 20, 150 * dt); }
    this.x += this.vx * dt; this.y += this.vy * dt; this.flip = this.vx > 0;
  }
}

export class Slug extends Enemy {
  constructor(x, y) { super('slug', x, y, 14, 10); this.dir = -1; this.score = 150; this.light = { r: 1, g: 0.5, b: 0.1, radius: 28, intensity: 0.7 }; }
  update(dt, level) { super.update(dt, level); this.animate(3); this.patrol(dt, level, 18, true); if (rng.next() < dt * 2) level.fx.ember(this.cx, this.y + 4); }
}

export class Drone extends Enemy {
  constructor(x, y) { super('drone', x, y, 14, 10); this.gravity = false; this.baseY = y; this.dir = -1; this.shadow = false; this.score = 150; this.shootT = 2; this.light = { r: 1, g: 0.2, b: 0.2, radius: 24, intensity: 0.6 }; }
  update(dt, level) {
    super.update(dt, level); this.animate(14);
    this.vx = this.dir * 45; this.x += this.vx * dt; this.y = this.baseY + Math.sin(this.anim * 2) * 8;
    if (isSolidType(level.map.getAt(this.cx + this.dir * 10, this.cy)) || this.x < 0 || this.x > level.map.pixelW - 16) this.dir = -this.dir;
    this.flip = this.dir > 0;
    this.shootT -= dt; const hero = level.hero;
    if (this.shootT <= 0 && Math.abs(hero.cx - this.cx) < 40 && hero.y > this.y) { this.shootT = 2.2; level.spawnProjectile('enemyBolt', this.cx, this.y + 10, 0, 120); level.sfx('zap'); }
  }
}

export class Crab extends Enemy {
  constructor(x, y) { super('crab', x, y, 14, 10); this.dir = -1; this.score = 100; }
  update(dt, level) { super.update(dt, level); this.animate(8); this.patrol(dt, level, 38, true); }
}

export const ENEMY_CLASSES = { hopper: Hopper, bird: Bird, roller: Roller, scorpion: Scorpion, bat: Bat, fish: Fish, jelly: Jelly, ghost: Ghost, knight: Knight, bee: Bee, slug: Slug, drone: Drone, crab: Crab };
