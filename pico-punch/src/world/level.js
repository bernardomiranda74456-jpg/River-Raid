// Fase: instancia mapa, entidades e herói; aplica regras (blocos, dinheiro, vidas, checkpoints, meta).
import { Tilemap, TILE, T } from './tilemap.js';
import { Hero } from './entities/hero.js';
import { ENEMY_CLASSES, Ghost } from './entities/enemies.js';
import { Pickup, Flag, Checkpoint, ShopDoor, Effect, FloatText, Projectile, GhostBuddy } from './entities/items.js';
import { Camera } from './camera.js';
import { mountVehicle, destroyVehicle } from './entities/vehicles.js';
import { rng } from '../core/math.js';

const NOFX = { dust() {}, splash() {}, bubbles() {}, sparks() {}, sparkle() {}, pop() {}, shards() {}, ember() {}, confetti() {} };

export class Level {
  constructor(json, game, opts = {}) {
    rng.s = 20261018; // determinístico por fase (bot de teste reproduzível)
    this.json = json; this.game = game; this.input = game.input; this.map = new Tilemap(json);
    this.theme = json.theme || 'mountain'; this.name = json.name || json.id; this.id = json.id;
    this.entities = []; this.fx = game.fx || NOFX; this.camera = new Camera(game.viewW, game.viewH);
    this.camera.zones = json.cameraZones || [];
    this.time = 0; this.score = 0; this.moneyStart = game.save.progress.money; this.money = this.moneyStart;
    this.hitStopFrames = 0; this.flashA = 0; this.state = 'play'; // play | dying | goal | shop | duel | boss | done
    this.stateT = 0; this.messages = []; this.checkpoint = null; this.qcontents = json.qcontents || {};
    this.waterLevel = json.waterLevel ?? null; this.events = []; this.defeated = 0; this.deaths = 0;
    const sp = this.map.spawn; this.hero = new Hero(sp.x * TILE + 3, (sp.y + 1) * TILE - 22);
    if (opts.checkpoint) { this.hero.x = opts.checkpoint.x; this.hero.y = opts.checkpoint.y; this.checkpoint = opts.checkpoint; }
    this.hero.savePrev(); this.entities.push(this.hero);
    this.boss = null; this.bossDef = json.boss || null; this.vehicleAtStart = json.vehicle || null;
    for (const e of this.map.entities) this.spawnEntity(e);
    this.camera.snapTo(this.hero, this.map.pixelW, this.map.pixelH);
    if (this.vehicleAtStart) mountVehicle(this, this.vehicleAtStart);
    this.applyInventory();
  }
  applyInventory() {
    const inv = this.game.save.progress.items || {};
    this.hero.items.cape = !!inv.cape; this.hero.items.bracelet = inv.bracelet || 0; this.hero.items.eye = !!inv.eye; this.hero.items.ghostbuddy = !!inv.ghostbuddy;
    if (this.hero.items.ghostbuddy && !this.entities.some((e) => e.type === 'ghostbuddy')) this.entities.push(new GhostBuddy(this.hero));
  }
  spawnEntity(e) {
    const x = e.x * TILE, yBottom = (e.y + 1) * TILE; let ent = null;
    if (ENEMY_CLASSES[e.type]) { const C = ENEMY_CLASSES[e.type]; ent = new C(x, yBottom); ent.y = yBottom - ent.h; if (e.dir) ent.dir = e.dir; }
    else switch (e.type) {
      case 'moneybag': case 'bigbag': case 'heart': ent = new Pickup(e.type, x + 2, yBottom - 12); break;
      case 'flag': ent = new Flag(x + 3, yBottom - 32); break;
      case 'checkpoint': ent = new Checkpoint(x + 2, yBottom - 14); break;
      case 'shop': ent = new ShopDoor(x, yBottom - 32); break;
      case 'boss': this.bossSpawn = { x, y: yBottom }; break;
      case 'gate': this.gate = { x, y: yBottom }; break;
      case 'moto': case 'heli': case 'boat': ent = new Pickup(e.type, x + 2, yBottom - 12); ent.vehicleKind = e.type; break;
      default: break;
    }
    if (ent) { for (const k of ['props']) if (e[k]) Object.assign(ent, e[k]); this.entities.push(ent); }
    return ent;
  }
  // ----- Hooks de áudio / efeitos (ligados pelo Game) ----------------------------------------
  sfx(name) { this.game.audio?.sfx(name); }
  hitStop(frames) { this.hitStopFrames = Math.max(this.hitStopFrames, frames); }
  flash(a) { this.flashA = Math.max(this.flashA, a); }
  floatText(text, x, y) { this.entities.push(new FloatText(text, x, y)); }
  spawnEffect(kind, x, y) { this.entities.push(new Effect(kind, x, y)); }
  spawnProjectile(kind, x, y, vx, vy) { this.entities.push(new Projectile(kind, x, y, vx, vy)); }
  addScore(n) { this.score += n; }
  addMoney(n) { this.money = Math.max(0, this.money + n); this.game.save.progress.money = this.money; }
  addLife() { this.game.save.progress.lives = Math.min(9, this.game.save.progress.lives + 1); }
  giveItem(type) { const p = this.game.save.progress; if (type === 'bracelet') p.items.bracelet = (p.items.bracelet || 0) + 1; else p.items[type] = true; this.applyInventory(); this.floatText(type.toUpperCase(), this.hero.cx, this.hero.y - 8); }
  setCheckpoint(x, y) { this.checkpoint = { x, y }; }
  onEnemyDefeated(e) { this.defeated++; }
  onBossDefeated(boss) {
    this.boss = null; this.bossSpawn = null; this.bossDone = true; this.state = 'play'; this.camera.zones = this.json.cameraZones || []; this.game.hud.showBoss(null);
    if (this.gateTiles) { for (const [tx, ty] of this.gateTiles) this.map.set(tx, ty, T.EMPTY); this.gateTiles = null; }
    this.game.audio?.music.play(this.json.music, { restart: true }); this.floatText(this.bossDef?.name ? 'DERROTADO!' : 'VITÓRIA!', boss.cx, boss.y);
    if (this.json.final) this.game.hooks.finalVictory?.(this); else this.game.audio?.music.play('item', { once: true, duck: true });
  }
  vehicleDestroyed(hero) { destroyVehicle(this, hero); }
  mountVehicle(kind) { mountVehicle(this, kind); }
  openShop(door) { this.state = 'shop'; this.game.openShop(this, door); }
  // ----- Blocos ------------------------------------------------------------------------------
  breakBlock(tx, ty, hero, fromBelow) {
    const t = this.map.get(tx, ty); const cx = tx * TILE + 8, cy = ty * TILE + 8;
    if (t === T.STAR) {
      this.map.set(tx, ty, T.EMPTY); this.fx.shards(cx, cy, 'star'); this.sfx('break'); this.addScore(50);
      const p = new Pickup('moneybag', tx * TILE + 2, ty * TILE - 14, true); p.vx = (rng.next() - 0.5) * 30; this.entities.push(p);
    } else if (t === T.QBLOCK || t === T.HIDDEN) {
      this.map.set(tx, ty, T.USED); this.sfx(t === T.HIDDEN ? 'reveal' : 'break'); this.fx.shards(cx, cy, 'q'); this.addScore(50);
      const content = this.qcontents[`${tx},${ty}`] || 'moneybag';
      if (content === 'ghost') { const g = new Ghost(tx * TILE + 1, ty * TILE - 18, 7); this.entities.push(g); this.sfx('ghost'); this.floatText('BUU!', cx, cy - 16); }
      else if (content === 'nothing') { this.floatText('...', cx, cy - 16); }
      else { const p = new Pickup(content, tx * TILE + 2, ty * TILE - 14, true); this.entities.push(p); if (content !== 'moneybag') this.sfx('itemPop'); }
    }
  }
  // ----- Fluxo de vida/morte/meta --------------------------------------------------------------
  onHeroDeath(cause) {
    if (this.state !== 'play' && this.state !== 'boss') return; this.deaths++;
    const inv = this.game.save.progress.items; inv.cape = false; inv.ghostbuddy = false; inv.bracelet = 0; this.game.save.save();
    this.state = 'dying'; this.stateT = 0; this.sfx('death'); this.game.audio?.music.stop(); this.camera.shake(3, 0.3);
  }
  reachGoal() {
    if (this.state !== 'play') return; this.state = 'goal'; this.stateT = 0; this.hero.state = 'eat'; this.hero.eatT = 0; this.hero.vx = 0; this.hero.facing = 1;
    this.fx.confetti(this.hero.cx, this.hero.y, 24); this.sfx('eat');
    this.game.onLevelClear(this);
  }
  respawn() {
    const p = this.game.save.progress; p.lives--;
    if (p.lives < 0) { this.game.gameOver(this); return; }
    const cp = this.checkpoint; const sp = this.map.spawn;
    if (cp) this.hero.respawnAt(cp.x, cp.y); else this.hero.respawnAt(sp.x * TILE + 3, (sp.y + 1) * TILE - 22);
    // reinicia inimigos próximos ao ponto de respawn? mantemos o estado, mas removemos fantasmas
    for (const e of this.entities) if (e instanceof Ghost || e.type === 'ghostbuddy') e.remove = true;
    this.applyInventory();
    this.state = 'play'; this.camera.snapTo(this.hero, this.map.pixelW, this.map.pixelH); this.game.audio?.music.play(this.json.music, { restart: true });
  }
  // ----- Passo fixo -----------------------------------------------------------------------------
  update(dt) {
    if (this.hitStopFrames > 0) { this.hitStopFrames--; return; }
    this.stateT += dt;
    if (this.state === 'shop' || this.state === 'duel' || this.state === 'done') { if (this.state === 'done') { this.hero.savePrev(); this.hero.update(dt, this); } return; }
    if (this.state === 'play' || this.state === 'boss') this.time += dt;
    if (this.state === 'dying') { this.hero.savePrev(); this.hero.update(dt, this); if (this.stateT > 1.6) this.respawn(); return; }
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 3);
    const hero = this.hero;
    const camL = this.camera.x - 80, camR = this.camera.x + this.camera.viewW + 80, camT = this.camera.y - 120, camB = this.camera.y + this.camera.viewH + 120;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i]; e.savePrev();
      if (e !== hero) {
        // ativa inimigos só quando perto da câmera (economia e "surpresa" previsível)
        if (!e.active) { if (e.x + e.w > camL && e.x < camR && e.y + e.h > camT && e.y < camB) e.active = true; else continue; }
        else if (e.hurtsHero && (e.x + e.w < camL - 200 || e.x > camR + 200 || e.y > camB + 200)) { if (!e.light) { e.active = false; continue; } }
      }
      e.update(dt, this);
    }
    // interações herói × entidades
    if (hero.state !== 'dead' && hero.state !== 'eat' && hero.state !== 'frozen') {
      for (const e of this.entities) {
        if (e === hero || e.remove || !e.active && e.hurtsHero) continue;
        if (!e.overlaps(hero)) continue;
        if (e.hurtsHero) { if (hero.items.capsule > 0 && e.punchable) { e.die(this, 1); continue; } if (hero.vehicle && e.punchable && hero.vehicle.crushes) { e.die(this, hero.facing); continue; } e.onHeroTouch(this, hero); }
        else e.onHeroTouch(this, hero);
      }
    }
    // limpeza sem alocação de novos arrays grandes: compacta in-place
    let w = 0; for (let i = 0; i < this.entities.length; i++) { const e = this.entities[i]; if (!e.remove) this.entities[w++] = e; } this.entities.length = w;
    this.camera.update(dt, hero, this.map.pixelW, this.map.pixelH);
    if (this.state === 'play' && this.bossSpawn && !this.boss && hero.cx > this.bossSpawn.x - 140) this.game.startBossEncounter(this);
  }
}
