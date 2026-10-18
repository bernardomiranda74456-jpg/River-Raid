// PICO — herói: corrida, pulo variável (coyote + buffer), agachar, soco gigante, nado, escalada.
import { Entity } from './entity.js';
import { moveBody, GRAVITY, MAX_FALL } from '../physics.js';
import { TILE, T, isClimbType, isWaterType, isHazardType, isBreakableType, isSolidType } from '../tilemap.js';
import { clamp, approach, sign, rng } from '../../core/math.js';

const RUN = 96, ACC = 760, DEC = 980, AIR_ACC = 520, JUMP_V = -262, JUMP_CUT = 0.42;
const COYOTE = 0.09, BUFFER = 0.12, PUNCH_T = 0.26, PUNCH_ACTIVE0 = 0.06, PUNCH_ACTIVE1 = 0.17;
const SWIM_GRAV = 190, SWIM_MAXFALL = 70, SWIM_STROKE = -108, SWIM_SPEED = 72, CLIMB_SPEED = 56;
const STAND_H = 22, CROUCH_H = 14;

export class Hero extends Entity {
  constructor(x, y) {
    super('hero', x, y, 10, STAND_H);
    this.art = 'hero'; this.frame = 'idle0'; this.ox = -7; this.oy = -2; // sprite 24×24 relativo ao hitbox
    this.state = 'normal'; // normal | climb | swim | dead | eat | frozen | vehicle
    this.coyote = 0; this.jumpBuf = 0; this.jumping = false; this.punch = 0; this.punchDir = 'fwd'; this.punchHit = false;
    this.crouch = false; this.invuln = 0; this.idleT = 0; this.blink = 0; this.walkT = 0; this.facing = 1;
    this.inWater = false; this.dropThrough = false; this.deathT = 0; this.squash = 1; this.stretch = 1; this.landT = 0;
    this.items = { cape: false, bracelet: 0, ghostbuddy: false, eye: false, capsule: 0 }; this.gliding = false;
    this.lastGroundX = x; this.lastGroundY = y; this.eatT = 0; this.punchCount = 0; this.shadow = true;
    this.vehicle = null; this.fist = { x: 0, y: 0, w: 0, h: 0, active: false };
    this.light = { r: 1, g: 0.9, b: 0.7, radius: 64, intensity: 0.35 };
  }
  get standing() { return this.state === 'normal' && this.onGround; }
  hurt(level, cause = 'enemy') {
    if (this.state === 'dead' || this.invuln > 0 || this.state === 'eat' || this.state === 'frozen') return false;
    if (this.items.capsule > 0) return false;
    if (this.vehicle && cause !== 'fall') { level.vehicleDestroyed(this); this.invuln = 1.2; return false; }
    if (this.vehicle) this.vehicle.dismount(level, this);
    this.state = 'dead'; this.deathT = 0; this.vy = -200; this.vx = 0; this.frame = 'hurt'; this.punch = 0;
    level.onHeroDeath(cause); return true;
  }
  update(dt, level) {
    const inp = level.input; const map = level.map;
    this.anim += dt; if (this.invuln > 0) this.invuln -= dt; if (this.items.capsule > 0) this.items.capsule -= dt;
    if (this.state === 'dead') {
      this.deathT += dt; this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL); this.y += this.vy * dt; this.frame = this.deathT < 0.25 ? 'hurt' : 'dead';
      this.rotation = this.deathT > 0.25 ? Math.min((this.deathT - 0.25) * 6, Math.PI) * (this.facing) : 0;
      return;
    }
    if (this.state === 'eat') { const prev = this.eatT; this.eatT += dt; this.vx = 0; this.frame = this.eatT < 0.9 ? 'eat0' : this.eatT < 1.9 ? 'eat1' : 'eat2'; this.squash = this.eatT < 1.9 ? 1 + Math.sin(this.eatT * 10) * 0.04 : 1; this.scaleX = this.squash; if (prev < 1.9 && this.eatT >= 1.9) { level.floatText('♥', this.cx + 6, this.y - 4); level.sfx('bubble'); } if (this.eatT < 0.9 && Math.floor(this.eatT * 6) !== Math.floor(prev * 6)) level.sfx('eat'); return; }
    if (this.state === 'frozen') { this.frame = this.onGround ? 'idle0' : 'fall'; this.vx = 0; this.applyGravity(dt); moveBody(this, map, dt); return; }
    if (this.vehicle) { this.vehicle.drive(dt, level, this); return; }

