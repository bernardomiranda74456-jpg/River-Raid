// Piloto automático: usado no modo demo (atrás do menu), nas screenshots e
// como validação contínua de que existe rota possível.
import { LANES, LANE_W, TRAIN_H } from './config.js';
import { OB } from './obstacles.js';

const STEP = 2;          // metros por célula
const STEPS = 40;        // horizonte de 80 m
const FREE = 0, BAR = 1, TRAIN = 2, RAMP = 3, MOVING = 4, HIGHB = 5;

export class Autopilot {
  constructor(track, player) {
    this.track = track; this.player = player; this.cool = 0;
    this.cells = [new Uint8Array(STEPS), new Uint8Array(STEPS), new Uint8Array(STEPS)];
    // custo mínimo por (pista, nível, passo) e ponteiros para reconstruir
    this.cost = new Float32Array(3 * 2 * STEPS);
    this.from = new Int16Array(3 * 2 * STEPS);
  }

  /** Preenche a grade de células a partir dos registros de obstáculos. */
  fillCells(z) {
    const C = this.cells;
    for (let l = 0; l < 3; l++) C[l].fill(FREE);
    const mark = (r) => {
      const lane = r.lane;
      if (lane < 0 || lane > 2) return;
      let type;
      switch (r.type) {
        case OB.TRAIN: type = TRAIN; break;
        case OB.TRAIN_MOVING: type = MOVING; break;
        case OB.RAMP: type = RAMP; break;
        case OB.HIGH: case OB.ARCH: type = HIGHB; break;
        default: type = BAR; break;
      }
      let za = r.z0, zb = r.z1;
      if (type === MOVING) { za = Math.min(z, r.z0 - 30); zb = r.z1 + 10; } // vem na nossa direção
      else if (type === TRAIN) { za -= 0.5; zb += 1.5; }                     // margem de segurança lateral
      const k0 = Math.max(0, Math.floor((za - z) / STEP)), k1 = Math.min(STEPS - 1, Math.floor((zb - z) / STEP));
      for (let k = k0; k <= k1; k++) if (C[lane][k] < type || type === MOVING) C[lane][k] = type;
    };
    const c = this.track.chunkAt(z);
    if (c) {
      for (const r of c.obstacles) mark(r);
      const n = this.track.chunkAfter(c); if (n) { for (const r of n.obstacles) mark(r); const n2 = this.track.chunkAfter(n); if (n2) for (const r of n2.obstacles) mark(r); }
    }
    for (const r of this.track.moving) if (r.active) mark(r);
  }

