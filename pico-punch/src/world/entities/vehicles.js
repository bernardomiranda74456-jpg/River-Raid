// Veículos: montarias do herói. Moto (auto-corrida, pula, quebra blocos ao bater), Helipé (voo a pedal
// com tiro) e Barquinho (flutua na água). Um golpe destrói o veículo em vez de matar o herói.
import { Entity } from './entity.js';
import { moveBody, GRAVITY, MAX_FALL } from '../physics.js';
import { TILE, T, isSolidType, isWaterType, isHazardType, isBreakableType } from '../tilemap.js';
import { approach, clamp } from '../../core/math.js';

/** Entidade visual do veículo (segue o herói). */
class VehicleView extends Entity {
  constructor(kind, hero) { super('vehicle', hero.x, hero.y, 1, 1); this.kind = kind; this.art = kind + 'Ride'; this.layer = kind === 'moto' ? 'back' : 'front'; this.hurtsHero = false; this.punchable = false; this.shadow = true; this.hero = hero; this.w = 32; this.h = kind === 'boat' ? 16 : 24; }
  update(dt) { this.anim += dt; const h = this.hero; this.x = h.x + h.w / 2 - 16; this.y = h.y + h.h - this.h + (this.kind === 'boat' ? 6 : 0); this.flip = h.facing < 0; this.ox = 0; this.oy = 0; if (!h.vehicle) this.remove = true; }
}

class Vehicle {
  constructor(kind, level, hero) {
    this.kind = kind; this.crushes = kind === 'moto'; this.view = new VehicleView(kind, hero); level.entities.push(this.view);
    this.saved = { w: hero.w, h: hero.h, ox: hero.ox, oy: hero.oy };
    const bottom = hero.y + hero.h; hero.w = 24; hero.h = kind === 'boat' ? 16 : 18; hero.x -= 7; hero.y = bottom - hero.h; hero.ox = -(24 - 24) / 2 + 0; hero.oy = kind === 'boat' ? -16 : kind === 'heli' ? -16 : -12; hero.crouch = false;
    this.t = 0; this.speed = 0; this.view.light = kind === 'moto' ? { r: 1, g: 0.95, b: 0.7, radius: 70, intensity: 0.8 } : kind === 'heli' ? { r: 1, g: 0.9, b: 0.6, radius: 50, intensity: 0.5 } : null;
  }
  dismount(level, hero) {
    const bottom = hero.y + hero.h; hero.w = this.saved.w; hero.h = this.saved.h; hero.ox = this.saved.ox; hero.oy = this.saved.oy; hero.x += 7; hero.y = bottom - hero.h; hero.vehicle = null; this.view.remove = true; level.game.audio?.engine(false);
    // se ficou dentro de um sólido, empurra para cima
    let guard = 0; while (guard++ < 24 && level.map.anyInRect(hero.x + 1, hero.y + 1, hero.w - 2, hero.h - 2, (t) => isSolidType(t))) hero.y -= 2;
  }
  /** Quebra blocos e empurra inimigos à frente (moto/heli). */
  smash(level, hero, x, y, w, h, breakRock) {
    let hit = false;
    level.map.forRect(x, y, w, h, (tx, ty, t) => { if (isBreakableType(t) && t !== T.HIDDEN) { level.breakBlock(tx, ty, hero, false); hit = true; } else if (t === T.ROCK && breakRock) { level.map.set(tx, ty, T.EMPTY); level.fx.shards(tx * TILE + 8, ty * TILE + 8, 'rock'); level.sfx('break'); level.addScore(100); hit = true; } return false; });
    if (hit) { level.hitStop(2); level.camera.shake(2, 0.1); }
    return hit;
  }
  frame(hero) { return 'ride'; }
}

