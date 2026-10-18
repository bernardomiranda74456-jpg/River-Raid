// Céu procedural (shader), sol/sombras, PMREM, ciclo de hora do dia, clima e
// luzes noturnas (pool de point lights para postes, spot para faróis).
import * as THREE from 'three';
import { clamp, lerp, smoothstep, damp } from './utils.js';
import { globalUniforms } from './materials.js';

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w; // sempre no far plane
  }
`;
const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform float uNight;
  uniform float uTime;
  uniform float uCloud;      // cobertura 0..1
  uniform float uSunDisc;    // 0/1 (desenha o disco)
  uniform float uGlow;       // brilho da cidade no horizonte
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float t = pow(clamp(h, 0.0, 1.0), 0.42);
    vec3 sky = mix(uHorizon, uZenith, t);
    // abaixo do horizonte: solo/neblina
    sky = mix(sky, uGround, smoothstep(0.0, -0.12, h));
    float sd = dot(d, uSunDir);
    // halo do sol
    float glow = pow(max(sd, 0.0), 6.0) * 0.22 + pow(max(sd, 0.0), 48.0) * 0.6;
    sky += uSunColor * glow * (1.0 - uNight * 0.9);
    // disco
    float disc = smoothstep(0.9993, 0.9997, sd) * uSunDisc;
    sky += uSunColor * disc * 14.0;
    // nuvens (projeção no plano do céu)
    if (h > 0.02) {
      vec2 uv = d.xz / (h + 0.15) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
      float c = fbm(uv * 1.5);
      float cov = smoothstep(0.62 - uCloud * 0.35, 0.78 - uCloud * 0.2, c);
      float lit = fbm(uv * 1.5 + uSunDir.xz * 0.15);
      vec3 cloudCol = mix(uHorizon * 0.65, vec3(1.0, 0.98, 0.95) * (0.55 + 0.6 * max(uSunDir.y, 0.0)), clamp(lit - c + 0.5, 0.0, 1.0));
      cloudCol = mix(cloudCol, uSunColor * 0.9, pow(max(sd, 0.0), 10.0) * 0.5);
      cloudCol = mix(cloudCol, vec3(0.03, 0.035, 0.05), uNight * 0.9);
      sky = mix(sky, cloudCol, cov * smoothstep(0.02, 0.2, h) * 0.95);
    }
    // estrelas
    if (uNight > 0.01 && h > 0.0) {
      vec3 sp = d * 180.0;
      float st = hash(floor(sp.xz + sp.y * 3.1));
      float star = smoothstep(0.985, 1.0, st) * (0.6 + 0.4 * sin(uTime * 3.0 + st * 100.0));
      sky += vec3(star) * uNight * smoothstep(0.05, 0.3, h) * 1.4;
    }
    // brilho urbano no horizonte (noite)
    sky += vec3(0.5, 0.28, 0.12) * uGlow * exp(-abs(h) * 14.0) * 0.5;
    gl_FragColor = vec4(sky, 1.0);
  }
`;

const _c = new THREE.Color();
const _v = new THREE.Vector3();

export class Environment {
  constructor(renderer, scene, preset, materials) {
    this.renderer = renderer;
    this.scene = scene;
    this.preset = preset;
    this.M = materials;
    this.tod = 8.5;            // hora do dia (0..24)
    this.todSpeed = 24 / 420;  // 1 ciclo a cada ~7 min de corrida
    this.rain = 0; this.rainTarget = 0;
    this.fogExtra = 0;
    this.tunnel = 0;           // 0..1 dentro do túnel
    this.envTimer = 99;
    this.sunElev = 0;
    this.night = 0;

    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uZenith: { value: new THREE.Color(0.2, 0.45, 0.9) },
      uHorizon: { value: new THREE.Color(0.8, 0.85, 0.9) },
      uGround: { value: new THREE.Color(0.25, 0.25, 0.27) },
      uNight: { value: 0 },
      uTime: { value: 0 },
      uCloud: { value: 0.3 },
      uSunDisc: { value: 1 },
      uGlow: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
    this.sky.scale.setScalar(1500);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // cena auxiliar para o PMREM (mesmo shader, com um "chão" escuro)
    this.envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(this.sky.geometry, skyMat);
    envSky.scale.setScalar(900);
    this.envScene.add(envSky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 24), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -3;
    this.envScene.add(ground);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envRT = null;

    // sol
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sm = this.sun.shadow;
    sm.mapSize.set(preset.shadowMap, preset.shadowMap);
    sm.camera.near = 1; sm.camera.far = 220;
    const ext = 38;
    sm.camera.left = -ext; sm.camera.right = ext; sm.camera.top = ext; sm.camera.bottom = -ext;
    sm.bias = -0.0004; sm.normalBias = 0.035;
    sm.radius = 2;
    scene.add(this.sun); scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x8fb4ff, 0x30281e, 0.5);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(0x9fb4c8, 120, 520);

