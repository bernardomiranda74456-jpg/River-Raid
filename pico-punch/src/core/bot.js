// Bot de teste: segue waypoints (tiles) definidos em level.json.botPath usando apenas entradas de jogador.
// Valida colisões (nunca dentro de sólido) e registra eventos. Ativado com ?bot=1.
import { TILE, T, isSolidType, isOneWayType, isClimbType, isHazardType, isBreakableType } from '../world/tilemap.js';
const punchable = (t) => isBreakableType(t) && t !== T.HIDDEN;
export class Bot {
  constructor(game) { this.game = game; this.i = 0; this.jumpHold = 0; this.punchCd = 0; this.log = []; this.violations = 0; this.stuckT = 0; this.lastX = 0; this.done = false; this.frames = 0; this.path = null; }
  reset(level) { this.i = 0; this.lastDeaths = level.deaths; this.path = (level.json.botPath || []).map(([x, y]) => ({ x: x * TILE + 8, y: (y + 1) * TILE })); this.done = false; this.frames = 0; this.violations = 0; this.log.length = 0; }
  update(dt) {
    const g = this.game; const lv = g.level; const inp = g.input; const T = inp.touch;
    for (const k of ['left', 'right', 'up', 'down', 'jump', 'punch']) T[k] = false;
    if (!lv || g.state !== 'play') { if (g.state === 'results' || g.state === 'gameover') T.jump = (this.frames % 30) === 0; this.frames++; return; }
    if (this.path === null || this.level !== lv) { this.level = lv; this.reset(lv); }
    this.frames++; const h = lv.hero; if (h.state === 'dead' || h.state === 'eat' || lv.state !== 'play') return;
    if (lv.deaths !== this.lastDeaths) { // renasceu: volta ao waypoint mais próximo já visitado
      this.lastDeaths = lv.deaths; let best = 0, bd = 1e9; for (let k = 0; k <= Math.min(this.i, this.path.length - 1); k++) { const w = this.path[k]; const d = Math.hypot(w.x - h.cx, w.y - h.bottom); if (d < bd) { bd = d; best = k; } }
      this.i = bd < 96 ? best + 1 : 0; this.log.push(`respawn: retomando do waypoint ${this.i}`); this.jumpHold = 0;
    }
    const map = lv.map;
    // validação de colisão: o herói nunca deve estar dentro de um tile sólido
    if (map.anyInRect(h.x + 1, h.y + 1, h.w - 2, h.h - 2, (t) => isSolidType(t))) { this.violations++; if (this.violations < 5) this.log.push(`colisão: herói dentro de sólido em (${h.x.toFixed(1)},${h.y.toFixed(1)}) frame ${this.frames}`); }
    if (this.i >= this.path.length) { T.right = true; return; }
    { // caiu longe do caminho (sem morrer): retoma do waypoint visitado mais próximo
      const w = this.path[this.i]; if (w.y - h.bottom < -96 && h.onGround && h.state !== 'climb') { let best = -1, bd = 1e9; for (let k = 0; k < this.i; k++) { const q = this.path[k]; const d = Math.hypot(q.x - h.cx, q.y - h.bottom); if (d < bd) { bd = d; best = k; } } if (best >= 0 && bd < 64 && best + 1 < this.i) { this.i = best + 1; this.log.push(`queda: retomando do waypoint ${this.i}`); } }
    }
    const wp = this.path[this.i]; const dx = wp.x - h.cx; const dy = wp.y - h.bottom; // dy<0: alvo acima
    if (Math.abs(dx) < 6 && Math.abs(dy) < 20) { this.i++; this.log.push(`waypoint ${this.i} alcançado no frame ${this.frames}`); return; }
    const dir = dx > 0 ? 1 : -1;
    const climbing = h.state === 'climb';
    const onLadderTile = isClimbType(map.getAt(h.cx, h.cy)) || isClimbType(map.getAt(h.cx, h.bottom - 2)) || isClimbType(map.getAt(h.cx, h.bottom + 1));
    if (climbing) {
      if (dy < -6) T.up = true; // alvo acima: sobe
      else if (Math.abs(dx) > 12) { const sideSolid = isSolidType(map.getAt(h.cx + dir * 12, h.bottom - 0.4)) || isSolidType(map.getAt(h.cx + dir * 12, h.y + 4)); if (sideSolid) T.up = true; else if (dir > 0) T.right = true; else T.left = true; } // alvo ao lado: sobe até liberar e sai da escada
      else if (dy > 6) T.down = true; else { if (dir > 0) T.right = true; else T.left = true; }
      return;
    }
    if (onLadderTile && dy < -12 && Math.abs(dx) < 10) { T.up = true; return; }
    if (onLadderTile && dy > 12 && Math.abs(dx) < 12 && h.onGround) { T.down = true; return; }
    if (Math.abs(dx) > 3) { if (dir > 0) T.right = true; else T.left = true; }
    // inimigos: soca o que entra no alcance (à frente ou caindo por cima); não espera nem recua
    this.punchCd -= dt; let fx = h.facing; let threat = false; let nearest = null; let retreating = false;
    for (const e of lv.entities) { if (!e.punchable || e.remove || !e.active) continue; const ex = e.cx - h.cx, ey = e.cy - h.cy; if (Math.abs(ex) < 60 && Math.abs(ey) < 48 && (!nearest || Math.abs(ex) < Math.abs(nearest.cx - h.cx))) nearest = e; }
    if (nearest) {
      const ex = nearest.cx - h.cx; const edir = ex > 0 ? 1 : -1; const above = nearest.cy < h.y + 2;
      if (above && Math.abs(ex) < 24 && h.onGround) { T.left = T.right = false; if (this.punchCd <= 0) { T.up = true; T.punch = true; this.punchCd = 0.26; } threat = true; }
      else if (Math.abs(ex) < 26 && Math.abs(nearest.cy - h.cy) < 30 && h.onGround) { T.left = T.right = false; if (edir !== fx) { if (edir > 0) T.right = true; else T.left = true; } else if (this.punchCd <= 0) { T.punch = true; this.punchCd = 0.26; } threat = true; }
    }
    const handX = h.cx + fx * 14, handY = h.y + 5;
    if (punchable(map.getAt(handX, handY)) || punchable(map.getAt(handX, h.y + h.h - 4))) threat = true;
    if (threat && this.punchCd <= 0 && (!nearest || Math.abs(nearest.cx - h.cx) > 34)) { T.punch = true; this.punchCd = 0.32; }
    // pulo: parede, buraco, espinho, degrau, alvo acima
    if (h.onGround && this.jumpHold <= 0 && !retreating) {
      const aheadX = h.cx + dir * 12; const footY = h.bottom + 2;
      const groundAhead = isSolidType(map.getAt(aheadX, footY)) || isOneWayType(map.getAt(aheadX, footY)) || isClimbType(map.getAt(aheadX, footY));
      const gapAhead = !groundAhead && !isSolidType(map.getAt(aheadX, footY + TILE)) && !isOneWayType(map.getAt(aheadX, footY + TILE));
      const wx = h.cx + dir * 9; const wallAhead = isSolidType(map.getAt(wx, h.y + h.h - 3)) || isSolidType(map.getAt(wx, h.y + h.h / 2)) || isSolidType(map.getAt(wx, h.y + 2));
      const hazardAhead = isHazardType(map.getAt(h.cx + dir * 14, h.bottom - 2)) || isHazardType(map.getAt(h.cx + dir * 24, h.bottom - 2));
      const targetAbove = dy < -12 && Math.abs(dx) < 44;
      const enemyClose = !!nearest && Math.abs(nearest.cx - h.cx) < 40 && !gapAhead;
      if ((wallAhead || (gapAhead && Math.abs(dx) > 10 && dy <= 24) || hazardAhead || targetAbove) && !enemyClose) { T.jump = true; this.jumpHold = targetAbove || gapAhead ? 0.32 : 0.2; }
    } else if (this.jumpHold > 0) { this.jumpHold -= dt; T.jump = true; }
    if (T.jump && this.prevJump && this.jumpHold <= 0) T.jump = false; // solta por 1 frame para gerar nova borda (hit-stop pode engolir o 'pressed')
    this.prevJump = T.jump;
    // detector de travamento: se não progride por 4 s, tenta pular
    if (Math.abs(h.x - this.lastX) < 0.5) { this.stuckT += dt; if (this.stuckT > 2.5) { T.jump = true; this.jumpHold = 0.3; if (this.stuckT > 4) { this.log.push(`travado em (${h.x.toFixed(0)},${h.y.toFixed(0)}) indo para waypoint ${this.i}`); this.stuckT = 0; } } } else this.stuckT = 0;
    this.lastX = h.x;
  }
}
