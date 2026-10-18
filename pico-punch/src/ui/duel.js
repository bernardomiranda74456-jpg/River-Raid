// Duelo de Mãos (pedra-papel-tesoura, melhor de 3) antes de cada chefe, depois a luta de plataforma.
import { Container, Graphics, Sprite } from 'pixi.js';
import { BitmapLine } from '../render/text.js';
import { Boss, BOSS_DEFS } from '../world/entities/boss.js';
import { T, TILE } from '../world/tilemap.js';
import { rng } from '../core/math.js';

const HANDS = ['handRock', 'handPaper', 'handScissors']; const NAMES = ['PEDRA', 'PAPEL', 'TESOURA'];
const beats = (a, b) => (a === 0 && b === 2) || (a === 1 && b === 0) || (a === 2 && b === 1);

export function installDuel(game) {
  let D = null;
  const line = (t, x, y, tint = 0xffffff, align = 'center', spacing = 8) => { const l = new BitmapLine(t, { tint, shadow: true, align, spacing }); l.x = x; l.y = y; return l; };
  function start(level) {
    const def = level.bossDef || { type: 'frogking' }; const bd = BOSS_DEFS[def.type] || BOSS_DEFS.frogking;
    level.bossSpawn = level.bossSpawn || { x: level.hero.x + 120, y: level.hero.bottom }; level.state = 'duel'; game.setState('duel'); level.hero.state = 'frozen'; level.hero.vx = 0;
    if (game.mode === 'hd') level.camera.targetZoom = 1.12;
    game.audio?.music.play('duel');
    const L = game.menuLayer; L.removeChildren(); const cx = Math.round(game.viewW / 2);
    const g = new Graphics(); g.roundRect(cx - 120, 8, 240, 112, 4).fill({ color: 0x120c22, alpha: 0.92 }).stroke({ color: 0xffd36b, width: 1 }); L.addChild(g);
    const title = line('DUELO DE MÃOS', cx, 14, 0xffd36b); const sub = line(bd.name + ' - MELHOR DE 3', cx, 26, 0x9aa4c8, 'center', 7); L.addChild(title, sub);
    const heroS = new Sprite(game.bank.sprite('hero', 'idle0')); heroS.anchor.set(0.5, 1); heroS.x = cx - 80; heroS.y = 96; heroS.scale.set(game.bank.invScale); L.addChild(heroS);
    const bossS = new Sprite(game.bank.sprite(def.type, 'f0')); bossS.anchor.set(0.5, 1); bossS.x = cx + 80; bossS.y = 100; bossS.scale.set(-game.bank.invScale, game.bank.invScale); L.addChild(bossS);
    const heroHand = new Sprite(); heroHand.anchor.set(0.5); heroHand.x = cx - 40; heroHand.y = 70; heroHand.scale.set(game.bank.invScale); heroHand.visible = false; L.addChild(heroHand);
    const bossHand = new Sprite(); bossHand.anchor.set(0.5); bossHand.x = cx + 40; bossHand.y = 70; bossHand.scale.set(-game.bank.invScale, game.bank.invScale); bossHand.visible = false; L.addChild(bossHand);
    const score = line('0 × 0', cx, 42, 0xffffff); const msg = line('', cx, 56, 0xfff3a0); const hint = line('← PEDRA   ↑ PAPEL   → TESOURA', cx, 108, 0x9aa4c8, 'center', 7); L.addChild(score, msg, hint);
    const sel = [0, 1, 2].map((i) => { const s = new Sprite(game.bank.sprite(HANDS[i], 'f0')); s.anchor.set(0.5, 1); s.x = cx - 24 + i * 24; s.y = 104; s.scale.set(game.bank.invScale * 0.6); s.alpha = 0.45; L.addChild(s); return s; });
    D = { level, def, bd, t: 0, phase: 'count', beat: 0, wins: 0, losses: 0, heroPick: 1, bossPick: 0, ui: { heroS, bossS, heroHand, bossHand, score, msg, sel, title }, eye: level.hero.items.eye, tellShown: false, history: [] };
    D.bossPick = choose(D); D.t = 0;
    level.game.hooks.duelActive = true;
  }
  /** Escolha do chefe: tende a evitar repetir e a "contrar" a última jogada do herói — aprendível. */
  function choose(D) {
    const h = D.history; if (h.length && rng.next() < 0.55) { const lastHero = h[h.length - 1]; return (lastHero + 1) % 3; } // escolhe o que vence a última do herói
    let p = Math.floor(rng.next() * 3); if (D.lastBoss === p && rng.next() < 0.7) p = (p + 1) % 3; return p;
  }
  function update(dt) {
    const d = D; const inp = game.input; const ui = d.ui; d.t += dt;
    if (d.phase === 'count') {
      // 4 tempos de 0.55 s: PEDRA, PAPEL, TESOURA, JÁ!
      const beat = Math.min(4, Math.floor(d.t / 0.55));
      if (beat !== d.beat) { d.beat = beat; if (beat < 3) { ui.msg.setText(['PEDRA...', 'PAPEL...', 'TESOURA...'][beat]); game.audio?.sfx('countdown'); } }
      if (inp.held.left) d.heroPick = 0; else if (inp.held.up) d.heroPick = 1; else if (inp.held.right) d.heroPick = 2;
      ui.sel.forEach((s, i) => { s.alpha = i === d.heroPick ? 1 : 0.4; s.y = i === d.heroPick ? 102 : 104; });
      // tell sutil no 2º tempo: deslocamento do sprite + leve variação de tempo da animação
      const tellOff = [-1.5, 0, 1.5][d.bossPick]; ui.bossS.x = Math.round(game.viewW / 2) + 80 + (beat >= 1 && beat < 3 ? tellOff : 0); ui.bossS.y = 100 + (beat === 1 && d.bossPick === 1 ? -1 : 0);
      ui.bossS.texture = game.bank.sprite(d.def.type, beat >= 1 && d.bossPick === 2 && Math.floor(d.t * 12) % 2 ? 'f1' : 'f0');
      if (d.eye && !d.tellShown) { d.tellShown = true; ui.bossHand.visible = true; ui.bossHand.texture = game.bank.sprite(HANDS[d.bossPick], 'f0'); ui.bossHand.alpha = 0.6; }
      if (beat >= 3) { d.phase = 'reveal'; d.t = 0; ui.msg.setText('JÁ!'); game.audio?.sfx('reveal3'); ui.heroHand.visible = ui.bossHand.visible = true; ui.heroHand.texture = game.bank.sprite(HANDS[d.heroPick], 'f0'); ui.bossHand.texture = game.bank.sprite(HANDS[d.bossPick], 'f0'); ui.bossHand.alpha = 1; d.history.push(d.heroPick); d.lastBoss = d.bossPick; if (d.eye) { d.eye = false; game.save.progress.items.eye = false; d.level.applyInventory(); }
        const win = beats(d.heroPick, d.bossPick), lose = beats(d.bossPick, d.heroPick); d.result = win ? 'win' : lose ? 'lose' : 'draw'; if (win) d.wins++; if (lose) d.losses++; }
    } else if (d.phase === 'reveal') {
      ui.heroHand.y = 70 + Math.sin(d.t * 30) * (d.t < 0.2 ? 3 : 0); ui.bossHand.y = ui.heroHand.y;
      if (d.t > 0.5 && !d.said) { d.said = true; ui.msg.setText(d.result === 'win' ? `${NAMES[d.heroPick]} VENCE!` : d.result === 'lose' ? `${NAMES[d.bossPick]} VENCE...` : 'EMPATE!'); ui.score.setText(`${d.wins} × ${d.losses}`); game.audio?.sfx(d.result === 'win' ? 'duelWin' : d.result === 'lose' ? 'duelLose' : 'menu'); }
      if (d.t > 1.6) {
        d.said = false; ui.heroHand.visible = ui.bossHand.visible = false;
        if (d.wins >= 2) { d.phase = 'won'; d.t = 0; ui.msg.setText('VOCÊ VENCEU O DUELO!'); ui.title.setText('PREPARE OS PUNHOS!'); game.audio?.sfx('duelWin'); }
        else if (d.losses >= 2) { d.phase = 'lost'; d.t = 0; ui.msg.setText('PERDEU O DUELO...'); game.audio?.sfx('duelLose'); }
        else { d.phase = 'count'; d.t = 0; d.beat = -1; d.bossPick = choose(d); d.tellShown = false; }
      }
    } else if (d.phase === 'won') { if (d.t > 1.4) startFight(d); }
    else if (d.phase === 'lost') { if (d.t > 1.4) { const lv = d.level; game.menuLayer.removeChildren(); D = null; lv.camera.targetZoom = 1; lv.hero.state = 'normal'; lv.state = 'play'; game.setState('play'); lv.hero.hurt(lv, 'duel'); } }
    return true;
  }
  function startFight(d) {
    const lv = d.level; game.menuLayer.removeChildren(); D = null; lv.hero.state = 'normal'; lv.state = 'boss'; game.setState('play');
    const gateX = lv.gate ? lv.gate.x : lv.hero.x - 48; const x1 = Math.min(lv.map.pixelW - 16, lv.bossSpawn.x + 160);
    lv.arena = { x0: gateX + 16, x1 }; lv.boss = new Boss(d.def.type, lv.bossSpawn.x, lv.bossSpawn.y, lv.arena); lv.entities.push(lv.boss);
    // fecha o portão: pilha de 3 blocos usados na coluna do portão
    if (lv.gate) { const tx = Math.floor(lv.gate.x / TILE), ty = Math.floor(lv.gate.y / TILE) - 1; lv.gateTiles = []; for (let k = 0; k < 3; k++) { if (lv.map.get(tx, ty - k) === T.EMPTY) { lv.map.set(tx, ty - k, T.USED); lv.gateTiles.push([tx, ty - k]); } } lv.sfx('thud'); lv.camera.shake(3, 0.2); }
    lv.camera.zones = [{ x: lv.arena.x0 - 16, w: lv.arena.x1 - lv.arena.x0 + 32, zoom: 1 }];
    game.audio?.music.play(d.bd.music, { restart: true }); game.hud.showBoss(d.bd.name, lv.boss);
    lv.camera.targetZoom = 1;
  }
  game.hooks.startBoss = (level) => { if (level.bossDef || level.bossSpawn) start(level); else level.bossSpawn = null; };
  const prev = game.hooks.update; game.hooks.update = (dt) => (D ? update(dt) : prev ? prev(dt) : false);
}
