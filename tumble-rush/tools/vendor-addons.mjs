// Copies the Three.js addons the game uses (and their transitive relative imports)
// from node_modules into vendor/three/addons so the project runs fully offline.
import fs from 'node:fs';
import path from 'node:path';
const SRC = process.argv[2]; // node_modules/three/examples/jsm
const DST = new URL('../vendor/three/addons/', import.meta.url).pathname;
const entries = [
  'postprocessing/EffectComposer.js','postprocessing/RenderPass.js','postprocessing/ShaderPass.js',
  'postprocessing/SMAAPass.js','postprocessing/UnrealBloomPass.js','postprocessing/GTAOPass.js',
  'postprocessing/OutputPass.js','postprocessing/BokehPass.js','postprocessing/SSAOPass.js',
  'objects/Sky.js','csm/CSM.js','loaders/RGBELoader.js','shaders/CopyShader.js','math/SimplexNoise.js',
];
const seen = new Set();
function copy(rel){
  if(seen.has(rel)) return; seen.add(rel);
  const from = path.join(SRC, rel), to = path.join(DST, rel);
  fs.mkdirSync(path.dirname(to), {recursive:true});
  const code = fs.readFileSync(from,'utf8');
  fs.writeFileSync(to, code);
  for (const m of code.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) copy(path.normalize(path.join(path.dirname(rel), m[1])));
}
entries.forEach(copy);
console.log('copied', seen.size, 'addon files');
