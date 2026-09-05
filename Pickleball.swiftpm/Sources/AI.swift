import Foundation

/// CPU brain: real doubles positioning (kitchen line, third-shot drops, dink
/// battles that escalate) plus a skill-driven error model.
enum AI {
    struct Spot { var x = 0.0; var z = 0.0 }

    static func contactPoint(_ m: Match, _ p: Player) -> (x: Double, z: Double, volley: Bool)? {
        if m.traceCache.isEmpty { return nil }
        let sign = Court.teamSign(p.team)
        let mustBounce = m.rally.shotCount <= 1

        if !mustBounce && p.atNet {
            for s in m.traceCache {
                if s.bounced { break }
                if Court.side(of: s.z) != p.team { continue }
                if abs(s.z) < Court.kitchen + 0.5 { continue }
                if s.y < 0.9 || s.y > 6.5 { continue }
                if abs(s.z) > 15 { continue }
                return (s.x, s.z, true)
            }
        }
        guard let land = m.landing, Court.side(of: land.z) == p.team else { return nil }
        for s in m.traceCache {
            if s.t <= land.t + 0.1 { continue }
            if s.y <= 3.1 && s.y >= 1.0 { return (s.x, s.z, false) }
            if s.bounced && s.t > land.t + 0.05 { break }
        }
        return (land.x, land.z + sign * 1.8, false)
    }

    static func isResponsible(_ m: Match, _ p: Player, _ cx: Double, _ cz: Double) -> Bool {
        let mates = m.team(p.team)
        if mates.count == 1 { return true }
        guard let other = mates.first(where: { $0 !== p }) else { return true }
        func cost(_ q: Player) -> Double {
            var c = ((cx - q.x) * (cx - q.x) + (cz - q.z) * (cz - q.z)).squareRoot()
            if sgn(cx) == m.sideXSign(q) { c -= 1.6 }
            if q.ctrl == "human" { c += 1.2 }
            return c
        }
        return cost(p) <= cost(other)
    }

    static func homeSpot(_ m: Match, _ p: Player) -> Spot {
        let sign = Court.teamSign(p.team)
        let half = m.isDoubles ? m.sideXSign(p) * 4.4 : 0
        let shade = clampD((m.ball.live ? m.ball.x : 0) * 0.42, -6.5, 6.5)
        let x = m.isDoubles ? half * 0.72 + shade * 0.55 : shade * 0.9
        let z = p.atNet ? sign * (Court.kitchen + 0.85) : sign * 19.0
        return Spot(x: clampD(x, -9.5, 9.5), z: z)
    }

    static func update(_ m: Match, _ p: Player, _ dt: Double) {
        if p.aiLastShot != m.rally.shotCount {
            p.aiLastShot = m.rally.shotCount
            p.aiTimer = rnd(0.10, 0.42) * (1.25 - p.skill)
            p.aiHasTarget = false
        }
        p.aiTimer -= dt

        // judgement: a ball heading out gets left alone instead of volleyed
        if p.aiLetGoShot != m.rally.shotCount, let land = m.landing {
            p.aiLetGoShot = m.rally.shotCount
            let margin = max(abs(land.x) - Court.halfW, abs(land.z) - Court.halfL)
            let readable = clampD((margin - 0.15) / 1.6, 0, 1)
            p.aiLetGo = margin > 0.15 && Double.random(in: 0...1) < readable * (0.25 + 0.65 * p.skill)
        }

        if m.state != "live" { p.tx = p.x; p.tz = p.z; return }

        let sign = Court.teamSign(p.team)
        var spot: Spot? = nil
        if m.ball.live && p.aiTimer <= 0 {
            if let cp = contactPoint(m, p), isResponsible(m, p, cp.x, cp.z) {
                var z = cp.z
                if !cp.volley { z += sign * 0.6 }
                if abs(z) < Court.kitchen + 0.2 && !cp.volley && abs(cp.z) > Court.kitchen - 1.5 {
                    z = sign * (Court.kitchen + 0.25)
                }
                let s = Spot(x: clampD(cp.x, -11.5, 11.5), z: clampD(abs(z), 1.4, 24.5) * sign)
                spot = s
                p.aiHasTarget = true
                p.aiTargetX = s.x
                p.aiTargetZ = s.z
            }
        }
        var chosen: Spot
        if let s = spot {
            chosen = s
        } else if p.aiHasTarget && p.aiTimer > 0 {
            chosen = Spot(x: p.aiTargetX, z: p.aiTargetZ)
        } else {
            chosen = homeSpot(m, p)
        }
        if p.volleyMomentum > 0 && abs(chosen.z) < Court.kitchen + 0.6 {
            chosen = Spot(x: chosen.x, z: sign * (Court.kitchen + 0.7))
        }
        p.tx = chosen.x
        p.tz = chosen.z
    }

