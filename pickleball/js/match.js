'use strict';
// Match engine: players, rally state machine and the official rule set
// (two-bounce rule, non-volley zone, diagonal underhand serve, side-out scoring,
// doubles serve rotation starting at 0-0-2).
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Match = (function () {
  const C = PB.Court, P = PB.Physics, S = PB.Shots;

  const SKILL = {
    facil:   { opp: 0.40, mate: 0.56, assist: true,  autoSwing: true  },
    normal:  { opp: 0.63, mate: 0.68, assist: true,  autoSwing: false },
    dificil: { opp: 0.86, mate: 0.80, assist: false, autoSwing: false },
  };

  const MOVE_SPEED = 13.2;   // ft/s, roughly a quick club player
  const REACH      = 3.05;   // paddle + arm
  const HIT_CD     = 0.22;

  let nextId = 0;

  function mkPlayer(team, ctrl, courtSide, skill, name) {
    return {
      id: nextId++, team, ctrl, courtSide, skill, name,
      x: 0, z: C.teamSign(team) * 18, vx: 0, vz: 0,
      tx: 0, tz: C.teamSign(team) * 18,           // AI desired spot
      reach: REACH, hitCd: 0, swingT: 0, swingType: null, swingDir: 1,
      atNet: false, volleyMomentum: 0, react: 0, lunge: 0,
      // visual state, read by the renderer
      runPhase: Math.random() * 6.28, speedN: 0, prep: 0, crouch: 0.2,
      lean: 0, yaw: 0, runAngle: 0, swingKind: 'ground', swingFore: true, swingDur: 0.42,
      swingHit: null, hop: 0,
      ai: { timer: 0, decided: null },
    };
  }

  class Match {
    constructor(cfg) {
      this.cfg = Object.assign({
        format: 'singles',      // 'singles' | 'doubles'
        humans: 1,              // 1 | 2
        arrangement: 'coop',    // doubles with 2 humans: 'coop' | 'versus'
        difficulty: 'normal',
        targetPoints: 11,
        winBy: 2,
      }, cfg || {});

      const d = SKILL[this.cfg.difficulty] || SKILL.normal;
      this.assistRules = d.assist;
      this.autoSwing = d.autoSwing;
      nextId = 0;

      const doubles = this.cfg.format === 'doubles';
      const versus = this.cfg.humans === 2 && (!doubles || this.cfg.arrangement === 'versus');
      this.versus = versus;
      this.players = [];
      this.slot = {};

      if (doubles) {
        const humanIds = versus ? [0, 2] : [0, 1];
        for (let t = 0; t < 2; t++) {
          for (let k = 0; k < 2; k++) {
            const id = t * 2 + k;
            const isHuman = this.cfg.humans === 2 ? humanIds.indexOf(id) >= 0 : id === 0;
            const skill = t === 0 ? d.mate : d.opp;
            this.players.push(mkPlayer(t, isHuman ? 'human' : 'cpu', k === 0 ? 'R' : 'L', skill, ''));
          }
        }
        if (this.cfg.humans === 2) { this.slot.p1 = humanIds[0]; this.slot.p2 = humanIds[1]; }
        else this.slot.p1 = 0;
      } else {
        this.players.push(mkPlayer(0, 'human', 'R', d.mate, ''));
        this.players.push(mkPlayer(1, this.cfg.humans === 2 ? 'human' : 'cpu', 'R', d.opp, ''));
        this.slot.p1 = 0;
        if (this.cfg.humans === 2) this.slot.p2 = 1;
      }
      this.nameEveryone();

      this.ball = P.newBall();
      this.score = [0, 0];
      this.servingTeam = 0;
      this.serverNumber = doubles ? 2 : 1;      // 0-0-2 start
      this.serverIdx = 0;
      this.state = 'ready';
      this.stateT = 0;
      this.banner = null;
      this.hint = null;
      this.hintT = 0;
      this.events = [];
      this.cheerT = 0;
      this.cheerDur = 2.6;
      this.cheerLevel = 0;
      this.rallyLog = [];
      this.winner = -1;
      this.pred = null;
      this.paused = false;
      this.pendingSwing = {};
      this.prepareServe();
    }

    nameEveryone() {
      const twoHumans = this.cfg.humans === 2;
      for (const p of this.players) {
        if (p.ctrl === 'human') {
          p.name = twoHumans ? (p.id === this.slot.p1 ? 'P1' : 'P2') : 'Você';
        } else {
          p.name = p.team === 0 ? 'Parceiro' : 'Rival';
        }
      }
      if (this.cfg.format === 'doubles' && this.cfg.humans === 2 && this.cfg.arrangement === 'versus') {
        this.players[1].name = 'Parceiro P1';
        this.players[3].name = 'Parceiro P2';
      }
    }

    // ── helpers ────────────────────────────────────────────────────────────
    teamOf(id) { return this.players[id].team; }
    mates(team) { return this.players.filter(p => p.team === team); }
    sideXSign(p) { return C.rightSignFor(p.team) * (p.courtSide === 'R' ? 1 : -1); }
    isDoubles() { return this.cfg.format === 'doubles'; }
    scoreText() {
      const s = this.servingTeam, r = 1 - s;
      return this.isDoubles()
        ? `${this.score[s]} - ${this.score[r]} - ${this.serverNumber}`
        : `${this.score[s]} - ${this.score[r]}`;
    }

    say(text, secs) { this.hint = text; this.hintT = secs || 1.6; }

    // ── serving ────────────────────────────────────────────────────────────
    prepareServe() {
      const st = this.servingTeam;
      const team = this.mates(st);

      if (!this.isDoubles()) {
        // singles: the server stands right when their score is even
        const want = this.score[st] % 2 === 0 ? 'R' : 'L';
        team[0].courtSide = want;
        this.serverIdx = team[0].id;
      } else if (this.serverIdx === undefined || this.players[this.serverIdx].team !== st) {
        this.serverIdx = team[0].id;
      }

      const server = this.players[this.serverIdx];
      const sSign = this.sideXSign(server);
      const rTeam = 1 - st;
      const rSign = C.teamSign(rTeam);
      const serveSign = C.teamSign(st);

      server.x = sSign * 4.6;
      server.z = serveSign * 23.2;

      // receiver is the opponent standing diagonally across
      let receiver;
      const opp = this.mates(rTeam);
      if (this.isDoubles()) {
        receiver = opp.find(p => this.sideXSign(p) === -sSign) || opp[0];
        const partner = opp.find(p => p !== receiver);
        partner.x = sSign * 4.6; partner.z = rSign * 8.2; partner.atNet = true;
        const sMate = team.find(p => p !== server);
        if (sMate) { sMate.x = -sSign * 4.6; sMate.z = serveSign * 17.5; sMate.atNet = false; }
      } else {
        receiver = opp[0];
        receiver.courtSide = this.score[st] % 2 === 0 ? 'R' : 'L';
      }
      receiver.x = -sSign * 4.6;
      receiver.z = rSign * 20.5;
      receiver.atNet = false;
      server.atNet = false;

      for (const p of this.players) {
        p.vx = 0; p.vz = 0; p.tx = p.x; p.tz = p.z; p.hitCd = 0;
        p.volleyMomentum = 0; p.swingT = 0; p.ai.timer = 0; p.lunge = 0;
      }

      this.serveXSign = sSign;
      this.receiverIdx = receiver.id;
      this.rally = {
        shotCount: 0, lastHitter: -1, bounces: 0, over: false, softCount: 0,
        serveXSign: sSign, servedBy: server.id, netTouch: false,
      };

      const b = this.ball;
      b.x = server.x + sSign * 0.9; b.y = 1.95; b.z = server.z + C.teamSign(st) * 0.35;
      b.vx = b.vy = b.vz = 0; b.spin = 0; b.live = false; b.resting = false;

      this.state = 'ready';
      this.stateT = 0;
      this.pred = null;
    }

    doServe(aim, power) {
      const server = this.players[this.serverIdx];
      const sSign = this.serveXSign;
      const behind = Math.abs(server.z) >= C.HALF_L + 0.05;
      const rightHalf = Math.sign(server.x) === sSign || Math.abs(server.x) < 0.2;
      if (!behind || !rightHalf) {
        if (this.assistRules) {
          // step them back to a legal spot instead of calling it
          if (!behind) server.z = C.teamSign(server.team) * (C.HALF_L + 0.9);
          if (!rightHalf) server.x = sSign * Math.max(0.9, Math.abs(server.x));
          server.vx = 0; server.vz = 0;
          this.ball.x = server.x + sSign * 0.9;
          this.ball.z = server.z + C.teamSign(server.team) * 0.35;
          this.say(behind ? 'Saque sai da sua metade da quadra' : 'Fique atrás da linha de fundo para sacar', 1.4);
        } else {
          this.state = 'live';
          this.rally.shotCount = 1;
          this.rally.lastHitter = server.id;
          this.endRally(server.team, 'pe_no_saque');
          return;
        }
      }
      const rTeam = 1 - server.team;
      const rSign = C.teamSign(rTeam);
      const from = { x: this.ball.x, y: 1.95, z: this.ball.z };
      const to = { x: aim.x, y: C.BALL_R, z: aim.z * rSign > 0 ? aim.z : rSign * Math.abs(aim.z) };
      const v = S.plan(from, to, 'serve', power === undefined ? 1 : power);
      const b = this.ball;
      b.x = from.x; b.y = from.y; b.z = from.z;
      b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.spin = v.spin;
      b.live = true; b.resting = false;
      this.rally.shotCount = 1;
      this.rally.lastHitter = server.id;
      this.rally.bounces = 0;
      server.swingT = 0.3; server.swingType = 'serve';
      this.state = 'live';
      this.stateT = 0;
      this.events.push({ type: 'hit', style: 'serve', x: b.x, z: b.z });
    }

    // Legal service target. `lateral` is world-space (-1 = toward -x) and maps
    // continuously across the width of the diagonal box.
    serveTarget(lateral, depth, clampInside) {
      const rSign = C.teamSign(1 - this.servingTeam);
      const xs = -this.serveXSign;                    // which half the box is on
      const t = (Math.max(-1, Math.min(1, lateral)) + 1) / 2;
      const near = xs * 0.8, far = xs * 9.2;          // centre line -> sideline
      let x = xs > 0 ? near + (far - near) * t : far + (near - far) * t;
      let z = rSign * (9.5 + depth * 12.2);
      if (clampInside) {
        x = xs * Math.max(0.8, Math.min(9.2, Math.abs(x)));
        z = rSign * Math.max(9.0, Math.min(21.2, Math.abs(z)));
      }
      return { x, z };
    }

    // ── the loop ───────────────────────────────────────────────────────────
    update(dt, inputs) {
      if (this.paused || this.state === 'gameover') return;
      dt = Math.min(dt, 1 / 20);
      this.stateT += dt;
      if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.hint = null; }
      if (this.cheerT > 0) this.cheerT -= dt;

      this.updatePrediction();
      this.updateAnticipation(dt);

      // humans
      for (const slot of ['p1', 'p2']) {
        const id = this.slot[slot];
        if (id === undefined) continue;
        const inp = (inputs && inputs[slot]) || null;
        this.driveHuman(this.players[id], inp, dt, slot, inputs);
      }
      // cpu
      for (const p of this.players) {
        if (p.ctrl === 'cpu') PB.AI.update(this, p, dt);
      }
      for (const p of this.players) this.movePlayer(p, dt);

      if (this.state === 'ready') {
        const server = this.players[this.serverIdx];
        // keep the ball in the server's hand
        this.ball.x = server.x + this.serveXSign * 0.9;
        this.ball.z = server.z + C.teamSign(server.team) * 0.35;
        this.ball.y = 1.95;
        if (server.ctrl === 'cpu' && this.stateT > 0.6) {
          PB.AI.serve(this, server);
        }
      } else if (this.state === 'live') {
        this.stepBall(dt);
      } else if (this.state === 'point') {
        if (this.ball.live) this.stepBall(dt, true);
        if (this.stateT > 1.25) this.afterPoint();
      }
      return this.events;
    }

    updatePrediction() {
      const b = this.ball;
      if (!b.live) { this.pred = null; return; }
      const tr = P.trace(b, 2.4, 1 / 120);
      let landing = null;
      for (const s of tr) { if (s.bounced) { landing = s; break; } }
      this.pred = { trace: tr, landing };
    }

    stepBall(dt, deadBall) {
      const sub = 5;
      const h = dt / sub;
      const ev = {};
      for (let i = 0; i < sub; i++) {
        ev.bounce = false; ev.net = false;
        P.step(this.ball, h, ev);
        if (ev.net) {
          this.rally.netTouch = true;
          this.events.push({ type: 'net', x: this.ball.x, z: this.ball.z });
        }
        if (ev.bounce) {
          this.events.push({ type: 'bounce', x: ev.bx, z: ev.bz, impact: ev.impact });
          if (!deadBall) this.onBounce(ev.bx, ev.bz);
        }
        if (this.rally.over || this.state !== 'live') break;
        if (!deadBall) this.checkHits();
        if (this.rally.over) break;
      }
      // ball wandered off entirely
      if (!deadBall && this.state === 'live') {
        const b = this.ball;
        if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.z)) {
          b.x = 0; b.y = 3; b.z = 0; b.vx = b.vy = b.vz = 0; b.resting = true;
        }
        if (b.resting || Math.abs(b.x) > 34 || Math.abs(b.z) > 46 || b.y > 60) {
          const hitter = this.rally.lastHitter;
          this.endRally(hitter >= 0 ? this.teamOf(hitter) : 1 - this.servingTeam, 'fora');
        }
      }
    }

    // ── rules on bounce ────────────────────────────────────────────────────
    onBounce(x, z) {
      const r = this.rally;
      if (r.over) return;
      const side = C.sideOf(z);
      const hitter = r.lastHitter;
      const hTeam = hitter >= 0 ? this.teamOf(hitter) : this.servingTeam;

      if (r.bounces === 0) {
        // first bounce after the last hit decides in/out
        if (side === hTeam) { this.endRally(hTeam, 'nao_passou'); return; }
        if (r.shotCount === 1) {
          if (!C.inServiceBox(x, z, 1 - hTeam, -r.serveXSign)) {
            const why = C.inKitchen(x, z) ? 'saque_cozinha' : 'saque_fora';
            this.endRally(hTeam, why); return;
          }
        } else if (!C.inBounds(x, z)) {
          this.endRally(hTeam, 'fora'); return;
        }
        r.bounces = 1;
        // a deep ball landing behind a net player pushes that team back
        if (Math.abs(z) > 15.5) for (const p of this.mates(side)) p.atNet = false;
        // a soft ball dying in the kitchen means the hitting team may advance
        if (Math.abs(z) < C.KITCHEN + 1.2 && r.shotCount >= 2) {
          for (const p of this.mates(hTeam)) p.atNet = true;
        }
      } else {
        // second bounce: the side that let it bounce twice loses the rally
        this.endRally(side, 'dois_quiques');
      }
    }

    // ── contact ────────────────────────────────────────────────────────────
    checkHits() {
      const b = this.ball;
      if (!b.live || this.rally.over) return;
      const side = C.sideOf(b.z);
      let best = null, bestD = 1e9;
      for (const p of this.players) {
        if (p.team !== side) continue;
        if (p.id === this.rally.lastHitter) continue;
        if (p.hitCd > 0) continue;
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        const reach = p.reach + p.lunge;
        if (d > reach) continue;
        if (b.y < 0.18 || b.y > 8.4) continue;
        if (d < bestD) { bestD = d; best = p; }
      }
      if (!best) return;
      this.attemptHit(best);
    }

    legality(p) {
      const r = this.rally;
      // only the diagonal receiver may return the serve
      if (r.shotCount === 1 && p.id !== this.receiverIdx) return 'recebedor';
      const volley = r.bounces === 0;
      // serve (shot 1) and return (shot 2) must both bounce, so anything up to
      // and including the third shot is played off the ground
      const mustBounce = r.shotCount <= 2;
      if (volley && mustBounce) return 'dois_quiques_regra';
      if (volley && C.playerInKitchen(p)) return 'cozinha';
      return null;
    }

    // How clean is this contact? Stretching, pace and awkward heights all cost
    // control — this is what actually ends rallies.
    contactQuality(p) {
      const b = this.ball;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      const reach = p.reach + p.lunge;
      let q = 1;
      q -= Math.max(0, Math.min(1, (d - 1.3) / Math.max(0.6, reach - 1.3))) * 0.52;
      q -= Math.max(0, Math.min(1, (P.speed(b) - 34) / 42)) * 0.22;
      if (b.y < 1.0) q -= 0.16;
      if (b.y > 5.6) q -= 0.10;
      const cross = Math.hypot(p.vx, p.vz) / MOVE_SPEED;
      q -= Math.max(0, cross - 0.75) * 0.35;
      return Math.max(0.18, Math.min(1, q));
    }

    attemptHit(p) {
      const bad = this.legality(p);
      let swing = null;
      if (p.ctrl === 'human') {
        swing = this.pendingSwing[p.id] || null;
        if (!swing && this.autoSwing) swing = PB.AI.neutralSwing(this, p);
        if (!swing) return;
        if (bad && swing.auto) return;                    // the assist swing never fouls
        if (bad && this.assistRules) {
          this.say(bad === 'cozinha' ? 'Saia da cozinha para dar voleio!'
            : bad === 'recebedor' ? 'O saque é do seu parceiro!'
            : 'Deixe quicar (regra dos dois quiques)!');
          return;
        }
      } else {
        if (bad) return;                                  // the CPU never breaks the rules
        if (PB.AI.letsItGo(this, p)) return;              // reading the ball as going out
        // decide once per shot: checkHits runs several times per frame, and
        // re-rolling here meant the miss almost never stuck
        if (p.ai.missShot !== this.rally.shotCount) {
          p.ai.missShot = this.rally.shotCount;
          const cq = this.contactQuality(p);
          p.ai.willMiss = cq < 0.42 && Math.random() < (0.42 - cq) * 2.1 * (1.3 - p.skill);
        }
        if (p.ai.willMiss) return;                        // can't get there cleanly
        swing = PB.AI.swing(this, p);
        if (!swing) return;
      }
      this.pendingSwing[p.id] = null;
      this.executeHit(p, swing);
      if (bad && !this.assistRules) {
        this.endRally(p.team,
          bad === 'cozinha' ? 'cozinha' : bad === 'recebedor' ? 'recebedor' : 'voleio_saque');
      }
    }

    executeHit(p, swing) {
      const b = this.ball;
      const r = this.rally;
      const oppTeam = 1 - p.team;
      const oSign = C.teamSign(oppTeam);
      const from = { x: b.x, y: Math.max(0.55, b.y), z: b.z };

      let style = swing.style;
      const volley = r.bounces === 0;
      if (!style) style = this.pickStyleFromSwipe(p, swing, volley, from);

      const q = (swing.quality === undefined ? 1 : swing.quality) * this.contactQuality(p);
      // off balance: the aggressive shot is simply not available
      if (q < 0.52 && (style === 'drive' || style === 'smash' || style === 'punch')) {
        style = Math.abs(p.z) > 12 ? 'lob' : 'drop';
        swing = Object.assign({}, swing, {
          target: { x: (Math.random() * 2 - 1) * 4.5, z: oSign * (style === 'lob' ? 18.5 : 4.8) },
        });
      }
      let tx = swing.target ? swing.target.x : 0;
      let tz = swing.target ? swing.target.z : oSign * 15;
      if (!swing.target) {
        const depth = this.depthForStyle(style, swing.depth);
        tz = oSign * depth;
        tx = Math.max(-9.4, Math.min(9.4, swing.lateral * 9.4));
      }
      // timing/skill scatter
      const jitter = (1 - q) * 5.0;
      tx += (Math.random() * 2 - 1) * jitter;
      tz += (Math.random() * 2 - 1) * jitter * oSign * 0.9;

      if (!isFinite(tx) || !isFinite(tz)) { tx = 0; tz = oSign * 15; }
      const v = S.plan(from, { x: tx, y: C.BALL_R, z: tz }, style, 0.55 + 0.45 * q);
      if (swing.netError) { v.vx *= 0.68; v.vy *= 0.68; v.vz *= 0.68; }
      if (!isFinite(v.vx) || !isFinite(v.vy) || !isFinite(v.vz)) { v.vx = 0; v.vy = 12; v.vz = oSign * 22; }
      b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.spin = v.spin;
      b.live = true; b.resting = false;
      b.z = from.z + Math.sign(v.vz) * 0.02;

      r.lastHitter = p.id;
      r.shotCount++;
      r.bounces = 0;
      r.netTouch = false;
      r.softCount = (style === 'dink' || style === 'drop') ? r.softCount + 1 : 0;
      p.hitCd = HIT_CD;
      p.swingType = style;
      p.swingKind = (style === 'serve' || style === 'smash') ? 'over'
        : (style === 'dink' || style === 'drop') ? 'soft' : 'ground';
      p.swingDur = p.swingKind === 'soft' ? 0.34 : p.swingKind === 'over' ? 0.5 : 0.44;
      p.swingT = p.swingDur;
      p.swingDir = Math.sign(b.x - p.x) || 1;
      // remember where the ball actually was, so the paddle meets it
      p.swingHit = { dx: b.x - p.x, dy: Math.max(0.6, from.y), dz: b.z - p.z };
      p.swingFore = (b.x - p.x) * (p.team === 0 ? 1 : -1) >= -0.35;
      p.prep = 0;
      if (volley) p.volleyMomentum = 0.45;
      if (r.shotCount === 2) p.atNet = true;              // returner charges the net

      this.events.push({ type: 'hit', style, x: b.x, z: b.z, power: Math.hypot(v.vx, v.vy, v.vz) });
    }

    depthForStyle(style, t) {
      t = t === undefined ? 0.5 : Math.max(0, Math.min(1, t));
      switch (style) {
        case 'dink': return 2.6 + t * 4.2;
        case 'drop': return 3.2 + t * 3.6;
        case 'lob':  return 15.0 + t * 6.0;
        case 'punch':return 8.0 + t * 9.0;
        case 'smash':return 7.0 + t * 10.0;
        default:     return 10.0 + t * 10.8;
      }
    }

    pickStyleFromSwipe(p, sw, volley, from) {
      const nearNet = Math.abs(p.z) < 10.5;
      if (sw.fast && from.y > 3.3 && Math.abs(from.z) < 13 && volley) return 'smash';
      if (sw.fast && sw.long) return 'drive';
      if (sw.fast && !sw.long) return 'punch';
      if (!sw.fast && sw.long) return 'lob';
      return nearNet ? 'dink' : 'drop';
    }

    // ── human control ──────────────────────────────────────────────────────
    driveHuman(p, inp, dt, slot, inputs) {
      if (!inp) { p.tx = p.x; p.tz = p.z; p.mx = 0; p.mz = 0; return; }
      const sign = p.team === 0 ? 1 : -1;                 // view space -> world
      p.mx = (inp.mx || 0) * sign;
      p.mz = (inp.mz || 0) * sign;

      if (inp.swipe) {
        const sw = inp.swipe;
        const lateral = Math.max(-1, Math.min(1, sw.lateral));
        if (this.state === 'ready' && p.id === this.serverIdx) {
          // lateral is in view space; the target lives in world space
          const aim = this.serveTarget(lateral * sign, Math.max(0, Math.min(1, sw.depth)), this.assistRules);
          this.doServe(aim, 0.75 + 0.25 * sw.power);
          inputs[slot].swipe = null;
          return;
        }
        this.pendingSwing[p.id] = {
          lateral: lateral * sign,
          depth: Math.max(0, Math.min(1, sw.depth)),
          fast: sw.fast, long: sw.long, power: sw.power,
          quality: 1, t: 0,
        };
        inputs[slot].swipe = null;
      }
      const ps = this.pendingSwing[p.id];
      if (ps) {
        ps.t += dt;
        ps.quality = Math.max(0.35, 1 - ps.t / 0.5);
        if (ps.t > 0.5) this.pendingSwing[p.id] = null;
      }
    }

    movePlayer(p, dt) {
      let dx, dz;
      if (p.ctrl === 'human') {
        dx = p.mx || 0; dz = p.mz || 0;
      } else {
        dx = p.tx - p.x; dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.25) { dx /= d; dz /= d; } else { dx = dz = 0; }
      }
      const mag = Math.hypot(dx, dz);
      if (mag > 1) { dx /= mag; dz /= mag; }
      const speed = MOVE_SPEED * (p.ctrl === 'cpu' ? 0.72 + 0.28 * p.skill : 1);
      const tvx = dx * speed, tvz = dz * speed;
      const k = Math.min(1, dt * 11);
      p.vx += (tvx - p.vx) * k;
      p.vz += (tvz - p.vz) * k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // stretch for a wide ball
      const b = this.ball;
      p.lunge = 0;
      if (b.live && C.sideOf(b.z) === p.team) {
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        if (d < p.reach + 1.4) p.lunge = Math.min(1.15, Math.max(0, d - p.reach + 1.0));
      }

      if (p.volleyMomentum > 0) {
        p.volleyMomentum -= dt;
        const inK = C.playerInKitchen(p);
        if (inK) {
          if (this.assistRules || p.ctrl === 'cpu') {
            p.z = C.teamSign(p.team) * (C.KITCHEN + C.footprint(p) + 0.05);  // held out
            p.vz = 0;
            if (p.ctrl === 'human') this.say('Impulso: não entre na cozinha após o voleio!', 1.2);
          } else if (this.state === 'live') {
            this.endRally(p.team, 'impulso');
          }
        }
      }
      C.clampToPlayArea(p, p.team);
      if (p.hitCd > 0) p.hitCd -= dt;
      if (p.swingT > 0) p.swingT -= dt;
      this.animate(p, dt);
    }

    // Visual state only: gait, stance and how loaded the swing looks.
    animate(p, dt) {
      const spd = Math.hypot(p.vx, p.vz);
      p.speedN = Math.min(1, spd / MOVE_SPEED);
      p.runPhase += dt * (5.2 + p.speedN * 12.5);
      if (p.runPhase > Math.PI * 2) p.runPhase -= Math.PI * 2;
      // lean into the run, and square up again when standing
      const target = -(p.vx / MOVE_SPEED) * 0.22 * (p.team === 0 ? 1 : -1);
      p.lean += (target - p.lean) * Math.min(1, dt * 6);
      // turn the body toward where it is running: a player who never turns
      // reads as a crab shuffling sideways
      const fwd = Math.abs(p.vz);
      // runAngle is where the body is actually travelling; yaw is how far it
      // manages to turn toward it. What is left over is the sideways shuffle.
      p.runAngle = spd > 1.4 ? Math.atan2(p.vx, fwd + 2.2) : 0;
      let yawWant = Math.max(-1.15, Math.min(1.15, p.runAngle)) * Math.min(1, spd / 4.5);
      if (p.prep > 0.25 || p.swingT > 0) yawWant *= 0.35;   // squaring up to hit
      p.yaw += (yawWant - p.yaw) * Math.min(1, dt * 7);
      // waiting between points: a small split-step bounce
      p.hop = this.state === 'ready' ? (Math.sin(this.stateT * 6.5) * 0.5 + 0.5) * 0.06 : 0;
      let wantCrouch = 0.30 + p.prep * 0.42 + (Math.abs(p.z) < 10 ? 0.10 : 0);
      // reaching for a low ball is done with the knees, not just the arm
      if (p.swingHit) {
        const low = Math.max(0, Math.min(1, (2.7 - p.swingHit.dy) / 2.0));
        const active = p.swingT > 0 ? 1 : Math.max(0, p.prep);
        wantCrouch = Math.max(wantCrouch, (0.22 + low * 0.72) * active);
      }
      p.crouch += (wantCrouch - p.crouch) * Math.min(1, dt * 8);
    }

    // How close is this player to having to hit? Drives the loaded stance.
    updateAnticipation(dt) {
      for (const p of this.players) {
        if (p.swingT > 0) { p.prep = 0; continue; }
        let t = -1;
        if (this.pred && this.ball.live) {
          for (const s of this.pred.trace) {
            if (C.sideOf(s.z) !== p.team) continue;
            if (s.y > 8) continue;
            if (Math.hypot(s.x - p.x, s.z - p.z) < 4.2) { t = s.t; break; }
          }
        }
        const want = t >= 0 ? Math.max(0, 1 - t / 0.62) : 0;
        const k = Math.min(1, dt * (want > p.prep ? 9 : 5));
        p.prep += (want - p.prep) * k;
      }
    }

    // ── scoring ────────────────────────────────────────────────────────────
    endRally(losingTeam, reason) {
      if (this.rally.over) return;
      this.rally.over = true;
      const winner = 1 - losingTeam;
      this.lastReason = reason;
      this.lastWinner = winner;
      this.state = 'point';
      this.stateT = 0;
      // the longer the rally, the louder the stands
      this.cheerLevel = Math.min(1, 0.45 + this.rally.shotCount * 0.045);
      this.cheerDur = 2.6;
      this.cheerT = this.cheerDur;
      this.events.push({ type: 'point', winner, reason, cheer: this.cheerLevel });

      if (winner === this.servingTeam) {
        this.score[winner]++;
        if (this.isDoubles()) {
          for (const p of this.mates(this.servingTeam)) p.courtSide = p.courtSide === 'R' ? 'L' : 'R';
        }
        this.sideOut = false;
      } else if (this.isDoubles() && this.serverNumber === 1) {
        const partner = this.mates(this.servingTeam).find(p => p.id !== this.serverIdx);
        this.serverIdx = partner.id;
        this.serverNumber = 2;
        this.sideOut = false;
      } else {
        this.servingTeam = winner;
        this.serverNumber = 1;
        if (this.isDoubles()) {
          const right = this.mates(winner).find(p => p.courtSide === 'R');
          this.serverIdx = right ? right.id : this.mates(winner)[0].id;
        } else {
          this.serverIdx = this.mates(winner)[0].id;
        }
        this.sideOut = true;
      }
      this.banner = PB.Match.reasonText(reason, this);

      const tp = this.cfg.targetPoints;
      if (this.score[winner] >= tp && this.score[winner] - this.score[1 - winner] >= this.cfg.winBy) {
        this.winner = winner;
        this.cheerLevel = 1;
        this.cheerDur = 4.5;
        this.cheerT = this.cheerDur;
      }
    }

    afterPoint() {
      if (this.winner >= 0) { this.state = 'gameover'; this.banner = null; return; }
      this.banner = null;
      this.prepareServe();
    }
  }

  Match.reasonText = function (reason, m) {
    const w = m.lastWinner === 0 ? 'Time 1' : 'Time 2';
    const map = {
      fora: 'Bola fora',
      nao_passou: 'Na rede',
      saque_fora: 'Saque fora',
      saque_cozinha: 'Saque na cozinha',
      dois_quiques: 'Dois quiques',
      cozinha: 'Voleio na cozinha',
      voleio_saque: 'Voleio antes do quique',
      recebedor: 'Recebedor errado',
      impulso: 'Impulso na cozinha',
      pe_no_saque: 'Pé na linha no saque',
    };
    const label = map[reason] || 'Ponto';
    return { label, team: m.lastWinner, sideOut: m.sideOut, w };
  };

  Match.SKILL = SKILL;
  Match.MOVE_SPEED = MOVE_SPEED;
  return Match;
})();
