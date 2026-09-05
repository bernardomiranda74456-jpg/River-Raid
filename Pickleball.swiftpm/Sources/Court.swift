import Foundation

/// Court geometry in feet. Origin is the centre of the net.
/// x runs across the court, y is height, z runs along it: team 0 owns z < 0.
enum Court {
    static let halfW: Double = 10          // 20 ft wide
    static let halfL: Double = 22          // 44 ft long
    static let kitchen: Double = 7         // non-volley zone
    static let netHalfW: Double = 11
    static let netHCenter: Double = 2.833  // 34 in
    static let netHPost: Double = 3.0      // 36 in
    static let ballR: Double = 0.121
    static let lineW: Double = 0.166
    static let outTol: Double = 0.06

    static func netHeight(at x: Double) -> Double {
        let t = min(1, abs(x) / netHalfW)
        return netHCenter + (netHPost - netHCenter) * t * t
    }

    static func teamSign(_ team: Int) -> Double { team == 0 ? -1 : 1 }
    static func side(of z: Double) -> Int { z < 0 ? 0 : 1 }
    /// Facing the net, team 0's right hand is +x and team 1's is -x.
    static func rightSign(_ team: Int) -> Double { team == 0 ? 1 : -1 }

    static func inBounds(_ x: Double, _ z: Double) -> Bool {
        abs(x) <= halfW + outTol && abs(z) <= halfL + outTol
    }

    static func inKitchen(_ x: Double, _ z: Double, team: Int? = nil) -> Bool {
        if let t = team, side(of: z) != t { return false }
        return abs(x) <= halfW && abs(z) <= kitchen
    }

    static func inServiceBox(_ x: Double, _ z: Double, team: Int, xSign: Double) -> Bool {
        if side(of: z) != team { return false }
        let az = abs(z), ax = abs(x)
        if az <= kitchen || az > halfL + outTol { return false }
        if ax > halfW + outTol { return false }
        return sgn(x) == xSign || ax < 0.15
    }

    static func clampToPlayArea(x: inout Double, z: inout Double, team: Int) {
        let s = teamSign(team)
        x = max(-halfW - 5, min(halfW + 5, x))
        if s < 0 { z = max(-halfL - 7, min(-0.7, z)) }
        else { z = min(halfL + 7, max(0.7, z)) }
    }
}

func sgn(_ v: Double) -> Double { v > 0 ? 1 : (v < 0 ? -1 : 0) }
func clampD(_ v: Double, _ a: Double, _ b: Double) -> Double { max(a, min(b, v)) }
func rnd(_ a: Double, _ b: Double) -> Double { a + Double.random(in: 0...1) * (b - a) }