class Moto extends Vehicle {
  constructor(level, hero) { super('moto', level, hero); this.speed = 60; hero.facing = 1; }
  drive(dt, level, hero) {
    const inp = level.input; const map = level.map; this.t += dt;
    const ax = inp.axisX(); const target = 150 + ax * 45;
    this.speed = approach(this.speed, target, 220 * dt); hero.vx = this.speed * hero.facing;
    if (inp.pressed.jump && hero.onGround) { hero.vy = -250; level.sfx('jump'); level.fx.dust(hero.cx, hero.bottom, 5); }
    if (hero.vy < 0 && !inp.held.jump) hero.vy *= 0.9;
    hero.vy = Math.min(hero.vy + GRAVITY * dt, MAX_FALL);
    // quebra o que está à frente antes de colidir
    this.smash(level, hero, hero.facing > 0 ? hero.x + hero.w : hero.x - 6, hero.y - 14, 6, hero.h + 14, true);
    moveBody(hero, map, dt);
    if (hero.hitWall) { // bateu em parede: moto destruída
      level.fx.sparks(hero.facing > 0 ? hero.right : hero.x, hero.cy, 12); level.sfx('crash'); level.camera.shake(5, 0.3); level.flash(0.5);
      this.destroy(level, hero); hero.vx = -hero.facing * 90; hero.vy = -170; hero.invuln = 1.5; return;
    }
    if (hero.onGround) { if (Math.random() < 0.6) level.fx.dust(hero.x + (hero.facing > 0 ? 2 : hero.w - 2), hero.bottom, 1); }
    if (map.anyInRect(hero.x + 4, hero.y + 4, hero.w - 8, hero.h - 2, (t) => isHazardType(t))) { hero.hurt(level, 'hazard'); return; }
    if (hero.y > map.pixelH + 32) { hero.hurt(level, 'fall'); return; }
    hero.frame = 'ride'; hero.flip = hero.facing < 0; this.view.frame = Math.floor(this.t * 20) % 2 ? 'f1' : 'f0';
    hero.scaleX = 1; hero.scaleY = 1 + Math.sin(this.t * 40) * 0.015;
    level.game.audio?.engine(true, clamp((this.speed - 100) / 100, 0, 1), 'moto');
    if (Math.random() < dt * 8) level.fx.ember(hero.x - hero.facing * 4, hero.bottom - 4);
  }
  destroy(level, hero) { this.dismount(level, hero); level.fx.pop(hero.cx, hero.cy); }
}

class Heli extends Vehicle {
  constructor(level, hero) { super('heli', level, hero); this.shootCd = 0; this.lift = 0; }
  drive(dt, level, hero) {
    const inp = level.input; const map = level.map; this.t += dt;
    const ax = inp.axisX(); if (ax) hero.facing = ax;
    hero.vx = approach(hero.vx, ax * 110, 300 * dt);
    // pedalar: segurar pulo dá sustentação; soltar cai devagar
    const pedal = inp.held.jump; this.lift = approach(this.lift, pedal ? 1 : 0, dt * 4);
    hero.vy = approach(hero.vy, pedal ? -95 : 70, 420 * dt);
    if (inp.held.down) hero.vy = approach(hero.vy, 130, 500 * dt);
    this.shootCd -= dt;
    if (inp.pressed.punch && this.shootCd <= 0) { this.shootCd = 0.3; level.spawnProjectile('bolt', hero.facing > 0 ? hero.right + 2 : hero.x - 2, hero.y + 8, hero.facing * 230, 0); level.sfx('shoot'); }
    this.smash(level, hero, hero.facing > 0 ? hero.x + hero.w : hero.x - 4, hero.y - 2, 4, hero.h + 4, true); this.smash(level, hero, hero.x + 2, hero.vy < 0 ? hero.y - 4 : hero.y + hero.h, hero.w - 4, 4, true);
    moveBody(hero, map, dt);
    if (hero.hitHead) hero.vy = 20; if (hero.y < -8) { hero.y = -8; hero.vy = Math.max(0, hero.vy); }
    if (map.anyInRect(hero.x + 4, hero.y + 4, hero.w - 8, hero.h - 4, (t) => isHazardType(t))) { hero.hurt(level, 'hazard'); return; }
    if (hero.y > map.pixelH + 32) { hero.hurt(level, 'fall'); return; }
    hero.frame = 'ride'; hero.flip = hero.facing < 0; this.view.frame = Math.floor(this.t * (pedal ? 30 : 14)) % 2 ? 'f1' : 'f0';
    level.game.audio?.engine(true, pedal ? 0.8 + Math.sin(this.t * 6) * 0.1 : 0.3, 'heli');
    if (pedal && Math.random() < dt * 6) level.fx.dust(hero.cx - hero.facing * 10, hero.y - 2, 1);
  }
  destroy(level, hero) { this.dismount(level, hero); level.fx.pop(hero.cx, hero.cy); level.fx.sparks(hero.cx, hero.cy, 8); }
}

