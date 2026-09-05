import Foundation

struct MatchConfig {
    var format = "singles"        // "singles" | "doubles"
    var humans = 1                // 1 | 2
    var arrangement = "coop"      // doubles with two humans: "coop" | "versus"
    var difficulty = "normal"
    var targetPoints = 11
    var winBy = 2
}

struct SwipeInput {
    var lateral = 0.0
    var depth = 0.5
    var fast = false
    var long = false
    var power = 1.0
}

struct HumanInput {
    var mx = 0.0
    var mz = 0.0
    var swipe: SwipeInput? = nil
}

struct Swing {
    var style: String? = nil
    var hasTarget = false
    var tx = 0.0
    var tz = 0.0
    var lateral = 0.0
    var depth = 0.5
    var fast = false
    var long = false
    var quality = 1.0
    var netError = false
    var auto = false
    var age = 0.0
}

enum GameEvent {
    case hit(style: String, power: Double)
    case bounce(impact: Double)
    case net
    case point(winner: Int, reason: String)
}

final class Player {
    let id: Int
    let team: Int
    var ctrl: String
    var courtSide: String
    var skill: Double
    var name = ""

    var x = 0.0, z = 0.0, vx = 0.0, vz = 0.0
    var tx = 0.0, tz = 0.0
    var mx = 0.0, mz = 0.0
    var reach = 3.05
    var hitCd = 0.0
    var swingT = 0.0
    var swingType: String? = nil
    var swingDir = 1.0
    var atNet = false
    var volleyMomentum = 0.0
    var lunge = 0.0

    var aiTimer = 0.0
    var aiLastShot = -1
    var aiHasTarget = false
    var aiTargetX = 0.0
    var aiTargetZ = 0.0
    var aiLetGo = false
    var aiLetGoShot = -1

    init(id: Int, team: Int, ctrl: String, courtSide: String, skill: Double) {
        self.id = id; self.team = team; self.ctrl = ctrl
        self.courtSide = courtSide; self.skill = skill
        self.z = Court.teamSign(team) * 18
        self.tz = self.z
    }
}

struct Rally {
    var shotCount = 0
    var lastHitter = -1
    var bounces = 0
    var over = false
    var softCount = 0
    var serveXSign = 1.0
    var servedBy = -1
    var netTouch = false
}

struct Banner {
    var label = ""
    var team = 0
    var sideOut = false
}

/// The rule engine: rally state machine, faults and side-out scoring.
final class Match {
    static let moveSpeed = 13.2
    static let hitCooldown = 0.22

    let cfg: MatchConfig
    var players: [Player] = []
    var slotP1 = 0
    var slotP2: Int? = nil
    var versus = false
    var assistRules = true
    var autoSwing = false

    var ball = Ball()
    var score = [0, 0]
    var servingTeam = 0
    var serverNumber = 1
    var serverIdx = 0
    var receiverIdx = 1
    var serveXSign = 1.0
    var state = "ready"          // ready | live | point | gameover
    var stateT = 0.0
    var rally = Rally()
    var banner: Banner? = nil
    var hint: String? = nil
    var hintT = 0.0
    var events: [GameEvent] = []
    var winner = -1
    var paused = false
    var lastWinner = 0
    var sideOut = false

    var traceCache: [TraceSample] = []
    var landing: TraceSample? = nil
    var pendingSwing: [Int: Swing] = [:]

    init(cfg: MatchConfig) {
        self.cfg = cfg
        let (opp, mate, assist, auto) = Match.skill(for: cfg.difficulty)
        assistRules = assist
        autoSwing = auto

        let doubles = cfg.format == "doubles"
        versus = cfg.humans == 2 && (!doubles || cfg.arrangement == "versus")

        if doubles {
            let humanIds = versus ? [0, 2] : [0, 1]
            for t in 0..<2 {
                for k in 0..<2 {
                    let id = t * 2 + k
                    let isHuman = cfg.humans == 2 ? humanIds.contains(id) : id == 0
                    players.append(Player(id: id, team: t, ctrl: isHuman ? "human" : "cpu",
                                          courtSide: k == 0 ? "R" : "L", skill: t == 0 ? mate : opp))
                }
            }
            if cfg.humans == 2 { slotP1 = humanIds[0]; slotP2 = humanIds[1] } else { slotP1 = 0 }
        } else {
            players.append(Player(id: 0, team: 0, ctrl: "human", courtSide: "R", skill: mate))
            players.append(Player(id: 1, team: 1, ctrl: cfg.humans == 2 ? "human" : "cpu",
                                  courtSide: "R", skill: opp))
            slotP1 = 0
            if cfg.humans == 2 { slotP2 = 1 }
        }
        serverNumber = doubles ? 2 : 1
        nameEveryone()
        prepareServe()
    }

