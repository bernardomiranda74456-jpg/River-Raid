'use strict';
// CPU brain: court positioning that follows real doubles strategy (get to the
// kitchen line, third-shot drop, dink battles) plus a skill-driven error model.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.AI = (function () {
  const C = PB.Court;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Where should this player meet the ball?
  function contactPoint(m, p) {
    if (!m.pred || !m.pred.trace.length) return null;
    const sign = C.teamSign(p.team);
    const mustBounce = m.rally.shotCount <= 1;
    const tr = m.pred.trace;
    const land = m.pred.landing;

    if (!mustBounce && p.atNet) {
      for (const s of tr) {
        if (s.bounced) break;
        if (C.sideOf(s.z) !== p.team) continue;
        if (Math.abs(s.z) < C.KITCHEN + 0.5) continue;   // would be a kitchen volley
        if (s.y < 0.9 || s.y > 6.5) continue;
        if (Math.abs(s.z) > 15) continue;
        return { x: s.x, z: s.z, t: s.t, volley: true };
      }
    }
    if (!land || C.sideOf(land.z) !== p.team) return null;
    for (const s of tr) {
      if (s.t <= land.t + 0.1) continue;
      if (s.y <= 3.1 && s.y >= 1.0) return { x: s.x, z: s.z, t: s.t, volley: false };
      if (s.bounced && s.t > land.t + 0.05) break;
    }
    return { x: land.x, z: land.z + sign * 1.8, t: land.t + 0.3, volley: false };
  }

  function isResponsible(m, p, cp) {
    const mates = m.mates(p.team);
    if (mates.length === 1) return true;
    const other = mates.find(q => q.id !== p.id);
    const cost = q => {
      let c = Math.hypot(cp.x - q.x, cp.z - q.z);
      if (Math.sign(cp.x) === m.sideXSign(q)) c -= 1.6;   // your half of the court
      if (q.ctrl === 'human') c += 1.2;                   // let the human take theirs
      return c;
    };
    return cost(p) <= cost(other);
  }

  function homeSpot(m, p) {
    const sign = C.teamSign(p.team);
    const b = m.ball;
    const doubles = m.isDoubles();
    const half = doubles ? m.sideXSign(p) * 4.4 : 0;
    const shade = clamp((b.live ? b.x : 0) * 0.42, -6.5, 6.5);
    let x = doubles ? half * 0.72 + shade * 0.55 : shade * 0.9;
    let z = p.atNet ? sign * (C.KITCHEN + 0.85) : sign * 19.0;
    return { x: clamp(x, -9.5, 9.5), z };
  }

  function update(m, p, dt) {
    const a = p.ai;
    if (a.lastShot !== m.rally.shotCount) {
      a.lastShot = m.rally.shotCount;
      a.timer = rnd(0.10, 0.42) * (1.25 - p.skill);
      a.target = null;
    }
    a.timer -= dt;

    // Judgement call: a ball heading out should be let go instead of volleyed.
    if (a.letGoShot !== m.rally.shotCount && m.pred && m.pred.landing) {
      a.letGoShot = m.rally.shotCount;
      const L = m.pred.landing;
      const margin = Math.max(Math.abs(L.x) - C.HALF_W, Math.abs(L.z) - C.HALF_L);
      const readable = clamp((margin - 0.15) / 1.6, 0, 1);
      a.letGo = margin > 0.15 && Math.random() < readable * (0.25 + 0.65 * p.skill);
    }

    if (m.state !== 'live') {
      p.tx = p.x; p.tz = p.z;                 // hold still between points
      return;
    }
    if (m.state === 'ready') {
      if (p.id === m.serverIdx) { p.tx = p.x; p.tz = p.z; return; }
      if (p.id === m.receiverIdx) { p.tx = p.x; p.tz = p.z; return; }
      p.tx = p.x; p.tz = p.z;
      return;
    }

    const sign = C.teamSign(p.team);
    let spot = null;
    if (m.ball.live && a.timer <= 0) {
      const cp = contactPoint(m, p);
      if (cp && isResponsible(m, p, cp)) {
        let z = cp.z;
        if (!cp.volley) z += sign * 0.6;                    // stand behind the bounce
        // never park inside the kitchen unless the ball actually died there
        if (Math.abs(z) < C.KITCHEN + 0.2 && !cp.volley && Math.abs(cp.z) > C.KITCHEN - 1.5) {
          z = sign * (C.KITCHEN + 0.25);
        }
        spot = { x: clamp(cp.x, -11.5, 11.5), z: clamp(Math.abs(z), 1.4, 24.5) * sign };
        a.target = spot;
      }
    }
    if (!spot) spot = a.target && a.timer > 0 ? a.target : homeSpot(m, p);
    // after a volley the momentum rule still applies: stay out of the kitchen
    if (p.volleyMomentum > 0 && Math.abs(spot.z) < C.KITCHEN + 0.6) {
      spot = { x: spot.x, z: sign * (C.KITCHEN + 0.7) };
    }
    p.tx = spot.x; p.tz = spot.z;
  }

  // Pick the widest gap in the opponents' coverage.
  function bestGap(m, p, deep) {
    const opp = m.mates(1 - p.team);
    const cand = [-8.2, -5.5, -2.5, 0, 2.5, 5.5, 8.2];
    let best = 0, bestScore = -1e9;
    for (const x of cand) {
      let s = 1e9;
      for (const o of opp) s = Math.min(s, Math.abs(o.x - x) + (deep ? Math.abs(o.z) * 0.12 : 0));
      s += (Math.random() - 0.5) * (1 - p.skill) * 7;
      if (s > bestScore) { bestScore = s; best = x; }
    }
    return best;
  }

  function swing(m, p) {
    const r = m.rally;
    const b = m.ball;
    const oSign = C.teamSign(1 - p.team);
    const opp = m.mates(1 - p.team);
    const oppNet = opp.some(o => Math.abs(o.z) < 11.5);
    const myZ = Math.abs(p.z);
    const volley = r.bounces === 0;

    let style, tx, tz, riskyShot = false;
    if (r.shotCount === 1) {
      style = 'ret';
      tx = bestGap(m, p, true) * 0.85;
      tz = oSign * rnd(16.5, 20.2);
    } else if (r.shotCount === 2) {
      const dropIt = oppNet && Math.random() < 0.28 + p.skill * 0.5;
      if (dropIt) { style = 'drop'; tx = clamp(-Math.sign(b.x || 1) * rnd(2, 5.5), -8, 8); tz = oSign * rnd(3.4, 6.2); }
      else { style = 'drive'; tx = bestGap(m, p, true); tz = oSign * rnd(15.5, 20); }
    } else if (volley && b.y > 3.1 && myZ < 13) {
      style = 'smash';
      tx = bestGap(m, p, false);
      tz = oSign * rnd(8, 16);
    } else if (myZ < 10.8 && b.y < 3.0) {
      // dink battles escalate: the longer the soft exchange, the more likely
      // somebody speeds the ball up, exactly like a real kitchen fight
      const attackable = b.y > 2.25 || Math.abs(b.z) > C.KITCHEN + 1.2;
      const heat = Math.min(0.6, Math.max(0, r.softCount - 3) * 0.13 + (b.y - 2.0) * 0.28);
      const risky = Math.max(0, r.softCount - 4) * 0.09;
      if (attackable && Math.random() < heat * (0.55 + p.skill * 0.6)) {
        style = 'punch';
        tx = bestGap(m, p, false);
        tz = oSign * rnd(8.5, 15);
      } else if (Math.random() < risky) {
        // speeding up a low ball: the classic way a dink battle finally breaks
        style = 'punch';
        tx = bestGap(m, p, false);
        tz = oSign * rnd(9, 15);
        riskyShot = true;
      } else if (oppNet && Math.random() < 0.05 + (1 - p.skill) * 0.05) {
        style = 'lob'; tx = bestGap(m, p, true); tz = oSign * rnd(18.5, 20.8);
      } else {
        style = 'dink';
        tx = clamp(-Math.sign(p.x || 1) * rnd(2.5, 6.0), -8.5, 8.5);
        // a loose dink drifts past the kitchen line and invites an attack
        const loose = (1 - p.skill) * 0.30 + r.softCount * 0.025;
        tz = Math.random() < loose ? oSign * rnd(7.3, 9.6) : oSign * rnd(2.8, 6.4);
      }
    } else if (myZ < 10.8) {
      style = 'punch';
      tx = bestGap(m, p, false);
      tz = oSign * rnd(9, 16);
    } else if (oppNet && Math.random() < 0.22 + p.skill * 0.35) {
      style = 'drop';
      tx = clamp(-Math.sign(b.x || 1) * rnd(1.5, 5.5), -8, 8);
      tz = oSign * rnd(3.4, 6.4);
    } else {
      style = 'drive';
      tx = bestGap(m, p, true);
      tz = oSign * rnd(14.5, 20);
    }

    // unforced errors — the single biggest lever on how long rallies run
    let errP = 0.045 + (1 - p.skill) * 0.27;
    if (style === 'dink' || style === 'drop') errP *= 0.8 + m.rally.softCount * 0.05;
    if (style === 'smash' || style === 'drive') errP *= 1.15;
    let netError = false;
    const soft = style === 'dink' || style === 'drop';
    if (Math.random() < errP) {
      const kind = Math.random();
      if (soft) {
        // soft shots die in the net or sit up to be attacked; they rarely fly long
        if (kind < 0.45) netError = true;
        else tz = oSign * rnd(7.6, 10.2);
      } else if (kind < 0.18) {
        netError = true;
      } else if (kind < 0.64) {
        tz = oSign * (C.HALF_L + rnd(0.6, 3.0));                               // long
      } else {
        tx = Math.sign(tx || 1) * (C.HALF_W + rnd(0.5, 2.2));                  // wide
      }
    }

    return {
      style, target: { x: tx, z: tz }, netError,
      quality: (0.6 + 0.4 * p.skill) * (riskyShot ? 0.72 : 1),
    };
  }

  function serve(m, server) {
    const skill = server.skill;
    const rTeam = 1 - server.team;
    const rSign = C.teamSign(rTeam);
    const xs = -m.serveXSign;
    let x = xs * rnd(1.6, 8.4);
    let z = rSign * rnd(15.5, 20.6);
    x += (Math.random() * 2 - 1) * (1 - skill) * 2.6;
    z += (Math.random() * 2 - 1) * (1 - skill) * 2.6 * rSign;
    if (Math.random() < (1 - skill) * 0.07) z = rSign * rnd(22.6, 24);        // long serve fault
    m.doServe({ x, z }, 0.8 + 0.2 * skill);
  }

  // The assist swing used when a human never flicks: competent, never reckless.
  function neutralSwing(m, p) {
    const b = m.ball;
    const oSign = C.teamSign(1 - p.team);
    const myZ = Math.abs(p.z);
    let style, tx, tz;
    if (m.rally.shotCount === 1) { style = 'ret'; tx = bestGap(m, p, true) * 0.8; tz = oSign * rnd(16, 19.5); }
    else if (myZ < 10.8 && b.y < 3.0) { style = 'dink'; tx = clamp(-Math.sign(p.x || 1) * rnd(2.5, 5.5), -8, 8); tz = oSign * rnd(3.0, 6.0); }
    else if (myZ < 10.8) { style = 'punch'; tx = bestGap(m, p, false); tz = oSign * rnd(9, 15); }
    else { style = 'drive'; tx = bestGap(m, p, true) * 0.85; tz = oSign * rnd(14, 18.5); }
    // the assist is competent but not perfect, otherwise rallies never end
    let netError = false;
    if (Math.random() < 0.07) {
      if (style === 'dink' || style === 'drop') netError = Math.random() < 0.6;
      else if (Math.random() < 0.5) tz = oSign * (C.HALF_L + rnd(0.5, 2.2));
      else netError = true;
    }
    return { auto: true, style, target: { x: tx, z: tz }, netError, quality: 0.62 };
  }

  // Should this player deliberately leave the ball alone?
  function letsItGo(m, p) {
    return !!(p.ai.letGo && m.rally.bounces === 0);
  }

  return { update, swing, serve, neutralSwing, bestGap, contactPoint, letsItGo };
})();
