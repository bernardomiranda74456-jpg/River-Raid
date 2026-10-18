// Helpers de geometria: merge sem dependência externa, caixas posicionadas, etc.
import * as THREE from 'three';

/** Mescla geometrias (convertidas para não indexadas) em uma só. */
export function mergeGeoms(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let off = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
    off += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

/** BoxGeometry transladada (centro em x,y,z). */
export function box(w, h, d, x = 0, y = 0, z = 0, uvScale = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uvScale) {
    // UVs em metros (para texturas tileáveis)
    const uv = g.attributes.uv;
    const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * sizes[f][0] * uvScale, uv.getY(k) * sizes[f][1] * uvScale);
    }
  }
  g.translate(x, y, z);
  return g;
}

export function cyl(rt, rb, h, seg, x = 0, y = 0, z = 0, rotZ = 0, rotX = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rotZ) g.rotateZ(rotZ);
  if (rotX) g.rotateX(rotX);
  g.translate(x, y, z);
  return g;
}

/** Plano vertical (parede) no plano XY com UV em metros. */
export function wallPlane(w, h, uvScale = 0.25) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * uvScale, uv.getY(i) * h * uvScale);
  return g;
}

/** Plano horizontal (chão) com UV em metros, normal +Y. */
export function floorPlane(w, d, uvScale = 0.25) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * uvScale, uv.getY(i) * d * uvScale);
  return g;
}

/** Cunha (rampa) subindo de y=0 em z=0 até y=h em z=len, largura w. */
export function wedge(w, h, len) {
  const hw = w / 2;
  const v = [
    // base
    -hw, 0, 0, hw, 0, 0, hw, 0, len, -hw, 0, len,
    // topo inclinado
    -hw, 0, 0, hw, 0, 0, hw, h, len, -hw, h, len,
    // traseira
    -hw, 0, len, hw, 0, len, hw, h, len, -hw, h, len,
    // lados
    -hw, 0, 0, -hw, 0, len, -hw, h, len,
    hw, 0, 0, hw, 0, len, hw, h, len,
  ];
  const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 15, 17, 16];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const uv = [];
  for (let i = 0; i < v.length / 3; i++) uv.push(v[i * 3] * 0.3, v[i * 3 + 2] * 0.3);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Perfil de trilho (I) extrudado ao longo de Z. */
export function railGeometry(len) {
  const s = new THREE.Shape();
  const hw = 0.038, head = 0.04, web = 0.014, base = 0.07, h = 0.165;
  s.moveTo(-base, 0); s.lineTo(base, 0); s.lineTo(base, 0.02); s.lineTo(web, 0.035);
  s.lineTo(web, h - head); s.lineTo(hw, h - head); s.lineTo(hw, h); s.lineTo(-hw, h);
  s.lineTo(-hw, h - head); s.lineTo(-web, h - head); s.lineTo(-web, 0.035); s.lineTo(-base, 0.02); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, steps: 1 });
  // UVs: v ao longo do comprimento
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 4 + pos.getY(i) * 4, pos.getZ(i) * 0.5);
  return g;
}

const _mm = new THREE.Matrix4();
/**
 * Mescla, dentro de um Group, todas as malhas estáticas que compartilham o mesmo
 * material em uma única malha (reduz draw calls). Malhas com múltiplos
 * materiais, InstancedMesh ou marcadas com userData.keep são preservadas.
 */
export function mergeByMaterial(root) {
  const buckets = new Map();
  const remove = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o === root) return;
    if (Array.isArray(o.material) || o.userData.keep) return;
    // matriz relativa à raiz
    _mm.copy(o.matrixWorld);
    if (root.matrixWorld.determinant() !== 0) _mm.premultiply(new THREE.Matrix4().copy(root.matrixWorld).invert());
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(_mm);
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, geos: [], cast: false, recv: false });
    const b = buckets.get(key);
    b.geos.push(g); b.cast = b.cast || o.castShadow; b.recv = b.recv || o.receiveShadow;
    remove.push(o);
  });
  if (remove.length <= 1) return root;
  for (const o of remove) o.parent.remove(o);
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(b.geos.length === 1 ? b.geos[0] : mergeGeoms(b.geos), b.material);
    m.castShadow = b.cast; m.receiveShadow = b.recv;
    root.add(m);
  }
  return root;
}
