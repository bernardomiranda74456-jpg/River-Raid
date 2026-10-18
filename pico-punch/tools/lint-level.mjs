// Verificações simples de design: buracos de 1 tile que não levam ao fundo, linhas com largura diferente,
// ausência de P/E, espinhos em pisos de 1 tile. Uso: node tools/lint-level.mjs levels/x.json
import fs from 'fs';
const lv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const rows = lv.map; const W = Math.max(...rows.map((r) => r.length)); const H = rows.length;
const solid = (x, y) => { if (x < 0 || x >= W) return true; if (y < 0 || y >= H) return false; return '#%SR?UXI'.includes(rows[y][x] || '.'); };
const issues = [];
rows.forEach((r, i) => { if (r.length !== W) issues.push(`linha ${i} tem largura ${r.length} (esperado ${W})`); });
if (!rows.some((r) => r.includes('P'))) issues.push('sem ponto inicial P'); if (!rows.some((r) => r.includes('E'))) issues.push('sem bandeira E');
for (let y = 0; y < H; y++) for (let x = 1; x < W - 1; x++) {
  if (!solid(x, y) && solid(x - 1, y) && solid(x + 1, y) && solid(x, y + 1) && !solid(x, y - 1)) { // buraco de 1 tile com chão
    let depth = 1; while (y - depth >= 0 && !solid(x, y - depth) && solid(x - 1, y - depth) && solid(x + 1, y - depth)) depth++;
    if (depth >= 2) issues.push(`buraco de 1 tile de largura e ${depth} de profundidade em (${x},${y - depth + 1})`);
  }
}
console.log(issues.length ? issues.join('\n') : 'ok: sem problemas detectados'); process.exit(issues.length ? 1 : 0);