    // luzes noturnas (pool)
    this.lampLights = [];
    for (let i = 0; i < preset.lights; i++) {
      const l = new THREE.PointLight(0xffd9a0, 0, 42, 2);
      l.visible = false;
      scene.add(l); this.lampLights.push(l);
    }
    this.headlight = new THREE.SpotLight(0xfff4d6, 0, 80, 0.5, 0.6, 1.2);
    this.headlight.visible = false;
    scene.add(this.headlight); scene.add(this.headlight.target);
    this.headlight2 = new THREE.SpotLight(0xfff4d6, 0, 80, 0.5, 0.6, 1.2);
    this.headlight2.visible = false;
    scene.add(this.headlight2); scene.add(this.headlight2.target);
    this.flashlight = new THREE.SpotLight(0xfff0c0, 0, 30, 0.35, 0.5, 1.5);
    this.flashlight.visible = false;
    scene.add(this.flashlight); scene.add(this.flashlight.target);
    this.tunnelLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xdfe8ff, 0, 30, 2);
      l.visible = false; scene.add(l); this.tunnelLights.push(l);
    }
    this.shadowTexel = (ext * 2) / preset.shadowMap;
    this.setTime(this.tod, true);
  }

  /** Posição/cores do sol em função da hora. */
  computeSun(tod) {
    const dayT = (tod - 6) / 12;           // 0 ao nascer, 1 ao pôr
    const elevAng = Math.sin(dayT * Math.PI) * (62 * Math.PI / 180);
    const e = Math.sin(elevAng);
    // azimute: manhã atrás-direita, pôr do sol à frente-direita (flare)
    const az = lerp(200, 15, clamp(dayT, -0.1, 1.1)) * Math.PI / 180;
    const cosE = Math.cos(elevAng);
    _v.set(Math.sin(az) * cosE, Math.max(e, -0.35), Math.cos(az) * cosE).normalize();
    return { dir: _v, elev: e };
  }

  setTime(tod, force = false) {
    this.tod = ((tod % 24) + 24) % 24;
    if (force) this.envTimer = 99;
  }

  /** Atualiza iluminação/céu. `playerPos`: Vector3; `tunnelAmt`: 0..1. */
  update(dt, playerPos, tunnelAmt, rainTarget) {
    const U = this.uniforms;
    this.tod = (this.tod + dt * this.todSpeed) % 24;
    this.rainTarget = rainTarget;
    this.rain = damp(this.rain, rainTarget, 0.35, dt);
    this.tunnel = damp(this.tunnel, tunnelAmt, 6, dt);
    const s = this.computeSun(this.tod);
    const e = s.elev;
    this.sunElev = e;
    const day = smoothstep(-0.08, 0.22, e);
    const dusk = smoothstep(0.35, 0.0, e) * smoothstep(-0.15, 0.02, e); // laranja perto do horizonte
    const night = 1 - smoothstep(-0.14, 0.03, e);
    this.night = night;
    const rain = this.rain;
    U.uTime.value += dt;
    U.uSunDir.value.copy(s.dir);
    U.uNight.value = night;
    U.uCloud.value = lerp(0.3, 1.0, rain);
    U.uSunDisc.value = rain > 0.7 ? 0 : 1;
    U.uGlow.value = night * 0.9 + rain * 0.2;
    // cores
    U.uSunColor.value.setRGB(1, lerp(0.98, 0.5, dusk), lerp(0.92, 0.22, dusk)).multiplyScalar(lerp(1, 0.55, rain));
    U.uZenith.value.setRGB(lerp(0.012, 0.14, day), lerp(0.015, 0.34, day), lerp(0.04, 0.82, day));
    U.uZenith.value.lerp(_c.setRGB(0.22, 0.28, 0.5), dusk * 0.6);
    U.uZenith.value.lerp(_c.setRGB(0.35, 0.38, 0.42), rain * day * 0.8);
    U.uHorizon.value.setRGB(lerp(0.07, 0.6, day), lerp(0.06, 0.72, day), lerp(0.11, 0.9, day));
    U.uHorizon.value.lerp(_c.setRGB(1.0, 0.55, 0.28), dusk * 0.85);
    U.uHorizon.value.lerp(_c.setRGB(0.55, 0.58, 0.62), rain * day * 0.8);
    U.uGround.value.setRGB(lerp(0.02, 0.3, day), lerp(0.02, 0.3, day), lerp(0.03, 0.32, day));

    // luzes
    const sunI = 4.6 * day * lerp(1, 0.25, rain) * (1 - this.tunnel * 0.98);
    this.sun.intensity = sunI;
    this.sun.color.copy(U.uSunColor.value);
    this.sun.castShadow = sunI > 0.05;
    this.hemi.color.copy(U.uZenith.value).lerp(U.uHorizon.value, 0.5);
    this.hemi.groundColor.setRGB(0.18, 0.15, 0.12).multiplyScalar(day * 0.8 + 0.2);
    this.hemi.intensity = (lerp(0.28, 0.34, day) * lerp(1, 0.7, rain) + dusk * 0.25) * (1 - this.tunnel * 0.7) + night * 0.2;
    this.scene.environmentIntensity = lerp(0.6 + dusk * 0.3, 0.1, this.tunnel) * lerp(1, 0.8, rain);

    // neblina
    const fogC = _c.copy(U.uHorizon.value).lerp(U.uZenith.value, 0.25);
    fogC.lerp(_c.clone().setRGB(0.03, 0.03, 0.05), this.tunnel * 0.9);
    this.scene.fog.color.copy(fogC);
    const fogNear = lerp(lerp(140, 60, rain), 10, this.tunnel);
    const fogFar = lerp(lerp(560, 260, rain), 110, this.tunnel) * lerp(1, 0.75, night * (1 - this.tunnel));
    this.scene.fog.near = fogNear; this.scene.fog.far = fogFar;
    this.scene.background = null;

    // uniforms globais
    globalUniforms.uWet.value = rain;
    globalUniforms.uNight.value = Math.max(night, this.tunnel * 0.8);
    globalUniforms.uTime.value = U.uTime.value;

    // sol segue o jogador (sombras), com snap no grid de texels
    const sd = s.dir;
    const tx = Math.round((playerPos.x) / this.shadowTexel) * this.shadowTexel;
    const tz = Math.round((playerPos.z + 18) / this.shadowTexel) * this.shadowTexel;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx + sd.x * 120, sd.y * 120, tz + sd.z * 120);
    this.sun.target.updateMatrixWorld();

    // céu acompanha a câmera (posição definida em main)
    // PMREM periódico
    this.envTimer += dt;
    if (this.envTimer > this.preset.envUpdate) { this.envTimer = 0; this.updateEnv(); }

    // intensidades emissivas noturnas
    const M = this.M;
    const nightLights = Math.max(night, this.tunnel * 0.6, rain * 0.5);
    M.facades.forEach((f) => { f.emissiveIntensity = nightLights * 0.9; });
    M.trainSets.forEach((t) => { t.side.emissiveIntensity = nightLights * 0.7; t.front.emissiveIntensity = 0.3 + nightLights * 3; });
    M.lampGlow.emissiveIntensity = nightLights * 5;
    M.lampPool.opacity = nightLights * (0.28 + rain * 0.3);
    M.ads.forEach((a) => { a.emissiveIntensity = nightLights * 0.9; });
    M.stationSigns.forEach((a) => { a.emissiveMap = a.map; a.emissiveIntensity = nightLights * 0.8; });
    M.neons.forEach((n) => { n.opacity = 0.25 + nightLights * 0.75; });
    M.tunnelLight.emissiveIntensity = 0.4 + this.tunnel * 1.4;
    this.nightLights = nightLights;
  }

  updateEnv() {
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0.04, 1, 2000);
    this.scene.environment = this.envRT.texture;
    if (old) old.dispose();
  }

  /** Pool de luzes de poste: recebe lista de posições (Vector3) candidatas. */
  updateLamps(positions, count, playerZ) {
    const n = Math.min(count, this.lampLights.length);
    const inten = this.nightLights * 90;
    for (let i = 0; i < this.lampLights.length; i++) {
      const l = this.lampLights[i];
      if (i < n && inten > 0.2) {
        l.position.copy(positions[i]);
        l.intensity = inten * smoothstep(-10, 10, l.position.z - playerZ + 20);
        l.visible = true;
      } else l.visible = false;
    }
  }

  setHeadlight(idx, active, pos, dir) {
    const l = idx === 0 ? this.headlight : this.headlight2;
    if (!active || this.nightLights < 0.05) { l.visible = false; l.intensity = 0; return; }
    l.visible = true;
    l.intensity = 260 * this.nightLights;
    l.position.copy(pos);
    l.target.position.copy(pos).addScaledVector(dir, 30);
    l.target.updateMatrixWorld();
  }

  setFlashlight(active, pos, target) {
    const l = this.flashlight;
    if (!active) { l.visible = false; return; }
    l.visible = true;
    l.intensity = 40 + this.nightLights * 120;
    l.position.copy(pos); l.target.position.copy(target); l.target.updateMatrixWorld();
  }

  setTunnelLights(positions, n) {
    for (let i = 0; i < this.tunnelLights.length; i++) {
      const l = this.tunnelLights[i];
      if (i < n) { l.visible = true; l.position.copy(positions[i]); l.intensity = 140 * this.tunnel; } else l.visible = false;
    }
  }

  dispose() { if (this.envRT) this.envRT.dispose(); this.pmrem.dispose(); }
}
