/** Simple stylized water: animated normals, fresnel sky reflection tint, depth-less. */
import * as THREE from 'three';
const VS = `uniform float uTime; varying vec3 vWorld; varying vec2 vUv;
void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * 0.08 + uTime) * 0.25 + cos(p.y * 0.1 - uTime * 0.8) * 0.2; vec4 wp = modelMatrix * vec4(p, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FS = `uniform float uTime; uniform vec3 uCam; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun; uniform vec3 uFogColor; uniform float uFogDensity; varying vec3 vWorld; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vWorld.xz * 0.25; float t = uTime * 0.35;
  float a = n(p + vec2(t, 0.3*t)) + 0.5 * n(p * 2.3 - vec2(0.7*t, t)) + 0.25 * n(p * 5.1 + vec2(t*1.3, -t));
  float e = 0.02; float ax = n(p + vec2(e,0) + vec2(t, 0.3*t)) + 0.5 * n((p + vec2(e,0)) * 2.3 - vec2(0.7*t, t)); float az = n(p + vec2(0,e) + vec2(t, 0.3*t)) + 0.5 * n((p + vec2(0,e)) * 2.3 - vec2(0.7*t, t));
  vec3 N = normalize(vec3((a - ax) * 6.0, 1.0, (a - az) * 6.0));
  vec3 V = normalize(uCam - vWorld); float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = mix(uDeep, uShallow, 0.3 + 0.4 * n(p * 0.5 + t * 0.2));
  col = mix(col, uSky, 0.25 + 0.6 * fres);
  vec3 Hh = normalize(V + uSun); float spec = pow(max(dot(N, Hh), 0.0), 180.0) * 2.5; col += vec3(spec);
  float dist = length(vWorld - uCam); float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist); col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;
export class Water {
  constructor(scene, { size = 1200, y = 0, deep = 0x0b3a52, shallow = 0x1e7f8f, sky = 0xbfe3ff, sunDir = new THREE.Vector3(0, 1, 0), fogColor = 0xcfe6ff, fogDensity = 0.003 } = {}) {
    this.scene = scene; this.y = y;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) }, uSky: { value: new THREE.Color(sky) }, uSun: { value: sunDir.clone().normalize() }, uFogColor: { value: new THREE.Color(fogColor) }, uFogDensity: { value: fogDensity } }, vertexShader: VS, fragmentShader: FS });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 64, 64), this.mat); this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.y = y; this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  update(dt, time, camPos) { this.mat.uniforms.uTime.value = time; this.mat.uniforms.uCam.value.copy(camPos); this.mesh.position.x = camPos.x; this.mesh.position.z = camPos.z; }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
