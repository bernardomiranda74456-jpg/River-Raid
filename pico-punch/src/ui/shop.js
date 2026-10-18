// Loja: itens e veículos comprados com o dinheiro coletado. Desenhada na cena (bitmap), nos dois modos.
import { Container, Graphics, Sprite } from 'pixi.js';
import { BitmapLine } from '../render/text.js';
import { Menu } from './ui.js';

export const SHOP_ITEMS = [
  { id: 'moto', name: 'MOTOCA TROVÃO', price: 150, icon: 'moto', desc: 'Corre sozinha, pula pedras e quebra blocos. Um golpe a destrói.' },
  { id: 'heli', name: 'HELIPÉ', price: 200, icon: 'heli', desc: 'Helicóptero a pedal: segure PULO para subir, SOCO atira.' },
  { id: 'boat', name: 'BARQUINHO', price: 100, icon: 'boat', desc: 'Flutua na água. PULO dá um salto. Útil no lago.' },
  { id: 'bracelet', name: 'PULSEIRA DE RAIO', price: 120, icon: 'bracelet', desc: 'Cada soco dispara um raio. 30 cargas.' },
  { id: 'cape', name: 'CAPA PLANADORA', price: 100, icon: 'cape', desc: 'Segure PULO no ar para planar devagar.' },
  { id: 'capsule', name: 'CÁPSULA ESTELAR', price: 80, icon: 'capsule', desc: 'Invencível por 12 segundos ao sair da loja.' },
  { id: 'ghostbuddy', name: 'FANTASMINHA AMIGO', price: 150, icon: 'ghostbuddy', desc: 'Um fantasma circula você e derrota inimigos.' },
  { id: 'life', name: 'VIDA EXTRA', price: 100, icon: 'life', desc: 'Mais uma chance.' },
  { id: 'eye', name: 'OLHO MÁGICO', price: 60, icon: 'eye', desc: 'Revela a escolha do adversário no próximo duelo.' },
];

export function installShop(game) {
  let ui = null;
  const build = (level, door) => {
    const L = game.menuLayer; L.removeChildren(); const cx = Math.round(game.viewW / 2); const W = 232, H = 170; const x0 = cx - W / 2, y0 = 10;
    const g = new Graphics(); g.roundRect(x0, y0, W, H, 4).fill({ color: 0x14102a, alpha: 0.94 }).stroke({ color: 0xffaa00, width: 1 }); L.addChild(g);
    const title = new BitmapLine('LOJA DA VILA', { tint: 0xffaa00, shadow: true, align: 'center' }); title.x = cx; title.y = y0 + 6; L.addChild(title);
    const money = new BitmapLine('', { tint: 0xffff55, shadow: true, align: 'right' }); money.x = x0 + W - 8; money.y = y0 + 6; L.addChild(money);
    const desc = new BitmapLine('', { tint: 0xaaaaff, shadow: true, align: 'center', spacing: 7 }); desc.x = cx; desc.y = y0 + H - 30; L.addChild(desc);
    const desc2 = new BitmapLine('', { tint: 0xaaaaff, shadow: true, align: 'center', spacing: 7 }); desc2.x = cx; desc2.y = y0 + H - 20; L.addChild(desc2);
    const hint = new BitmapLine('PULO COMPRA   SOCO SAI', { tint: 0xaaaaff, shadow: true, align: 'center', spacing: 7 }); hint.x = cx; hint.y = y0 + H - 9; L.addChild(hint);
    const icon = new Sprite(); icon.x = x0 + 12; icon.y = y0 + 22; icon.scale.set(game.bank.invScale); L.addChild(icon);
    const p = game.save.progress; const bought = { vehicle: null, capsule: false };
    const owned = (it) => (it.id === 'cape' || it.id === 'ghostbuddy' || it.id === 'eye') && p.items[it.id];
    const items = SHOP_ITEMS.map((it) => ({ it, label: () => `${it.name} ${owned(it) ? '(TEM)' : (it.price + '$')}`, sfx: 'buy', action: () => {
      if (owned(it)) { game.audio?.sfx('noMoney'); return; }
      if (level.money < it.price) { game.audio?.sfx('noMoney'); desc.setText('DINHEIRO INSUFICIENTE!'); desc2.setText(''); return; }
      level.addMoney(-it.price);
      switch (it.id) {
        case 'moto': case 'heli': case 'boat': bought.vehicle = it.id; break;
        case 'bracelet': p.items.bracelet = (p.items.bracelet || 0) + 30; break;
        case 'capsule': bought.capsule = true; break;
        case 'life': p.lives = Math.min(9, p.lives + 1); break;
        default: p.items[it.id] = true;
      }
      game.save.save(); level.applyInventory(); refresh();
    } }));
    const menu = new Menu(game, items, { gap: 11, onBack: () => close() }); menu.root.x = cx + 20; menu.root.y = y0 + 22; L.addChild(menu.root);
    const refresh = () => { money.setText(level.money + '$'); menu.refresh(); const it = SHOP_ITEMS[menu.index]; icon.texture = game.bank.sprite(it.icon, 'f0'); const words = it.desc.split(' '); let a = '', b = ''; for (const w of words) { if (a.length + w.length < 30) a += (a ? ' ' : '') + w; else b += (b ? ' ' : '') + w; } desc.setText(a); desc2.setText(b); };
    const close = () => { game.menuLayer.removeChildren(); ui = null; level.state = 'play'; game.setState('play'); level.camera.targetZoom = 1; game.audio?.music.play(level.json.music); game.audio?.sfx('door');
      if (bought.vehicle) level.mountVehicle(bought.vehicle); if (bought.capsule) level.hero.items.capsule = 12; level.hero.invuln = Math.max(level.hero.invuln, 0.5); };
    ui = { menu, refresh }; refresh(); if (game.mode === 'hd') level.camera.targetZoom = 1.1;
    game.audio?.sfx('shop'); game.audio?.music.play('village');
  };
  game.hooks.openShop = (level, door) => { game.setState('shop'); build(level, door); };
  const prevUpdate = game.hooks.update;
  game.hooks.update = (dt) => { if (game.state === 'shop' && ui) { const i = ui.menu.index; ui.menu.update(game.input); if (ui.menu.index !== i) ui.refresh(); return true; } return prevUpdate ? prevUpdate(dt) : false; };
}