    static func letsItGo(_ m: Match, _ p: Player) -> Bool {
        p.aiLetGo && m.rally.bounces == 0
    }

    static func bestGap(_ m: Match, _ p: Player, deep: Bool) -> Double {
        let opp = m.team(1 - p.team)
        let cand: [Double] = [-8.2, -5.5, -2.5, 0, 2.5, 5.5, 8.2]
        var best = 0.0, bestScore = -1e9
        for x in cand {
            var s = 1e9
            for o in opp { s = min(s, abs(o.x - x) + (deep ? abs(o.z) * 0.12 : 0)) }
            s += (Double.random(in: 0...1) - 0.5) * (1 - p.skill) * 7
            if s > bestScore { bestScore = s; best = x }
        }
        return best
    }

    static func swing(_ m: Match, _ p: Player) -> Swing {
        let r = m.rally
        let b = m.ball
        let oSign = Court.teamSign(1 - p.team)
        let opp = m.team(1 - p.team)
        let oppNet = opp.contains(where: { abs($0.z) < 11.5 })
        let myZ = abs(p.z)
        let volley = r.bounces == 0

        var style = "drive"
        var tx = 0.0, tz = 0.0
        var risky = false

        if r.shotCount == 1 {
            style = "ret"
            tx = bestGap(m, p, deep: true) * 0.85
            tz = oSign * rnd(16.5, 20.2)
        } else if r.shotCount == 2 {
            if oppNet && Double.random(in: 0...1) < 0.28 + p.skill * 0.5 {
                style = "drop"
                tx = clampD(-sgn(b.x == 0 ? 1 : b.x) * rnd(2, 5.5), -8, 8)
                tz = oSign * rnd(3.4, 6.2)
            } else {
                style = "drive"
                tx = bestGap(m, p, deep: true)
                tz = oSign * rnd(15.5, 20)
            }
        } else if volley && b.y > 3.1 && myZ < 13 {
            style = "smash"
            tx = bestGap(m, p, deep: false)
            tz = oSign * rnd(8, 16)
        } else if myZ < 10.8 && b.y < 3.0 {
            let attackable = b.y > 2.25 || abs(b.z) > Court.kitchen + 1.2
            let heat = min(0.6, max(0, Double(r.softCount - 3)) * 0.13 + (b.y - 2.0) * 0.28)
            let riskyP = max(0, Double(r.softCount - 4)) * 0.09
            if attackable && Double.random(in: 0...1) < heat * (0.55 + p.skill * 0.6) {
                style = "punch"
                tx = bestGap(m, p, deep: false)
                tz = oSign * rnd(8.5, 15)
            } else if Double.random(in: 0...1) < riskyP {
                style = "punch"
                tx = bestGap(m, p, deep: false)
                tz = oSign * rnd(9, 15)
                risky = true
            } else if oppNet && Double.random(in: 0...1) < 0.05 + (1 - p.skill) * 0.05 {
                style = "lob"
                tx = bestGap(m, p, deep: true)
                tz = oSign * rnd(18.5, 20.8)
            } else {
                style = "dink"
                tx = clampD(-sgn(p.x == 0 ? 1 : p.x) * rnd(2.5, 6.0), -8.5, 8.5)
                let loose = (1 - p.skill) * 0.30 + Double(r.softCount) * 0.025
                tz = Double.random(in: 0...1) < loose ? oSign * rnd(7.3, 9.6) : oSign * rnd(2.8, 6.4)
            }
        } else if myZ < 10.8 {
            style = "punch"
            tx = bestGap(m, p, deep: false)
            tz = oSign * rnd(9, 16)
        } else if oppNet && Double.random(in: 0...1) < 0.22 + p.skill * 0.35 {
            style = "drop"
            tx = clampD(-sgn(b.x == 0 ? 1 : b.x) * rnd(1.5, 5.5), -8, 8)
            tz = oSign * rnd(3.4, 6.4)
        } else {
            style = "drive"
            tx = bestGap(m, p, deep: true)
            tz = oSign * rnd(14.5, 20)
        }

        var errP = 0.045 + (1 - p.skill) * 0.27
        let soft = style == "dink" || style == "drop"
        if soft { errP *= 0.8 + Double(r.softCount) * 0.05 }
        if style == "smash" || style == "drive" { errP *= 1.15 }

        var netError = false
        if Double.random(in: 0...1) < errP {
            let kind = Double.random(in: 0...1)
            if soft {
                if kind < 0.45 { netError = true } else { tz = oSign * rnd(7.6, 10.2) }
            } else if kind < 0.18 {
                netError = true
            } else if kind < 0.64 {
                tz = oSign * (Court.halfL + rnd(0.6, 3.0))
            } else {
                tx = (tx == 0 ? 1 : sgn(tx)) * (Court.halfW + rnd(0.5, 2.2))
            }
        }

        var s = Swing()
        s.style = style
        s.hasTarget = true
        s.tx = tx
        s.tz = tz
        s.netError = netError
        s.quality = (0.6 + 0.4 * p.skill) * (risky ? 0.72 : 1)
        return s
    }