    const ax = inp.axisX();
    if (ax !== 0 && this.punch <= 0) this.facing = ax;
    // Água?
    const headInWater = isWaterType(map.getAt(this.cx, this.y + 4)); const bodyInWater = isWaterType(map.getAt(this.cx, this.y + this.h * 0.6));
    this.inWater = bodyInWater;
    if (bodyInWater && this.state === 'normal') { this.state = 'swim'; this.vy = Math.min(this.vy, 60); level.fx.splash(this.cx, this.y + this.h / 2); level.sfx('splash'); }
    if (!bodyInWater && this.state === 'swim') { this.state = 'normal'; if (this.vy < 0) this.vy = Math.min(this.vy, -150); }
    // Escada/trepadeira
    const onClimb = isClimbType(map.getAt(this.cx, this.cy)) || isClimbType(map.getAt(this.cx, this.y + this.h - 2));
    if (this.state === 'normal' && onClimb && (inp.held.up || (inp.held.down && !this.onGround)) && this.punch <= 0) { this.state = 'climb'; this.vx = 0; this.vy = 0; this.jumping = false; }
    if (this.state === 'climb' && !onClimb) { this.state = 'normal'; }

    // Jump buffer / coyote
    if (inp.pressed.jump) this.jumpBuf = BUFFER; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.onGround) this.coyote = COYOTE; else this.coyote = Math.max(0, this.coyote - dt);

    // Soco (em qualquer estado exceto escalada)
    if (this.punch > 0) { this.punch -= dt; if (this.punch <= 0) { this.punch = 0; this.fist.active = false; } }
    if (inp.pressed.punch && this.punch <= 0 && this.state !== 'climb') {
      this.punch = PUNCH_T; this.punchHit = false; this.punchCount++;
      this.punchDir = inp.held.up ? 'up' : (inp.held.down && !this.onGround) ? 'down' : 'fwd';
      level.sfx('punch');
      if (this.items.bracelet > 0 && this.punchDir === 'fwd') { this.items.bracelet--; level.game.save.progress.items.bracelet = this.items.bracelet; level.spawnProjectile('bolt', this.facing > 0 ? this.right + 4 : this.x - 4, this.y + 8, this.facing * 240, 0); level.sfx('shoot'); }
    }

    if (this.state === 'climb') this.updateClimb(dt, level, ax);
    else if (this.state === 'swim') this.updateSwim(dt, level, ax);
    else this.updateNormal(dt, level, ax);

    // Hitbox do soco
    const t = PUNCH_T - this.punch;
    this.fist.active = this.punch > 0 && t >= PUNCH_ACTIVE0 && t <= PUNCH_ACTIVE1;
    if (this.fist.active) {
      if (this.punchDir === 'up') { this.fist.x = this.x - 1; this.fist.y = this.y - 11; this.fist.w = 12; this.fist.h = 12; }
      else if (this.punchDir === 'down') { this.fist.x = this.x - 1; this.fist.y = this.y + this.h - 1; this.fist.w = 12; this.fist.h = 12; }
      else { const fw = 12, fh = 10; this.fist.x = this.facing > 0 ? this.x + this.w - 1 : this.x - fw + 1; this.fist.y = this.y + (this.crouch ? 2 : 4); this.fist.w = fw; this.fist.h = fh; }
      if (!this.punchHit) this.resolvePunch(level);
    }
    // Perigos
    if (map.anyInRect(this.x + 2, this.y + 2, this.w - 4, this.h - 2, (tt) => isHazardType(tt))) { if (this.items.capsule <= 0) this.hurt(level, 'hazard'); }
    // Queda fora do mapa
    if (this.y > map.pixelH + 32) { this.invuln = 0; this.items.capsule = 0; this.hurt(level, 'fall'); }
    // Blocos escondidos revelados pela cabeça
    if (this.hitHead && this.headTile) { /* nada: tiles sólidos */ }
    if (this.vy < 0) { // bater a cabeça em bloco escondido
      const ty = Math.floor((this.y - 1) / TILE); const x0 = Math.floor((this.x + 1) / TILE), x1 = Math.floor((this.x + this.w - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) if (map.get(tx, ty) === T.HIDDEN) { level.breakBlock(tx, ty, this, true); this.vy = 40; }
    }
    this.chooseFrame(dt, ax);
    if (this.onGround) { this.lastGroundX = this.x; this.lastGroundY = this.y; }
  }
  applyGravity(dt) { this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL); }
  updateNormal(dt, level, ax) {
    const inp = level.input; const map = level.map;
    // Agachar
    const wantCrouch = inp.held.down && this.onGround && this.punch <= 0;
    if (wantCrouch && !this.crouch) { this.crouch = true; this.y += STAND_H - CROUCH_H; this.h = CROUCH_H; }
    if (!wantCrouch && this.crouch) {
      // só levanta se houver espaço
      const free = !map.anyInRect(this.x + 1, this.y - (STAND_H - CROUCH_H), this.w - 2, STAND_H - CROUCH_H, (t) => isSolidType(t));
      if (free) { this.crouch = false; this.y -= STAND_H - CROUCH_H; this.h = STAND_H; }
    }
    // Horizontal
    const target = this.crouch ? 0 : ax * RUN;
    const acc = this.onGround ? (ax !== 0 && sign(ax) === sign(this.vx) || this.vx === 0 ? ACC : DEC) : AIR_ACC;
    this.vx = approach(this.vx, target, acc * dt);
    // Pulo
    this.dropThrough = inp.held.down && inp.pressed.jump && this.onGround && this.groundTile === T.PLATFORM;
    if (this.jumpBuf > 0 && this.coyote > 0 && !this.dropThrough) {
      this.vy = JUMP_V; this.jumping = true; this.jumpBuf = 0; this.coyote = 0; this.onGround = false; this.stretch = 1.25; this.squash = 0.8;
      level.sfx('jump'); level.fx.dust(this.cx, this.bottom, 4);
    }
    if (this.dropThrough) { this.y += 2; this.onGround = false; }
    if (this.jumping && !inp.held.jump && this.vy < 0) { this.vy *= JUMP_CUT; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;
    // Planar com a capa
    this.gliding = this.items.cape && !this.onGround && this.vy > 0 && inp.held.jump && !this.jumping;
    if (this.gliding) this.vy = Math.min(this.vy + GRAVITY * dt, 45); else this.applyGravity(dt);
    const wasOnGround = this.onGround; const vyBefore = this.vy;
    moveBody(this, map, dt);
    this.dropThrough = false;
    if (this.onGround && !wasOnGround) { // aterrissou
      this.squash = 0.72; this.stretch = 1.2; this.landT = 0.12; level.fx.dust(this.cx, this.bottom, vyBefore > 200 ? 7 : 4); level.sfx('land');
    }
    if (this.hitHead) { this.jumping = false; }
  }
  updateClimb(dt, level, ax) {
    const inp = level.input; const map = level.map;
    const ay = (inp.held.down ? 1 : 0) - (inp.held.up ? 1 : 0);
    this.vy = ay * CLIMB_SPEED; this.vx = ax * 40; this.crouch = false; this.h = STAND_H;
    if (ax === 0) { const tcx = Math.floor(this.cx / TILE) * TILE + TILE / 2; this.x = approach(this.x, tcx - this.w / 2, 80 * dt); } // centraliza na escada
    if (ay !== 0) this.walkT += dt * 2.2;
    const oldY = this.y;
    moveBody(this, map, dt);
    // sair pelo topo
    const stillOn = isClimbType(map.getAt(this.cx, this.cy)) || isClimbType(map.getAt(this.cx, this.y + this.h - 2));
    if (!stillOn) { if (ay < 0) { this.y = oldY; this.vy = 0; } this.state = 'normal'; }
    if (inp.pressed.jump) { this.state = 'normal'; this.vy = JUMP_V * 0.8; this.jumping = true; level.sfx('jump'); this.jumpBuf = 0; }
    if (this.onGround && ay > 0) this.state = 'normal';
  }
  updateSwim(dt, level, ax) {
    const inp = level.input; const map = level.map;
    this.crouch = false; this.h = STAND_H; this.jumping = false;
    this.vx = approach(this.vx, ax * SWIM_SPEED, 400 * dt);
    this.vy = Math.min(this.vy + SWIM_GRAV * dt, SWIM_MAXFALL);
    if (inp.pressed.jump) {
      const atSurface = !isWaterType(map.getAt(this.cx, this.y - 2));
      this.vy = atSurface ? -215 : SWIM_STROKE; level.sfx('swim'); level.fx.bubbles(this.cx, this.y + 4, 3); this.walkT = 0;
      if (atSurface) level.fx.splash(this.cx, this.y);
    }
    this.walkT += dt;
    moveBody(this, map, dt);
    if (rng.next() < dt * 1.5) level.fx.bubbles(this.cx + this.facing * 4, this.y + 6, 1);
  }
  resolvePunch(level) {
    const f = this.fist; const map = level.map; let hit = false;
    // tiles quebráveis
    map.forRect(f.x, f.y, f.w, f.h, (tx, ty, t) => {
      if (isBreakableType(t) && t !== T.HIDDEN) { level.breakBlock(tx, ty, this, false); hit = true; }
      else if (t === T.ROCK) { level.fx.sparks(f.x + f.w / 2, f.y + f.h / 2, 3); level.sfx('clank'); hit = true; }
      return false;
    });
    // entidades
    for (const e of level.entities) {
      if (e === this || e.remove || !e.punchable) continue;
      if (e.overlapsRect(f.x, f.y, f.w, f.h)) { if (e.onPunch(level, this)) hit = true; }
    }
    if (hit) { this.punchHit = true; level.hitStop(3); level.camera.shake(2.5, 0.12); level.flash(0.35); }
  }
  chooseFrame(dt, ax) {
    this.flip = this.facing < 0;
    const sq = 1 - (1 - this.squash) * Math.exp(0); this.squash = approach(this.squash, 1, dt * 5); this.stretch = approach(this.stretch, 1, dt * 5);
    this.scaleX = this.squash; this.scaleY = this.stretch; this.rotation = 0;
    if (this.landT > 0) this.landT -= dt;
    if (this.punch > 0) {
      const t = PUNCH_T - this.punch;
      if (this.state === 'swim') this.frame = t < 0.06 ? 'punch0' : 'punch1';
      else if (this.crouch) this.frame = 'crouchPunch';
      else if (this.punchDir === 'up') this.frame = 'punchUp';
      else if (this.punchDir === 'down') this.frame = 'punchDown';
      else this.frame = t < 0.06 ? 'punch0' : 'punch1';
      return;
    }
    if (this.state === 'climb') { this.frame = Math.floor(this.walkT * 4) % 2 ? 'climb1' : 'climb0'; return; }
    if (this.state === 'swim') { this.frame = (this.walkT % 0.7) < 0.3 ? 'swim0' : 'swim1'; this.rotation = Math.sin(this.anim * 3) * 0.08; return; }
    if (this.crouch) { this.frame = 'crouch'; this.oy = -2 - (STAND_H - CROUCH_H) + (STAND_H - CROUCH_H); return; }
    if (!this.onGround) { this.frame = this.gliding ? 'jump' : this.vy < -30 ? 'jump' : this.vy > 40 ? 'fall' : 'jump'; this.idleT = 0; return; }
    if (Math.abs(this.vx) > 8) { this.walkT += dt * (8 + Math.abs(this.vx) / 14); this.frame = 'walk' + (Math.floor(this.walkT) % 4); this.idleT = 0; return; }
    this.idleT += dt; this.blink -= dt;
    if (this.blink <= 0) { this.blink = 2.2 + rng.next() * 2.5; this.blinkT = 0.14; }
    if (this.blinkT > 0) { this.blinkT -= dt; this.frame = 'idle1'; }
    else this.frame = (Math.floor(this.idleT * 1.6) % 2) ? 'idle2' : 'idle0';
  }
  /** Hitbox da cabeça para itens etc. */
  respawnAt(x, y, map = null) {
    this.x = x; this.y = y;
    if (map) { let g = 0; const inside = () => map.anyInRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2, (t) => isSolidType(t)); while (inside() && g++ < 8) this.x += 4; g = 0; while (inside() && g++ < 8) { this.x -= 4; this.y -= 4; } } this.vx = 0; this.vy = 0; this.state = 'normal'; this.frame = 'idle0'; this.rotation = 0; this.invuln = 1.5; this.crouch = false; this.h = STAND_H; this.punch = 0; this.vehicle = null; this.scaleX = this.scaleY = 1; this.savePrev();
  }
}
