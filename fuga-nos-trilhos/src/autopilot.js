// Piloto automático: usado no modo demo (atrás do menu), nas screenshots e
// como validação contínua de que existe rota possível.
import { LANES, LANE_W, TRAIN_H } from './config.js';
import { OB } from './obstacles.js';

export class Autopilot {
  constructor(track, player) { this.track = track; this.player = player; this.cool = 0; }

  /** Custo de uma pista nos próximos `range` metros: Infinity se bloqueada. */
  laneCost(lane, z, range, onTrainTop) {
    const x = LANES[lane];
    let cost = 0;
    const scan = (r) => {
      if (Math.abs(r.x - x) > 0.5) return;
      if (r.z1 < z - 1 || r.z0 > z + range) return;
      const d = Math.max(0, r.z0 - z);
      switch (r.type) {
        case OB.TRAIN:
          if (onTrainTop && r.z0 <= z + 2) return; // já em cima
          if (r.hasRamp) { cost += 0.5; return; }
          cost = Infinity; break;
        case OB.TRAIN_MOVING: cost = Infinity; break;
        case OB.RAMP: cost += 0.3; break;
        case OB.LOW: case OB.CONE: case OB.HOARDING: cost += 1 + (d < 6 ? 2 : 0); break;
        case OB.HIGH: case OB.ARCH: cost += 1.2 + (d < 6 ? 2 : 0); break;
        default: break;
      }
    };
    const c = this.track.chunkAt(z);
    if (c) { for (const r of c.obstacles) scan(r); const n = this.track.chunkAfter(c); if (n) for (const r of n.obstacles) scan(r); }
    for (const r of this.track.moving) if (r.active) scan(r);
    return cost;
  }

  update(dt, speed, game) {
    const p = this.player;
    if (!p.alive) return;
    this.cool -= dt;
    const z = p.z, lane = p.targetLane;
    const look = Math.max(18, speed * 0.9);
    const onTop = p.onTrain;
    // próximo obstáculo na pista atual
    let next = null;
    const consider = (r) => {
      if (Math.abs(r.x - LANES[lane]) > 0.5) return;
      if (r.z1 < z) return;
      if (r.type === OB.RAMP) return;
      if (r.type === OB.TRAIN && onTop && r.z0 <= z + 1) return;
      if (!next || r.z0 < next.z0) next = r;
    };
    const c = this.track.chunkAt(z);
    if (c) { for (const r of c.obstacles) consider(r); const n = this.track.chunkAfter(c); if (n) for (const r of n.obstacles) consider(r); }
    for (const r of this.track.moving) if (r.active) consider(r);
    if (!next) return;
    const dist = next.z0 - z;
    const react = speed * 0.33 + 2;
    const blocked = (next.type === OB.TRAIN && !next.hasRamp && !(p.sneakers > 0)) || next.type === OB.TRAIN_MOVING;
    if (blocked) {
      if (dist > look && next.type !== OB.TRAIN_MOVING) return;
      if (this.cool > 0) return;
      // escolher pista vizinha com menor custo
      let best = 0, bestCost = Infinity;
      for (const d of [-1, 1]) {
        const l = lane + d; if (l < 0 || l > 2) continue;
        const cost = this.laneCost(l, z, look * 1.2, onTop);
        if (cost < bestCost) { bestCost = cost; best = d; }
      }
      if (best !== 0 && bestCost < Infinity) { p.moveLane(best, game); this.cool = 0.35; }
      else if (bestCost === Infinity && dist < react) { // sem saída: tenta pular (tênis) ou mudar mesmo assim
        if (p.sneakers > 0) p.jump(game); else { const d = lane === 0 ? 1 : lane === 2 ? -1 : 1; p.moveLane(d, game); this.cool = 0.4; }
      }
      return;
    }
    if (dist < react && dist > -0.5) {
      if (next.type === OB.HIGH || next.type === OB.ARCH) { if (p.grounded && p.state !== 2) p.roll(game); }
      else if (next.type === OB.TRAIN && next.hasRamp) { /* sobe pela rampa */ }
      else if (p.grounded) p.jump(game);
    }
    // oportunismo: trocar para pista com moedas/power-up quando livre (leve)
    const _ = LANE_W + TRAIN_H;
  }
}