class Boat extends Vehicle {
  constructor(level, hero) { super('boat', level, hero); this.bob = 0; }
  drive(dt, level, hero) {
    const inp = level.input; const map = level.map; this.t += dt;
    const ax = inp.axisX(); if (ax) hero.facing = ax;
    hero.vx = approach(hero.vx, ax * 95, 240 * dt);
    // flutuação: procura a superfície da água sob o barco
    const surfY = this.findSurface(map, hero.cx, hero.bottom);
    if (surfY !== null) { const targetY = surfY - hero.h + 6 + Math.sin(this.t * 3) * 1.2; const dy = targetY - hero.y; hero.vy = dy * 8; if (inp.pressed.jump && Math.abs(dy) < 6) { hero.vy = -170; level.sfx('splash'); level.fx.splash(hero.cx, hero.bottom); } }
    else hero.vy = Math.min(hero.vy + GRAVITY * dt, MAX_FALL);
    moveBody(hero, map, dt);
    this.dryT = surfY === null && hero.onGround ? (this.dryT || 0) + dt : 0; if (this.dryT > 0.6) { level.floatText('ENCALHOU', hero.cx, hero.y - 8); this.destroy(level, hero); return; }
    if (hero.hitWall) { hero.vx = 0; }
    if (map.anyInRect(hero.x + 4, hero.y + 4, hero.w - 8, hero.h - 4, (t) => isHazardType(t))) { hero.hurt(level, 'hazard'); return; }
    if (hero.y > map.pixelH + 32) { hero.hurt(level, 'fall'); return; }
    hero.frame = 'ride'; hero.flip = hero.facing < 0; hero.rotation = Math.sin(this.t * 3) * 0.04; this.view.rotation = hero.rotation; this.view.frame = 'f0';
    level.game.audio?.engine(true, Math.abs(hero.vx) / 95, 'boat');
    if (Math.abs(hero.vx) > 20 && Math.random() < dt * 10) level.fx.bubbles(hero.x - hero.facing * 6 + hero.w / 2, hero.bottom - 4, 1);
  }
  findSurface(map, x, fromY) { for (let k = -2; k < 6; k++) { const ty = Math.floor(fromY / TILE) + k; const t = map.get(Math.floor(x / TILE), ty); if (t === T.WATER_TOP) return ty * TILE + 4; if (t === T.WATER && !isWaterType(map.get(Math.floor(x / TILE), ty - 1))) return ty * TILE; } return null; }
  destroy(level, hero) { this.dismount(level, hero); level.fx.splash(hero.cx, hero.bottom); }
}

const CLASSES = { moto: Moto, heli: Heli, boat: Boat };
export function mountVehicle(level, kind) {
  const hero = level.hero; if (hero.vehicle) hero.vehicle.dismount(level, hero);
  const C = CLASSES[kind]; if (!C) return; hero.vehicle = new C(level, hero); hero.state = 'normal'; hero.punch = 0; hero.fist.active = false; level.sfx('vehicleGet'); level.floatText(kind === 'moto' ? 'MOTOCA TROVÃO!' : kind === 'heli' ? 'HELIPÉ!' : 'BARQUINHO!', hero.cx, hero.y - 10);
}
export function destroyVehicle(level, hero) { if (hero.vehicle) { hero.vehicle.destroy(level, hero); level.sfx('crash'); } }
