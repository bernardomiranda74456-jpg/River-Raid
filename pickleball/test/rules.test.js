'use strict';
// Rule-engine tests. No browser, no dependencies: node test/rules.test.js
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'js');
for (const f of ['court', 'physics', 'shots', 'match', 'ai']) {
  vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), { filename: f + '.js' });
}
const C = PB.Court;

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failures.push(name + '\n      ' + e.message); }
}
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || 'valor'}: esperado ${b}, veio ${a}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || 'condição falsa'); }

const mk = cfg => new PB.Match(Object.assign({ format: 'singles', humans: 1, difficulty: 'normal' }, cfg));

// Puts a rally in the state right after `shotCount` hits by `hitter`.
function midRally(m, hitter, shotCount, bounces) {
  m.state = 'live';
  m.ball.live = true;
  m.rally.shotCount = shotCount;
  m.rally.lastHitter = hitter;
  m.rally.bounces = bounces;
  m.rally.over = false;
}

// ── serve ─────────────────────────────────────────────────────────────────
test('saque sai da caixa direita quando o placar do sacador é par', () => {
  const m = mk({});
  eq(m.players[m.serverIdx].courtSide, 'R', 'lado do sacador');
  ok(m.serveXSign > 0, 'time 0 saca do lado +x (sua direita)');
  ok(Math.abs(m.players[m.serverIdx].z) > C.HALF_L, 'sacador atrás da linha de fundo');
});

test('saque troca para a caixa esquerda com placar ímpar', () => {
  const m = mk({});
  m.score[0] = 1;
  m.prepareServe();
  eq(m.players[m.serverIdx].courtSide, 'L', 'lado do sacador');
  ok(m.serveXSign < 0, 'saque pela esquerda');
});

test('recebedor fica na diagonal do sacador', () => {
  const m = mk({ format: 'doubles' });
  const recv = m.players[m.receiverIdx];
  eq(Math.sign(recv.x), -Math.sign(m.serveXSign), 'sinal x do recebedor');
  eq(recv.team, 1, 'time do recebedor');
});

test('saque bom na caixa diagonal continua o rally', () => {
  const m = mk({});
  midRally(m, m.serverIdx, 1, 0);
  m.onBounce(-m.serveXSign * 5, C.teamSign(1) * 17);
  eq(m.rally.over, false, 'rally seguiu');
  eq(m.rally.bounces, 1, 'quique contabilizado');
});

test('saque que cai na cozinha é falta', () => {
  const m = mk({});
  midRally(m, m.serverIdx, 1, 0);
  m.onBounce(-m.serveXSign * 4, C.teamSign(1) * 5);
  eq(m.lastReason, 'saque_cozinha');
  eq(m.lastWinner, 1, 'ponto para quem recebe');
});

test('saque na caixa errada é falta', () => {
  const m = mk({});
  midRally(m, m.serverIdx, 1, 0);
  m.onBounce(m.serveXSign * 5, C.teamSign(1) * 17);   // mesmo lado, não diagonal
  eq(m.lastReason, 'saque_fora');
});

test('saque longo demais é falta', () => {
  const m = mk({});
  midRally(m, m.serverIdx, 1, 0);
  m.onBounce(-m.serveXSign * 5, C.teamSign(1) * (C.HALF_L + 1.5));
  eq(m.lastReason, 'saque_fora');
});

// ── two-bounce rule ───────────────────────────────────────────────────────
test('voleio antes do quique é falta quando as regras são estritas', () => {
  const m = mk({ difficulty: 'dificil' });
  m.servingTeam = 1;                 // deixa o humano recebendo
  m.serverIdx = m.players.find(p => p.team === 1).id;
  m.prepareServe();
  const human = m.players[m.slot.p1];
  midRally(m, m.serverIdx, 1, 0);    // saque no ar, sem quicar
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 2.5;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'voleio_saque');
  eq(m.lastWinner, human.team === 0 ? 1 : 0, 'ponto para o adversário');
});

