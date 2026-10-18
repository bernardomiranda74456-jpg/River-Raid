// HUD de jogo (vidas, dinheiro, placar, tempo) e mensagens centrais. Fonte bitmap nos dois modos.
import { Container, Sprite } from 'pixi.js';
import { BitmapLine } from './text.js';
export class Hud {
  constructor(bank) {
    this.bank = bank; this.root = new Container();
    this.lifeIcon = new Sprite(bank.sprite('life', 'f0')); this.lifeIcon.x = 4; this.lifeIcon.y = 2; this.root.addChild(this.lifeIcon);
    this.lives = new BitmapLine('×3', { tint: 0xffffff, shadow: true }); this.lives.x = 20; this.lives.y = 6; this.root.addChild(this.lives);
    this.bagIcon = new Sprite(bank.sprite('moneybag', 'f0')); this.bagIcon.x = 52; this.bagIcon.y = 2; this.root.addChild(this.bagIcon);
    this.money = new BitmapLine('0', { tint: 0xffe066, shadow: true }); this.money.x = 68; this.money.y = 6; this.root.addChild(this.money);
    this.score = new BitmapLine('000000', { tint: 0xffffff, shadow: true, align: 'right' }); this.score.y = 6; this.root.addChild(this.score);
    this.time = new BitmapLine('0:00', { tint: 0xbfe9ff, shadow: true, align: 'center' }); this.time.y = 6; this.root.addChild(this.time);
    this.msg = new BitmapLine('', { tint: 0xffffff, shadow: true, align: 'center' }); this.msg.visible = false; this.root.addChild(this.msg);
    this.msg2 = new BitmapLine('', { tint: 0xffe066, shadow: true, align: 'center' }); this.msg2.visible = false; this.root.addChild(this.msg2);
    this.itemIcons = new Container(); this.root.addChild(this.itemIcons);
    this.bossName = new BitmapLine('', { tint: 0xff8080, shadow: true, align: 'center', spacing: 7 }); this.bossName.visible = false; this.root.addChild(this.bossName);
    this.bossHp = new BitmapLine('', { tint: 0xff6060, shadow: true, align: 'center' }); this.bossHp.visible = false; this.root.addChild(this.bossHp); this.bossRef = null;
    this.brace = new BitmapLine('', { tint: 0x9ad0ff, shadow: true, align: 'right', spacing: 7 }); this.root.addChild(this.brace);
    this.icons = {}; for (const k of ['cape', 'ghostbuddy', 'eye']) { const sp = new Sprite(bank.sprite(k, 'f0')); sp.visible = false; this.itemIcons.addChild(sp); this.icons[k] = sp; }
  }
  layout(w, h) { this.bossName.x = Math.round(w / 2); this.bossName.y = 18; this.bossHp.x = this.bossName.x; this.bossHp.y = 28; this.brace.x = w - 6; this.brace.y = 18; this.score.x = w - 6; this.time.x = Math.round(w / 2); this.msg.x = Math.round(w / 2); this.msg.y = Math.round(h / 2 - 12); this.msg2.x = this.msg.x; this.msg2.y = this.msg.y + 14; this.itemIcons.x = w - 6 - 18; this.itemIcons.y = 16; }
  refreshMode() { this.lifeIcon.texture = this.bank.sprite('life', 'f0'); this.bagIcon.texture = this.bank.sprite('moneybag', 'f0'); const inv = this.bank.invScale; this.lifeIcon.scale.set(inv); this.bagIcon.scale.set(inv); }
  update(level, save) {
    this.lives.setText('×' + Math.max(0, save.progress.lives)); this.money.setText(String(level.money));
    this.score.setText(String(level.score).padStart(6, '0'));
    if (this.bossRef) { this.bossHp.setText('♥'.repeat(Math.max(0, this.bossRef.hp)) + '·'.repeat(this.bossRef.maxHp - Math.max(0, this.bossRef.hp))); if (this.bossRef.remove) this.showBoss(null); }
    this.brace.setText(level.hero.items.bracelet > 0 ? 'RAIO ×' + level.hero.items.bracelet : '');
    let ix = 0; for (const k in this.icons) { const sp = this.icons[k]; const on = !!level.hero.items[k]; sp.visible = on; if (on) { sp.texture = this.bank.sprite(k, 'f0'); sp.scale.set(this.bank.invScale); sp.x = -ix * 18; sp.y = 12; ix++; } }
    const t = Math.floor(level.time); this.time.setText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
  }
  showBoss(name, boss = null) { this.bossRef = boss; this.bossName.visible = this.bossHp.visible = !!name; if (name) this.bossName.setText(name); }
  showMessage(a, b = '') { this.msg.setText(a); this.msg.visible = !!a; this.msg2.setText(b); this.msg2.visible = !!b; }
}
