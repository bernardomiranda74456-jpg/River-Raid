// Chefes: luta de plataforma com padrões após o duelo. Cada tipo tem comportamento próprio.
import { Enemy } from './enemies.js';
import { Ghost } from './enemies.js';
import { moveBody, GRAVITY, MAX_FALL } from '../physics.js';
import { TILE, isSolidType } from '../tilemap.js';
import { approach, sign, clamp, rng } from '../../core/math.js';

export const BOSS_DEFS = {
  frogking: { name: 'RÃ-REI BUFO', hp: 6, w: 28, h: 26, tells: ['coroa pende à esquerda', 'coroa balança', 'coroa pende à direita'], music: 'boss' },
  dunescorp: { name: 'ESCORPIÃO DUNAR', hp: 7, w: 30, h: 16, tells: ['cauda treme 1 vez', 'cauda treme 2 vezes', 'cauda treme 3 vezes'], music: 'boss' },
  firebat: { name: 'MORCEGÃO BRASA', hp: 6, w: 28, h: 18, tells: ['asas lentas', 'asas normais', 'asas rápidas'], music: 'boss' },
  vizier: { name: 'VIZIR KAZMAR', hp: 9, w: 24, h: 30, tells: ['olhos à esquerda', 'olhos fechados', 'olhos à direita'], music: 'boss' },
};

