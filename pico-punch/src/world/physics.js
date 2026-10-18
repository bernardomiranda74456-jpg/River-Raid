// Física de plataforma: AABB contra tiles, plataformas de mão única, escorregamento nas bordas.
import { TILE, T, isSolidType, isOneWayType } from './tilemap.js';

export const GRAVITY = 820, MAX_FALL = 270;

/**
 * Move um corpo (x,y,w,h,vx,vy) contra o tilemap. Preenche flags onGround/hitWall/hitHead.
 * `solidFn(t, tx, ty)` permite tratar tiles extras como sólidos (ex.: HIDDEN revelado).
 */
export function moveBody(body, map, dt, opts = {}) {
  const dx = body.vx * dt, dy = body.vy * dt;
  body.hitWall = 0; body.hitHead = false; const wasOnGround = body.onGround; body.onGround = false; body.groundTile = T.EMPTY;
  const ignoreOneWay = !!opts.ignoreOneWay;
  // --- Horizontal
  if (dx !== 0) {
    let nx = body.x + dx;
    const dir = dx > 0 ? 1 : -1;
    const edge = dir > 0 ? nx + body.w : nx;
    const tx = Math.floor(edge / TILE);
    const y0 = Math.floor((body.y + 0.5) / TILE), y1 = Math.floor((body.y + body.h - 0.5) / TILE);
    let blocked = false;
    for (let ty = y0; ty <= y1; ty++) if (isSolidType(map.get(tx, ty))) { blocked = true; break; }
    if (blocked) { nx = dir > 0 ? tx * TILE - body.w - 0.001 : (tx + 1) * TILE + 0.001; body.vx = 0; body.hitWall = dir; }
    body.x = nx;
  }
  // --- Vertical
  if (dy !== 0 || true) {
    let ny = body.y + dy;
    const dir = dy > 0 ? 1 : -1;
    const x0 = Math.floor((body.x + 0.5) / TILE), x1 = Math.floor((body.x + body.w - 0.5) / TILE);
    if (dy >= 0) {
      const feetOld = body.y + body.h, feetNew = ny + body.h;
      const ty = Math.floor(feetNew / TILE);
      let land = false, landT = T.EMPTY;
      for (let tx = x0; tx <= x1; tx++) {
        const t = map.get(tx, ty);
        if (isSolidType(t)) { land = true; landT = t; break; }
        if (!ignoreOneWay && isOneWayType(t) && feetOld <= ty * TILE + 0.01 && !body.dropThrough) { land = true; landT = t; break; }
      }
      if (land) { ny = ty * TILE - body.h; body.vy = 0; body.onGround = true; body.groundTile = landT; }
    } else {
      const ty = Math.floor(ny / TILE);
      let hit = false;
      for (let tx = x0; tx <= x1; tx++) { const t = map.get(tx, ty); if (isSolidType(t)) { hit = true; body.headTile = { tx, ty, t }; break; } }
      if (hit) { ny = (ty + 1) * TILE + 0.001; body.vy = 0; body.hitHead = true; }
    }
    body.y = ny;
  }
  body.wasOnGround = wasOnGround;
}

/** Verdadeiro se o retângulo toca algum tile que satisfaz pred. */
export function overlapsTile(map, x, y, w, h, pred) { return map.anyInRect(x, y, w, h, pred); }
