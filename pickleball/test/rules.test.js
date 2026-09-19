'use strict';
// Rule-engine tests. No browser, no dependencies: node test/rules.test.js
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'js');
for (const f of ['i18n', 'court', 'physics', 'shots', 'stroke', 'match', 'ai', 'tutorial']) {
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

const mk = cfg => new PB.Match(Object.assign({ format: 'singles', difficulty: 'normal' }, cfg));

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
  const human = m.players[m.humanIdx];
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
  const human = m.players[m.humanIdx];
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
  const human = m.players[m.humanIdx];          // time 0, que sacou
  midRally(m, 1, 2, 0);                        // devolução do adversário, no ar
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 2.5;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'voleio_saque', 'voleio no terceiro golpe é falta');
});

test('a partir do quarto golpe o voleio é liberado', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.humanIdx];
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
  const human = m.players[m.humanIdx];
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
  const human = m.players[m.humanIdx];
  midRally(m, 1, 3, 0);                       // adversário bateu, sem quique
  human.x = 2; human.z = C.teamSign(0) * 3;   // dentro da cozinha
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 3.0;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'cozinha');
});

test('voleio fora da cozinha é legal', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.humanIdx];
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
  const human = m.players[m.humanIdx];
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
  const human = m.players[m.humanIdx];
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
  const p = m.players[m.humanIdx];
  p.z = C.teamSign(0) * (C.KITCHEN + 0.7);
  p.speedN = 0; p.lunge = 0;
  ok(!C.playerInKitchen(p), 'parado a essa distância está legal');
  p.speedN = 1;                                     // em corrida
  ok(C.playerInKitchen(p), 'em velocidade o pé da frente invade a zona');
});

test('a zona de não-voleio termina na linha lateral', () => {
  const m = mk({});
  const p = m.players[m.humanIdx];
  p.x = C.HALF_W + 2; p.z = C.teamSign(0) * 3;      // fora da lateral, junto à rede
  p.speedN = 0; p.lunge = 0;
  ok(!C.playerInKitchen(p), 'fora da lateral pode voleiar junto à rede');
});

