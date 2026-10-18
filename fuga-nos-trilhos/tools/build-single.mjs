// Gera um HTML de arquivo único (../fuga-nos-trilhos.html na raiz do repositório)
// com todo o JavaScript embutido, para abrir com duplo clique (file://), sem servidor.
// Uso: node tools/build-single.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, '..', 'fuga-nos-trilhos.html');

const res = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, format: 'esm', minify: true, write: false, target: 'es2020', legalComments: 'none',
  alias: {
    three: path.join(root, 'vendor/three/build/three.module.js'),
    'three/addons': path.join(root, 'vendor/three/examples/jsm'),
  },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<!--\s*Importmap[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, () =>
  '<!-- Three.js 0.186.1 (MIT, © three.js authors) embutido -->\n  <script type="module">' + js + '</script>');
if (html.includes('./src/main.js') || html.includes('importmap')) throw new Error('substituição falhou');
fs.writeFileSync(out, html);
console.log('ok', out, (html.length / 1024 / 1024).toFixed(2) + ' MB');