test('no modo assistido o voleio do saque é bloqueado em vez de virar falta', () => {
  const m = mk({ difficulty: 'normal' });   // assistRules = true
  m.servingTeam = 1;
  m.serverIdx = m.players.find(p => p.team === 1).id;
  m.prepareServe();
  const human = m.players[m.slot.p1];
  midRally(m, m.serverIdx, 1, 0);
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 2.5;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.rally.over, false, 'nenhuma falta');
  eq(m.rally.shotCount, 1, 'a bola não foi golpeada');
  ok(m.hint !== null, 'aviso mostrado ao jogador');
});

test('o terceiro golpe também tem que esperar o quique', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.slot.p1];          // time 0, que sacou
  midRally(m, 1, 2, 0);                        // devolução do adversário, no ar
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 2.5;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'voleio_saque', 'voleio no terceiro golpe é falta');
});

test('a partir do quarto golpe o voleio é liberado', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.slot.p1];
  midRally(m, 1, 3, 0);                        // já passou dos dois quiques
  human.z = C.teamSign(0) * 12;                // longe da cozinha
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 2.5;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.rally.over, false, 'sem falta');
  eq(m.rally.shotCount, 4, 'voleio contou como golpe');
});

test('mira do saque é contínua e sempre cai na caixa certa', () => {
  for (const team of [0, 1]) {
    const m = mk({ format: 'doubles' });
    m.servingTeam = team;
    m.serverIdx = m.players.find(p => p.team === team).id;
    m.prepareServe();
    const xs = -m.serveXSign;
    let prev = null;
    for (let lat = -1; lat <= 1.0001; lat += 0.1) {
      const aim = m.serveTarget(lat, 0.5, true);
      ok(C.inServiceBox(aim.x, aim.z, 1 - team, xs),
         `time ${team}: mira ${lat.toFixed(1)} caiu fora da caixa (x=${aim.x.toFixed(2)})`);
      if (prev !== null) {
        ok(Math.abs(aim.x - prev) < 1.2,
           `time ${team}: salto de ${Math.abs(aim.x - prev).toFixed(2)} ft na mira em ${lat.toFixed(1)}`);
      }
      prev = aim.x;
    }
    const left = m.serveTarget(-1, 0.5, true).x;
    const right = m.serveTarget(1, 0.5, true).x;
    ok(left < right, `time ${team}: mira à esquerda deve ficar à esquerda`);
  }
});

test('uma partida recém-criada já aceita um golpe', () => {
  const m = mk({});
  ok(m.pendingSwing && typeof m.pendingSwing === 'object', 'pendingSwing existe desde o início');
  midRally(m, 1, 3, 0);
  const human = m.players[m.slot.p1];
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 2.5;
  m.attemptHit(human);                          // sem swipe: não pode explodir
  eq(m.rally.shotCount, 3, 'sem swipe, sem golpe');
});

test('só o recebedor da diagonal pode devolver o saque', () => {
  const m = mk({ format: 'doubles', difficulty: 'dificil' });
  m.servingTeam = 0;
  m.prepareServe();
  const receiver = m.players[m.receiverIdx];
  const partner = m.mates(receiver.team).find(p => p.id !== receiver.id);
  partner.ctrl = 'human';                       // para poder forçar o golpe
  m.slot.p2 = partner.id;
  midRally(m, m.serverIdx, 1, 1);               // saque quicou
  m.ball.x = partner.x; m.ball.z = partner.z; m.ball.y = 2.4;
  m.pendingSwing[partner.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(partner);
  eq(m.lastReason, 'recebedor');
  eq(m.lastWinner, 0, 'ponto para quem sacou');
});

test('o recebedor correto devolve normalmente', () => {
  const m = mk({ format: 'doubles', difficulty: 'dificil' });
  m.servingTeam = 0;
  m.prepareServe();
  const receiver = m.players[m.receiverIdx];
  receiver.ctrl = 'human';
  m.slot.p2 = receiver.id;
  midRally(m, m.serverIdx, 1, 1);
  m.ball.x = receiver.x; m.ball.z = receiver.z; m.ball.y = 2.4;
  m.pendingSwing[receiver.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(receiver);
  eq(m.rally.over, false, 'sem falta');
  eq(m.rally.shotCount, 2, 'devolução contou');
});

test('segundo quique do mesmo lado perde o rally', () => {
  const m = mk({});
  midRally(m, m.serverIdx, 1, 1);
  m.onBounce(-m.serveXSign * 5, C.teamSign(1) * 17);
  eq(m.lastReason, 'dois_quiques');
  eq(m.lastWinner, 0, 'ponto para quem sacou');
});

// ── kitchen ───────────────────────────────────────────────────────────────
test('voleio com o pé na cozinha é falta', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.slot.p1];
  midRally(m, 1, 3, 0);                       // adversário bateu, sem quique
  human.x = 2; human.z = C.teamSign(0) * 3;   // dentro da cozinha
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 3.0;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'cozinha');
});

