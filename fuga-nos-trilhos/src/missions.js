// Missões simples (3 ativas por vez), progresso salvo em localStorage.
export const MISSION_DEFS = [
  { id: 'coins100', text: 'Pegue 100 moedas em uma corrida', stat: 'coins', goal: 100, run: true, reward: 150 },
  { id: 'coins300', text: 'Pegue 300 moedas em uma corrida', stat: 'coins', goal: 300, run: true, reward: 400 },
  { id: 'jump20', text: 'Pule 20 vezes', stat: 'jumps', goal: 20, run: false, reward: 100 },
  { id: 'roll15', text: 'Role 15 vezes em uma corrida', stat: 'rolls', goal: 15, run: true, reward: 150 },
  { id: 'dist1000', text: 'Corra 1.000 m em uma corrida', stat: 'distance', goal: 1000, run: true, reward: 200 },
  { id: 'dist3000', text: 'Corra 3.000 m em uma corrida', stat: 'distance', goal: 3000, run: true, reward: 600 },
  { id: 'barriers10', text: 'Supere 10 barreiras em uma corrida', stat: 'barriers', goal: 10, run: true, reward: 150 },
  { id: 'trains5', text: 'Corra em cima de 5 trens', stat: 'trainTops', goal: 5, run: false, reward: 200 },
  { id: 'power3', text: 'Use 3 power-ups em uma corrida', stat: 'powerups', goal: 3, run: true, reward: 250 },
  { id: 'jet2', text: 'Voe com a mochila a jato 2 vezes', stat: 'jets', goal: 2, run: false, reward: 250 },
  { id: 'magnet200', text: 'Pegue 200 moedas com o ímã', stat: 'magnetCoins', goal: 200, run: false, reward: 300 },
  { id: 'stumble0', text: 'Corra 800 m sem tropeçar', stat: 'cleanDistance', goal: 800, run: true, reward: 300 },
  { id: 'score20k', text: 'Faça 20.000 pontos em uma corrida', stat: 'score', goal: 20000, run: true, reward: 500 },
  { id: 'night500', text: 'Corra 500 m durante a noite', stat: 'nightDistance', goal: 500, run: false, reward: 250 },
  { id: 'rain500', text: 'Corra 500 m na chuva', stat: 'rainDistance', goal: 500, run: false, reward: 250 },
];

export class Missions {
  constructor(save) {
    this.save = save;
    const st = save.data.missions;
    if (!st.active || st.active.length < 3) this.pickNew(st);
  }
  pickNew(st) {
    st.active = st.active || [];
    st.done = st.done || [];
    st.progress = st.progress || {};
    const pool = MISSION_DEFS.filter((m) => !st.active.includes(m.id) && !st.done.includes(m.id));
    while (st.active.length < 3 && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      st.active.push(pool[i].id); pool.splice(i, 1);
    }
    if (st.active.length < 3) { st.done = []; this.pickNew(st); }
  }
  get active() { return this.save.data.missions.active.map((id) => MISSION_DEFS.find((m) => m.id === id)); }
  progress(def, runStats) {
    const st = this.save.data.missions;
    if (def.run) return Math.min(def.goal, runStats[def.stat] || 0);
    return Math.min(def.goal, st.progress[def.id] || 0);
  }
  /** Atualiza progresso ao fim (ou durante) a corrida; retorna missões concluídas. */
  update(runStats, commit) {
    const st = this.save.data.missions;
    const completed = [];
    for (const def of this.active) {
      if (!def) continue;
      let val;
      if (def.run) val = runStats[def.stat] || 0;
      else {
        if (commit) { st.progress[def.id] = (st.progress[def.id] || 0) + (runStats[def.stat] || 0); }
        val = (st.progress[def.id] || 0) + (commit ? 0 : (runStats[def.stat] || 0));
      }
      if (val >= def.goal && commit) {
        completed.push(def);
        st.done.push(def.id);
        st.active = st.active.filter((id) => id !== def.id);
        this.save.data.coins += def.reward;
      }
    }
    if (commit) { this.pickNew(st); this.save.write(); }
    return completed;
  }
}
