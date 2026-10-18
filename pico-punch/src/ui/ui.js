// Menus e telas: título, pausa, resultados, game over, seleção de fase, opções, loja e duelo
// (loja e duelo em módulos próprios). Tudo desenhado na cena (fonte bitmap), nos dois modos.
import { Container, Graphics, Sprite } from 'pixi.js';
import { BitmapLine } from '../render/text.js';
import { LEVELS } from '../levels.js';
import { installShop } from './shop.js';
import { installDuel } from './duel.js';
import { installStory } from './story.js';

const COL = { title: 0xffaa00, text: 0xffffff, dim: 0xaaaaff, sel: 0xffff55, bad: 0xff5555, ok: 0x55ff55 };

export class Menu {
  constructor(game, items, opts = {}) {
    this.game = game; this.items = items; this.index = 0; this.root = new Container(); this.lines = []; this.opts = opts;
    for (let i = 0; i < items.length; i++) { const l = new BitmapLine('', { shadow: true, align: 'center' }); this.root.addChild(l); this.lines.push(l); }
    this.refresh();
  }
  refresh() {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]; const sel = i === this.index; const label = typeof it.label === 'function' ? it.label() : it.label;
      this.lines[i].setText((sel ? '> ' : '  ') + label + (sel ? ' <' : '  ')); this.lines[i].setTint(it.disabled ? COL.dim : sel ? COL.sel : COL.text); this.lines[i].y = i * (this.opts.gap || 12);
    }
  }
  update(input) {
    if (input.pressed.down) { this.index = (this.index + 1) % this.items.length; input.consume('down'); this.game.audio?.sfx('menu'); this.refresh(); }
    if (input.pressed.up) { this.index = (this.index - 1 + this.items.length) % this.items.length; input.consume('up'); this.game.audio?.sfx('menu'); this.refresh(); }
    const it = this.items[this.index];
    if ((input.pressed.left || input.pressed.right) && it.adjust) { it.adjust(input.pressed.right ? 1 : -1); input.consume('left'); input.consume('right'); this.game.audio?.sfx('menu'); this.refresh(); }
    if (input.pressed.confirm || input.pressed.jump) { input.consume('confirm'); input.consume('jump'); if (!it.disabled) { this.game.audio?.sfx(it.sfx || 'confirm'); it.action?.(); } }
    if (input.pressed.back && this.opts.onBack) { input.consume('back'); this.game.audio?.sfx('back'); this.opts.onBack(); }
  }
}