test('voleio fora da cozinha é legal', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.slot.p1];
  midRally(m, 1, 3, 0);
  human.x = 2; human.z = C.teamSign(0) * (C.KITCHEN + 1);
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 3.0;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.rally.over, false, 'sem falta');
  eq(m.rally.shotCount, 4, 'golpe contabilizado');
});

test('voleio com o pé da frente sobre a linha é falta, mesmo com o centro fora', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.slot.p1];
  midRally(m, 1, 3, 0);
  human.x = 2;
  human.speedN = 0; human.lunge = 0;
  human.z = C.teamSign(0) * (C.KITCHEN + 0.3);      // centro fora, pé dentro
  ok(!C.inKitchen(human.x, human.z, 0), 'o centro está fora da cozinha');
  ok(C.playerInKitchen(human), 'mas o jogador ocupa a linha');
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 3.0;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'cozinha');
});

test('voleio com um passo de folga da linha é legal', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.slot.p1];
  midRally(m, 1, 3, 0);
  human.x = 2; human.speedN = 0; human.lunge = 0;
  human.z = C.teamSign(0) * (C.KITCHEN + 1.0);
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 3.0;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.rally.over, false, 'sem falta');
  eq(m.rally.shotCount, 4, 'voleio contou');
});

test('correndo, a pegada aumenta e a folga exigida também', () => {
  const m = mk({ difficulty: 'dificil' });
  const p = m.players[m.slot.p1];
  p.z = C.teamSign(0) * (C.KITCHEN + 0.7);
  p.speedN = 0; p.lunge = 0;
  ok(!C.playerInKitchen(p), 'parado a essa distância está legal');
  p.speedN = 1;                                     // em corrida
  ok(C.playerInKitchen(p), 'em velocidade o pé da frente invade a zona');
});

test('a zona de não-voleio termina na linha lateral', () => {
  const m = mk({});
  const p = m.players[m.slot.p1];
  p.x = C.HALF_W + 2; p.z = C.teamSign(0) * 3;      // fora da lateral, junto à rede
  p.speedN = 0; p.lunge = 0;
  ok(!C.playerInKitchen(p), 'fora da lateral pode voleiar junto à rede');
});

test('entrar na cozinha por impulso após o voleio é falta', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.slot.p1];
  m.state = 'live';
  human.volleyMomentum = 0.4;
  human.x = 0; human.z = C.teamSign(0) * 3;    // arrastado para dentro
  m.movePlayer(human, 1 / 60);
  eq(m.lastReason, 'impulso');
});

test('a CPU é segurada fora da cozinha em vez de cometer a falta', () => {
  const m = mk({ difficulty: 'dificil' });
  const cpu = m.players.find(p => p.ctrl === 'cpu');
  m.state = 'live';
  cpu.volleyMomentum = 0.4;
  cpu.x = 0; cpu.z = C.teamSign(cpu.team) * 3;
  m.movePlayer(cpu, 1 / 60);
  eq(m.rally.over, false, 'sem falta');
  ok(Math.abs(cpu.z) >= C.KITCHEN, 'a CPU foi mantida atrás da linha');
});

