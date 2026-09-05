import Foundation

struct Launch {
    var vx = 0.0, vy = 0.0, vz = 0.0, spin = 0.0
    var style = "drive"
    var clear = Double.infinity
    var crossed = false
    var landedT = 0.0
    var landedDist = 0.0
}

struct ShotStyle {
    let time: Double, spin: Double, clear: Double, power: Double
}

/// Solves launch velocities against drag so every shot family reaches the point
/// it was aimed at, and lifts the arc until the net is genuinely cleared.
enum Shots {
    static let maxSpeed = 78.0

    static let styles: [String: ShotStyle] = [
        "serve": ShotStyle(time: 1.05, spin: 0.8, clear: 0.85, power: 1.0),
        "drive": ShotStyle(time: 0.72, spin: 2.6, clear: 0.55, power: 1.0),
        "ret":   ShotStyle(time: 0.95, spin: 1.6, clear: 0.80, power: 0.9),
        "drop":  ShotStyle(time: 1.15, spin: 0.4, clear: 0.75, power: 0.7),
        "dink":  ShotStyle(time: 0.85, spin: 0.2, clear: 0.42, power: 0.5),
        "lob":   ShotStyle(time: 1.95, spin: -0.6, clear: 4.50, power: 0.8),
        "punch": ShotStyle(time: 0.55, spin: 1.4, clear: 0.40, power: 0.9),
        "smash": ShotStyle(time: 0.42, spin: 3.2, clear: 0.30, power: 1.0),
    ]

    struct FlightResult {
        var x = 0.0, z = 0.0, t = 0.0, dist = 0.0
        var clear = Double.infinity
        var crossed = false
    }

    static func fly(from fx: Double, _ fy: Double, _ fz: Double,
                    vx: Double, vy: Double, vz: Double, spin: Double,
                    endY: Double) -> FlightResult {
        var b = Ball()
        b.x = fx; b.y = fy; b.z = fz
        b.vx = vx; b.vy = vy; b.vz = vz; b.spin = spin
        let dt = 1.0 / 240.0
        var res = FlightResult()
        var crossed = false
        var clear = Double.infinity
        let wantsHeight = endY > Court.ballR + 0.005
        var t = dt
        while t < 6 {
            let py = b.y, pz = b.z, pvy = b.vy
            var ev = BallEvent()
            Physics.step(&b, dt, &ev)
            if !crossed && pz != b.z && sgn(pz) != sgn(b.z) {
                crossed = true
                clear = b.y - Court.netHeight(at: b.x)
            }
            if wantsHeight && pvy < 0 && py > endY && b.y <= endY {
                res.x = b.x; res.z = b.z; res.t = t
                res.dist = ((b.x - fx) * (b.x - fx) + (b.z - fz) * (b.z - fz)).squareRoot()
                res.clear = clear; res.crossed = crossed
                return res
            }
            if ev.bounce {
                res.x = ev.bx; res.z = ev.bz; res.t = t
                res.dist = ((ev.bx - fx) * (ev.bx - fx) + (ev.bz - fz) * (ev.bz - fz)).squareRoot()
                res.clear = clear; res.crossed = crossed
                return res
            }
            if b.resting { break }
            t += dt
        }
        res.x = b.x; res.z = b.z; res.t = 6
        res.dist = ((b.x - fx) * (b.x - fx) + (b.z - fz) * (b.z - fz)).squareRoot()
        res.clear = clear; res.crossed = crossed
        return res
    }

    static func solve(fromX: Double, fromY: Double, fromZ: Double,
                      toX: Double, toY: Double, toZ: Double,
                      time: Double, spin: Double) -> Launch {
        let dx = toX - fromX, dz = toZ - fromZ
        let d = max(0.4, (dx * dx + dz * dz).squareRoot())
        let ux = dx / d, uz = dz / d
        var vh = d / time
        var vy = (toY - fromY + 0.5 * Physics.g * time * time) / time
        var out = Launch()
        for _ in 0..<6 {
            let r = fly(from: fromX, fromY, fromZ, vx: ux * vh, vy: vy, vz: uz * vh, spin: spin, endY: toY)
            out.clear = r.clear; out.crossed = r.crossed; out.landedT = r.t; out.landedDist = r.dist
            let dErr = d - r.dist
            let tErr = time - r.t
            if abs(dErr) < 0.15 && abs(tErr) < 0.02 { break }
            vh += dErr / max(0.2, r.t)
            vy += tErr * Physics.g * 0.5
            vh = clampD(vh, 1, maxSpeed)
            vy = clampD(vy, -45, 60)
        }
        out.vx = ux * vh; out.vy = vy; out.vz = uz * vh; out.spin = spin
        return out
    }

    static func plan(fromX: Double, fromY: Double, fromZ: Double,
                     toX: Double, toZ: Double, style: String, power: Double) -> Launch {
        let st = styles[style] ?? styles["drive"]!
        let want = st.clear + Court.ballR
        var time = st.time
        var best = Launch()
        for i in 0..<5 {
            let v = solve(fromX: fromX, fromY: fromY, fromZ: fromZ,
                          toX: toX, toY: Court.ballR, toZ: toZ, time: time, spin: st.spin)
            best = v
            let sp = (v.vx * v.vx + v.vy * v.vy + v.vz * v.vz).squareRoot()
            if v.crossed && v.clear >= want && sp <= maxSpeed { break }
            if i < 4 { time *= 1.16 }
        }
        let cap = maxSpeed * st.power * (0.55 + 0.45 * power)
        let sp = (best.vx * best.vx + best.vy * best.vy + best.vz * best.vz).squareRoot()
        if sp > cap {
            let k = cap / sp
            best.vx *= k; best.vy *= k; best.vz *= k
        }
        best.style = style
        return best
    }
}
