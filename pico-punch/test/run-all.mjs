// Roda o bot em todas as fases (sequencial) e imprime um resumo. Uso: node test/run-all.mjs [fast=5]
import { spawnSync } from 'child_process';
const fast = process.argv[2] || '5'; const rows = [];
for (let n = 1; n <= 10; n++) {
  const r = spawnSync('node', ['test/e2e.mjs', String(n), 'retro', fast], { encoding: 'utf8' });
  const out = r.stdout || ''; const pass = /\nPASS\n?$/.test(out); let info = {};
  try { info = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)); } catch (e) {}
  rows.push({ level: n, pass, deaths: info.deaths, violations: info.violations, wp: `${info.wp}/${info.total}`, time: info.time ? Math.round(info.time) + 's' : '-', end: info.reachedDuel ? 'duelo' : info.lvState });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
console.log('\nResumo:'); console.table(rows); process.exit(rows.every((r) => r.pass) ? 0 : 1);
