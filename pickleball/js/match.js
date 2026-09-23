'use strict';
// Match engine: players, rally state machine and the official rule set
// (two-bounce rule, non-volley zone, diagonal underhand serve, side-out scoring,
// doubles serve rotation starting at 0-0-2).
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Match = (function () {
  const T = (k, v) => (PB.I18n ? PB.I18n.t(k, v) : k);
  const C = PB.Court, P = PB.Physics, S = PB.Shots;

  // `accel` is how sharply a CPU gets going, in the same units as the human's
  // (see HUMAN_ACCEL): lower is heavier off the mark.
  const SKILL = {
    facil:   { opp: 0.40, mate: 0.56, accel: 6.5, react: 0.70, assist: true,  autoSwing: true  },
    normal:  { opp: 0.63, mate: 0.68, accel: 8.0, react: 0.50, assist: true,  autoSwing: false },
    dificil: { opp: 0.86, mate: 0.80, accel: 9.5, react: 0.40, assist: false, autoSwing: false },
  };

  const MOVE_SPEED = 13.2;    // ft/s: the baseline the CPU is built on
  const HUMAN_SPEED = 14.52;  // the player runs 10% above that, on purpose
  // aiming: a full sideways stroke turns the shot AIM_MAX from straight ahead,
  // AIM_CURVE keeps small tilts gentle, AIM_EDGE is the widest landing allowed
  const AIM_MAX = 30 * Math.PI / 180, AIM_CURVE = 1.6, AIM_EDGE = 9.0;
  // Where the server stands while waiting: one step behind the baseline, and
  // between the centre line and the sideline of the half they must serve from.
  const SERVE_Z = 23.2, SERVE_X_MIN = 0.65;
  // A ball can only be hit DOWNWARD once it is above the net, and the net is
  // 2.83 ft at the centre. Measured launch angles turn from up to down between
  // 2.8 and 3.2 ft of contact height, so 3.4 is the first height with real room
  // to swing over the top. Below it there is no put-away and no overarm swing,
  // however hard the stroke: that is the whole reason the dink game exists.
  const SMASH_HIGH = 3.4;        // contact height that unlocks the put-away
  const SMASH_NEAR = 11;         // and only from this close to the net
  const SMASH_POWER = 0.32;      // a soft stroke up there is still a dink
  const REACH      = 3.05;   // paddle + arm
  const HIT_CD     = 0.22;
  const SERVE_WAIT   = 3.0;  // s standing at the line before the server starts bouncing the ball
  const BOUNCE_PERIOD = 0.8; // s per bounce, hand to floor and back
  const MARK_FADE  = 2.0;    // seconds a bounce mark takes to fade off the court

  // A paddle held in front of the chest cannot sweep the floor at arm's length.
  // Reach collapses toward the ground, so a ball at ankle height can only be
  // played by somebody standing almost on top of it — which is what stops
  // players from scooping the ball the instant it touches down.
  function reachFactor(y) {
    return Math.max(0.06, Math.min(1, 0.06 + 0.94 * (y - 0.15) / 1.15));
  }

  // How fast this player can run. The CPU is a fraction of the baseline by
  // skill; the human sits above it, so the edge is theirs rather than shared.
  // Everyone used to snap to speed at the same rate. Now a CPU carries weight:
  // it leans into the run instead of starting at full tilt, which is what you
  // see when it has to change direction. That must not quietly hand the player
  // the match, so each CPU's plateau is raised by exactly enough that a
  // one-second chase still covers the ground it covered before. The easing is
  // therefore confined to the first half second, where a real player is slow
  // too, and a long chase is as hard to win as it always was.
  const HUMAN_ACCEL = 11;
  const CHASE = 1.0;
  const ground = k => CHASE - (1 - Math.exp(-k * CHASE)) / k;
  const rampComp = k => ground(HUMAN_ACCEL) / ground(k);

  function topSpeed(p) {
    const base = p.ctrl === 'cpu' ? MOVE_SPEED * (0.72 + 0.28 * p.skill) : HUMAN_SPEED;
    return base * (p.speedBoost || 1);
  }
  function accelOf(p) { return p.accel || HUMAN_ACCEL; }

  // A CPU has two gears and a facing. Repositioning is a shuffle at a fraction
  // of its top speed; only a ball worth chasing gets the sprint. And it faces
  // the net the whole time: running forward is full pace, sliding sideways
  // about 80% of it, backpedalling about 65%.
  const SHUFFLE = 0.60, SIDE = 0.80, BACK = 0.65;
  function cpuPace(p, ux, uz) {
    const gear = p.chasing ? 1 : SHUFFLE;
    const forward = uz * C.teamSign(p.team) < 0;       // toward the net
    return gear * (SIDE * ux * ux + (forward ? 1 : BACK) * uz * uz);
  }

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
        difficulty: 'normal',
        targetPoints: 11,
        winBy: 2,
      }, cfg || {});

      const d = SKILL[this.cfg.difficulty] || SKILL.normal;
      this.assistRules = d.assist;
      this.autoSwing = d.autoSwing;
      nextId = 0;

      // One human, always player 0; everyone else is driven by the CPU.
      const doubles = this.cfg.format === 'doubles';
      this.players = [];
      this.humanIdx = 0;

      if (doubles) {
        for (let t = 0; t < 2; t++) {
          for (let k = 0; k < 2; k++) {
            const id = t * 2 + k;
            const skill = t === 0 ? d.mate : d.opp;
            this.players.push(mkPlayer(t, id === 0 ? 'human' : 'cpu', k === 0 ? 'R' : 'L', skill, ''));
          }
        }
      } else {
        this.players.push(mkPlayer(0, 'human', 'R', d.mate, ''));
        this.players.push(mkPlayer(1, 'cpu', 'R', d.opp, ''));
      }
      for (const p of this.players) {
        p.accel = p.ctrl === 'cpu' ? d.accel : HUMAN_ACCEL;
        p.reactMax = d.react;                 // slowest a CPU may be to read a shot
        p.speedBoost = p.ctrl === 'cpu' ? rampComp(d.accel) : 1;
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
      // where the ball actually landed, newest last, each fading on its own clock
      this.marks = [];
      this.prepareServe();
    }

    nameEveryone() {
      const surnames = ['ALVES', 'COSTA', 'DIAS', 'MELO', 'PRADO', 'REIS'];
      for (const p of this.players) {
        p.role = p.ctrl === 'human' ? 'human' : (p.team === 0 ? 'mate' : 'rival');
        p.name = p.ctrl === 'human' ? T('name.you') : surnames[(p.id * 2 + 1) % surnames.length];
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
      server.z = serveSign * SERVE_Z;

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
        serveXSign: sSign, servedBy: server.id, netTouch: false, lastStyle: null,
      };

      const b = this.ball;
      b.x = server.x + sSign * 0.9; b.y = 1.95; b.z = server.z + C.teamSign(st) * 0.35;
      b.vx = b.vy = b.vz = 0; b.spin = 0; b.live = false; b.resting = false; b.style = null;

      this.state = 'ready';
      this.stateT = 0;
      this.pred = null;
      this.serveBounceN = -1;
    }

    // Where the free hand holds the ball before the serve: a little to the
    // non-paddle side, a step toward the net, waist high.
    serveHold(server) {
      const padSide = server.team === 0 ? 1 : -1;      // right-handed, facing the net
      return {
        x: server.x - padSide * 0.25,
        y: 2.55,
        z: server.z - C.teamSign(server.team) * 0.9,   // a step toward the net
      };
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
          this.say(T(behind ? 'hint.servehalf' : 'hint.servebehind'), 1.4);
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
      b.style = 'serve';
      this.rally.shotCount = 1;
      this.rally.lastHitter = server.id;
      this.rally.bounces = 0;
      this.rally.lastStyle = 'serve';
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

      for (let i = this.marks.length - 1; i >= 0; i--) {
        if ((this.marks[i].t -= dt) <= 0) this.marks.splice(i, 1);
      }

      this.updatePrediction();
      this.updateAnticipation(dt);

      // the human
      this.driveHuman(this.players[this.humanIdx], (inputs && inputs.p1) || null, dt, 'p1', inputs);
      // cpu
      for (const p of this.players) {
        if (p.ctrl === 'cpu') PB.AI.update(this, p, dt);
      }
      for (const p of this.players) this.movePlayer(p, dt);

      if (this.state === 'ready') {
        const server = this.players[this.serverIdx];
        // The ball waits in the server's free hand, held out in front at waist
        // height the way a real server stands. Kept waiting long enough, a human
        // server starts bouncing it on the court, as players do.
        const hold = this.serveHold(server);
        server.serveHold = hold;
        const b = this.ball;
        b.x = hold.x; b.z = hold.z; b.y = hold.y;
        const waited = this.stateT - SERVE_WAIT;
        server.serveBouncing = server.ctrl === 'human' && waited > 0;
        if (server.serveBouncing) {
          const phase = (waited % BOUNCE_PERIOD) / BOUNCE_PERIOD;
          const k = 2 * phase - 1;                     // -1 at the hand, 0 on the floor, 1 back
          b.y = C.BALL_R + (hold.y - C.BALL_R) * k * k;
          const n = Math.floor(waited / BOUNCE_PERIOD + 0.5);
          if (n !== this.serveBounceN) {
            this.serveBounceN = n;
            this.events.push({ type: 'bounce', x: b.x, z: b.z, impact: 5 });
          }
        }
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
      const b = this.ball, r = this.rally;
      if (!b.live) { this.pred = null; return; }
      const tr = P.trace(b, 2.4, 1 / 120);
      // The landing is settled once per flight, not re-traced every frame: a
      // flight is deterministic, and re-sampling it coarsely moved the
      // predicted bounce by inches, which near a line flipped the ring
      // between in and out in mid-air. A bounce or a net touch starts a new
      // flight, so the key changes and the landing is worked out again.
      const key = r.shotCount + ':' + r.bounces + ':' + (r.netTouch ? 1 : 0);
      const landing = this.pred && this.pred.key === key ? this.pred.landing
        : P.predictLanding(b, 5, 1 / 300);
      this.pred = { trace: tr, landing, key };
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
          this.marks.push({ x: ev.bx, z: ev.bz, t: MARK_FADE });
          if (this.marks.length > 12) this.marks.shift();
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
    // The team whose shot is still in the air: nobody on it may touch the
    // ball again until it has crossed the net.
    hitTeam() {
      const h = this.rally.lastHitter;
      return h >= 0 ? this.teamOf(h) : -1;
    }

    checkHits() {
      const b = this.ball;
      if (!b.live || this.rally.over) return;
      const side = C.sideOf(b.z);
      const own = this.hitTeam();
      let best = null, bestD = 1e9;
      for (const p of this.players) {
        if (p.team !== side) continue;
        if (p.id === this.rally.lastHitter) continue;
        if (p.hitCd > 0) continue;
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        const reach = (p.reach + p.lunge) * reachFactor(b.y);
        if (d > reach) continue;
        if (b.y < 0.18 || b.y > 8.4) continue;
        if (p.team === own) {
          // The partner's shot has not crossed yet. The CPU keeps its paddle
          // down; a human who swings anyway has hit the ball twice as a team,
          // which is a fault (a warning instead when the rules assist).
          if (p.ctrl !== 'human' || !this.pendingSwing[p.id]) continue;
          this.pendingSwing[p.id] = null;
          if (this.assistRules) { this.say(T('hint.partnerhit'), 1.4); continue; }
          this.endRally(p.team, 'dois_golpes');
          return;
        }
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
      const cross = Math.hypot(p.vx, p.vz) / topSpeed(p);
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
          this.say(T(bad === 'cozinha' ? 'hint.kitchen'
            : bad === 'recebedor' ? 'hint.receiver'
            : 'hint.letbounce'));
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
      // Off balance, the CPU simply cannot play the aggressive shot. A human
      // stroke is never rewritten: what you drew is what you asked for, and bad
      // contact costs accuracy further down instead of changing the shot.
      if (!swing.human && q < 0.52 && (style === 'drive' || style === 'smash' || style === 'punch')) {
        style = Math.abs(p.z) > 12 ? 'lob' : 'drop';
        swing = Object.assign({}, swing, {
          target: { x: (Math.random() * 2 - 1) * 4.5, z: oSign * (style === 'lob' ? 18.5 : 4.8) },
        });
      }
      let tx = swing.target ? swing.target.x : 0;
      let tz = swing.target ? swing.target.z : oSign * 15;
      if (!swing.target) {
        // The stroke itself is the aim: how far you pulled is how deep it lands,
        // and how far sideways is how wide. Pull past the line and it goes out.
        const depth = swing.human !== undefined
          ? PB.Stroke.depthAt(swing.power)
          : this.depthForStyle(style, swing.depth);
        tz = oSign * depth;
        // The tilt of the stroke is the angle of the shot. Straight up goes
        // straight ahead from where the ball is; a full sideways pull turns it
        // AIM_MAX degrees toward that side, sharper the further it leans. The
        // target stops at the sideline, never past it: the colour ramp warns
        // about depth, nothing warns about width, so width cannot fault alone.
        const lat = Math.max(-1, Math.min(1, swing.lateral || 0));
        const ang = Math.sign(lat) * Math.pow(Math.abs(lat), AIM_CURVE) * AIM_MAX;
        tx = from.x + Math.tan(ang) * Math.abs(tz - from.z);
        tx = Math.max(-AIM_EDGE, Math.min(AIM_EDGE, tx));
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
      b.style = style;                    // the renderer colours the flight by it
      b.z = from.z + Math.sign(v.vz) * 0.02;

      r.lastHitter = p.id;
      r.shotCount++;
      r.bounces = 0;
      r.netTouch = false;
      r.softCount = (style === 'dink' || style === 'drop') ? r.softCount + 1 : 0;
      r.lastStyle = style;                 // what the next player is receiving
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

    // The stroke names the shot. A bowed path is a lob; a very short pull is a
    // soft ball; everything else is a drive, or a volley when it is taken out of
    // the air near the net. The smash is not one of these: it is earned, and
    // `smashable` decides that separately.
    pickStyleFromSwipe(p, sw, volley, from) {
      const nearNet = Math.abs(p.z) < 10.5;
      if (sw.lob) return 'lob';
      if (this.smashable(p, volley, from, sw)) return 'smash';
      if (sw.power <= 0.16) return nearNet ? 'dink' : 'drop';
      return volley && nearNet ? 'punch' : 'drive';
    }

    // Two ways to earn the overarm swing, both of them about height.
    // One: the opponent lobs and you take it out of the air, up high.
    // Two: you are at the net and the ball sits above it, so you can hit down
    // on it. Anything lower is an ordinary stroke, however hard you pull.
    smashable(p, volley, from, sw) {
      if (from.y > SMASH_HIGH && Math.abs(from.z) < SMASH_NEAR
          && (sw ? (sw.power || 0) : 1) > SMASH_POWER) return true;
      return volley
        && this.rally.lastStyle === 'lob'
        && from.y > 4.2
        && Math.abs(from.z) < 16;
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
        const power = Math.max(0, Math.min(1.15, sw.power || 0));
        if (this.state === 'ready' && p.id === this.serverIdx) {
          // The serve reads the same stroke: how far you pulled is how deep it
          // goes, and the box is the only thing keeping it honest.
          const depth = Math.max(0, Math.min(1, power / 0.78));
          const aim = this.serveTarget(lateral * sign, depth, this.assistRules);
          this.doServe(aim, 0.7 + 0.3 * Math.min(1, power));
          inputs[slot].swipe = null;
          return;
        }
        this.pendingSwing[p.id] = {
          lateral: lateral * sign, power, lob: !!sw.lob,
          human: true, quality: 1, t: 0,
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

    // Waiting to serve, the only legal ground is behind the baseline and inside
    // the half you must serve from. Rather than let the player wander out and
    // then call a foot fault, the serve stance simply holds: sideways only.
    isServing(p) {
      return this.state === 'ready' && p.id === this.serverIdx;
    }

    clampServer(p) {
      if (!this.isServing(p)) return;
      const sign = C.teamSign(p.team);
      p.z = sign * SERVE_Z;
      p.vz = 0;
      const xs = this.serveXSign;
      const ax = Math.min(C.HALF_W, Math.max(SERVE_X_MIN, Math.abs(p.x)));
      const nx = xs * ax;
      // pressing into a wall stops rather than piling up speed
      if (nx !== p.x) p.vx = 0;
      p.x = nx;
    }

    movePlayer(p, dt) {
      let dx, dz;
      if (p.ctrl === 'human') {
        dx = p.mx || 0; dz = p.mz || 0;
        if (this.isServing(p)) dz = 0;          // sideways only until the serve is away
      } else {
        dx = p.tx - p.x; dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.25) { dx /= d; dz /= d; } else { dx = dz = 0; }
      }
      const mag = Math.hypot(dx, dz);
      if (mag > 1) { dx /= mag; dz /= mag; }
      const speed = topSpeed(p) * (p.ctrl === 'cpu' ? cpuPace(p, dx, dz) : 1);
      const tvx = dx * speed, tvz = dz * speed;
      const k = Math.min(1, dt * accelOf(p));
      p.vx += (tvx - p.vx) * k;
      p.vz += (tvz - p.vz) * k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // stretch for a wide ball
      const b = this.ball;
      p.lunge = 0;
      if (b.live && C.sideOf(b.z) === p.team && this.hitTeam() !== p.team) {
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
            if (p.ctrl === 'human') this.say(T('hint.momentum'), 1.2);
          } else if (this.state === 'live') {
            this.endRally(p.team, 'impulso');
          }
        }
      }
      C.clampToPlayArea(p, p.team);
      this.clampServer(p);
      if (p.hitCd > 0) p.hitCd -= dt;
      if (p.swingT > 0) p.swingT -= dt;
      this.animate(p, dt);
    }

    // Visual state only: gait, stance and how loaded the swing looks.
    animate(p, dt) {
      const spd = Math.hypot(p.vx, p.vz);
      p.speedN = Math.min(1, spd / topSpeed(p));
      p.runPhase += dt * (5.2 + p.speedN * 12.5);
      if (p.runPhase > Math.PI * 2) p.runPhase -= Math.PI * 2;
      // lean into the run, and square up again when standing
      const target = -(p.vx / topSpeed(p)) * 0.22 * (p.team === 0 ? 1 : -1);
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
      // the server stands in the serve posture, ball out front; nobody bounces
      // on their toes while holding the ball
      p.serveStance = this.state === 'ready' && p.id === this.serverIdx;
      if (!p.serveStance) { p.serveHold = null; p.serveBouncing = false; }
      p.hop = this.state === 'ready' && !p.serveStance ? (Math.sin(this.stateT * 6.5) * 0.5 + 0.5) * 0.06 : 0;
      // Ready position is a real athletic stance: knees bent and weight forward
      // even before the ball comes, deeper still at the kitchen line.
      let wantCrouch = 0.46 + p.prep * 0.36 + (Math.abs(p.z) < 10 ? 0.12 : 0);
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
      // Which call the umpire makes is decided by the same three branches that
      // move the serve along, so the voice can never disagree with the score.
      const ev = { type: 'point', winner, reason, cheer: this.cheerLevel, call: 'sideout' };
      this.events.push(ev);

      if (winner === this.servingTeam) {
        // A referee names what happened before anyone thinks about the score,
        // so a ball that died on the line or on the tape is called as such.
        // Only the winning-the-point call gives way; a serve changing hands is
        // still announced as a serve changing hands.
        ev.call = reason === 'fora' || reason === 'saque_fora' ? 'out'
          : (reason === 'nao_passou' && this.rally.netTouch) ? 'net'
          : 'point';
        this.score[winner]++;
        if (this.isDoubles()) {
          for (const p of this.mates(this.servingTeam)) p.courtSide = p.courtSide === 'R' ? 'L' : 'R';
        }
        this.sideOut = false;
      } else if (this.isDoubles() && this.serverNumber === 1) {
        ev.call = 'second';
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
        ev.cheer = 1;
        ev.final = true;
      }
    }

    afterPoint() {
      if (this.winner >= 0) { this.state = 'gameover'; this.banner = null; return; }
      this.banner = null;
      this.prepareServe();
    }
  }

  // The call the umpire makes. `reason` is a rule key, never a sentence, so the
  // same rally reads back in whatever language is on at the time.
  Match.reasonText = function (reason, m) {
    const w = T(m.lastWinner === 0 ? 'team.1' : 'team.2');
    const key = reason === 'nao_passou'
      ? (m.rally.netTouch ? 'reason.na_rede' : 'reason.nao_passou')
      : 'reason.' + reason;
    const label = PB.I18n && PB.I18n.DICT.en[key] ? T(key) : T('reason.ponto');
    return { label, team: m.lastWinner, sideOut: m.sideOut, w };
  };

  Match.SKILL = SKILL;
  Match.MOVE_SPEED = MOVE_SPEED;
  Match.HUMAN_SPEED = HUMAN_SPEED;
  Match.topSpeed = topSpeed;
  Match.accelOf = accelOf;
  Match.cpuPace = cpuPace;
  Match.HUMAN_ACCEL = HUMAN_ACCEL;
  Match.rampComp = rampComp;
  Match.SMASH_HIGH = SMASH_HIGH;
  Match.SMASH_NEAR = SMASH_NEAR;
  return Match;
})();