// ── scoring ───────────────────────────────────────────────────────────────
test('sacar com o pé dentro da quadra é falta no modo estrito', () => {
  const m = mk({ difficulty: 'dificil' });
  const server = m.players[m.serverIdx];
  server.z = C.teamSign(server.team) * (C.HALF_L - 1.5);   // pisou dentro
  m.doServe({ x: -m.serveXSign * 4, z: C.teamSign(1) * 17 }, 1);
  eq(m.lastReason, 'pe_no_saque');
  eq(m.lastWinner, 1, 'ponto para quem recebe');
});

test('no modo assistido o sacador é reposicionado em vez de perder o ponto', () => {
  const m = mk({ difficulty: 'normal' });
  const server = m.players[m.serverIdx];
  server.z = C.teamSign(server.team) * (C.HALF_L - 1.5);
  m.doServe({ x: -m.serveXSign * 4, z: C.teamSign(1) * 17 }, 1);
  eq(m.rally.over, false, 'sem falta');
  ok(Math.abs(server.z) >= C.HALF_L, 'sacador voltou para trás da linha');
  eq(m.state, 'live', 'o saque saiu');
});

test('sacar da metade errada é corrigido ou é falta', () => {
  const m = mk({ difficulty: 'dificil' });
  const server = m.players[m.serverIdx];
  server.x = -m.serveXSign * 4;                     // metade errada
  m.doServe({ x: -m.serveXSign * 4, z: C.teamSign(1) * 17 }, 1);
  eq(m.lastReason, 'pe_no_saque');
});

test('só quem saca pontua', () => {
  const m = mk({});
  m.endRally(1, 'fora');                    // time 1 perde o rally, time 0 sacava
  eq(m.score, [1, 0], 'placar');
  m.afterPoint();
  m.endRally(0, 'fora');                    // agora quem saca erra
  eq(m.score, [1, 0], 'placar não muda na troca de saque');
  eq(m.servingTeam, 1, 'saque passou');
});

test('duplas começam em 0-0-2 e a primeira falta já troca o saque', () => {
  const m = mk({ format: 'doubles' });
  eq(m.serverNumber, 2, 'primeiro sacador do jogo é o segundo sacador');
  m.endRally(0, 'fora');                    // time que saca erra
  eq(m.servingTeam, 1, 'side out imediato');
  eq(m.serverNumber, 1, 'novo time começa no primeiro sacador');
});

test('nas duplas os dois parceiros sacam antes do side out', () => {
  const m = mk({ format: 'doubles' });
  m.endRally(0, 'fora');                    // side out para o time 1 (0-0-2)
  const first = m.serverIdx;
  m.afterPoint();
  m.endRally(1, 'fora');                    // sacador 1 erra
  eq(m.serverNumber, 2, 'passa para o sacador 2');
  eq(m.servingTeam, 1, 'mesmo time');
  ok(m.serverIdx !== first, 'quem saca agora é o parceiro');
  m.afterPoint();
  m.endRally(1, 'fora');                    // sacador 2 erra
  eq(m.servingTeam, 0, 'agora sim troca de time');
});

test('parceiros trocam de lado a cada ponto do time que saca', () => {
  const m = mk({ format: 'doubles' });
  const a = m.players[0], b = m.players[1];
  const before = [a.courtSide, b.courtSide];
  m.endRally(1, 'fora');                    // time 0 pontua
  eq([a.courtSide, b.courtSide], [before[1], before[0]], 'lados trocados');
  m.afterPoint();
  const now = [a.courtSide, b.courtSide];
  m.endRally(0, 'fora');                    // time 0 erra: ninguém troca
  eq([a.courtSide, b.courtSide], now, 'lados mantidos no side out');
});

test('após o side out saca quem está na quadra da direita', () => {
  const m = mk({ format: 'doubles' });
  m.endRally(0, 'fora');
  const server = m.players[m.serverIdx];
  eq(server.team, 1, 'time correto');
  eq(server.courtSide, 'R', 'sacador vem da direita');
});

