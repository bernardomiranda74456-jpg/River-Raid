/**
 * Animated lava: procedural fbm crust with glowing cracks, flow, surface
 * waves and a rising emissive "heat" halo. Emissive > 1 drives bloom.
 */
import * as THREE from 'three';

const VS = `
uniform float uTime; varying vec2 vUv; varying vec3 vWorld; varying float vWave;
void main(){
  vUv = uv; vec3 p = position;
  float w = sin(p.x * 0.35 + uTime * 0.9) * 0.18 + sin(p.y * 0.27 - uTime * 0.7) * 0.15 + sin((p.x + p.y) * 0.12 + uTime * 0.5) * 0.22;
  p.z += w; vWave = w;
  vec4 wp = modelMatrix * vec4(p, 1.0); vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FS = `
uniform float uTime; uniform vec3 uCam; uniform float uIntensity; uniform vec3 uFogColor; uniform float uFogDensity;
varying vec2 vUv; varying vec3 vWorld; varying float vWave;
vec3 hash3(vec2 p){ vec3 q = vec3(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9))); return fract(sin(q) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash3(i).x, b = hash3(i + vec2(1,0)).x, c = hash3(i + vec2(0,1)).x, d = hash3(i + vec2(1,1)).x;
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8); for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.05 + 7.3; a *= 0.5; } return v; }
void main(){
  vec2 p = vWorld.xz * 0.11;
  float t = uTime * 0.06;
  // domain-warped flow
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.7));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.3), fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(p + 3.0 * r);
  // crust vs cracks
  float crust = smoothstep(0.31, 0.44, f);
  float cracks = 1.0 - smoothstep(0.0, 0.035, abs(f - 0.47));
  vec3 hot = vec3(1.0, 0.22, 0.02) * 2.4;
  vec3 veryHot = vec3(1.0, 0.62, 0.15) * 5.0;
  vec3 crustCol = vec3(0.05, 0.025, 0.02) + vec3(0.3, 0.09, 0.02) * (1.0 - crust) * 0.5;
  vec3 col = mix(hot, crustCol, crust);
  col += veryHot * cracks * (0.6 + 0.4 * sin(uTime * 2.0 + f * 20.0)) * 0.5;
  col += vec3(1.0, 0.3, 0.05) * smoothstep(0.2, -0.3, vWave) * 0.25; // troughs glow
  col *= uIntensity;
  // distance fog
  float dist = length(vWorld - uCam); float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(fogF, 0.0, 0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

export class Lava {
  constructor(scene, { size = 700, segments = 110, y = -8, intensity = 1 } = {}) {
    this.scene = scene; this.y = y;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uIntensity: { value: intensity }, uFogColor: { value: new THREE.Color(0x2a1208) }, uFogDensity: { value: 0.004 } }, vertexShader: VS, fragmentShader: FS, fog: false });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.y = y; this.mesh.frustumCulled = false; this.mesh.receiveShadow = false;
    scene.add(this.mesh);
    // glowing point light riding with the player for lava bounce light
    this.light = new THREE.PointLight(0xff5a1a, 0, 40, 1.6); this.light.castShadow = false; scene.add(this.light);
  }
  setFog(color, density) { this.mat.uniforms.uFogColor.value.set(color); this.mat.uniforms.uFogDensity.value = density; }
  update(dt, time, camPos, playerPos) {
    this.mat.uniforms.uTime.value = time; this.mat.uniforms.uCam.value.copy(camPos);
    this.mesh.position.y = this.y; this.mesh.position.x = camPos.x; this.mesh.position.z = camPos.z;
    if (playerPos) { this.light.position.set(playerPos.x, this.y + 3, playerPos.z); const d = Math.max(0, playerPos.y - this.y); this.light.intensity = 400 * Math.exp(-d / 9); }
  }
  dispose() { this.scene.remove(this.mesh); this.scene.remove(this.light); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
