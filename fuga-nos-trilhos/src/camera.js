// Câmera em terceira pessoa: segue atrás do personagem, FOV abre com a
// velocidade, inclina na troca de pista, shake, câmera dramática na batida.
import * as THREE from 'three';
import { damp, lerp, clamp } from './utils.js';
import { SPEED_START, SPEED_MAX } from './config.js';

const _p = new THREE.Vector3();
const _look = new THREE.Vector3();

export class FollowCamera {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(62, aspect, 0.2, 1600);
    this.pos = new THREE.Vector3(0, 3.4, -6.5);
    this.look = new THREE.Vector3(0, 1.2, 10);
    this.shake = 0; this.shakeT = 0;
    this.roll = 0;
    this.fov = 62;
    this.deathT = -1;
    this.orbit = 0;
    this.yOffset = 0;
    this.menu = false;
  }
  setAspect(a) { this.cam.aspect = a; this.cam.updateProjectionMatrix(); }
  addShake(s) { this.shake = Math.min(1.5, this.shake + s); }

  update(dt, player, speed, tilt, time, mode) {
    const cam = this.cam;
    player.getRenderPos(_p);
    const sp = clamp((speed - SPEED_START) / (SPEED_MAX - SPEED_START), 0, 1);
    if (mode === 'dead') {
      // câmera lenta dramática: orbita ao redor do jogador e desce
      this.deathT += dt;
      this.orbit += dt * 0.7;
      const r = 5.5 + this.deathT * 0.4;
      const a = Math.PI + this.orbit * 0.5 + 0.6;
      const tx = _p.x + Math.sin(a) * r, tz = _p.z + Math.cos(a) * r * 0.9, ty = _p.y + 1.6 + this.deathT * 0.3;
      this.pos.x = damp(this.pos.x, tx, 3, dt); this.pos.y = damp(this.pos.y, ty, 3, dt); this.pos.z = damp(this.pos.z, tz, 3, dt);
      _look.set(_p.x, _p.y + 0.8, _p.z);
      this.look.lerp(_look, 1 - Math.exp(-5 * dt));
      this.fov = damp(this.fov, 48, 2, dt);
    } else if (mode === 'menu') {
      // câmera do menu: vista lateral/frontal elevada girando devagar
      const a = time * 0.12;
      const portrait = cam.aspect < 1;
      const tx = _p.x + Math.sin(a) * 6.0, tz = _p.z + 3 + Math.cos(a) * 4.5, ty = 2.0 + Math.sin(time * 0.3) * 0.3;
      this.pos.set(tx, ty, tz);
      // em telas largas o painel do menu fica à esquerda: personagem no terço direito
      this.look.set(_p.x - (portrait ? 0 : 2.2), portrait ? 2.2 : 1.1, _p.z + 2);
      this.fov = portrait ? 62 : 50;
    } else {
      const back = lerp(6.4, 7.8, sp), up = lerp(3.5, 3.9, sp);
      const flyUp = player.jetpack > 0 ? 1.0 : 0;
      const tx = _p.x * 0.75, ty = (player.jetpack > 0 ? _p.y * 0.45 : _p.y * 0.85) + up + flyUp * 0.4, tz = _p.z - back;
      this.pos.x = damp(this.pos.x, tx, 8, dt);
      this.pos.y = damp(this.pos.y, ty, 6, dt);
      this.pos.z = tz; // sem atraso no eixo de corrida (sensação de velocidade estável)
      _look.set(_p.x * 0.85, (player.jetpack > 0 ? _p.y * 0.6 : _p.y * 0.8) + 1.3 + flyUp * 0.3, _p.z + lerp(9, 13, sp));
      this.look.x = damp(this.look.x, _look.x, 10, dt); this.look.y = damp(this.look.y, _look.y, 8, dt); this.look.z = _look.z;
      this.fov = damp(this.fov, lerp(62, 80, sp) + (player.jetpack > 0 ? 4 : 0) + (cam.aspect < 1 ? 10 : 0), 3, dt);
    }
    // shake
    this.shakeT += dt * 40;
    const sh = this.shake;
    if (sh > 0) this.shake = Math.max(0, sh - dt * 2.2);
    const sx = Math.sin(this.shakeT * 1.3) * sh * 0.12, sy = Math.cos(this.shakeT * 1.7) * sh * 0.1;
    // vibração sutil de alta velocidade
    const vib = sp * 0.012;
    cam.position.set(this.pos.x + sx + Math.sin(time * 37) * vib, this.pos.y + sy + Math.cos(time * 41) * vib, this.pos.z);
    cam.lookAt(this.look);
    this.roll = damp(this.roll, mode === 'run' ? -tilt * 0.06 : 0, 8, dt);
    cam.rotateZ(this.roll + sx * 0.3);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
  shift(dz) { this.pos.z -= dz; this.look.z -= dz; this.cam.position.z -= dz; }
  startDeath() { this.deathT = 0; this.orbit = 0; }
}