test('vitória exige dois pontos de vantagem', () => {
  const m = mk({ targetPoints: 11 });
  m.score = [10, 10];
  m.endRally(1, 'fora');
  eq(m.score, [11, 10], 'placar');
  eq(m.winner, -1, 'ainda não acabou');
  m.afterPoint();
  m.endRally(1, 'fora');
  eq(m.score, [12, 10], 'placar');
  eq(m.winner, 0, 'partida encerrada');
});

test('placar de duplas é dito sacador-recebedor-número', () => {
  const m = mk({ format: 'doubles' });
  m.score = [4, 3];
  eq(m.scoreText(), '4 - 3 - 2');
  m.endRally(0, 'fora');                    // side out
  eq(m.scoreText(), '3 - 4 - 1', 'placar sempre pela ótica de quem saca');
});

// ── ball in and out ───────────────────────────────────────────────────────
test('bola na linha é dentro, bola fora da linha é falta', () => {
  const m = mk({});
  midRally(m, 0, 3, 0);
  m.onBounce(C.HALF_W - 0.05, C.teamSign(1) * (C.HALF_L - 0.05));
  eq(m.rally.over, false, 'bola na linha vale');

  const m2 = mk({});
  midRally(m2, 0, 3, 0);
  m2.onBounce(C.HALF_W + 0.6, C.teamSign(1) * 10);
  eq(m2.lastReason, 'fora');
  eq(m2.lastWinner, 1, 'ponto para quem não errou');
});

test('bola que não passa da rede é falta de quem bateu', () => {
  const m = mk({});
  midRally(m, 0, 3, 0);
  m.onBounce(2, C.teamSign(0) * 8);         // quicou no próprio campo
  eq(m.lastReason, 'nao_passou');
  eq(m.lastWinner, 1);
});

// ── physics sanity ────────────────────────────────────────────────────────
test('golpes chegam ao alvo escolhido, com folga na rede', () => {
  const cases = [
    ['serve', { x: 5, y: 2.2, z: -23 }, { x: -5, z: 16 }],
    ['drive', { x: 2, y: 2.6, z: -14 }, { x: -4, z: 18 }],
    ['dink', { x: 3, y: 1.4, z: -8 }, { x: -4, z: 4 }],
    ['lob', { x: 0, y: 2.0, z: -8 }, { x: 0, z: 20 }],
  ];
  for (const [style, from, to] of cases) {
    const v = PB.Shots.plan(from, { x: to.x, y: C.BALL_R, z: to.z }, style, 1);
    const r = PB.Shots.fly(from, v, C.BALL_R);
    ok(Math.hypot(r.x - to.x, r.z - to.z) < 1.0, `${style} caiu a ${Math.hypot(r.x - to.x, r.z - to.z).toFixed(2)} ft do alvo`);
    ok(r.crossed && r.clear > 0, `${style} passou da rede (folga ${r.clear.toFixed(2)} ft)`);
  }
});

test('a bola quica e perde altura, e a rede segura a bola baixa', () => {
  const b = PB.Physics.newBall();
  b.x = 0; b.y = 4; b.z = -10; b.live = true;
  const land = PB.Physics.predictLanding(b, 5);
  ok(land && Math.abs(land.z + 10) < 0.01, 'bola solta cai no lugar');

  const n = PB.Physics.newBall();
  n.x = 0; n.y = 1.2; n.z = -1; n.vz = 30; n.live = true;
  const ev = {};
  for (let i = 0; i < 40; i++) PB.Physics.step(n, 1 / 240, ev);
  ok(n.z < 1, 'bola baixa não atravessa a rede');
});

// ── report ────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} testes passaram`);
if (failures.length) {
  console.log(`  ${failures.length} falharam:\n`);
  for (const f of failures) console.log('    ✗ ' + f);
  process.exit(1);
}
console.log('  tudo verde\n');