export class Boss extends Enemy {
  constructor(type, x, yBottom, arena) {
    const d = BOSS_DEFS[type] || BOSS_DEFS.frogking;
    super(type, x, yBottom - d.h, d.w, d.h); this.def = d; this.hp = d.hp; this.maxHp = d.hp; this.score = 2000; this.art = type; this.frame = 'f0';
    this.ox = -Math.round((32 - d.w) / 2); this.oy = -(32 - d.h); this.arena = arena; this.active = true; this.invT = 0; this.t = 0; this.phaseT = 0; this.mode = 'idle'; this.dir = -1; this.shootT = 0;
    this.gravity = type !== 'firebat' && type !== 'vizier'; this.flipRight = true; this.light = type === 'firebat' ? { r: 1, g: 0.5, b: 0.2, radius: 60, intensity: 0.9 } : type === 'vizier' ? { r: 0.7, g: 0.4, b: 1, radius: 60, intensity: 0.7 } : null;
    this.baseY = this.y; this.tele = 0;
  }
  onPunch(level, hero) {
    if (this.invT > 0) return false;
    if (this.type === 'firebat' && this.mode !== 'low') { level.sfx('clank'); return true; }
    this.hp--; this.invT = 1.1; this.hitFlash = 0.2; level.sfx('bossHit'); level.camera.shake(4, 0.25); level.hitStop(4); level.flash(0.4); level.fx.pop(this.cx, this.cy);
    this.vx = hero.facing * 60; if (this.gravity) this.vy = -120;
    if (this.hp <= 0) this.die(level, hero.facing); else if (this.hp === Math.ceil(this.maxHp / 2)) { this.phase2 = true; level.sfx('bossRoar'); level.floatText('!!!', this.cx, this.y - 10); }
    return true;
  }
  die(level, dir) {
    this.remove = true; level.addScore(this.score); level.sfx('enemyDie'); level.camera.shake(6, 0.5); level.flash(0.8);
    for (let i = 0; i < 6; i++) level.spawnEffect('pop', this.x + rng.next() * this.w, this.y + rng.next() * this.h);
    level.fx.confetti(this.cx, this.y, 40); level.onBossDefeated(this);
  }
  onHeroTouch(level, hero) { if (this.remove) return; hero.hurt(level, 'enemy'); }
  update(dt, level) {
    super.update(dt, level); this.t += dt; this.phaseT += dt; if (this.invT > 0) this.invT -= dt;
    this.alpha = this.invT > 0 && Math.floor(this.invT * 20) % 2 ? 0.4 : 1;
    const hero = level.hero; const sp = this.phase2 ? 1.35 : 1;
    switch (this.type) {
      case 'frogking': this.updateFrog(dt, level, hero, sp); break;
      case 'dunescorp': this.updateScorp(dt, level, hero, sp); break;
      case 'firebat': this.updateBat(dt, level, hero, sp); break;
      case 'vizier': this.updateVizier(dt, level, hero, sp); break;
    }
    this.x = clamp(this.x, this.arena.x0, this.arena.x1 - this.w);
    this.flip = this.dir > 0; this.frame = Math.floor(this.anim * 4) % 2 ? 'f1' : 'f0';
  }
  updateFrog(dt, level, hero, sp) {
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    if (this.onGround) {
      this.vx = approach(this.vx, 0, 500 * dt); this.wait = (this.wait ?? 1.2) - dt * sp;
      if (this.wait <= 0) {
        const dx = hero.cx - this.cx; this.dir = sign(dx) || this.dir; this.jumps = (this.jumps || 0) + 1;
        if (this.jumps % 3 === 0) { // cuspe: 2 bolhas
          level.spawnProjectile('enemyBolt', this.cx + this.dir * 10, this.y + 8, this.dir * 110, -60); level.spawnProjectile('enemyBolt', this.cx + this.dir * 10, this.y + 8, this.dir * 150, -120); level.sfx('zap'); this.wait = 1.0;
        } else { this.vy = -300; this.vx = this.dir * clamp(Math.abs(dx) * 1.1, 40, 140) * sp; this.wait = 1.1; level.sfx('hop'); }
      }
    }
    const wasAir = !this.onGround; moveBody(this, level.map, dt); if (this.hitWall) this.dir = -this.hitWall;
    if (wasAir && this.onGround) { level.camera.shake(3, 0.2); level.fx.dust(this.cx, this.bottom, 10); level.sfx('thud'); }
  }
  updateScorp(dt, level, hero, sp) {
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL); this.shootT -= dt;
    if (this.mode === 'idle') { this.vx = approach(this.vx, this.dir * 30 * sp, 200 * dt); if (this.phaseT > 1.6) { this.mode = rng.next() < 0.5 ? 'charge' : 'shoot'; this.phaseT = 0; this.dir = sign(hero.cx - this.cx) || this.dir; } }
    else if (this.mode === 'charge') { this.vx = this.dir * 150 * sp; if (this.phaseT > 1.1 || this.hitWall) { this.mode = 'idle'; this.phaseT = 0; if (this.hitWall) { level.camera.shake(3, 0.2); level.sfx('thud'); } } }
    else if (this.mode === 'shoot') { this.vx = approach(this.vx, 0, 400 * dt); if (this.shootT <= 0) { this.shootT = 0.5; level.spawnProjectile('enemyBolt', this.cx + this.dir * 14, this.y - 4, this.dir * 100, -170); level.sfx('zap'); } if (this.phaseT > 1.2) { this.mode = 'idle'; this.phaseT = 0; } }
    moveBody(this, level.map, dt); if (this.hitWall) this.dir = -this.hitWall;
  }
  updateBat(dt, level, hero, sp) {
    const cx = (this.arena.x0 + this.arena.x1) / 2; const amp = (this.arena.x1 - this.arena.x0) / 2 - 20;
    if (this.mode !== 'low' && this.mode !== 'dive') { this.mode = 'high'; this.x = cx + Math.sin(this.t * 1.1 * sp) * amp - this.w / 2; this.y = this.baseY - 60 + Math.sin(this.t * 2.3) * 8; this.dir = Math.cos(this.t * 1.1 * sp) > 0 ? 1 : -1; this.shootT -= dt; if (this.shootT <= 0) { this.shootT = 1.1 / sp; level.spawnProjectile('enemyBolt', this.cx, this.bottom, 0, 90); level.sfx('zap'); } if (this.phaseT > 3.5 / sp) { this.mode = 'dive'; this.phaseT = 0; this.diveX = hero.cx; } }
    else if (this.mode === 'dive') { const ty = this.baseY; this.y = approach(this.y, ty, 160 * dt * sp); this.x = approach(this.x, this.diveX - this.w / 2, 120 * dt); if (Math.abs(this.y - ty) < 1) { this.mode = 'low'; this.phaseT = 0; level.sfx('flap'); } }
    else { this.y = this.baseY + Math.sin(this.phaseT * 10) * 2; if (this.phaseT > 1.6) { this.mode = 'high'; this.phaseT = 0; this.t = 0; } }
    if (this.mode === 'low' && rng.next() < dt * 6) level.fx.ember(this.cx + (rng.next() - 0.5) * 20, this.cy);
  }
  updateVizier(dt, level, hero, sp) {
    // teleporta entre 3 pontos, atira punhos de pedra, invoca fantasmas na fase 2
    if (this.tele > 0) { this.tele -= dt; this.alpha = 0.3; if (this.tele <= 0) { const spots = [this.arena.x0 + 16, (this.arena.x0 + this.arena.x1) / 2 - this.w / 2, this.arena.x1 - 16 - this.w]; this.x = spots[Math.floor(rng.next() * 3)]; level.fx.sparkle(this.cx, this.cy, 10); level.sfx('ghost'); } return; }
    this.y = this.baseY + Math.sin(this.t * 2) * 3; this.dir = sign(hero.cx - this.cx) || this.dir; this.shootT -= dt * sp;
    if (this.shootT <= 0) { this.shootT = 1.4; level.spawnProjectile('enemyBolt', this.cx + this.dir * 14, this.y + 16, this.dir * 160, 0); level.sfx('shoot'); this.shots = (this.shots || 0) + 1; if (this.shots % 3 === 0) { this.tele = 0.6; if (this.phase2 && level.entities.filter((e) => e instanceof Ghost).length < 2) { level.entities.push(new Ghost(this.cx - 8, this.y, 5)); level.sfx('ghost'); } } }
  }
}
