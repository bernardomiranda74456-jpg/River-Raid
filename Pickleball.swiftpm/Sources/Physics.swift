import Foundation

struct Ball {
    var x = 0.0, y = 0.0, z = 0.0
    var vx = 0.0, vy = 0.0, vz = 0.0
    var spin = 0.0
    var live = false
    var resting = false

    var speed: Double { (vx * vx + vy * vy + vz * vz).squareRoot() }
}

struct BallEvent {
    var bounce = false
    var net = false
    var netTape = false
    var bx = 0.0, bz = 0.0
    var impact = 0.0
}

struct TraceSample {
    var x = 0.0, y = 0.0, z = 0.0, t = 0.0
    var bounced = false
}

/// Flight of a hollow plastic ball: gravity, quadratic drag, a light Magnus
/// term, court bounce and the net.
enum Physics {
    static let g = 32.174
    static let drag = 0.0134
    static let magnus = 0.0060
    static let spinDecay = 0.55
    static let restitution = 0.58
    static let friction = 0.76

    static func step(_ b: inout Ball, _ dt: Double, _ ev: inout BallEvent) {
        let v = b.speed
        let k = drag * v
        let ax = -k * b.vx
        let ay = -k * b.vy - g - magnus * b.spin * v
        let az = -k * b.vz

        let px = b.x, py = b.y, pz = b.z
        b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt
        b.spin -= b.spin * spinDecay * dt

        // net
        if pz != b.z && sgn(pz) != sgn(b.z) {
            let t = abs(pz) / abs(pz - b.z)
            let cx = px + (b.x - px) * t
            let cy = py + (b.y - py) * t
            if abs(cx) <= Court.netHalfW {
                let top = Court.netHeight(at: cx)
                if cy < top + Court.ballR {
                    let tape = cy > top - 0.25
                    b.x = cx; b.y = cy; b.z = sgn(pz) * 0.02
                    if tape {
                        b.vz *= 0.22; b.vy = b.vy * 0.3 + 0.4; b.vx *= 0.5
                    } else {
                        b.vz *= -0.16; b.vy = b.vy * 0.28 - 0.6; b.vx *= 0.45
                    }
                    b.spin *= 0.2
                    ev.net = true
                    ev.netTape = tape
                }
            }
        }

        // court
        if b.y <= Court.ballR && b.vy < 0 {
            let t = (py - Court.ballR) / max(1e-6, py - b.y)
            let bx = px + (b.x - px) * t
            let bz = pz + (b.z - pz) * t
            b.x = bx; b.z = bz; b.y = Court.ballR
            let impact = -b.vy
            b.vy = impact * restitution
            let spinKick = 1 + clampD(b.spin * 0.05, -0.35, 0.35)
            b.vx *= friction * spinKick
            b.vz *= friction * spinKick
            b.spin *= 0.45
            ev.bounce = true; ev.bx = bx; ev.bz = bz; ev.impact = impact
            if impact < 1.6 && (b.vx * b.vx + b.vz * b.vz).squareRoot() < 2.2 {
                b.resting = true; b.vy = 0
            }
        }
    }

    static func trace(_ ball: Ball, maxT: Double = 2.4, dt: Double = 1.0 / 120.0) -> [TraceSample] {
        var b = ball
        var out: [TraceSample] = []
        var t = 0.0
        while t < maxT {
            var ev = BallEvent()
            step(&b, dt, &ev)
            t += dt
            out.append(TraceSample(x: b.x, y: b.y, z: b.z, t: t, bounced: ev.bounce))
            if b.resting { break }
        }
        return out
    }
}
