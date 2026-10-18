/** Procedural rock geometry: a sphere/cone displaced by layered noise, flat-shaded. */
import * as THREE from 'three';
import { mulberry32 } from './Textures.js';

function hash3(x, y, z, seed) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 13.1) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c00 = l(hash3(ix, iy, iz, seed), hash3(ix + 1, iy, iz, seed), sx), c10 = l(hash3(ix, iy + 1, iz, seed), hash3(ix + 1, iy + 1, iz, seed), sx);
  const c01 = l(hash3(ix, iy, iz + 1, seed), hash3(ix + 1, iy, iz + 1, seed), sx), c11 = l(hash3(ix, iy + 1, iz + 1, seed), hash3(ix + 1, iy + 1, iz + 1, seed), sx);
  return l(l(c00, c10, sy), l(c01, c11, sy), sz);
}
export function fbm3(x, y, z, seed, oct = 4) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, z * f, seed + i * 7); a *= 0.5; f *= 2.1; } return v; }

/** Rock: displaced icosphere, stretched by scale; flat-shaded with world-ish UVs for triplanar-like tiling. */
export function rockGeometry(radius = 5, detail = 3, seed = 1, { rough = 0.35, stretch = [1, 1, 1], spikiness = 0 } = {}) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const d = fbm3(n.x * 1.6 + seed, n.y * 1.6, n.z * 1.6, seed, 4) - 0.5;
    const d2 = fbm3(n.x * 5 + seed, n.y * 5, n.z * 5, seed + 3, 3) - 0.5;
    let r = radius * (1 + d * rough * 2 + d2 * rough * 0.5);
    if (spikiness > 0) r *= 1 + Math.max(0, n.y) * spikiness * (0.5 + d2);
    v.copy(n).multiplyScalar(r); v.x *= stretch[0]; v.y *= stretch[1]; v.z *= stretch[2];
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
  // planar UVs from position (scaled) so textures tile across the rock
  const pos = ng.attributes.position; const uv = new Float32Array(pos.count * 2); const nor = ng.attributes.normal;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i)); let u, w; if (ay >= ax && ay >= az) { u = x; w = z; } else if (ax >= az) { u = z; w = y; } else { u = x; w = y; } uv[i * 2] = u * 0.12; uv[i * 2 + 1] = w * 0.12; }
  ng.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (ng !== g) g.dispose(); return ng;
}

/** Mountain: cone-ish rock with ridges. */
export function mountainGeometry(radius, height, seed) { return rockGeometry(radius, 3, seed, { rough: 0.3, stretch: [1, height / radius, 1], spikiness: 0.9 }); }