export function installUI(game) {
  game.setState = ((orig) => function (st) { orig.call(game, st); })(game.setState);
  const ui = { menu: null, panel: null, t: 0 }; game.ui = ui;
  const center = () => Math.round(game.viewW / 2);
  const panel = (w, h, alpha = 0.88) => { const g = new Graphics(); g.roundRect(0, 0, w, h, 4).fill({ color: 0x0a0a1a, alpha }); g.roundRect(0, 0, w, h, 4).stroke({ color: 0x5a5a9a, width: 1 }); return g; };
  const line = (text, x, y, tint = COL.text, align = 'center') => { const l = new BitmapLine(text, { tint, shadow: true, align }); l.x = x; l.y = y; return l; };

  // ----- Título ---------------------------------------------------------------------------------
  function buildTitle() {
    const L = game.menuLayer; L.removeChildren(); ui.menu = null;
    const bg = new Graphics(); L.addChild(bg); ui.titleBg = bg;
    ui.titleHero = new Sprite(game.bank.sprite('hero', 'victory')); ui.titleHero.anchor.set(0.5, 1); ui.titleHero.scale.set(game.bank.invScale); L.addChild(ui.titleHero);
    ui.logo1 = new BitmapLine('PICO PUNCH', { tint: COL.title, shadow: true, align: 'center', scale: 2 }); ui.logo1.y = 30; L.addChild(ui.logo1);
    ui.logo2 = line('PUNHOS DE VANTURA', center(), 54, 0xffffff); L.addChild(ui.logo2);
    const p = game.save.progress; const canContinue = p.unlocked > 1;
    ui.menu = new Menu(game, [
      { label: 'NOVO JOGO', action: () => { p.lives = 3; p.money = 0; p.items = {}; game.save.save(); startIntro(); } },
      { label: 'CONTINUAR', disabled: !canContinue, action: () => buildLevelSelect() },
      { label: 'OPÇÕES', action: () => buildOptions(() => buildTitle()) },
    ]);
    ui.menu.root.y = 112; L.addChild(ui.menu.root);
    ui.credit = new BitmapLine('Z PULA   X SOCA   TAB: HD/8-BIT', { tint: COL.dim, shadow: true, align: 'center', spacing: 7 }); ui.credit.y = 176; L.addChild(ui.credit);
    ui.titleT = 0; layoutTitle();
    game.audio?.music.play('title');
  }
  function layoutTitle() {
    if (!ui.titleBg) return; const w = game.viewW, h = game.viewH; ui.titleT = (ui.titleT || 0) + 1 / 60;
    ui.titleBg.clear().rect(0, 0, w, h).fill({ color: 0x06061a, alpha: 0.18 }).roundRect(center() - 70, 104, 140, 48, 4).fill({ color: 0x06061a, alpha: 0.55 });
    ui.logo1.x = center(); ui.logo1.y = 28 + Math.round(Math.sin(ui.titleT * 2) * 1.5); ui.logo2.x = center(); ui.credit.x = center(); ui.menu.root.x = center();
    ui.titleHero.x = center() + 96; ui.titleHero.y = 150 + Math.round(Math.sin(ui.titleT * 3) * 2); ui.titleHero.texture = game.bank.sprite('hero', Math.floor(ui.titleT * 2) % 4 === 3 ? 'punch1' : 'victory');
  }
  function startIntro() { if (game.hooks.playIntro) game.hooks.playIntro(() => game.startLevel(0)); else game.startLevel(0); }
  // ----- Seleção de fase -------------------------------------------------------------------------
  function buildLevelSelect() {
    game.setState('levelselect'); const L = game.menuLayer; L.removeChildren();
    const bg = new Graphics(); bg.rect(0, 0, game.viewW, game.viewH).fill(0x0a0a1a); L.addChild(bg);
    L.addChild(line('SELEÇÃO DE FASE', center(), 14, COL.title));
    const p = game.save.progress; const items = LEVELS.map((lv, i) => ({ label: `${i + 1}. ${lv.name.toUpperCase()}` + (p.beaten[lv.id] ? ' ★' : ''), disabled: i + 1 > p.unlocked, action: () => game.startLevel(i) }));
    ui.menu = new Menu(game, items, { gap: 11, onBack: () => { game.setState('title'); buildTitle(); } }); ui.menu.root.x = center(); ui.menu.root.y = 34; L.addChild(ui.menu.root);
    const info = line('DINHEIRO: ' + p.money + '   VIDAS: ' + p.lives, center(), 164, COL.dim); L.addChild(info);
    L.addChild(line('X VOLTA', center(), 180, COL.dim));
  }
  // ----- Opções ---------------------------------------------------------------------------------
  function buildOptions(onBack) {
    const prev = game.state; game.setState('options'); const L = game.menuLayer; L.removeChildren(); const s = game.save.settings;
    const bg = new Graphics(); bg.rect(0, 0, game.viewW, game.viewH).fill({ color: 0x0a0a1a, alpha: 0.92 }); L.addChild(bg);
    L.addChild(line('OPÇÕES', center(), 14, COL.title));
    const vol = (k) => Math.round(s[k] * 10);
    const items = [
      { label: () => 'GRÁFICOS: ' + (game.mode === 'hd' ? 'HD REMASTER' : 'RETRÔ 8-BIT'), adjust: () => game.setMode(game.mode === 'hd' ? 'retro' : 'hd'), action: () => game.setMode(game.mode === 'hd' ? 'retro' : 'hd') },
      { label: () => 'FILTRO CRT: ' + (s.crt ? 'LIGADO' : 'DESLIGADO'), adjust: () => { s.crt = !s.crt; game.save.save(); game.hooks.crtChanged?.(); }, action: () => { s.crt = !s.crt; game.save.save(); game.hooks.crtChanged?.(); } },
      { label: () => 'LIMITE 8 SPRITES/LINHA: ' + (s.spriteLimit ? 'SIM' : 'NÃO'), adjust: () => { s.spriteLimit = !s.spriteLimit; game.save.save(); }, action: () => { s.spriteLimit = !s.spriteLimit; game.save.save(); } },
      { label: () => 'EFEITOS HD: ' + (s.reduceFx ? 'LEVES' : 'COMPLETOS'), adjust: () => { s.reduceFx = !s.reduceFx; game.save.save(); game.hdRenderer?.updateFilters(); }, action: () => { s.reduceFx = !s.reduceFx; game.save.save(); game.hdRenderer?.updateFilters(); } },
      { label: () => 'MÚSICA: ' + '■'.repeat(vol('musicVol')) + '□'.repeat(10 - vol('musicVol')), adjust: (d) => { s.musicVol = Math.max(0, Math.min(1, +(s.musicVol + d * 0.1).toFixed(1))); game.save.save(); game.audio?.setVolumes(s.musicVol, s.sfxVol); } },
      { label: () => 'EFEITOS: ' + '■'.repeat(vol('sfxVol')) + '□'.repeat(10 - vol('sfxVol')), adjust: (d) => { s.sfxVol = Math.max(0, Math.min(1, +(s.sfxVol + d * 0.1).toFixed(1))); game.save.save(); game.audio?.setVolumes(s.musicVol, s.sfxVol); } },
      { label: () => 'CONTROLES', action: () => buildControls(() => buildOptions(onBack)) },
      { label: () => 'APAGAR PROGRESSO', action: () => { game.save.reset(); game.input.resetBindings(); buildOptions(onBack); } },
      { label: 'VOLTAR', action: onBack },
    ];
    ui.menu = new Menu(game, items, { gap: 13, onBack }); ui.menu.root.x = center(); ui.menu.root.y = 36; L.addChild(ui.menu.root);
    L.addChild(line('←→ AJUSTA   X VOLTA', center(), 176, COL.dim));
  }
  function buildControls(onBack) {
    game.setState('controls'); const L = game.menuLayer; L.removeChildren(); const inp = game.input;
    const bg = new Graphics(); bg.rect(0, 0, game.viewW, game.viewH).fill({ color: 0x0a0a1a, alpha: 0.95 }); L.addChild(bg);
    L.addChild(line('CONTROLES (ENTER REMAPEIA)', center(), 14, COL.title));
    const names = { left: 'ESQUERDA', right: 'DIREITA', up: 'CIMA', down: 'BAIXO', jump: 'PULO', punch: 'SOCO', pause: 'PAUSA', mode: 'HD/RETRÔ' };
    const items = Object.keys(names).map((a) => ({ label: () => `${names[a]}: ${inp.remapping === a ? '...' : inp.keys[a].map((k) => inp.keyName(k)).join(' / ')}`, action: () => { inp.remapping = a; ui.menu.refresh(); } }));
    items.push({ label: 'PADRÃO', action: () => { inp.resetBindings(); game.save.settings.keys = null; game.save.save(); ui.menu.refresh(); } });
    items.push({ label: 'VOLTAR', action: () => { game.save.settings.keys = inp.keys; game.save.save(); onBack(); } });
    ui.menu = new Menu(game, items, { gap: 12, onBack: () => { game.save.settings.keys = inp.keys; game.save.save(); onBack(); } }); ui.menu.root.x = center(); ui.menu.root.y = 34; L.addChild(ui.menu.root);
    ui.controlsRefresh = true;
  }
  // ----- Pausa ----------------------------------------------------------------------------------
  function buildPause() {
    const L = game.menuLayer; L.removeChildren();
    const g = panel(140, 96); g.x = center() - 70; g.y = 46; L.addChild(g);
    L.addChild(line('PAUSA', center(), 54, COL.title));
    ui.menu = new Menu(game, [
      { label: 'CONTINUAR', action: () => { game.setState('play'); game.audio?.music.resume(); } },
      { label: 'OPÇÕES', action: () => buildOptions(() => { game.setState('pause'); buildPause(); }) },
      { label: 'REINICIAR FASE', action: () => game.startLevel(game.levelIndex) },
      { label: 'SAIR PARA O TÍTULO', action: () => { game.level = null; game.setState('title'); buildTitle(); } },
    ], { gap: 12, onBack: () => { game.setState('play'); game.audio?.music.resume(); } });
    ui.menu.root.x = center(); ui.menu.root.y = 72; L.addChild(ui.menu.root);
  }
  // ----- Resultados -----------------------------------------------------------------------------
  function showResults(lv) {
    const L = game.menuLayer; L.removeChildren();
    const g = panel(208, 110); g.x = center() - 104; g.y = 36; L.addChild(g);
    L.addChild(line('FASE COMPLETA!', center(), 44, COL.title));
    L.addChild(line(lv.name.toUpperCase(), center(), 58, COL.dim));
    const t = Math.floor(lv.time); const best = game.save.progress.bestTimes[lv.id];
    L.addChild(line(`TEMPO  ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, center(), 76));
    L.addChild(line(`PLACAR ${lv.score}`, center(), 88));
    L.addChild(line(`DINHEIRO ${lv.money}  (+${lv.money - lv.moneyStart})`, center(), 100, 0xffff55));
    L.addChild(line(`INIMIGOS ${lv.defeated}   MORTES ${lv.deaths}`, center(), 112, COL.dim));
    L.addChild(line(game.levelIndex + 1 < LEVELS.length ? 'PULO: PRÓXIMA FASE' : 'PULO: CONTINUAR', center(), 130, COL.ok));
  }
  function showGameOver() { const L = game.menuLayer; L.removeChildren(); const g = panel(216, 64, 0.9); g.x = center() - 108; g.y = 62; L.addChild(g); L.addChild(line('FIM DE JOGO', center(), 72, COL.bad)); const a = new BitmapLine('PULO: CONTINUAR (3 VIDAS)', { tint: COL.text, shadow: true, align: 'center', spacing: 7 }); a.x = center(); a.y = 94; const b = new BitmapLine('DINHEIRO MANTIDO', { tint: COL.dim, shadow: true, align: 'center', spacing: 7 }); b.x = center(); b.y = 108; L.addChild(a, b); }

  // ----- Hooks no Game --------------------------------------------------------------------------
  game.hooks.stateChanged = (s) => { if (s === 'title') buildTitle(); if (s === 'pause') { buildPause(); game.audio?.sfx('pause'); } if (s === 'gameover') showGameOver(); };
  game.hooks.showResults = showResults;
  game.hooks.resize = () => { layoutTitle(); if (game.state === 'pause') buildPause(); };
  game.hooks.modeChanged = () => { if (game.state === 'title') buildTitle(); };
  game.hooks.crtChanged = () => { game.save.settings.crtHD = game.save.settings.crt; game.applyCrt(); };
  game.hooks.update = (dt) => {
    const st = game.state;
    if (st === 'title') { layoutTitle(); if (ui.menu) ui.menu.update(game.input); return true; }
    if (st === 'levelselect' || st === 'options' || st === 'controls' || st === 'pause') { if (ui.controlsRefresh && st === 'controls') ui.menu.refresh(); ui.menu?.update(game.input); return true; }
    return false;
  };
  installShop(game); installDuel(game); installStory(game);
  if (game.state === 'title') buildTitle();
}
