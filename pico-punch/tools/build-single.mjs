// Gera ../pico-punch.html: o jogo inteiro num único arquivo HTML (como enduro.html), sem servidor.
// Embute Pixi (cópia de vendor/), todo o src/ (esbuild, IIFE, imports dinâmicos inlinados),
// as fases JSON (globalThis.__PP_LEVELS) e o AudioWorklet do PSG (data: URL em __PP_WORKLET_URL).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '..', process.argv[2] || 'pico-punch.html');

const js = await build({
  entryPoints: [resolve(root, 'src/main.js')], bundle: true, write: false, format: 'iife', target: 'es2022',
  minify: true, legalComments: 'none', alias: { 'pixi.js': resolve(root, 'vendor/pixi.min.mjs') }, logLevel: 'warning',
});
const bundle = js.outputFiles[0].text;

const levels = {};
for (const f of readdirSync(resolve(root, 'levels'))) if (f.endsWith('.json') && !f.startsWith('_')) levels['./levels/' + f] = JSON.parse(readFileSync(resolve(root, 'levels', f), 'utf8'));
const worklet = readFileSync(resolve(root, 'src/audio/psg-worklet.js'), 'utf8');

const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const start = html.indexOf('<script type="importmap">'); const end = html.indexOf('</body>');
if (start < 0 || end < 0) throw new Error('index.html: não achei o bloco de scripts');
const inline = `<!-- Arquivo único gerado por tools/build-single.mjs — edite pico-punch/src e rode: node pico-punch/tools/build-single.mjs -->
<script>
globalThis.__PP_LEVELS = ${safe(JSON.stringify(levels))};
globalThis.__PP_WORKLET_URL = 'data:text/javascript;base64,${Buffer.from(worklet, 'utf8').toString('base64')}'; // data: funciona em file://, blob: não
</script>
<script>
${safe(bundle)}
</script>
`;
const single = html.slice(0, start) + inline + html.slice(end);
writeFileSync(out, single);
console.log(`gerado ${out} (${(single.length / 1024 / 1024).toFixed(2)} MB; bundle ${(bundle.length / 1024).toFixed(0)} KB, ${Object.keys(levels).length} fases)`);