  /**
   * Programação dinâmica sobre (pista, nível, passo). Nível 0 = chão, 1 = em
   * cima de trem. Retorna a pista alvo do primeiro movimento (ou -1 = ficar).
   */
  plan(lane, onTop, sneakers) {
    const C = this.cells, cost = this.cost, from = this.from;
    const idx = (l, v, k) => (l * 2 + v) * STEPS + k;
    cost.fill(Infinity); from.fill(-1);
    const enterCost = (l, v, k, sneak) => { // custo de ocupar a célula; Infinity se impossível
      const t = C[l][k];
      if (t === MOVING) return Infinity;
      if (v === 0) { if (t === TRAIN) return sneak ? 1.5 : Infinity; if (t === BAR) return 1; if (t === HIGHB) return 1.2; if (t === RAMP) return 0.2; return 0; }
      return t === TRAIN ? 0 : Infinity; // nível 1 só existe sobre trem
    };
    // estado inicial
    const v0 = onTop ? 1 : 0;
    const t0 = C[lane][0];
    cost[idx(lane, v0, 0)] = 0;
    if (v0 === 1 && t0 !== TRAIN) cost[idx(lane, 0, 0)] = 0; // caindo do trem
    for (let k = 0; k < STEPS - 1; k++) {
      for (let l = 0; l < 3; l++) for (let v = 0; v < 2; v++) {
        const c0 = cost[idx(l, v, k)];
        if (c0 === Infinity) continue;
        const here = C[l][k];
        // transições de nível ao avançar na mesma pista
        const nexts = [];
        const tn = C[l][k + 1];
        if (v === 0) {
          if (here === RAMP && tn === TRAIN) nexts.push([l, 1]); else nexts.push([l, 0]);
          if (sneakers && tn === TRAIN) nexts.push([l, 1]);
        } else {
          if (tn === TRAIN) nexts.push([l, 1]); else nexts.push([l, 0]); // cai
        }
        // trocas de pista (mesmo nível): a pista de destino precisa estar livre
        // nos 2 passos seguintes (4 m) e não bloqueada no terceiro (tempo de pular)
        for (const d of [-1, 1]) {
          const m = l + d; if (m < 0 || m > 2) continue;
          if (v === 1) { if (C[m][k] === TRAIN && C[m][k + 1] === TRAIN && C[m][k + 2] === TRAIN) nexts.push([m, 1]); }
          else {
            const h = C[m][k], a = C[m][k + 1], b = k + 2 < STEPS ? C[m][k + 2] : FREE, c = k + 3 < STEPS ? C[m][k + 3] : FREE;
            if (h === FREE && a === FREE && b !== TRAIN && b !== MOVING && b !== RAMP && c !== TRAIN && c !== MOVING) nexts.push([m, 0]);
          }
        }
        for (const [m, w] of nexts) {
          const ec = enterCost(m, w, k + 1, sneakers);
          if (ec === Infinity) continue;
          const nc = c0 + ec + (m !== l ? 0.05 + k * 0.004 : 0); // trocar cedo é melhor que tarde
          const j = idx(m, w, k + 1);
          if (nc < cost[j]) { cost[j] = nc; from[j] = idx(l, v, k); }
        }
      }
    }
    // melhor estado final
    let best = -1, bc = Infinity;
    for (let l = 0; l < 3; l++) for (let v = 0; v < 2; v++) { const j = idx(l, v, STEPS - 1); if (cost[j] < bc) { bc = cost[j]; best = j; } }
    if (best < 0) { // sem caminho completo: pega o estado alcançável mais distante
      for (let k = STEPS - 2; k > 0 && best < 0; k--) for (let l = 0; l < 3; l++) for (let v = 0; v < 2; v++) { const j = idx(l, v, k); if (cost[j] < bc) { bc = cost[j]; best = j; } }
      if (best < 0) return -1;
    }
    // reconstrói até o passo 1 e devolve a pista do passo 1
    let j = best, prev = -1;
    while (j >= 0 && from[j] >= 0) { prev = j; j = from[j]; }
    if (prev < 0) return -1;
    const laneAt1 = Math.floor(prev / (2 * STEPS));
    return laneAt1 === lane ? -1 : laneAt1;
  }

  update(dt, speed, game) {
    const p = this.player;
    if (!p.alive || p.jetpack > 0) return;
    this.cool -= dt;
    const z = p.z, lane = p.targetLane;
    this.fillCells(z);
    if (this.cool <= 0 && p.laneT >= 1) {
      const target = this.plan(lane, p.groundY >= TRAIN_H - 0.1, false); // tênis de mola: só reativo
      if (target >= 0 && target !== lane) { p.moveLane(target > lane ? 1 : -1, game); this.cool = 0.25; }
    }
    // pulo/rolamento com distância exata ao próximo obstáculo da pista atual
    let next = null;
    const lx = LANES[lane];
    const consider = (r) => {
      if (Math.abs(r.x - lx) > 0.5 || r.z1 < z || r.type === OB.RAMP) return;
      if (r.type === OB.TRAIN && (p.onTrain || r.hasRamp)) return;
      if (!next || r.z0 < next.z0) next = r;
    };
    const c = this.track.chunkAt(z);
    if (c) { for (const r of c.obstacles) consider(r); const n = this.track.chunkAfter(c); if (n) for (const r of n.obstacles) consider(r); }
    if (!next || !p.grounded) return;
    const dist = next.z0 - z;
    if (next.type === OB.HIGH || next.type === OB.ARCH) { if (dist < speed * 0.3 + 1 && p.state !== 2) p.roll(game); }
    else if (next.type === OB.TRAIN) { if (p.sneakers > 0 && dist < speed * 0.5 && dist > speed * 0.33) p.jump(game); }
    else if (next.type !== OB.TRAIN_MOVING) { if (dist <= speed * 0.4 + 0.5) p.jump(game); }
    const _ = LANE_W + TRAIN_H;
  }
}
