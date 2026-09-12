const vm = require('vm'), fs = require('fs');
const base = '/home/user/River-Raid/pickleball/js/';
for (const f of ['court','physics','shots','stroke','match','ai']) vm.runInThisContext(fs.readFileSync(base+f+'.js','utf8'));
const C = PB.Court;

const stats = {
  volleys: 0, volleyInKitchen: 0, volleyNearLine: [],
  hitsAfterBounceInKitchen: 0,
  serveFootFaults: 0, serveOutsideHalf: 0,
  thirdShotVolleys: 0, doubleHits: 0,
  ballThroughPlayer: 0,
};

function audit(cfg, seconds) {
  const m = new PB.Match(cfg);
  for (const p of m.players) p.ctrl = 'cpu';
  const dt = 1/60;
  const origExec = m.executeHit.bind(m);
  m.executeHit = function (p, sw) {
    const volley = m.rally.bounces === 0;
    if (volley) {
      stats.volleys++;
      // official rule: any part of the player touching the NVZ or its line
      if (C.playerInKitchen(p)) stats.volleyInKitchen++;
      const wide = Math.abs(p.x) > C.HALF_W + 0.6;    // NVZ ends at the sideline
      const dist = C.frontEdge(p) - C.KITCHEN;        // + = whole body behind the line
      if (wide) stats.volleyWideOfSideline = (stats.volleyWideOfSideline || 0) + 1;
      else if (dist < 1.2) stats.volleyNearLine.push(+dist.toFixed(2));
      if (m.rally.shotCount <= 2) stats.thirdShotVolleys++;
    } else if (C.playerInKitchen(p)) {
      stats.hitsAfterBounceInKitchen++;               // legal, but worth counting
    }
    if (m.rally.lastHitter === p.id) stats.doubleHits++;
    return origExec(p, sw);
  };
  const origServe = m.doServe.bind(m);
  m.doServe = function (x, z, pw) {
    const s = m.players[m.serverIdx];
    if (Math.abs(s.z) < C.HALF_L) stats.serveFootFaults++;
    const want = m.sideXSign(s);
    if (Math.sign(s.x) !== want) stats.serveOutsideHalf++;
    return origServe(x, z, pw);
  };
  let t = 0;
  while (t < seconds) { m.update(dt, {}); m.events.length = 0; t += dt; }
}

audit({ format: 'doubles', humans: 1, difficulty: 'normal' }, 600);
audit({ format: 'doubles', humans: 1, difficulty: 'dificil' }, 600);
audit({ format: 'singles', humans: 1, difficulty: 'normal' }, 400);

const near = stats.volleyNearLine.sort((a,b)=>a-b);
console.log('voleios totais:', stats.volleys);
console.log('voleios com o jogador DENTRO da cozinha (falta):', stats.volleyInKitchen);
console.log('voleio antes do quique obrigatório (3o golpe):', stats.thirdShotVolleys);
console.log('golpes após o quique com o jogador na cozinha (legal):', stats.hitsAfterBounceInKitchen);
console.log('golpes duplos do mesmo jogador:', stats.doubleHits);
console.log('saques com o pé dentro da quadra:', stats.serveFootFaults);
console.log('saques da metade errada:', stats.serveOutsideHalf);
console.log('voleios legais fora da linha lateral (a cozinha não se aplica):', stats.volleyWideOfSideline || 0);
console.log('voleios com o pé a menos de 1,2 ft da linha:', near.length,
  near.length ? '(menor folga: ' + near[0] + ' ft)' : '');
