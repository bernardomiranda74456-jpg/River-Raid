import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.setContent(`<canvas id=c></canvas><script>
const gl=document.getElementById('c').getContext('webgl2');
document.title = gl ? ('ok '+gl.getParameter(gl.VERSION)+' | '+gl.getParameter(gl.RENDERER)+' | maxTex '+gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 'no webgl2';
const ac = typeof AudioContext; document.title += ' | audio '+ac+' | worklet '+(typeof AudioWorkletNode);
</script>`);
console.log(await p.title());
await b.close();
