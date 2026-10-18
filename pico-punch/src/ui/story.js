// Abertura (história em quadros de texto) e sequência final de vitória com créditos.
import { Container, Graphics, Sprite } from 'pixi.js';
import { BitmapLine } from '../render/text.js';
import { smsColor } from './panelfx.js';

const INTRO = [
  ['NAS ILHAS FLUTUANTES DE VANTURA,', 'O CORAÇÃO DE SOL AQUECIA A TODOS.'],
  ['ATÉ QUE O VIZIR KAZMAR O ROUBOU', 'E TRANCOU O IRMÃO DE PICO NO CASTELO.'],
  ['PICO TEM PUNHOS ENORMES,', 'UM ESTÔMAGO MAIOR AINDA...'],
  ['E UMA MISSÃO: SOCAR TUDO', 'ATÉ O SOL VOLTAR A BRILHAR.'],
];
const ENDING = [
  ['O CORAÇÃO DE SOL VOLTA A BRILHAR!', 'VANTURA ESTÁ SALVA.'],
  ['PICO E SEU IRMÃO COMEMORAM', 'COM UMA PILHA DE PASTÉIS.'],
  ['OBRIGADO POR JOGAR!', ''],
];
const CREDITS = ['PICO PUNCH', '', 'UM JOGO ORIGINAL', 'FEITO COM PIXI.JS E WEB AUDIO', '', 'PERSONAGENS, FASES, ARTE E MÚSICA', 'CRIADOS DO ZERO', '', 'MODO RETRÔ: 256×192, 64 CORES', 'MODO HD: LUZ, SOMBRAS E SHADERS', '', 'APERTE PULO PARA VOLTAR'];

export function installStory(game) {
  let S = null;
  const line = (t, x, y, tint = 0xffffff, spacing = 8) => { const l = new BitmapLine(t, { tint, shadow: true, align: 'center', spacing }); l.x = x; l.y = y; return l; };
  function show(pages, { onDone, music, kind }) {
    game.setState('story'); const L = game.menuLayer; L.removeChildren(); const cx = Math.round(game.viewW / 2);
    const bg = new Graphics(); bg.rect(0, 0, game.viewW, game.viewH).fill(0x06061a); L.addChild(bg);
    const hero = new Sprite(game.bank.sprite('hero', kind === 'ending' ? 'eat1' : 'idle0')); hero.anchor.set(0.5, 1); hero.x = cx; hero.y = 118; hero.scale.set(game.bank.invScale * 1); L.addChild(hero);
    const l1 = line('', cx, 136, 0xffffff, 7), l2 = line('', cx, 148, 0xffffff, 7); L.addChild(l1, l2);
    const hint = line('PULO AVANÇA   SOCO PULA TUDO', cx, 178, 0x5555aa, 7); L.addChild(hint);
    const glow = new Graphics(); L.addChildAt(glow, 1);
    S = { pages, i: 0, t: 0, l1, l2, hero, glow, bg, onDone, kind, cx };
    if (music) game.audio?.music.play(music, { restart: true }); draw();
  }
  function draw() { const p = S.pages[S.i]; S.l1.setText(p[0]); S.l2.setText(p[1]); S.t = 0; S.hero.texture = game.bank.sprite('hero', S.kind === 'ending' ? ['eat0', 'eat1', 'eat2'][S.i % 3] : ['idle0', 'punch1', 'eat0', 'victory'][S.i % 4]); }
  function update(dt) {
    S.t += dt; const inp = game.input; const g = S.glow; g.clear(); const r = 30 + Math.sin(S.t * 2) * 4;
    const retro = game.mode === 'retro'; const c1 = S.kind === 'ending' ? 0xffaa00 : 0x3a2a6a, c2 = S.kind === 'ending' ? 0xfff3b0 : 0x5a4a9a;
    g.circle(S.cx, 90, r).fill({ color: retro ? smsColor(c1) : c1, alpha: retro ? 1 : 0.5 }); g.circle(S.cx, 90, r * 0.6).fill({ color: retro ? smsColor(c2) : c2, alpha: retro ? 1 : 0.6 });
    S.hero.y = 118 + Math.round(Math.sin(S.t * 3) * 1.5);
    if (inp.pressed.jump || inp.pressed.confirm) { inp.consume('jump'); inp.consume('confirm'); game.audio?.sfx('menu'); S.i++; if (S.i >= S.pages.length) finish(); else draw(); }
    if (inp.pressed.back || inp.pressed.punch) { inp.consume('back'); inp.consume('punch'); finish(); }
    return true;
  }
  function finish() { const cb = S.onDone; S = null; game.menuLayer.removeChildren(); cb(); }
  function credits() {
    game.setState('story'); const L = game.menuLayer; L.removeChildren(); const cx = Math.round(game.viewW / 2);
    const bg = new Graphics(); bg.rect(0, 0, game.viewW, game.viewH).fill(0x06061a); L.addChild(bg);
    const lines = CREDITS.map((t, i) => { const l = line(t, cx, 200 + i * 12, i === 0 ? 0xffaa00 : 0xffffff, 7); L.addChild(l); return l; });
    const hero = new Sprite(game.bank.sprite('hero', 'victory')); hero.anchor.set(0.5, 1); hero.x = cx; hero.y = 200 + CREDITS.length * 12 + 40; hero.scale.set(game.bank.invScale); L.addChild(hero);
    S = { credits: true, t: 0, lines, hero, update: (dt) => { S.t += dt; const off = S.t * 18; lines.forEach((l, i) => { l.y = 200 + i * 12 - off; }); hero.y = 200 + CREDITS.length * 12 + 40 - off; if ((game.input.pressed.jump || game.input.pressed.confirm) && S.t > 2) { game.input.consume('jump'); S = null; game.level = null; game.setState('title'); } return true; } };
  }
  game.hooks.playIntro = (onDone) => show(INTRO, { onDone, music: 'opening', kind: 'intro' });
  game.hooks.finalVictory = (level) => { level.state = 'done'; setTimeout(() => show(ENDING, { onDone: () => credits(), music: 'victory', kind: 'ending' }), 1500); };
  const prev = game.hooks.update; game.hooks.update = (dt) => (S ? (S.credits ? S.update(dt) : update(dt)) : prev ? prev(dt) : false);
}