    static func skill(for difficulty: String) -> (Double, Double, Bool, Bool) {
        switch difficulty {
        case "facil":   return (0.40, 0.56, true, true)
        case "dificil": return (0.86, 0.80, false, false)
        default:        return (0.63, 0.68, true, false)
        }
    }

    func nameEveryone() {
        let two = cfg.humans == 2
        for p in players {
            if p.ctrl == "human" {
                p.name = two ? (p.id == slotP1 ? "P1" : "P2") : "Você"
            } else {
                p.name = p.team == 0 ? "Parceiro" : "Rival"
            }
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────
    var isDoubles: Bool { cfg.format == "doubles" }
    func team(_ t: Int) -> [Player] { players.filter { $0.team == t } }
    func teamOf(_ id: Int) -> Int { players[id].team }
    func sideXSign(_ p: Player) -> Double { Court.rightSign(p.team) * (p.courtSide == "R" ? 1 : -1) }

    var scoreText: String {
        let s = servingTeam, r = 1 - s
        return isDoubles ? "\(score[s]) - \(score[r]) - \(serverNumber)" : "\(score[s]) - \(score[r])"
    }

    func say(_ text: String, _ secs: Double = 1.6) { hint = text; hintT = secs }

    // ── serving ────────────────────────────────────────────────────────────
    func prepareServe() {
        let st = servingTeam
        let mates = team(st)

        if !isDoubles {
            mates[0].courtSide = score[st] % 2 == 0 ? "R" : "L"
            serverIdx = mates[0].id
        } else if players[serverIdx].team != st {
            serverIdx = mates[0].id
        }

        let server = players[serverIdx]
        let sSign = sideXSign(server)
        let rTeam = 1 - st
        let rSign = Court.teamSign(rTeam)
        let serveSign = Court.teamSign(st)

        server.x = sSign * 4.6
        server.z = serveSign * 23.2

        let opp = team(rTeam)
        var receiver: Player
        if isDoubles {
            receiver = opp.first(where: { sideXSign($0) == -sSign }) ?? opp[0]
            if let partner = opp.first(where: { $0 !== receiver }) {
                partner.x = sSign * 4.6; partner.z = rSign * 8.2; partner.atNet = true
            }
            if let sMate = mates.first(where: { $0 !== server }) {
                sMate.x = -sSign * 4.6; sMate.z = serveSign * 17.5; sMate.atNet = false
            }
        } else {
            receiver = opp[0]
            receiver.courtSide = score[st] % 2 == 0 ? "R" : "L"
        }
        receiver.x = -sSign * 4.6
        receiver.z = rSign * 20.5
        receiver.atNet = false
        server.atNet = false

        for p in players {
            p.vx = 0; p.vz = 0; p.tx = p.x; p.tz = p.z; p.hitCd = 0
            p.volleyMomentum = 0; p.swingT = 0; p.aiTimer = 0; p.lunge = 0
            p.aiHasTarget = false
        }

        serveXSign = sSign
        receiverIdx = receiver.id
        rally = Rally()
        rally.serveXSign = sSign
        rally.servedBy = server.id
        pendingSwing.removeAll()

        ball = Ball()
        ball.x = server.x + sSign * 0.9
        ball.y = 1.95
        ball.z = server.z + serveSign * 0.35

        state = "ready"
        stateT = 0
        traceCache = []
        landing = nil
    }

    func serveTarget(lateral: Double, depth: Double, clampInside: Bool) -> (x: Double, z: Double) {
        let rSign = Court.teamSign(1 - servingTeam)
        let xs = -serveXSign
        var x = xs * (1.1 + abs(lateral) * 8.3)
        if lateral * xs < 0 { x = xs * (1.1 + (1 - abs(lateral)) * 8.3) }
        var z = rSign * (9.5 + depth * 12.2)
        if clampInside {
            x = xs * clampD(abs(x), 0.8, 9.2)
            z = rSign * clampD(abs(z), 9.0, 21.2)
        }
        return (x, z)
    }

    func doServe(aimX: Double, aimZ: Double, power: Double) {
        let server = players[serverIdx]
        let rSign = Court.teamSign(1 - server.team)
        let toZ = aimZ * rSign > 0 ? aimZ : rSign * abs(aimZ)
        let v = Shots.plan(fromX: ball.x, fromY: 1.95, fromZ: ball.z,
                           toX: aimX, toZ: toZ, style: "serve", power: power)
        ball.y = 1.95
        ball.vx = v.vx; ball.vy = v.vy; ball.vz = v.vz; ball.spin = v.spin
        ball.live = true; ball.resting = false
        rally.shotCount = 1
        rally.lastHitter = server.id
        rally.bounces = 0
        server.swingT = 0.3
        server.swingType = "serve"
        state = "live"
        stateT = 0
        events.append(.hit(style: "serve", power: 34))
    }

    // ── frame ──────────────────────────────────────────────────────────────
    func update(dt rawDt: Double, inputs: inout [String: HumanInput]) {
        if paused || state == "gameover" { return }
        let dt = min(rawDt, 1.0 / 20.0)
        stateT += dt
        if hintT > 0 { hintT -= dt; if hintT <= 0 { hint = nil } }

        updatePrediction()

        driveHuman(players[slotP1], slot: "p1", dt: dt, inputs: &inputs)
        if let s2 = slotP2 { driveHuman(players[s2], slot: "p2", dt: dt, inputs: &inputs) }
        for p in players where p.ctrl == "cpu" { AI.update(self, p, dt) }
        for p in players { movePlayer(p, dt) }

        if state == "ready" {
            let server = players[serverIdx]
            ball.x = server.x + serveXSign * 0.9
            ball.z = server.z + Court.teamSign(server.team) * 0.35
            ball.y = 1.95
            if server.ctrl == "cpu" && stateT > 0.75 { AI.serve(self, server) }
        } else if state == "live" {
            stepBall(dt, deadBall: false)
        } else if state == "point" {
            if ball.live { stepBall(dt, deadBall: true) }
            if stateT > 1.55 { afterPoint() }
        }
    }

    func updatePrediction() {
        guard ball.live else { traceCache = []; landing = nil; return }
        traceCache = Physics.trace(ball)
        landing = traceCache.first(where: { $0.bounced })
    }

    func stepBall(_ dt: Double, deadBall: Bool) {
        let sub = 5
        let h = dt / Double(sub)
        for _ in 0..<sub {
            var ev = BallEvent()
            Physics.step(&ball, h, &ev)
            if ev.net {
                rally.netTouch = true
                events.append(.net)
            }
            if ev.bounce {
                events.append(.bounce(impact: ev.impact))
                if !deadBall { onBounce(ev.bx, ev.bz) }
            }
            if rally.over || state != "live" { break }
            if !deadBall { checkHits() }
            if rally.over { break }
        }
        if !deadBall && state == "live" {
            if !ball.x.isFinite || !ball.y.isFinite || !ball.z.isFinite {
                ball = Ball(); ball.y = 3; ball.resting = true
            }
            if ball.resting || abs(ball.x) > 34 || abs(ball.z) > 46 || ball.y > 60 {
                let hitter = rally.lastHitter
                endRally(losing: hitter >= 0 ? teamOf(hitter) : 1 - servingTeam, reason: "fora")
            }
        }
    }

    func onBounce(_ x: Double, _ z: Double) {
        if rally.over { return }
        let side = Court.side(of: z)
        let hitter = rally.lastHitter
        let hTeam = hitter >= 0 ? teamOf(hitter) : servingTeam

        if rally.bounces == 0 {
            if side == hTeam { endRally(losing: hTeam, reason: "nao_passou"); return }
            if rally.shotCount == 1 {
                if !Court.inServiceBox(x, z, team: 1 - hTeam, xSign: -rally.serveXSign) {
                    endRally(losing: hTeam, reason: Court.inKitchen(x, z) ? "saque_cozinha" : "saque_fora")
                    return
                }
            } else if !Court.inBounds(x, z) {
                endRally(losing: hTeam, reason: "fora"); return
            }
            rally.bounces = 1
            if abs(z) > 15.5 { for p in team(side) { p.atNet = false } }
            if abs(z) < Court.kitchen + 1.2 && rally.shotCount >= 2 {
                for p in team(hTeam) { p.atNet = true }
            }
        } else {
            endRally(losing: side, reason: "dois_quiques")
        }
    }

    // ── contact ────────────────────────────────────────────────────────────
    func checkHits() {
        guard ball.live, !rally.over else { return }
        let side = Court.side(of: ball.z)
        var best: Player? = nil
        var bestD = 1e9
        for p in players where p.team == side {
            if p.id == rally.lastHitter || p.hitCd > 0 { continue }
            let d = ((ball.x - p.x) * (ball.x - p.x) + (ball.z - p.z) * (ball.z - p.z)).squareRoot()
            if d > p.reach + p.lunge { continue }
            if ball.y < 0.18 || ball.y > 8.4 { continue }
            if d < bestD { bestD = d; best = p }
        }
        if let p = best { attemptHit(p) }
    }

    func legality(_ p: Player) -> String? {
        let volley = rally.bounces == 0
        if volley && rally.shotCount <= 1 { return "dois_quiques_regra" }
        if volley && Court.inKitchen(p.x, p.z, team: p.team) { return "cozinha" }
        return nil
    }

    /// Stretch, pace and awkward heights all cost control — this is what ends rallies.
    func contactQuality(_ p: Player) -> Double {
        let d = ((ball.x - p.x) * (ball.x - p.x) + (ball.z - p.z) * (ball.z - p.z)).squareRoot()
        let reach = p.reach + p.lunge
        var q = 1.0
        q -= clampD((d - 1.3) / max(0.6, reach - 1.3), 0, 1) * 0.52
        q -= clampD((ball.speed - 34) / 42, 0, 1) * 0.22
        if ball.y < 1.0 { q -= 0.16 }
        if ball.y > 5.6 { q -= 0.10 }
        let cross = (p.vx * p.vx + p.vz * p.vz).squareRoot() / Match.moveSpeed
        q -= max(0, cross - 0.75) * 0.35
        return clampD(q, 0.18, 1)
    }

    func attemptHit(_ p: Player) {
        let bad = legality(p)
        var swing: Swing
        if p.ctrl == "human" {
            if let s = pendingSwing[p.id] {
                swing = s
            } else if autoSwing {
                swing = AI.neutralSwing(self, p)
            } else {
                return
            }
            if bad != nil && swing.auto { return }
            if let b = bad, assistRules {
                say(b == "cozinha" ? "Saia da cozinha para dar voleio!" : "Deixe quicar (regra dos dois quiques)!")
                return
            }
        } else {
            if bad != nil { return }
            if AI.letsItGo(self, p) { return }
            let cq = contactQuality(p)
            if cq < 0.42 && Double.random(in: 0...1) < (0.42 - cq) * 2.1 * (1.3 - p.skill) { return }
            swing = AI.swing(self, p)
        }
        pendingSwing[p.id] = nil
        executeHit(p, swing)
        if let b = bad, !assistRules {
            endRally(losing: p.team, reason: b == "cozinha" ? "cozinha" : "voleio_saque")
        }
    }

    func executeHit(_ p: Player, _ swingIn: Swing) {
        var swing = swingIn
        let oppTeam = 1 - p.team
        let oSign = Court.teamSign(oppTeam)
        let fromX = ball.x, fromY = max(0.55, ball.y), fromZ = ball.z
        let volley = rally.bounces == 0

        var style = swing.style ?? pickStyle(p, swing, volley: volley, contactY: fromY, contactZ: fromZ)
        let q = swing.quality * contactQuality(p)
        if q < 0.52 && (style == "drive" || style == "smash" || style == "punch") {
            style = abs(p.z) > 12 ? "lob" : "drop"
            swing.hasTarget = true
            swing.tx = rnd(-4.5, 4.5)
            swing.tz = oSign * (style == "lob" ? 18.5 : 4.8)
        }

        var tx: Double
        var tz: Double
        if swing.hasTarget {
            tx = swing.tx; tz = swing.tz
        } else {
            tz = oSign * depthFor(style, swing.depth)
            tx = clampD(swing.lateral * 9.4, -9.4, 9.4)
        }
        let jitter = (1 - q) * 5.0
        tx += Double.random(in: -1...1) * jitter
        tz += Double.random(in: -1...1) * jitter * oSign * 0.9
        if !tx.isFinite || !tz.isFinite { tx = 0; tz = oSign * 15 }

        var v = Shots.plan(fromX: fromX, fromY: fromY, fromZ: fromZ,
                           toX: tx, toZ: tz, style: style, power: 0.55 + 0.45 * q)
        if swing.netError { v.vx *= 0.68; v.vy *= 0.68; v.vz *= 0.68 }
        if !v.vx.isFinite || !v.vy.isFinite || !v.vz.isFinite {
            v.vx = 0; v.vy = 12; v.vz = oSign * 22
        }
        ball.vx = v.vx; ball.vy = v.vy; ball.vz = v.vz; ball.spin = v.spin
        ball.live = true; ball.resting = false
        ball.z = fromZ + sgn(v.vz) * 0.02

        rally.lastHitter = p.id
        rally.shotCount += 1
        rally.bounces = 0
        rally.netTouch = false
        rally.softCount = (style == "dink" || style == "drop") ? rally.softCount + 1 : 0
        p.hitCd = Match.hitCooldown
        p.swingT = 0.28
        p.swingType = style
        p.swingDir = sgn(ball.x - p.x) == 0 ? 1 : sgn(ball.x - p.x)
        if volley { p.volleyMomentum = 0.45 }
        if rally.shotCount == 2 { p.atNet = true }

        let sp = (v.vx * v.vx + v.vy * v.vy + v.vz * v.vz).squareRoot()
        events.append(.hit(style: style, power: sp))
    }

    func depthFor(_ style: String, _ tIn: Double) -> Double {
        let t = clampD(tIn, 0, 1)
        switch style {
        case "dink":  return 2.6 + t * 4.2
        case "drop":  return 3.2 + t * 3.6
        case "lob":   return 15.0 + t * 6.0
        case "punch": return 8.0 + t * 9.0
        case "smash": return 7.0 + t * 10.0
        default:      return 10.0 + t * 10.8
        }
    }

    func pickStyle(_ p: Player, _ sw: Swing, volley: Bool, contactY: Double, contactZ: Double) -> String {
        let nearNet = abs(p.z) < 10.5
        if sw.fast && contactY > 3.3 && abs(contactZ) < 13 && volley { return "smash" }
        if sw.fast && sw.long { return "drive" }
        if sw.fast && !sw.long { return "punch" }
        if !sw.fast && sw.long { return "lob" }
        return nearNet ? "dink" : "drop"
    }

    // ── human control ──────────────────────────────────────────────────────
    func driveHuman(_ p: Player, slot: String, dt: Double, inputs: inout [String: HumanInput]) {
        guard var inp = inputs[slot] else { p.mx = 0; p.mz = 0; return }
        let sign = p.team == 0 ? 1.0 : -1.0
        p.mx = inp.mx * sign
        p.mz = inp.mz * sign

        if let sw = inp.swipe {
            let lateral = clampD(sw.lateral, -1, 1)
            if state == "ready" && p.id == serverIdx {
                let aim = serveTarget(lateral: lateral, depth: clampD(sw.depth, 0, 1), clampInside: assistRules)
                doServe(aimX: aim.x, aimZ: aim.z, power: 0.75 + 0.25 * sw.power)
                inp.swipe = nil
                inputs[slot] = inp
                return
            }
            var s = Swing()
            s.lateral = lateral * sign
            s.depth = clampD(sw.depth, 0, 1)
            s.fast = sw.fast
            s.long = sw.long
            s.quality = 1
            pendingSwing[p.id] = s
            inp.swipe = nil
            inputs[slot] = inp
        }
        if var ps = pendingSwing[p.id] {
            ps.age += dt
            ps.quality = max(0.35, 1 - ps.age / 0.5)
            if ps.age > 0.5 { pendingSwing[p.id] = nil } else { pendingSwing[p.id] = ps }
        }
    }

    func movePlayer(_ p: Player, _ dt: Double) {
        var dx: Double, dz: Double
        if p.ctrl == "human" {
            dx = p.mx; dz = p.mz
        } else {
            dx = p.tx - p.x; dz = p.tz - p.z
            let d = (dx * dx + dz * dz).squareRoot()
            if d > 0.25 { dx /= d; dz /= d } else { dx = 0; dz = 0 }
        }
        let mag = (dx * dx + dz * dz).squareRoot()
        if mag > 1 { dx /= mag; dz /= mag }
        let speed = Match.moveSpeed * (p.ctrl == "cpu" ? 0.72 + 0.28 * p.skill : 1)
        let k = min(1, dt * 11)
        p.vx += (dx * speed - p.vx) * k
        p.vz += (dz * speed - p.vz) * k
        p.x += p.vx * dt
        p.z += p.vz * dt

        p.lunge = 0
        if ball.live && Court.side(of: ball.z) == p.team {
            let d = ((ball.x - p.x) * (ball.x - p.x) + (ball.z - p.z) * (ball.z - p.z)).squareRoot()
            if d < p.reach + 1.4 { p.lunge = clampD(d - p.reach + 1.0, 0, 1.15) }
        }

        if p.volleyMomentum > 0 {
            p.volleyMomentum -= dt
            if Court.inKitchen(p.x, p.z, team: p.team) {
                if assistRules || p.ctrl == "cpu" {
                    p.z = Court.teamSign(p.team) * (Court.kitchen + 0.12)
                    p.vz = 0
                    if p.ctrl == "human" { say("Impulso: não entre na cozinha após o voleio!", 1.2) }
                } else if state == "live" {
                    endRally(losing: p.team, reason: "impulso")
                }
            }
        }
        Court.clampToPlayArea(x: &p.x, z: &p.z, team: p.team)
        if p.hitCd > 0 { p.hitCd -= dt }
        if p.swingT > 0 { p.swingT -= dt }
    }

    // ── scoring ────────────────────────────────────────────────────────────
    func endRally(losing losingTeam: Int, reason: String) {
        if rally.over { return }
        rally.over = true
        let win = 1 - losingTeam
        lastWinner = win
        state = "point"
        stateT = 0
        events.append(.point(winner: win, reason: reason))

        if win == servingTeam {
            score[win] += 1
            if isDoubles {
                for p in team(servingTeam) { p.courtSide = p.courtSide == "R" ? "L" : "R" }
            }
            sideOut = false
        } else if isDoubles && serverNumber == 1 {
            if let partner = team(servingTeam).first(where: { $0.id != serverIdx }) {
                serverIdx = partner.id
            }
            serverNumber = 2
            sideOut = false
        } else {
            servingTeam = win
            serverNumber = 1
            if isDoubles {
                serverIdx = (team(win).first(where: { $0.courtSide == "R" }) ?? team(win)[0]).id
            } else {
                serverIdx = team(win)[0].id
            }
            sideOut = true
        }
        banner = Banner(label: Match.reasonText(reason), team: win, sideOut: sideOut)

        if score[win] >= cfg.targetPoints && score[win] - score[1 - win] >= cfg.winBy {
            winner = win
        }
    }

    func afterPoint() {
        if winner >= 0 { state = "gameover"; banner = nil; return }
        banner = nil
        prepareServe()
    }

    static func reasonText(_ reason: String) -> String {
        switch reason {
        case "fora": return "Bola fora"
        case "nao_passou": return "Na rede"
        case "saque_fora": return "Saque fora"
        case "saque_cozinha": return "Saque na cozinha"
        case "dois_quiques": return "Dois quiques"
        case "cozinha": return "Voleio na cozinha"
        case "voleio_saque": return "Voleio antes do quique"
        case "impulso": return "Impulso na cozinha"
        default: return "Ponto"
        }
    }
}
