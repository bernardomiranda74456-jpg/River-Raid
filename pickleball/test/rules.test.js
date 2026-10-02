'use strict';
// Rule-engine tests. No browser, no dependencies: node test/rules.test.js
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'js');
for (const f of ['i18n', 'calls', 'logos', 'court', 'physics', 'shots', 'stroke', 'match', 'ai', 'tutorial']) {
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

const mk = cfg => new PB.Match(Object.assign({ format: 'singles', difficulty: 'pro' }, cfg));

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
  const m = mk({ assist: false });
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
  const m = mk({ difficulty: 'pro' });   // assistRules = true
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
  const m = mk({ assist: false });
  const human = m.players[m.humanIdx];          // time 0, que sacou
  midRally(m, 1, 2, 0);                        // devolução do adversário, no ar
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 2.5;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'voleio_saque', 'voleio no terceiro golpe é falta');
});

test('a partir do quarto golpe o voleio é liberado', () => {
  const m = mk({ assist: false });
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
  const m = mk({ format: 'doubles', assist: false });
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
  const m = mk({ format: 'doubles', assist: false });
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
  const m = mk({ assist: false });
  const human = m.players[m.humanIdx];
  midRally(m, 1, 3, 0);                       // adversário bateu, sem quique
  human.x = 2; human.z = C.teamSign(0) * 3;   // dentro da cozinha
  m.ball.x = human.x; m.ball.z = human.z; m.ball.y = 3.0;
  m.pendingSwing[human.id] = { lateral: 0, depth: 0.5, fast: true, long: true, quality: 1 };
  m.attemptHit(human);
  eq(m.lastReason, 'cozinha');
});

test('voleio fora da cozinha é legal', () => {
  const m = mk({ assist: false });
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
  const m = mk({ assist: false });
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
  const m = mk({ assist: false });
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
  const m = mk({ assist: false });
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
  const m = mk({ assist: false });
  const human = m.players[m.humanIdx];
  m.state = 'live';
  human.volleyMomentum = 0.4;
  human.x = 0; human.z = C.teamSign(0) * 3;    // arrastado para dentro
  m.movePlayer(human, 1 / 60);
  eq(m.lastReason, 'impulso');
});

test('a CPU é segurada fora da cozinha em vez de cometer a falta', () => {
  const m = mk({ assist: false });
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
  const m = mk({ assist: false });
  const server = m.players[m.serverIdx];
  server.z = C.teamSign(server.team) * (C.HALF_L - 1.5);   // pisou dentro
  m.doServe({ x: -m.serveXSign * 4, z: C.teamSign(1) * 17 }, 1);
  eq(m.lastReason, 'pe_no_saque');
  eq(m.lastWinner, 1, 'ponto para quem recebe');
});

test('no modo assistido o sacador é reposicionado em vez de perder o ponto', () => {
  const m = mk({ difficulty: 'pro' });
  const server = m.players[m.serverIdx];
  server.z = C.teamSign(server.team) * (C.HALF_L - 1.5);
  m.doServe({ x: -m.serveXSign * 4, z: C.teamSign(1) * 17 }, 1);
  eq(m.rally.over, false, 'sem falta');
  ok(Math.abs(server.z) >= C.HALF_L, 'sacador voltou para trás da linha');
  eq(m.state, 'live', 'o saque saiu');
});