    /// Used when a human never flicks (assist): competent, never reckless.
    static func neutralSwing(_ m: Match, _ p: Player) -> Swing {
        let b = m.ball
        let oSign = Court.teamSign(1 - p.team)
        let myZ = abs(p.z)
        var style: String
        var tx = 0.0, tz = 0.0
        if m.rally.shotCount == 1 {
            style = "ret"; tx = bestGap(m, p, deep: true) * 0.8; tz = oSign * rnd(16, 19.5)
        } else if myZ < 10.8 && b.y < 3.0 {
            style = "dink"
            tx = clampD(-sgn(p.x == 0 ? 1 : p.x) * rnd(2.5, 5.5), -8, 8)
            tz = oSign * rnd(3.0, 6.0)
        } else if myZ < 10.8 {
            style = "punch"; tx = bestGap(m, p, deep: false); tz = oSign * rnd(9, 15)
        } else {
            style = "drive"; tx = bestGap(m, p, deep: true) * 0.85; tz = oSign * rnd(14, 18.5)
        }
        var netError = false
        if Double.random(in: 0...1) < 0.07 {
            if style == "dink" || style == "drop" {
                netError = Double.random(in: 0...1) < 0.6
            } else if Double.random(in: 0...1) < 0.5 {
                tz = oSign * (Court.halfL + rnd(0.5, 2.2))
            } else {
                netError = true
            }
        }
        var s = Swing()
        s.style = style
        s.hasTarget = true
        s.tx = tx
        s.tz = tz
        s.netError = netError
        s.quality = 0.62
        s.auto = true
        return s
    }

    static func serve(_ m: Match, _ server: Player) {
        let skill = server.skill
        let rSign = Court.teamSign(1 - server.team)
        let xs = -m.serveXSign
        var x = xs * rnd(1.6, 8.4)
        var z = rSign * rnd(15.5, 20.6)
        x += Double.random(in: -1...1) * (1 - skill) * 2.6
        z += Double.random(in: -1...1) * (1 - skill) * 2.6 * rSign
        if Double.random(in: 0...1) < (1 - skill) * 0.07 { z = rSign * rnd(22.6, 24) }
        m.doServe(aimX: x, aimZ: z, power: 0.8 + 0.2 * skill)
    }
}