test('entrar na cozinha por impulso após o voleio é falta', () => {
  const m = mk({ difficulty: 'dificil' });
  const human = m.players[m.humanIdx];
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

test('o parceiro da CPU não rebate a bola que a própria dupla acabou de bater', () => {
  const m = mk({ format: 'doubles', difficulty: 'dificil' });
  const [a, b] = m.mates(0);
  midRally(m, a.id, 3, 0);
  // a weak shot by a, dying on their own side, right at b's feet
  cleanContact(m, b);
  m.ball.y = 2.0; m.ball.vz = 4; b.hitCd = 0;
  const before = m.rally.shotCount;
  m.checkHits();
  eq(m.rally.shotCount, before, 'a CPU deixou a bola passar');
  eq(m.rally.lastHitter, a.id, 'o último golpe continua sendo do primeiro');
  ok(!m.rally.over, 'o rali só termina quando a bola quicar');
});

test('humano que bate na bola do parceiro comete falta de dois golpes', () => {
  const m = mk({ format: 'doubles', difficulty: 'dificil' });
  const a = m.players[m.humanIdx];
  const b = m.mates(a.team).find(p => p.id !== a.id);
  b.ctrl = 'human';                              // para poder forçar o golpe
  midRally(m, a.id, 3, 0);
  cleanContact(m, b);
  b.hitCd = 0;
  m.pendingSwing[b.id] = humanSwing(m, b, { power: 0.5 });
  m.checkHits();
  ok(m.rally.over, 'o rali terminou');
  eq(m.lastReason, 'dois_golpes');
  eq(m.lastWinner, 1, 'ponto para os adversários');
});

test('no nível normal o segundo golpe da dupla vira aviso, e o golpe é descartado', () => {
  const m = mk({ format: 'doubles', difficulty: 'normal' });
  const a = m.players[m.humanIdx];
  const b = m.mates(a.team).find(p => p.id !== a.id);
  b.ctrl = 'human';
  midRally(m, a.id, 3, 0);
  cleanContact(m, b);
  b.hitCd = 0;
  m.pendingSwing[b.id] = humanSwing(m, b, { power: 0.5 });
  m.checkHits();
  ok(!m.rally.over, 'sem falta com as regras assistidas');
  eq(m.rally.lastHitter, a.id, 'a bola não foi rebatida');
  ok(!m.pendingSwing[b.id], 'o deslize foi consumido');
  eq(m.hint, PB.I18n.t('hint.partnerhit'), 'aviso na tela');
});

test('bola fraca que quica no próprio campo é falta, e a mensagem distingue a rede', () => {
  const m = mk({});
  midRally(m, 0, 3, 0);
  m.rally.netTouch = false;
  m.onBounce(2, C.teamSign(0) * 8);
  eq(m.lastReason, 'nao_passou');
  eq(PB.Match.reasonText('nao_passou', m).label, PB.I18n.t('reason.nao_passou'));
  const m2 = mk({});
  midRally(m2, 0, 3, 0);
  m2.rally.netTouch = true;
  m2.onBounce(2, C.teamSign(0) * 8);
  eq(PB.Match.reasonText('nao_passou', m2).label, PB.I18n.t('reason.na_rede'));
});

test('a partida tem um humano só, em simples e em duplas', () => {
  for (const format of ['singles', 'doubles']) {
    const m = mk({ format });
    const humanos = m.players.filter(p => p.ctrl === 'human');
    eq(humanos.length, 1, format + ': um humano');
    eq(humanos[0].id, m.humanIdx, format + ': é o jogador do índice humano');
    eq(m.players.length, format === 'doubles' ? 4 : 2, format + ': gente em quadra');
  }
});

test('os três idiomas têm todas as chaves e nenhuma sobra', () => {
  const D = PB.I18n.DICT;
  const base = Object.keys(D.en);
  for (const l of PB.I18n.LANGS) {
    const faltando = base.filter(k => D[l][k] === undefined);
    const sobrando = Object.keys(D[l]).filter(k => base.indexOf(k) < 0);
    eq(faltando.length, 0, l + ' sem chaves faltando: ' + faltando.join(', '));
    eq(sobrando.length, 0, l + ' sem chaves sobrando: ' + sobrando.join(', '));
    for (const k of base) ok(String(D[l][k]).length > 0, l + '/' + k + ' não é vazio');
  }
});

test('trocar de idioma troca as chamadas e o tutorial', () => {
  const m = mk({});
  midRally(m, 0, 3, 0);
  m.rally.netTouch = true;
  const antes = PB.I18n.lang;
  PB.I18n.setLang('en');
  eq(PB.Match.reasonText('fora', m).label, 'Ball out');
  eq(PB.Tutorial.steps()[0].title, 'Two thumbs');
  PB.I18n.setLang('es');
  eq(PB.Match.reasonText('fora', m).label, 'Bola fuera');
  eq(PB.Tutorial.steps()[0].title, 'Dos dedos');
  PB.I18n.setLang('pt');
  eq(PB.Match.reasonText('fora', m).label, 'Bola fora');
  eq(PB.Tutorial.steps()[0].title, 'Dois dedos');
  PB.I18n.setLang(antes);
});

test('os oito passos do tutorial vêm inteiros nos três idiomas', () => {
  const antes = PB.I18n.lang;
  for (const l of PB.I18n.LANGS) {
    PB.I18n.setLang(l);
    const st = PB.Tutorial.steps();
    eq(st.length, 8, l + ': oito passos');
    for (const s of st) {
      ok(s.title && s.title.indexOf('tut.') < 0, l + ': título traduzido');
      ok(s.body && s.body.indexOf('tut.') < 0, l + ': texto traduzido');
      ok(s.stage && s.stage.indexOf('${') < 0, l + ': desenho montado');
    }
  }
  PB.I18n.setLang(antes);
});

test('o sacador não sai da linha de fundo nem do lado certo', () => {
  for (const format of ['singles', 'doubles']) {
    const m = mk({ format });
    const server = m.players[m.serverIdx];
    server.ctrl = 'human';
    const z0 = server.z;
    const lado = m.serveXSign;
    // empurra para a frente, para trás e para o lado errado, por dois segundos
    for (const [mx, mz] of [[0, 1], [0, -1], [-lado, 0], [lado, 0]]) {
      server.mx = mx; server.mz = mz;
      for (let i = 0; i < 120; i++) m.movePlayer(server, 1 / 60);
      ok(Math.abs(server.z - z0) < 1e-6, `${format}: continua na linha de fundo (z=${server.z.toFixed(2)})`);
      ok(Math.abs(server.z) > C.HALF_L, `${format}: atrás da linha de fundo`);
      ok(Math.sign(server.x) === lado, `${format}: continua no lado do saque (x=${server.x.toFixed(2)})`);
      ok(Math.abs(server.x) <= C.HALF_W + 1e-6, `${format}: não passa da linha lateral`);
      ok(Math.abs(server.x) >= 0.6, `${format}: não pisa na linha do meio`);
    }
    // e o saque daí é legal
    server.mx = 0; server.mz = 0;
    m.doServe(m.serveTarget(0, 0.5, true), 0.8);
    ok(m.lastReason !== 'pe_no_saque', `${format}: saque sem falta de pé`);
  }
});

test('depois do saque o jogador volta a andar para frente e para trás', () => {
  const m = mk({});
  const server = m.players[m.serverIdx];
  server.ctrl = 'human';
  m.doServe(m.serveTarget(0, 0.5, true), 0.8);
  eq(m.state, 'live', 'a bola está em jogo');
  const z0 = server.z;
  server.mx = 0; server.mz = 1;
  for (let i = 0; i < 60; i++) m.movePlayer(server, 1 / 60);
  ok(Math.abs(server.z) < Math.abs(z0) - 1, `avançou para a quadra (${z0.toFixed(1)} -> ${server.z.toFixed(1)})`);
});

test('quem recebe anda livre enquanto espera o saque', () => {
  const m = mk({});
  const receiver = m.players[m.receiverIdx];
  receiver.ctrl = 'human';
  const z0 = receiver.z;
  receiver.mx = 0; receiver.mz = 1;
  for (let i = 0; i < 60; i++) m.movePlayer(receiver, 1 / 60);
  ok(Math.abs(receiver.z - z0) > 1, 'o recebedor se mexe normalmente');
});

test('a CPU acelera mais devagar que o jogador, e mais devagar no fácil', () => {
  const A = PB.Match.accelOf;
  const h = PB.Match.HUMAN_ACCEL;
  const k = {};
  for (const d of ['facil', 'normal', 'dificil']) {
    const m = mk({ format: 'doubles', difficulty: d });
    eq(A(m.players[m.humanIdx]), h, d + ': o jogador não mudou');
    const cpu = m.players.find(p => p.ctrl === 'cpu');
    k[d] = A(cpu);
    ok(k[d] < h, d + ': a CPU é mais pesada que o jogador');
  }
  ok(k.facil < k.normal && k.normal < k.dificil, 'quanto mais difícil, mais afiada a arrancada');
});

test('a compensação mantém a perseguição de um segundo como era antes', () => {
  const T = PB.Match.topSpeed, A = PB.Match.accelOf, h = PB.Match.HUMAN_ACCEL;
  const corrida = (V, k, t) => {
    let v = 0, x = 0; const dt = 1 / 2000;
    for (let i = 0; i < t / dt; i++) { v += (V - v) * dt * k; x += v * dt; }
    return x;
  };
  for (const d of ['facil', 'normal', 'dificil']) {
    const m = mk({ format: 'doubles', difficulty: d });
    const cpu = m.players.find(p => p.ctrl === 'cpu');
    const antes = corrida(T(cpu) / cpu.speedBoost, h, 1);     // como era na v24
    const agora = corrida(T(cpu), A(cpu), 1);
    ok(Math.abs(agora / antes - 1) < 0.01, `${d}: um segundo de corrida cobre o mesmo chão (${antes.toFixed(2)} -> ${agora.toFixed(2)} ft)`);
    // mas o arranque curto ficou mais leve para o jogador
    const curtoAntes = corrida(T(cpu) / cpu.speedBoost, h, 0.3);
    const curtoAgora = corrida(T(cpu), A(cpu), 0.3);
    ok(curtoAgora < curtoAntes * 0.97, `${d}: os primeiros 0,3 s ficaram mais curtos`);
  }
});

test('a velocidade do jogador não mudou', () => {
  const m = mk({ format: 'doubles', difficulty: 'dificil' });
  const you = m.players[m.humanIdx];
  eq(+PB.Match.topSpeed(you).toFixed(2), +PB.Match.HUMAN_SPEED.toFixed(2), 'topo do jogador intocado');
  eq(you.speedBoost, 1, 'o jogador não leva compensação');
});

// Fires a drive at a CPU standing at the net, landing `margin` ft past the
// baseline, and says whether that CPU volleyed it instead of letting it go.
function outBallTrial(margin, side) {
  const m = mk({ format: 'doubles', difficulty: 'normal' });
  const you = m.players[m.humanIdx];
  const team = side === 'mate' ? you.team : 1 - you.team;
  const cpu = m.players.find(p => p.ctrl === 'cpu' && p.team === team);
  const sign = C.teamSign(team);
  m.state = 'live';
  m.rally.shotCount = 3; m.rally.bounces = 0; m.rally.over = false;
  m.rally.lastHitter = m.players.find(p => p.team !== team).id;
  const from = { x: 0, y: 3.0, z: -sign * 14 };
  const v = PB.Shots.plan(from, { x: 0, y: C.BALL_R, z: sign * (C.HALF_L + margin) }, 'drive', 1);
  const b = m.ball;
  b.x = from.x; b.y = from.y; b.z = from.z;
  b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.spin = v.spin;
  b.live = true; b.resting = false;
  cpu.x = 0; cpu.z = sign * (C.KITCHEN + 1.1); cpu.atNet = true; cpu.hitCd = 0;
  const shots0 = m.rally.shotCount;
  for (let f = 0; f < 240 && !m.rally.over; f++) m.update(1 / 60, null);
  return m.rally.shotCount > shots0;      // true = rebateu
}

test('o parceiro deixa passar a bola que vai sair', () => {
  for (const margin of [1.0, 2.0]) {
    let rebateu = 0;
    for (let i = 0; i < 40; i++) if (outBallTrial(margin, 'mate')) rebateu++;
    eq(rebateu, 0, `${margin} ft fora: o parceiro nunca rebate (rebateu ${rebateu} de 40)`);
  }
});

test('o parceiro joga normalmente a bola que vai cair dentro', () => {
  let rebateu = 0;
  for (let i = 0; i < 40; i++) if (outBallTrial(-1.5, 'mate')) rebateu++;
  ok(rebateu > 30, `bola dentro: o parceiro joga (rebateu ${rebateu} de 40)`);
});

test('o adversário ainda erra a leitura e rebate bola que ia sair', () => {
  let rebateu = 0;
  for (let i = 0; i < 60; i++) if (outBallTrial(1.0, 'opp')) rebateu++;
  ok(rebateu > 20, `o erro do adversário continua sendo uma chance sua (rebateu ${rebateu} de 60)`);
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

// ── o gesto do golpe (v2) ─────────────────────────────────────────────────
const S = PB.Stroke;

test('o degradê caminha do verde claro ao vermelho escuro sem repetir cor', () => {
  const seen = new Set();
  for (let p = 0; p <= 1.15; p += 0.01) seen.add(S.colorAt(p));
  ok(seen.size > 60, 'o degradê é contínuo');
  eq(S.nameAt(0), 'verde claro', 'começo do degradê');
  eq(S.nameAt(1.1), 'vermelho escuro', 'fim do degradê');
});

test('laranja é bola funda, rosa pinta a linha, vermelho já saiu', () => {
  const laranja = 0.58, rosa = 0.72, vermelho = 0.85;
  eq(S.nameAt(laranja), 'laranja', 'faixa laranja');
  eq(S.nameAt(rosa), 'rosa', 'faixa rosa');
  eq(S.nameAt(vermelho), 'vermelho', 'faixa vermelha');
  ok(S.depthAt(laranja) > 18 && S.depthAt(laranja) < 22, 'laranja cai funda e dentro');
  ok(S.depthAt(rosa) > S.depthAt(laranja) && S.depthAt(rosa) <= 22, 'rosa na linha');
  ok(!S.goesOut(laranja) && !S.goesOut(rosa), 'laranja e rosa entram');
  ok(S.goesOut(vermelho), 'vermelho sai');
});

test('a profundidade cresce sempre com a força', () => {
  let last = -1;
  for (let p = 0; p <= 1.15; p += 0.02) {
    const d = S.depthAt(p);
    ok(d >= last - 1e-9, 'profundidade nunca diminui em p=' + p.toFixed(2));
    last = d;
  }
});

test('deslize reto não é lob, arco acentuado é', () => {
  const H = 800;
  const reto = [];
  for (let i = 0; i <= 10; i++) reto.push({ x: 100, y: 600 - i * 30 });
  const m1 = S.measure(reto, H);
  ok(m1 && !m1.lob, 'reto vira rebatida');

  const arco = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    arco.push({ x: 100 + Math.sin(t * Math.PI) * 120, y: 600 - t * 300 });
  }
  const m2 = S.measure(arco, H);
  ok(m2 && m2.lob, 'arco vira lob');
});

test('o lado do deslize é o lado da bola', () => {
  const H = 800;
  const esq = S.measure([{ x: 300, y: 600 }, { x: 150, y: 380 }], H);
  const dir = S.measure([{ x: 300, y: 600 }, { x: 450, y: 380 }], H);
  ok(esq.lateral < -0.3, 'deslize para a esquerda mira à esquerda');
  ok(dir.lateral > 0.3, 'deslize para a direita mira à direita');
});

test('a inclinação do deslize é a direção: reto é zero, deitado é tudo', () => {
  const H = 800;
  const reto = S.measure([{ x: 300, y: 600 }, { x: 300, y: 380 }], H);
  const deitado = S.measure([{ x: 300, y: 600 }, { x: 80, y: 560 }], H);
  const meio = S.measure([{ x: 300, y: 600 }, { x: 190, y: 490 }], H);      // 45°
  eq(reto.lateral, 0, 'reto para cima mira em frente');
  ok(deitado.lateral <= -0.99, 'quase horizontal é tudo para o lado');
  ok(meio.lateral < -0.6 && meio.lateral > -0.9, '45° fica no meio do caminho');
  // the same tilt reads the same whether the stroke is short or long
  const curto = S.measure([{ x: 300, y: 600 }, { x: 245, y: 545 }], H);
  ok(Math.abs(curto.lateral - meio.lateral) < 0.01, 'a direção não depende do comprimento');
});

test('reto vai reto em frente, deitado vai no canto sem sair', () => {
  const m = mk({});
  const p = m.players[0];
  const land = (x, lateral) => {
    m.state = 'live';
    midRally(m, 1, 3, 1);
    cleanContact(m, p);
    p.x = x; m.ball.x = x;
    m.executeHit(p, humanSwing(m, p, { power: 0.5, lateral }));
    return PB.Physics.predictLanding(m.ball, 5);
  };
  for (const x of [-6, 0, 6]) {
    const reto = land(x, 0);
    ok(reto && Math.abs(reto.x - x) < 0.6, `reto de x=${x} cai em frente (${reto && reto.x.toFixed(1)})`);
    const esq = land(x, -1);
    ok(esq && esq.x < -8.2 && esq.x > -C.HALF_W, `todo à esquerda de x=${x} cai junto à lateral, dentro (${esq && esq.x.toFixed(1)})`);
    const dir = land(x, 1);
    ok(dir && dir.x > 8.2 && dir.x < C.HALF_W, `todo à direita de x=${x} cai junto à lateral, dentro (${dir && dir.x.toFixed(1)})`);
  }
  const meio = land(0, -0.5);
  ok(meio && meio.x < -2 && meio.x > -8, `meia inclinação cai no meio do caminho (${meio && meio.x.toFixed(1)})`);
});

test('deslize mais longo é mais forte', () => {
  const H = 800;
  const curto = S.measure([{ x: 300, y: 600 }, { x: 300, y: 540 }], H);
  const longo = S.measure([{ x: 300, y: 600 }, { x: 300, y: 260 }], H);
  ok(longo.power > curto.power * 2, 'força acompanha o comprimento');
});

test('um toque não vira golpe', () => {
  eq(S.measure([{ x: 300, y: 600 }, { x: 302, y: 599 }], 800), null, 'toque mínimo');
});

// ── o gesto decide o golpe ────────────────────────────────────────────────
function humanSwing(m, p, over) {
  return Object.assign({ lateral: 0, power: 0.5, lob: false, human: true, quality: 1 }, over);
}

test('deslize curtíssimo vira bola curta, longo vira drive', () => {
  const m = mk({});
  const p = m.players[0];
  midRally(m, 1, 3, 1);
  eq(m.pickStyleFromSwipe(p, humanSwing(m, p, { power: 0.08 }), false, { x: 0, y: 2, z: -5 }),
     Math.abs(p.z) < 10.5 ? 'dink' : 'drop', 'deslize curto');
  eq(m.pickStyleFromSwipe(p, humanSwing(m, p, { power: 0.6 }), false, { x: 0, y: 2, z: -18 }),
     'drive', 'deslize longo');
});

test('lob só sai do arco', () => {
  const m = mk({});
  const p = m.players[0];
  midRally(m, 1, 3, 1);
  eq(m.pickStyleFromSwipe(p, humanSwing(m, p, { power: 0.9 }), false, { x: 0, y: 2, z: -18 }),
     'drive', 'deslize reto e longo não é lob');
  eq(m.pickStyleFromSwipe(p, humanSwing(m, p, { power: 0.5, lob: true }), false, { x: 0, y: 2, z: -18 }),
     'lob', 'arco é lob');
});

test('smash só contra um lob pego alto e no ar', () => {
  const m = mk({});
  const p = m.players[0];
  midRally(m, 1, 3, 0);
  const alto = { x: 0, y: 5.2, z: -10 };
  m.rally.lastStyle = 'drive';
  ok(!m.smashable(p, true, alto), 'bola alta que não veio de lob não dá smash');
  m.rally.lastStyle = 'lob';
  ok(m.smashable(p, true, alto), 'lob pego alto e no ar dá smash');
  ok(!m.smashable(p, false, alto), 'depois do quique não é mais smash');
  ok(!m.smashable(p, true, { x: 0, y: 2.4, z: -10 }), 'lob pego baixo não é smash');
});

// Stand the player on the ball: these tests are about the power-to-depth map,
// not about the scatter that bad contact adds on top of it.
function cleanContact(m, p) {
  p.x = 0; p.z = -16; p.vx = 0; p.vz = 0; p.lunge = 0; p.speedN = 0;
  m.ball.x = 0; m.ball.y = 2.2; m.ball.z = -16;
  m.ball.vx = m.ball.vy = m.ball.vz = 0;
  m.ball.live = true; m.ball.resting = false;
}

test('uma força vermelha manda a bola para fora de verdade', () => {
  const m = mk({});
  const p = m.players[0];
  m.state = 'live';
  midRally(m, 1, 3, 1);
  cleanContact(m, p);
  m.executeHit(p, humanSwing(m, p, { power: 0.95 }));
  const land = PB.Physics.predictLanding(m.ball, 5);
  ok(land && Math.abs(land.z) > C.HALF_L, 'a bola cai além da linha de fundo');
});

test('uma força laranja cai funda e dentro', () => {
  const m = mk({});
  const p = m.players[0];
  m.state = 'live';
  midRally(m, 1, 3, 1);
  cleanContact(m, p);
  m.executeHit(p, humanSwing(m, p, { power: 0.58 }));
  const land = PB.Physics.predictLanding(m.ball, 5);
  ok(land && Math.abs(land.z) < C.HALF_L, 'a bola cai dentro');
  ok(land && Math.abs(land.z) > 14, 'e cai funda');
});

// ── report ────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} testes passaram`);
if (failures.length) {
  console.log(`  ${failures.length} falharam:\n`);
  for (const f of failures) console.log('    ✗ ' + f);
  process.exit(1);
}
console.log('  tudo verde\n');
