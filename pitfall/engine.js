// Pitfall! (Activision, 1982) — game logic, no DOM dependencies.
// The jungle is not stored: like the original 4 KB cartridge, every screen is
// decoded from one byte of an 8-bit LFSR (seed $C4, period 255).
(function (root) {
  'use strict';

  // ─── Geometry (logical 160×192 Atari-style screen) ─────────────────────────
  const W = 160, H = 192;
  const LEFT_EDGE = 8, RIGHT_EDGE = 152;
  const GROUND_Y = 112;          // Harry's feet when above ground
  const TUNNEL_TOP = 146;
  const UNDER_Y = 172;           // Harry's feet in the tunnel
  const HARRY_H = 21;

  const WALK = 1;
  const JUMP_LEN = 32, JUMP_H = 16;
  const DEATH_FRAMES = 120, SINK_FRAMES = 64;

  const START_SEED = 0xC4;
  const START_SCORE = 2000;
  const START_LIVES = 3;
  const TIME_FRAMES = 20 * 60 * 60;   // 20:00 at 60 fps
  const HOLE_PENALTY = 100;
  const TREASURE_VALUES = [2000, 3000, 4000, 5000]; // bag, silver, gold, ring
  const TREASURE_NAMES = ['money', 'silver', 'gold', 'ring'];
  const TOTAL_TREASURES = 32;

  const LADDER_X = 80, LADDER_HALF = 4;
  const SIDE_HOLES = [[44, 56], [104, 116]];
  const PIT_X0 = 40, PIT_X1 = 120, PIT_CX = 80, PIT_HALF = 40;
  const SHIFT_PERIOD = 256;
  const CROC_XS = [52, 80, 108], CROC_HALF = 6, CROC_PERIOD = 64;
  const VINE_PX = 80, VINE_PY = 26, VINE_LEN = 60, VINE_AMP = 0.8, VINE_PERIOD = 176;
  const HANG_OFF = 20;
  const OBJ_X = 124;
  const WALL_W = 8;

  const SCENES = [
    'one hole', 'three holes', 'tar pit + vine', 'swamp + vine',
    'crocodiles', 'shifting tar pit + treasure', 'shifting tar pit + vine',
    'shifting quicksand',
  ];
  const OBJECTS = [
    'rolling log', 'two rolling logs (close)', 'two rolling logs (far)',
    'three rolling logs', 'log', 'three logs', 'fire', 'cobra',
  ];

  // ─── Random-number generator (8-bit LFSR, taps 7/5/4/3) ────────────────────
  function lfsrNext(r) {
    const b = ((r >> 3) ^ (r >> 4) ^ (r >> 5) ^ (r >> 7)) & 1;
    return ((r << 1) | b) & 0xFF;
  }
  function lfsrPrev(r) {
    const b7 = (r ^ (r >> 4) ^ (r >> 5) ^ (r >> 6)) & 1;
    return (r >> 1) | (b7 << 7);
  }
  function advance(seed, n) {
    for (let i = 0; i < Math.abs(n); i++) seed = n > 0 ? lfsrNext(seed) : lfsrPrev(seed);
    return seed;
  }

  // ─── Screen decoding ──────────────────────────────────────────────────────
  // bits 7-6 tree pattern, bit 7 wall side, bits 5-3 scene, bits 2-0 object
  function decodeRoom(seed) {
    const scene = (seed >> 3) & 7;
    const objType = seed & 7;
    const room = {
      seed, scene, objType,
      trees: (seed >> 6) & 3,
      ladder: scene <= 1,
      sideHoles: scene === 1,
      pit: null, shifting: false, vine: false, crocs: false,
      treasure: null, objects: [], scorpion: false, wallX: null,
    };
    switch (scene) {
      case 2: room.pit = 'tar'; room.vine = true; break;
      case 3: room.pit = 'swamp'; room.vine = true; break;
      case 4: room.pit = 'swamp'; room.crocs = true; room.vine = !!(seed & 2); break;
      case 5: room.pit = 'tar'; room.shifting = true; room.treasure = seed & 3; break;
      case 6: room.pit = 'tar'; room.shifting = true; room.vine = true; break;
      case 7: room.pit = 'swamp'; room.shifting = true; break;
    }
    if (scene !== 4 && scene !== 5) room.objects = objectLayout(objType);
    if (room.ladder) room.wallX = (seed & 0x80) ? RIGHT_EDGE - 12 : LEFT_EDGE + 4;
    else room.scorpion = true;
    return room;
  }

  function objectLayout(t) {
    const log = (x, rolling) => ({ kind: 'log', x, rolling });
    switch (t) {
      case 0: return [log(OBJ_X, true)];
      case 1: return [log(OBJ_X, true), log(OBJ_X + 16, true)];
      case 2: return [log(OBJ_X - 32, true), log(OBJ_X, true)];
      case 3: return [log(OBJ_X - 64, true), log(OBJ_X - 32, true), log(OBJ_X, true)];
      case 4: return [log(OBJ_X, false)];
      case 5: return [log(OBJ_X - 64, false), log(OBJ_X - 32, false), log(OBJ_X, false)];
      case 6: return [{ kind: 'fire', x: OBJ_X }];
      case 7: return [{ kind: 'cobra', x: OBJ_X }];
    }
    return [];
  }

  function allRooms() {
    const out = [];
    let s = START_SEED;
    for (let i = 0; i < 255; i++) { out.push(decodeRoom(s)); s = lfsrNext(s); }
    return out;
  }

  // ─── Game state ───────────────────────────────────────────────────────────
  function newGame() {
    const g = {
      frame: 0, score: START_SCORE, lives: START_LIVES, timer: TIME_FRAMES,
      over: false, won: false, collected: {}, treasuresTaken: 0,
      events: [], room: null, objs: [], scorpionX: 0,
      prevJump: false, logContact: false, harry: null,
    };
    enterRoom(g, START_SEED);
    placeHarry(g, 16, GROUND_Y, 'ground');
    return g;
  }

  function placeHarry(g, x, y, mode) {
    g.harry = {
      x, y, mode, level: y > (GROUND_Y + TUNNEL_TOP) / 2 ? 'under' : 'top',
      dir: 1, vx: 0, vy: 0, baseY: y, jumpT: 0, deadT: 0, grabCD: 0,
      walkT: 0, moving: false, hit: false, cause: null,
    };
  }

  function enterRoom(g, seed) {
    g.room = decodeRoom(seed);
    g.objs = g.room.objects.map(o => Object.assign({}, o));
    if (g.room.treasure !== null && !g.collected[seed]) {
      g.objs.push({ kind: 'treasure', x: OBJ_X, type: g.room.treasure });
    }
    g.scorpionX = OBJ_X + 12;
  }

  // ─── Terrain queries ──────────────────────────────────────────────────────
  function pitSpan(g) {
    const r = g.room;
    if (!r.pit) return null;
    if (!r.shifting) return [PIT_X0, PIT_X1];
    const t = (g.frame % SHIFT_PERIOD) / SHIFT_PERIOD;
    const hw = Math.round(PIT_HALF * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)));
    return [PIT_CX - hw, PIT_CX + hw];
  }

  function crocsOpen(g) { return ((g.frame / CROC_PERIOD) | 0) % 2 === 1; }

  function surfaceAt(g, x) {
    const r = g.room;
    if (r.ladder) {
      if (Math.abs(x - LADDER_X) < LADDER_HALF) return 'hole';
      if (r.sideHoles) for (const [a, b] of SIDE_HOLES) if (x >= a && x < b) return 'hole';
    }
    const span = pitSpan(g);
    if (span && x >= span[0] && x < span[1]) {
      if (r.crocs) {
        for (const cx of CROC_XS) {
          if (Math.abs(x - cx) <= CROC_HALF) return crocsOpen(g) ? 'jaws' : 'croc';
        }
      }
      return 'pit';
    }
    return 'ground';
  }

  function vineEnd(g, frame) {
    const f = frame === undefined ? g.frame : frame;
    const a = VINE_AMP * Math.sin(2 * Math.PI * f / VINE_PERIOD);
    return { x: VINE_PX + VINE_LEN * Math.sin(a), y: VINE_PY + VINE_LEN * Math.cos(a) };
  }

  function wallBlocks(g, x) {
    const wx = g.room.wallX;
    return g.harry.level === 'under' && wx !== null && x + 3 > wx && x - 3 < wx + WALL_W;
  }

  // ─── Harry helpers ────────────────────────────────────────────────────────
  function addScore(g, n) { g.score = Math.max(0, g.score + n); }

  function changeRoom(g, dir) {
    const h = g.harry;
    const steps = h.level === 'under' ? 3 : 1;
    enterRoom(g, advance(g.room.seed, dir * steps));
    h.x = dir > 0 ? LEFT_EDGE + 1 : RIGHT_EDGE - 1;
    g.events.push('room');
  }

  function moveX(g, dx) {
    const h = g.harry;
    const nx = h.x + dx;
    if (wallBlocks(g, nx)) return false;
    h.x = nx;
    if (h.x > RIGHT_EDGE) changeRoom(g, 1);
    else if (h.x < LEFT_EDGE) changeRoom(g, -1);
    return true;
  }

  function kill(g, cause) {
    const h = g.harry;
    h.mode = cause === 'sink' ? 'sink' : 'dead';
    h.cause = cause;
    h.deadT = 0;
    g.events.push('death');
  }

  function checkFooting(g) {
    const h = g.harry;
    if (h.level !== 'top' || h.mode !== 'ground') return;
    const s = surfaceAt(g, h.x);
    if (s === 'hole') {
      h.mode = 'fall';
      addScore(g, -HOLE_PENALTY);
      g.events.push('hole');
    } else if (s === 'pit') {
      kill(g, 'sink');
    } else if (s === 'jaws') {
      kill(g, 'croc');
    }
  }

  function respawn(g) {
    placeHarry(g, 16, 40, 'drop');
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────
  function step(g, input) {
    input = input || {};
    g.events = [];
    if (g.over) return g;
    g.frame++;
    if (g.timer > 0 && --g.timer === 0) {
      g.over = true;
      g.events.push('gameover');
      return g;
    }
    updateObjects(g);
    updateHarry(g, input);
    if (!g.over) collide(g);
    g.prevJump = !!input.jump;
    return g;
  }

  function updateObjects(g) {
    for (const o of g.objs) {
      if (o.kind === 'log' && o.rolling) {
        o.x -= 1;
        if (o.x < LEFT_EDGE - 4) o.x = RIGHT_EDGE + 4;
      }
    }
    if (g.room.scorpion && g.frame % 2 === 0) {
      const tx = g.harry.x;
      if (g.scorpionX < tx) g.scorpionX++;
      else if (g.scorpionX > tx) g.scorpionX--;
      g.scorpionX = Math.max(LEFT_EDGE + 8, Math.min(RIGHT_EDGE - 8, g.scorpionX));
    }
  }

  function updateHarry(g, input) {
    const h = g.harry;
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const jumpPressed = !!input.jump && !g.prevJump;
    if (h.grabCD > 0) h.grabCD--;
    h.moving = false;

    switch (h.mode) {
      case 'ground': {
        if (dx) h.dir = dx;
        if (g.room.ladder && h.level === 'top' && input.down && Math.abs(h.x - LADDER_X) <= 8) {
          h.mode = 'ladder'; h.x = LADDER_X; h.y = GROUND_Y;
          break;
        }
        if (g.room.ladder && h.level === 'under' && input.up && Math.abs(h.x - LADDER_X) <= LADDER_HALF) {
          h.mode = 'ladder'; h.x = LADDER_X;
          break;
        }
        if (jumpPressed) {
          h.mode = 'jump'; h.jumpT = 0; h.vx = dx * WALK; h.baseY = h.y;
          g.events.push('jump');
          break;
        }
        if (dx) { h.moving = moveX(g, dx * WALK); if (h.moving) h.walkT++; }
        checkFooting(g);
        break;
      }
      case 'jump': {
        h.jumpT++;
        if (h.vx) moveX(g, h.vx);
        const t = h.jumpT / JUMP_LEN;
        h.y = h.baseY - Math.round(JUMP_H * 4 * t * (1 - t));
        if (tryGrabVine(g)) break;
        if (h.jumpT >= JUMP_LEN) {
          h.y = h.baseY; h.mode = 'ground';
          checkFooting(g);
        }
        break;
      }
      case 'drop': {
        h.vy = Math.min(3, h.vy + 0.25);
        h.y += h.vy;
        if (h.vx) moveX(g, h.vx);
        if (h.y >= GROUND_Y) {
          h.y = GROUND_Y; h.mode = 'ground'; h.vx = 0; h.vy = 0;
          checkFooting(g);
        }
        break;
      }
      case 'vine': {
        const e = vineEnd(g);
        h.x = e.x; h.y = e.y + HANG_OFF;
        if (input.down) {
          // Harry lets go and drops straight down
          h.mode = 'drop'; h.vy = 0; h.vx = 0; h.grabCD = 30;
          h.x = Math.round(h.x);
        }
        break;
      }
      case 'fall': {
        h.y += 2;
        if (h.y > TUNNEL_TOP) h.level = 'under';
        if (h.y >= UNDER_Y) { h.y = UNDER_Y; h.mode = 'ground'; }
        break;
      }
      case 'ladder': {
        if (input.up) h.y--;
        else if (input.down) h.y++;
        h.y = Math.max(GROUND_Y, Math.min(UNDER_Y, h.y));
        if (input.up || input.down) h.walkT++;
        h.level = h.y < (GROUND_Y + UNDER_Y) / 2 ? 'top' : 'under';
        if (h.y === GROUND_Y && dx) {
          h.x = LADDER_X + dx * 10; h.dir = dx; h.mode = 'ground'; h.level = 'top';
          checkFooting(g);
        } else if (h.y === UNDER_Y && dx) {
          h.mode = 'ground'; h.level = 'under'; h.dir = dx;
          moveX(g, dx * WALK);
        }
        break;
      }
      case 'sink': {
        h.deadT++;
        if (h.deadT <= SINK_FRAMES) h.y += 0.35;
        if (h.deadT >= DEATH_FRAMES) loseLife(g);
        break;
      }
      case 'dead': {
        h.deadT++;
        if (h.deadT >= DEATH_FRAMES) loseLife(g);
        break;
      }
    }
  }

  function tryGrabVine(g) {
    const h = g.harry;
    if (!g.room.vine || h.level !== 'top' || h.grabCD > 0) return false;
    const e = vineEnd(g);
    const top = h.y - HARRY_H;
    if (Math.abs(e.x - h.x) <= 5 && e.y >= top - 8 && e.y <= top + 10) {
      h.mode = 'vine'; h.x = e.x; h.y = e.y + HANG_OFF;
      g.events.push('vine');
      return true;
    }
    return false;
  }

  function loseLife(g) {
    g.lives--;
    if (g.lives <= 0) {
      g.over = true;
      g.events.push('gameover');
    } else {
      respawn(g);
    }
  }

  function collide(g) {
    const h = g.harry;
    const alive = h.mode === 'ground' || h.mode === 'jump' || h.mode === 'drop';
    h.hit = false;
    let touching = false;
    if (alive && h.level === 'top') {
      for (let i = 0; i < g.objs.length; i++) {
        const o = g.objs[i];
        const d = Math.abs(h.x - o.x);
        if (o.kind === 'log' && d < 6 && h.y > GROUND_Y - 8) {
          touching = true;
          addScore(g, -1);
        } else if ((o.kind === 'fire' || o.kind === 'cobra') && d < 5 && h.y > GROUND_Y - 10) {
          kill(g, o.kind);
          break;
        } else if (o.kind === 'treasure' && d < 7 && h.y > GROUND_Y - 14) {
          addScore(g, TREASURE_VALUES[o.type]);
          g.collected[g.room.seed] = true;
          g.treasuresTaken++;
          g.objs.splice(i, 1);
          g.events.push('treasure');
          if (g.treasuresTaken >= TOTAL_TREASURES) {
            g.over = true; g.won = true; g.events.push('win');
          }
          break;
        }
      }
    }
    if (alive && h.level === 'under' && g.room.scorpion &&
        Math.abs(h.x - g.scorpionX) < 6 && h.y > UNDER_Y - 10) {
      kill(g, 'scorpion');
    }
    h.hit = touching;
    if (touching && !g.logContact) g.events.push('log');
    g.logContact = touching;
  }

  function formatTime(frames) {
    const s = Math.ceil(frames / 60);
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  const api = {
    W, H, LEFT_EDGE, RIGHT_EDGE, GROUND_Y, TUNNEL_TOP, UNDER_Y, HARRY_H,
    WALK, JUMP_LEN, JUMP_H, DEATH_FRAMES, START_SEED, START_SCORE, START_LIVES,
    TIME_FRAMES, HOLE_PENALTY, TREASURE_VALUES, TREASURE_NAMES, TOTAL_TREASURES,
    LADDER_X, LADDER_HALF, SIDE_HOLES, PIT_X0, PIT_X1, CROC_XS, CROC_HALF, CROC_PERIOD,
    SHIFT_PERIOD, VINE_PX, VINE_PY, VINE_LEN, VINE_PERIOD, HANG_OFF, OBJ_X, WALL_W,
    SCENES, OBJECTS,
    lfsrNext, lfsrPrev, advance, decodeRoom, allRooms,
    newGame, enterRoom, placeHarry, step, pitSpan, crocsOpen, surfaceAt, vineEnd, formatTime,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pitfall = api;
})(this);