test('sacar da metade errada é corrigido ou é falta', () => {
  const m = mk({ assist: false });
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

test('a partida curta acaba nos 5 pontos, com os mesmos dois de vantagem', () => {
  const m = mk({ targetPoints: 5 });     // quem saca é o time 0, então é ele que pontua
  m.score = [4, 0];
  m.endRally(1, 'fora');
  eq(m.score, [5, 0], 'placar');
  eq(m.winner, 0, 'cinco a zero encerra');

  const n = mk({ targetPoints: 5 });
  n.score = [4, 4];
  n.endRally(1, 'fora');
  eq(n.winner, -1, '5 a 4 ainda não encerra');
  n.afterPoint();
  n.endRally(1, 'fora');
  eq(n.score, [6, 4], 'placar');
  eq(n.winner, 0, 'seis a quatro encerra');
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
  const m = mk({ format: 'doubles', assist: false });
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
  const m = mk({ format: 'doubles', assist: false });
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
  const m = mk({ format: 'doubles', difficulty: 'pro' });
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

test('os nove passos do tutorial vêm inteiros nos três idiomas', () => {
  const antes = PB.I18n.lang;
  for (const l of PB.I18n.LANGS) {
    PB.I18n.setLang(l);
    const st = PB.Tutorial.steps();
    eq(st.length, 9, l + ': nove passos');
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
  for (const d of ['facil', 'pro']) {
    const m = mk({ format: 'doubles', difficulty: d });
    eq(A(m.players[m.humanIdx]), h, d + ': o jogador não mudou');
    const cpu = m.players.find(p => p.ctrl === 'cpu');
    k[d] = A(cpu);
    ok(k[d] < h, d + ': a CPU é mais pesada que o jogador');
  }
  ok(k.facil < k.pro, 'no pro a arrancada é mais afiada');
});

// ── sets ──────────────────────────────────────────────────────────────────
function fechaJogo(m, vencedor) {
  // leva o placar ao match point do vencedor e fecha com um ponto dele sacando
  m.servingTeam = vencedor; m.serverNumber = 2;
  m.serverIdx = m.mates(vencedor)[0].id;
  m.score = vencedor === 0 ? [10, 3] : [3, 10];
  m.rally.over = false;
  m.endRally(1 - vencedor, 'fora');
  m.afterPoint();
}

test('melhor de 1: o jogo acaba e a partida acaba junto', () => {
  const m = mk({ format: 'doubles', sets: 1 });
  fechaJogo(m, 0);
  eq(m.sets, [1, 0], 'sets');
  eq(m.matchWinner, 0, 'partida decidida');
  eq(m.state, 'gameover', 'estado');
});

test('melhor de 3: o primeiro set abre o segundo do zero, com o outro time sacando', () => {
  const m = mk({ format: 'doubles', sets: 3 });
  eq(m.servingTeam, 0, 'o time 0 abre o primeiro set');
  fechaJogo(m, 0);
  eq(m.sets, [1, 0], 'sets');
  eq(m.matchWinner, -1, 'partida segue');
  eq(m.game, 2, 'segundo set');
  eq(m.score, [0, 0], 'placar zerado');
  eq(m.servingTeam, 1, 'o outro time abre o segundo set');
  eq(m.serverNumber, 2, 'começa 0-0-2');
  eq(m.players[m.serverIdx].team, 1, 'o sacador é do time 1');
  eq(m.state, 'ready', 'à espera do saque');
  ok(m.banner && m.banner.sub === PB.I18n.t('banner.sets', { a: 1, b: 0 }), 'faixa com o placar de sets');
  eq(m.history, [[11, 3]], 'histórico do set');
});

test('melhor de 3: dois sets fecham a partida, um a um vai ao terceiro', () => {
  const m = mk({ format: 'doubles', sets: 3 });
  fechaJogo(m, 0);
  fechaJogo(m, 1);
  eq(m.sets, [1, 1], 'um a um');
  eq(m.game, 3, 'terceiro set');
  eq(m.servingTeam, 0, 'o time 0 abre o terceiro');
  eq(m.matchWinner, -1, 'ainda em jogo');
  fechaJogo(m, 1);
  eq(m.sets, [1, 2], 'sets finais');
  eq(m.matchWinner, 1, 'time 1 leva a partida');
  eq(m.state, 'gameover', 'estado');
  eq(m.history.length, 3, 'três sets no histórico');
});

test('match point e set point: só para quem saca, e set point só na melhor de 3', () => {
  const caso = (cfg, saca, placar, sets) => {
    const m = mk(Object.assign({ format: 'doubles' }, cfg));
    m.servingTeam = saca; m.score = placar; if (sets) m.sets = sets;
    return m.pointCall();
  };
  eq(caso({ sets: 1 }, 0, [10, 4]), 'matchpoint', 'melhor de 1, 10-4 sacando');
  eq(caso({ sets: 1 }, 1, [10, 4]), null, 'quem tem 10 está recebendo: não pontua, não é match point');
  eq(caso({ sets: 1 }, 0, [10, 10]), null, '10-10: o próximo ponto não fecha com dois de vantagem');
  eq(caso({ sets: 1 }, 0, [11, 10]), 'matchpoint', '11-10 sacando');
  eq(caso({ sets: 1, targetPoints: 5 }, 0, [4, 2]), 'matchpoint', 'até 5, 4-2');
  eq(caso({ sets: 3 }, 0, [10, 4], [0, 0]), 'setpoint', 'melhor de 3, primeiro set');
  eq(caso({ sets: 3 }, 0, [10, 4], [1, 0]), 'matchpoint', 'quem já tem um set');
  eq(caso({ sets: 3 }, 1, [4, 10], [1, 0]), 'setpoint', 'o outro time, sem set ainda');
  eq(caso({ sets: 3 }, 1, [4, 10], [1, 1]), 'matchpoint', 'terceiro set');
  eq(caso({ sets: 3 }, 0, [9, 4], [1, 0]), null, 'a dois pontos não é nada');
});

test('a juíza fala antes do saque, e a CPU espera a fala acabar para sacar', () => {
  const m = mk({ format: 'doubles', sets: 1 });
  const cpuTeam = 1;
  m.servingTeam = cpuTeam; m.serverNumber = 1;
  m.serverIdx = m.mates(cpuTeam)[0].id;
  m.score = [3, 10]; m.events.length = 0;
  m.prepareServe();
  const fala = m.events.find(e => e.type === 'call');
  ok(fala && fala.call === 'matchpoint', 'evento de match point no saque');
  let t = 0, sacou = null;
  for (let f = 0; f < 200 && sacou === null; f++) { m.update(1 / 60, null); t += 1 / 60; if (m.state === 'live') sacou = t; }
  ok(sacou !== null && sacou > 1.4, `a CPU esperou a fala (${sacou && sacou.toFixed(2)} s)`);
  m.score = [3, 4]; m.events.length = 0;
  m.servingTeam = cpuTeam; m.prepareServe();
  ok(!m.events.some(e => e.type === 'call'), 'sem match point, sem fala');
});

test('a faixa do set sai quando o saque acontece', () => {
  const m = mk({ format: 'doubles', sets: 3 });
  fechaJogo(m, 0);
  ok(m.banner, 'faixa no ar');
  m.doServe({ x: 0, z: 18 }, 0.8);
  eq(m.banner, null, 'faixa limpa no saque');
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
  const m = mk({ format: 'doubles', assist: false });
  const you = m.players[m.humanIdx];
  eq(+PB.Match.topSpeed(you).toFixed(2), +PB.Match.HUMAN_SPEED.toFixed(2), 'topo do jogador intocado');
  eq(you.speedBoost, 1, 'o jogador não leva compensação');
});

// Fires a drive at a CPU standing at the net, landing `margin` ft past the
// baseline, and says whether that CPU volleyed it instead of letting it go.
function outBallTrial(margin, side) {
  const m = mk({ format: 'doubles', difficulty: 'pro' });
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
  // this trial is about the in/out call, not reaction: the CPU has read the shot
  cpu.ai.lastShot = m.rally.shotCount; cpu.ai.timer = 0;
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

// Puts the player on the ball at a chosen spot and height and plays one stroke.
function strokeAt(z, y, power) {
  const m = mk({});
  const you = m.players[m.humanIdx];
  m.state = 'live';
  m.rally.shotCount = 4; m.rally.bounces = 1; m.rally.over = false; m.rally.lastHitter = 1;
  you.x = 0; you.z = z; you.vx = 0; you.vz = 0; you.lunge = 0; you.speedN = 0;
  const b = m.ball;
  b.x = 0; b.y = y; b.z = z; b.vx = b.vy = b.vz = 0; b.live = true; b.resting = false;
  m.executeHit(you, { lateral: 0, power, lob: false, human: true, quality: 1 });
  // how long the opponent has, and where it lands
  const cl = Object.assign({}, b);
  let t = 0;
  for (let i = 0; i < 6000; i++) {
    const ev = {};
    PB.Physics.step(cl, 1 / 600, ev); t += 1 / 600;
    if (cl.z >= 14 || (ev.bounce && cl.z > 0)) break;
  }
  return { style: b.style, kind: you.swingKind, ms: t * 1000,
           land: PB.Physics.predictLanding(b, 6) };
}

test('na rede, a bola acima da rede vira smash e o braço vai por cima', () => {
  const alto = strokeAt(-3, PB.Match.SMASH_HIGH + 0.25, 0.55);
  eq(alto.style, 'smash', 'bola alta na rede é smash');
  eq(alto.kind, 'over', 'e o movimento é por cima');
});

test('na altura da rede ou abaixo não existe smash, por mais forte que seja', () => {
  for (const y of [2.2, 2.8, PB.Match.SMASH_HIGH - 0.1]) {
    for (const power of [0.45, 0.66, 0.78]) {
      const r = strokeAt(-3, y, power);
      ok(r.style !== 'smash', `bola a ${y} ft com força ${power}: ${r.style}, não smash`);
      ok(r.kind !== 'over', `bola a ${y} ft: sem movimento por cima`);
    }
  }
});

test('toque leve numa bola alta na rede continua sendo bola curta', () => {
  const r = strokeAt(-3, 4.2, 0.12);
  ok(r.style !== 'smash', `toque leve vira ${r.style}`);
});

test('longe da rede a bola alta não vira smash sozinha', () => {
  const r = strokeAt(-16, 4.5, 0.55);
  ok(r.style !== 'smash', `a ${16} ft da rede vira ${r.style}`);
});

test('o smash da rede chega bem antes que o mesmo golpe rasteiro', () => {
  const baixo = strokeAt(-3, 3.0, 0.55);
  const alto = strokeAt(-3, 4.2, 0.55);
  ok(alto.ms < baixo.ms * 0.75,
     `${baixo.ms.toFixed(0)} ms rasteiro contra ${alto.ms.toFixed(0)} ms por cima`);
});

test('o smash da rede também sai fora se você puxar demais', () => {
  const dentro = strokeAt(-3, 4.2, 0.60);
  const fora = strokeAt(-3, 4.2, 0.95);
  ok(dentro.land && Math.abs(dentro.land.z) <= C.HALF_L, 'força controlada cai dentro');
  ok(fora.land && Math.abs(fora.land.z) > C.HALF_L, 'força demais manda para fora');
});

// Ends a rally with a chosen winner and hands back the point event.
// `dois_quiques` is the neutral reason: it is neither out nor into the net,
// so it leaves the call to the score alone.
function callFor(m, losingTeam, reason) {
  m.events.length = 0;
  m.rally.over = false;
  m.endRally(losingTeam, reason || 'dois_quiques');
  return m.events.find(e => e.type === 'point');
}
// the calls that mean "the serving side scored", however they are phrased
const MARCOU = ['point', 'out', 'net'];

test('a chamada do juiz segue o placar, nas três situações', () => {
  // quem saca ganha: Point
  const a = mk({ format: 'doubles' });
  eq(callFor(a, 1 - a.servingTeam).call, 'point', 'sacador pontuou');

  // quem saca perde sendo o primeiro sacador: Second Serve
  const b = mk({ format: 'doubles' });
  b.serverNumber = 1;
  eq(callFor(b, b.servingTeam).call, 'second', 'passa para o parceiro');

  // quem saca perde sendo o segundo: Side Out
  const c = mk({ format: 'doubles' });
  c.serverNumber = 2;
  eq(callFor(c, c.servingTeam).call, 'sideout', 'passa para os adversários');
});

test('em simples não existe Second Serve', () => {
  for (let i = 0; i < 6; i++) {
    const m = mk({ format: 'singles' });
    const perdedor = i % 2 === 0 ? m.servingTeam : 1 - m.servingTeam;
    const ev = callFor(m, perdedor);
    ok(MARCOU.indexOf(ev.call) >= 0 || ev.call === 'sideout', `simples chamou ${ev.call}`);
  }
});

test('bola fora e bola na rede trocam a chamada de ponto', () => {
  const casos = [
    ['fora', 'out'], ['saque_fora', 'out'],
    ['dois_quiques', 'point'], ['cozinha', 'point'], ['recebedor', 'point'],
  ];
  for (const [reason, esperado] of casos) {
    const m = mk({ format: 'doubles' });
    eq(callFor(m, 1 - m.servingTeam, reason).call, esperado, reason);
  }
  // na rede só quando a bola encostou mesmo na fita
  const a = mk({ format: 'doubles' });
  a.rally.netTouch = true;
  eq(callFor(a, 1 - a.servingTeam, 'nao_passou').call, 'net', 'encostou na rede');
  const b = mk({ format: 'doubles' });
  b.rally.netTouch = false;
  eq(callFor(b, 1 - b.servingTeam, 'nao_passou').call, 'point', 'morreu antes da rede');
});

test('quando o saque troca de mão, a chamada continua sendo do saque', () => {
  for (const reason of ['fora', 'nao_passou', 'saque_fora']) {
    const a = mk({ format: 'doubles' });
    a.serverNumber = 1; a.rally.netTouch = true;
    eq(callFor(a, a.servingTeam, reason).call, 'second', reason + ' com o primeiro sacador');
    const b = mk({ format: 'doubles' });
    b.serverNumber = 2; b.rally.netTouch = true;
    eq(callFor(b, b.servingTeam, reason).call, 'sideout', reason + ' com o segundo');
  }
});

test('a chamada bate com quem saca depois', () => {
  for (const fmt of ['singles', 'doubles']) {
    for (const quemPerde of ['sacador', 'recebedor']) {
      const m = mk({ format: fmt });
      const antesTime = m.servingTeam, antesNum = m.serverNumber;
      const ev = callFor(m, quemPerde === 'sacador' ? m.servingTeam : 1 - m.servingTeam);
      if (MARCOU.indexOf(ev.call) >= 0) {
        eq(m.servingTeam, antesTime, ev.call + ': o saque fica');
      } else if (ev.call === 'second') {
        eq(m.servingTeam, antesTime, 'Second Serve: o saque fica no time');
        eq(m.serverNumber, 2, 'e passa para o segundo sacador');
        eq(antesNum, 1, 'só acontece vindo do primeiro');
      } else {
        ok(m.servingTeam !== antesTime, 'Side Out: o saque troca de time');
        eq(m.serverNumber, 1, 'e volta para o primeiro sacador');
      }
    }
  }
});

test('as três falas estão embutidas e são curtas', () => {
  const c = PB.CALLS_MP3;
  for (const k of ['point', 'second', 'sideout', 'out', 'net']) {
    ok(c[k] && c[k].length > 2000, k + ' está embutida');
    ok(c[k].length < 20000, k + ' cabe no arquivo único (' + Math.round(c[k].length / 1024) + ' KB em base64)');
  }
});

test('a logo da 3EMP está embutida, é leve, e todo logo que o desenho usa existe', () => {
  const L = PB.LOGOS_PNG;
  ok(L['3emp'], 'logo da 3EMP');
  ok(L['3emp'].slice(0, 8) === 'iVBORw0K', 'é PNG, que é o formato com transparência');
  ok(L['3emp'].length < 20000, 'leve: ' + Math.round(L['3emp'].length / 1024) + ' KB em base64');
  const usados = new Set();
  const src = fs.readFileSync(path.join(dir, 'render.js'), 'utf8');
  for (const m of src.matchAll(/(?:groundLogo\(ctx, cam, |name: )'([a-z0-9]+)'/g)) usados.add(m[1]);
  ok(usados.size > 0, 'o desenho usa algum logo');
  for (const n of usados) ok(L[n], `o desenho usa '${n}', que está embutido`);
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
    ok(esq && esq.x < -7.4 && esq.x > -8.6, `todo à esquerda de x=${x} cai a 2 ft da lateral, dentro (${esq && esq.x.toFixed(1)})`);
    const dir = land(x, 1);
    ok(dir && dir.x > 7.4 && dir.x < 8.6, `todo à direita de x=${x} cai a 2 ft da lateral, dentro (${dir && dir.x.toFixed(1)})`);
  }
  const meio = land(0, -0.5);
  ok(meio && meio.x < -2 && meio.x > -6, `meia inclinação cai no meio do caminho (${meio && meio.x.toFixed(1)})`);
});

test('a mesma inclinação abre a bola igual, fraca ou forte', () => {
  const m = mk({});
  const p = m.players[0];
  const land = (power, lateral, bz) => {
    m.state = 'live';
    midRally(m, 1, 3, 1);
    cleanContact(m, p);
    p.x = 0; m.ball.x = 0; p.z = bz; m.ball.z = bz + 0.3;
    m.executeHit(p, humanSwing(m, p, { power, lateral }));
    return PB.Physics.predictLanding(m.ball, 5);
  };
  for (const lat of [-0.6, 0.6, 1]) {
    const dink = land(0.08, lat, -7.6), fundo = land(0.5, lat, -21);
    ok(Math.abs(dink.x - fundo.x) < 0.8, `inclinação ${lat}: dink em ${dink.x.toFixed(1)}, bola funda em ${fundo.x.toFixed(1)}`);
  }
});

test('o lob vai para o lado da barriga do arco', () => {
  const H = 844;
  const arco = lado => Array.from({ length: 21 }, (_, i) =>
    ({ x: 200 + lado * Math.sin(Math.PI * i / 20) * 70, y: 700 - 180 * i / 20 }));
  const c = S.measure(arco(-1), H), inv = S.measure(arco(1), H);
  ok(c.lob && inv.lob, 'os dois arcos são lob');
  ok(c.lateral < -0.5, `arco em C vai para a esquerda (${c.lateral.toFixed(2)})`);
  ok(inv.lateral > 0.5, `arco invertido vai para a direita (${inv.lateral.toFixed(2)})`);
  const reto = S.measure([{ x: 300, y: 700 }, { x: 300, y: 520 }], H);
  eq(reto.lob, false, 'deslize reto não é lob');
});

test('bola que chega antes da reação: longe do corpo passa, no corpo às vezes volta mole', () => {
  // Sorteio com semente fixa: o resultado é sempre o mesmo. A faixa aceita vem
  // de 400 rodadas medidas sem semente: média 26 bloqueios em 100 bolas no
  // corpo, 98% delas entre 16 e 37.
  const sorteio = Math.random;
  let seed = 12345;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let passou = 0, bloqueou = 0, fundo = 0;
  try {
  for (let i = 0; i < 200; i++) {
    const m = mk({ format: 'doubles' });
    const cpu = m.players.find(p => p.ctrl === 'cpu' && p.team === 1);
    m.state = 'live'; midRally(m, 0, 5, 0);
    cpu.x = 0; cpu.z = 8.5; cpu.vx = cpu.vz = 0; cpu.hitCd = 0; cpu.lunge = 0;
    cpu.ai.lastShot = m.rally.shotCount; cpu.ai.timer = 0.3;        // ainda lendo a bola
    for (const q of m.players) if (q !== cpu && q.team === 1) { q.x = -9; q.z = 20; }  // o parceiro longe
    const perto = i % 2 === 0;
    Object.assign(m.ball, { x: perto ? 0.5 : 2.6, y: 3.0, z: 7.0, vx: 0, vy: 0, vz: 45, live: true, resting: false });
    const antes = m.rally.shotCount;
    m.checkHits();
    if (m.rally.shotCount > antes) {
      bloqueou++;
      if (!perto) fundo++;
      eq(m.ball.style, 'drop', 'o reflexo é um bloqueio mole');
    } else passou++;
  }
  } finally { Math.random = sorteio; }
  eq(fundo, 0, 'bola a um braço de distância nunca é bloqueada por reflexo');
  ok(bloqueou >= 12 && bloqueou <= 45, `no corpo, parte volta (${bloqueou} de 100)`);
});

test('deslize para baixo é slice, e nunca lob, mesmo curvado', () => {
  const H = 844;
  const reto = S.measure([{ x: 300, y: 400 }, { x: 300, y: 520 }], H);
  ok(reto.slice && !reto.lob, 'reto para baixo é slice');
  const curvo = S.measure(Array.from({ length: 21 }, (_, i) =>
    ({ x: 300 - Math.sin(Math.PI * i / 20) * 70, y: 400 + 180 * i / 20 })), H);
  ok(curvo.slice && !curvo.lob, 'para baixo em arco continua slice');
  const esq = S.measure([{ x: 300, y: 400 }, { x: 240, y: 500 }], H);
  const dir = S.measure([{ x: 300, y: 400 }, { x: 360, y: 500 }], H);
  ok(esq.lateral < -0.4 && dir.lateral > 0.4, `para baixo e à esquerda vai à esquerda (${esq.lateral.toFixed(2)}), à direita vai à direita (${dir.lateral.toFixed(2)})`);
  const cima = S.measure([{ x: 300, y: 520 }, { x: 300, y: 400 }], H);
  eq(cima.slice, false, 'para cima não é slice');
});

test('o slice cai na cozinha adversária, da rede ou do fundo, e mais comprido cai mais fundo', () => {
  const m = mk({});
  const p = m.players[0];
  const land = (bz, power, lateral) => {
    m.state = 'live';
    midRally(m, 1, 3, 1);
    cleanContact(m, p);
    p.x = 0; m.ball.x = 0; p.z = bz; m.ball.z = bz + 0.3;
    m.executeHit(p, humanSwing(m, p, { power, lateral: lateral || 0, slice: true }));
    return { L: PB.Physics.predictLanding(m.ball, 5), style: m.ball.style };
  };
  for (const [bz, estilo] of [[-7.6, 'dink'], [-21, 'drop']]) {
    const curto = land(bz, 0.08), longo = land(bz, 0.45);
    eq(curto.style, estilo, `de z=${bz} o slice é ${estilo}`);
    for (const r of [curto, longo]) ok(r.L.z > 0 && r.L.z < C.KITCHEN, `de z=${bz} cai na cozinha (${r.L.z.toFixed(1)})`);
    ok(longo.L.z > curto.L.z + 1.5, `mais comprido, mais fundo (${curto.L.z.toFixed(1)} → ${longo.L.z.toFixed(1)})`);
    const e = land(bz, 0.2, -0.8), d = land(bz, 0.2, 0.8);
    ok(e.L.x < -4 && d.L.x > 4, `o lado do slice é o lado da bola (${e.L.x.toFixed(1)} / ${d.L.x.toFixed(1)})`);
  }
});

test('no saque, o slice manda o saque suave para o lado dele', () => {
  const m = mk({});
  const me = m.players[m.humanIdx];
  m.serverIdx = me.id; m.servingTeam = me.team; m.state = 'ready'; m.stateT = 1;
  let aimed = null;
  const orig = m.doServe.bind(m);
  m.doServe = (aim, pw) => { aimed = { aim, pw }; };
  m.update(1 / 60, { p1: { mx: 0, mz: 0, swipe: { lateral: 0, power: 0.9, lob: false, slice: true, arc: 0 } } });
  ok(aimed, 'sacou');
  ok(aimed.pw < 0.9, `saque suave (${aimed.pw.toFixed(2)})`);
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

test('longe da rede, o smash continua sendo só contra um lob pego alto e no ar', () => {
  const m = mk({});
  const p = m.players[0];
  midRally(m, 1, 3, 0);
  const forte = { power: 0.6 };
  const alto = { x: 0, y: 5.2, z: -14 };          // fora do alcance da rede
  m.rally.lastStyle = 'drive';
  ok(!m.smashable(p, true, alto, forte), 'bola alta que não veio de lob não dá smash');
  m.rally.lastStyle = 'lob';
  ok(m.smashable(p, true, alto, forte), 'lob pego alto e no ar dá smash');
  ok(!m.smashable(p, false, alto, forte), 'depois do quique não é mais smash');
  ok(!m.smashable(p, true, { x: 0, y: 2.4, z: -14 }, forte), 'lob pego baixo não é smash');
});

test('na rede, a altura da bola é o que decide, não de onde ela veio', () => {
  const m = mk({});
  const p = m.players[0];
  midRally(m, 1, 3, 1);
  const forte = { power: 0.6 };
  m.rally.lastStyle = 'drive';                    // não veio de lob
  const H = PB.Match.SMASH_HIGH;
  ok(m.smashable(p, false, { x: 0, y: H + 0.3, z: -3 }, forte), 'acima da rede, na rede, é smash');
  ok(!m.smashable(p, false, { x: 0, y: H - 0.3, z: -3 }, forte), 'abaixo dessa altura, não');
  ok(!m.smashable(p, false, { x: 0, y: H + 0.3, z: -3 }, { power: 0.15 }), 'toque leve não é smash');
  ok(!m.smashable(p, false, { x: 0, y: H + 0.3, z: -PB.Match.SMASH_NEAR - 1 }, forte), 'longe da rede, não');
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
