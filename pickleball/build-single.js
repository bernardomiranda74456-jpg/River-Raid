'use strict';
// Bundles index.html + js/*.js into one self-contained HTML file.
//   node build-single.js              -> pickleball-v<N>.html (standalone page)
//   node build-single.js --fragment X -> same page without the html/head/body
//                                        wrapper, for hosts that supply their own
const fs = require('fs');
const path = require('path');

// Bump this and the game names its own build. It is the one place the version
// lives: the file name and the line under the title screen both read it.
const VERSION = 2;

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const stamped = html.replace('<!--VERSION-->', `v${VERSION}`);

const inlined = stamped.replace(/<script src="js\/([^"]+)"><\/script>/g, (_, file) => {
  const code = fs.readFileSync(path.join(dir, 'js', file), 'utf8');
  if (code.includes('</script')) throw new Error(`${file} contains a closing script tag`);
  return `<script>\n${code}\n</script>`;
});

const remaining = inlined.match(/<script src=/);
if (remaining) throw new Error('an external script survived the inlining step');

const fragIdx = process.argv.indexOf('--fragment');
if (fragIdx >= 0) {
  const out = process.argv[fragIdx + 1];
  if (!out) throw new Error('--fragment needs an output path');
  // keep <title> and <style>, drop the document wrapper
  const head = inlined.slice(inlined.indexOf('<title>'), inlined.indexOf('</head>'));
  const body = inlined.slice(inlined.indexOf('<body>') + 6, inlined.lastIndexOf('</body>'));
  fs.writeFileSync(out, head.trim() + '\n' + body.trim() + '\n');
  console.log('fragmento escrito em', out);
} else {
  const out = path.join(dir, `pickleball-v${VERSION}.html`);
  fs.writeFileSync(out, inlined);
  console.log('arquivo único escrito em', out, (inlined.length / 1024).toFixed(0) + ' KB');
}
