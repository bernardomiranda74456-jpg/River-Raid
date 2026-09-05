import SpriteKit
import UIKit

/// Pinhole camera behind the baseline. Fixed position, so the court, net and
/// stadium can be built once and only the actors move each frame.
struct Camera {
    static let camY = 20.0
    static let camZ = -45.0

    let side: Int
    let sinP: Double
    let cosP: Double
    let focal: Double
    let cx: Double
    let cyScreen: Double
    let height: Double
    let horizonY: Double

    init(size: CGSize, side: Int) {
        let pitch = atan2(Camera.camY - 2.0, 8.0 - Camera.camZ)
        let s = sin(pitch), c = cos(pitch)
        func czOf(_ z: Double) -> Double { Camera.camY * s + (z - Camera.camZ) * c }
        func vOf(_ z: Double) -> Double { -((-Camera.camY) * c + (z - Camera.camZ) * s) / czOf(z) }

        let w = Double(size.width), h = Double(size.height)
        let portrait = h > w * 1.2
        let halfNear = Court.halfW / czOf(-18)
        let span = vOf(-23.5) - vOf(22)
        let f = min((portrait ? 1.25 : 1.45) * w / (2 * halfNear), 0.74 * h / span)

        self.side = side
        sinP = s; cosP = c; focal = f
        cx = w / 2
        cyScreen = h * 0.98 - f * vOf(-23.5)
        height = h
        horizonY = cyScreen - f * (s / c)
    }

    /// Returns the point in SpriteKit coordinates plus pixels-per-foot at that depth.
    func project(_ xIn: Double, _ y: Double, _ zIn: Double) -> (point: CGPoint, scale: Double) {
        var x = xIn, z = zIn
        if side == 1 { x = -x; z = -z }
        let dy = y - Camera.camY
        let dz = z - Camera.camZ
        let cz = -dy * sinP + dz * cosP
        let cyc = dy * cosP + dz * sinP
        let s = focal / max(0.8, cz)
        let sy = cyScreen - cyc * s
        return (CGPoint(x: cx + x * s, y: height - sy), s)
    }
}

enum Palette {
    static let surround = UIColor(red: 0.06, green: 0.36, blue: 0.29, alpha: 1)
    static let court = UIColor(red: 0.17, green: 0.50, blue: 0.74, alpha: 1)
    static let kitchen = UIColor(red: 0.10, green: 0.36, blue: 0.56, alpha: 1)
    static let line = UIColor(white: 0.96, alpha: 1)
    static let ball = UIColor(red: 0.85, green: 1.0, blue: 0.24, alpha: 1)
    static let skyTop = UIColor(red: 0.06, green: 0.11, blue: 0.20, alpha: 1)
    static let skyBottom = UIColor(red: 0.22, green: 0.44, blue: 0.55, alpha: 1)
    static let shirt: [UIColor] = [
        UIColor(red: 1.0, green: 0.82, blue: 0.29, alpha: 1),
        UIColor(red: 1.0, green: 0.37, blue: 0.43, alpha: 1),
    ]
    static let shorts = UIColor(red: 0.09, green: 0.13, blue: 0.19, alpha: 1)
    static let skin = UIColor(red: 0.79, green: 0.54, blue: 0.35, alpha: 1)
}

final class GameScene: SKScene {
    let model: GameModel
    let side: Int
    let isPrimary: Bool
    private var cam: Camera!
    private var lastTime: TimeInterval = 0

    private let staticLayer = SKNode()
    private let actorLayer = SKNode()
    private let hudLayer = SKNode()
    private var playerNodes: [SKNode] = []
    private var armNodes: [SKNode] = []
    private var shadowNodes: [SKShapeNode] = []
    private var ballNode = SKShapeNode()
    private var ballShadow = SKShapeNode()
    private var markerNode = SKShapeNode()
    private var scoreLabel = SKLabelNode()
    private var serveLabel = SKLabelNode()
    private var bannerLabel = SKLabelNode()
    private var bannerSub = SKLabelNode()
    private var hintLabel = SKLabelNode()
    private let refScale = 24.0

    private struct TouchState {
        var slot: String
        var x: Double
        var y: Double
        var dx = 0.0
        var dy = 0.0
        var mover: Bool
        var samples: [(t: TimeInterval, x: Double, y: Double)] = []
        var lockUntil: TimeInterval = 0
    }
    private var touches: [ObjectIdentifier: TouchState] = [:]

    init(size: CGSize, side: Int, model: GameModel, isPrimary: Bool) {
        self.model = model
        self.side = side
        self.isPrimary = isPrimary
        super.init(size: size)
        scaleMode = .resizeFill
        backgroundColor = Palette.skyTop
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func didMove(to view: SKView) {
        isUserInteractionEnabled = true
        addChild(staticLayer)
        addChild(actorLayer)
        addChild(hudLayer)
        rebuild()
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        if staticLayer.parent != nil { rebuild() }
    }

    // ── static scenery ─────────────────────────────────────────────────────
    private func rebuild() {
        cam = Camera(size: size, side: side)
        staticLayer.removeAllChildren()
        actorLayer.removeAllChildren()
        hudLayer.removeAllChildren()
        playerNodes.removeAll(); armNodes.removeAll(); shadowNodes.removeAll()

        buildSky()
        buildStands()
        staticLayer.addChild(fill([(-60, -42), (60, -42), (60, 34), (-60, 34)], Palette.surround))
        buildFence()
        buildCourt()
        buildNet()
        buildActors()
        buildHud()
    }

    private func p(_ x: Double, _ y: Double, _ z: Double) -> CGPoint { cam.project(x, y, z).point }

    private func fill(_ pts: [(Double, Double)], _ color: UIColor) -> SKShapeNode {
        let path = CGMutablePath()
        for (i, q) in pts.enumerated() {
            let sp = p(q.0, 0, q.1)
            if i == 0 { path.move(to: sp) } else { path.addLine(to: sp) }
        }
        path.closeSubpath()
        let n = SKShapeNode(path: path)
        n.fillColor = color
        n.strokeColor = .clear
        n.lineWidth = 0
        return n
    }

    private func fill3(_ pts: [(Double, Double, Double)], _ color: UIColor) -> SKShapeNode {
        let path = CGMutablePath()
        for (i, q) in pts.enumerated() {
            let sp = p(q.0, q.1, q.2)
            if i == 0 { path.move(to: sp) } else { path.addLine(to: sp) }
        }
        path.closeSubpath()
        let n = SKShapeNode(path: path)
        n.fillColor = color
        n.strokeColor = .clear
        n.lineWidth = 0
        return n
    }

    private func courtLine(_ x1: Double, _ z1: Double, _ x2: Double, _ z2: Double) {
        let hw = Court.lineW / 2
        let dx = x2 - x1, dz = z2 - z1
        let len = max(0.001, (dx * dx + dz * dz).squareRoot())
        let nx = (-dz / len) * hw, nz = (dx / len) * hw
        staticLayer.addChild(fill([(x1 + nx, z1 + nz), (x2 + nx, z2 + nz),
                                   (x2 - nx, z2 - nz), (x1 - nx, z1 - nz)], Palette.line))
    }

    private func buildSky() {
        let tex = GameScene.gradientTexture(size: size, top: Palette.skyTop, bottom: Palette.skyBottom)
        let sky = SKSpriteNode(texture: tex, size: size)
        sky.position = CGPoint(x: size.width / 2, y: size.height / 2)
        sky.zPosition = -10
        staticLayer.addChild(sky)
    }

    private func buildStands() {
        let Z = 41.0, X = 52.0, H = 21.0
        staticLayer.addChild(fill3([(-X, 0, Z), (-X, H, Z), (X, H, Z), (X, 0, Z)],
                                   UIColor(red: 0.08, green: 0.15, blue: 0.21, alpha: 1)))
        let rows = 9
        for i in 0..<rows {
            let y0 = 2 + (Double(i) * (H - 3)) / Double(rows)
            let y1 = y0 + (H - 3) / Double(rows) - 0.45
            let c = i % 2 == 0 ? UIColor(red: 0.09, green: 0.16, blue: 0.23, alpha: 1)
                               : UIColor(red: 0.11, green: 0.18, blue: 0.26, alpha: 1)
            staticLayer.addChild(fill3([(-X, y0, Z), (-X, y1, Z), (X, y1, Z), (X, y0, Z)], c))
            var k = -26.0
            while k <= 26 {
                let q = cam.project(k + Double(i % 2) * 0.7, y0 + 0.55, Z)
                let r = max(0.8, q.scale * 0.36)
                let dot = SKSpriteNode(color: i % 3 == 0 ? UIColor(white: 0.85, alpha: 0.20)
                                                        : UIColor(red: 1, green: 0.82, blue: 0.47, alpha: 0.16),
                                       size: CGSize(width: r, height: r))
                dot.position = q.point
                staticLayer.addChild(dot)
                k += 1.6
            }
        }
        for px in [-23.0, 23.0] {
            let base = cam.project(px, 0, Z - 4), top = cam.project(px, 32, Z - 4)
            let path = CGMutablePath()
            path.move(to: base.point); path.addLine(to: top.point)
            let pole = SKShapeNode(path: path)
            pole.strokeColor = UIColor(red: 0.10, green: 0.16, blue: 0.23, alpha: 1)
            pole.lineWidth = CGFloat(max(2, base.scale * 0.5))
            staticLayer.addChild(pole)
            let lamp = cam.project(px, 33.5, Z - 4)
            let glow = SKShapeNode(circleOfRadius: CGFloat(max(6, lamp.scale * 4.5)))
            glow.position = lamp.point
            glow.fillColor = UIColor(red: 1, green: 0.96, blue: 0.84, alpha: 0.18)
            glow.strokeColor = .clear
            glow.blendMode = .add
            staticLayer.addChild(glow)
        }
    }

    private func buildFence() {
        let Z = 34.0, H = 10.0, X = 26.0
        for sx in [-X, X] {
            staticLayer.addChild(fill3([(sx, 0, -30), (sx, H, -30), (sx, H, Z), (sx, 0, Z)],
                                       UIColor(red: 0.06, green: 0.13, blue: 0.17, alpha: 0.55)))
        }
        staticLayer.addChild(fill3([(-X, 0, Z), (-X, H, Z), (X, H, Z), (X, 0, Z)],
                                   UIColor(red: 0.05, green: 0.11, blue: 0.15, alpha: 0.72)))
        let mesh = CGMutablePath()
        var i = -X
        while i <= X {
            mesh.move(to: p(i, 0, Z)); mesh.addLine(to: p(i, H, Z))
            i += 3
        }
        var h = 1.0
        while h < H {
            mesh.move(to: p(-X, h, Z)); mesh.addLine(to: p(X, h, Z))
            h += 2
        }
        let meshNode = SKShapeNode(path: mesh)
        meshNode.strokeColor = UIColor(white: 1, alpha: 0.07)
        meshNode.lineWidth = 1
        staticLayer.addChild(meshNode)
        staticLayer.addChild(fill3([(-X, 2.2, Z - 0.05), (-X, 4.6, Z - 0.05),
                                    (X, 4.6, Z - 0.05), (X, 2.2, Z - 0.05)],
                                   UIColor(red: 0.08, green: 0.35, blue: 0.47, alpha: 0.85)))
        let banner = SKLabelNode(text: "P I C K L E B A L L")
        let anchor = cam.project(0, 3.4, Z - 0.06)
        banner.position = anchor.point
        banner.fontName = "AvenirNext-Bold"
        banner.fontSize = CGFloat(max(7, anchor.scale * 0.9))
        banner.fontColor = UIColor(white: 1, alpha: 0.5)
        banner.verticalAlignmentMode = .center
        staticLayer.addChild(banner)
    }

    private func buildCourt() {
        let W = Court.halfW, L = Court.halfL, K = Court.kitchen
        staticLayer.addChild(fill([(-W, -L), (W, -L), (W, L), (-W, L)], Palette.court))
        staticLayer.addChild(fill([(-W, -K), (W, -K), (W, 0), (-W, 0)], Palette.kitchen))
        staticLayer.addChild(fill([(-W, 0), (W, 0), (W, K), (-W, K)], Palette.kitchen))
        courtLine(-W, -L, W, -L); courtLine(-W, L, W, L)
        courtLine(-W, -L, -W, L); courtLine(W, -L, W, L)
        courtLine(-W, -K, W, -K); courtLine(-W, K, W, K)
        courtLine(0, -L, 0, -K); courtLine(0, K, 0, L)
    }

    private func buildNet() {
        let N = Court.netHalfW
        let steps = 28
        let cloth = CGMutablePath()
        for i in 0...steps {
            let x = -N + (2 * N * Double(i)) / Double(steps)
            let sp = p(x, Court.netHeight(at: x), 0)
            if i == 0 { cloth.move(to: sp) } else { cloth.addLine(to: sp) }
        }
        for i in stride(from: steps, through: 0, by: -1) {
            let x = -N + (2 * N * Double(i)) / Double(steps)
            cloth.addLine(to: p(x, 0, 0))
        }
        cloth.closeSubpath()
        let net = SKShapeNode(path: cloth)
        net.fillColor = UIColor(red: 0.04, green: 0.07, blue: 0.11, alpha: 0.72)
        net.strokeColor = .clear
        net.zPosition = 5
        staticLayer.addChild(net)

        let mesh = CGMutablePath()
        for i in 0...22 {
            let x = -N + (2 * N * Double(i)) / 22.0
            mesh.move(to: p(x, Court.netHeight(at: x), 0))
            mesh.addLine(to: p(x, 0, 0))
        }
        for k in 1...5 {
            for i in 0...steps {
                let x = -N + (2 * N * Double(i)) / Double(steps)
                let sp = p(x, Court.netHeight(at: x) * Double(k) / 6, 0)
                if i == 0 { mesh.move(to: sp) } else { mesh.addLine(to: sp) }
            }
        }
        let meshNode = SKShapeNode(path: mesh)
        meshNode.strokeColor = UIColor(white: 1, alpha: 0.13)
        meshNode.lineWidth = 1
        meshNode.zPosition = 5
        staticLayer.addChild(meshNode)

        let tape = CGMutablePath()
        for i in 0...steps {
            let x = -N + (2 * N * Double(i)) / Double(steps)
            let sp = p(x, Court.netHeight(at: x), 0)
            if i == 0 { tape.move(to: sp) } else { tape.addLine(to: sp) }
        }
        let tapeNode = SKShapeNode(path: tape)
        tapeNode.strokeColor = Palette.line
        tapeNode.lineWidth = CGFloat(max(2, cam.project(0, 0, 0).scale * 0.11))
        tapeNode.zPosition = 5
        staticLayer.addChild(tapeNode)

        for px in [-N, N] {
            let post = CGMutablePath()
            post.move(to: p(px, 0, 0)); post.addLine(to: p(px, Court.netHPost + 0.15, 0))
            let node = SKShapeNode(path: post)
            node.strokeColor = UIColor(red: 0.13, green: 0.19, blue: 0.25, alpha: 1)
            node.lineWidth = CGFloat(max(2, cam.project(px, 0, 0).scale * 0.22))
            node.zPosition = 5
            staticLayer.addChild(node)
        }
    }

    // ── actors ─────────────────────────────────────────────────────────────
    private func buildActors() {
        guard let m = model.match else { return }
        for pl in m.players {
            let shadow = SKShapeNode(ellipseOf: CGSize(width: 2, height: 0.68))
            shadow.fillColor = UIColor(white: 0, alpha: 0.28)
            shadow.strokeColor = .clear
            shadow.zPosition = 1
            actorLayer.addChild(shadow)
            shadowNodes.append(shadow)

            let node = SKNode()
            node.zPosition = pl.team == side ? 8 : 3
            let R = refScale
            let color = Palette.shirt[pl.team]

            let legs = CGMutablePath()
            legs.move(to: CGPoint(x: -0.16 * R, y: 1.85 * R)); legs.addLine(to: CGPoint(x: -0.22 * R, y: 0))
            legs.move(to: CGPoint(x: 0.16 * R, y: 1.85 * R)); legs.addLine(to: CGPoint(x: 0.22 * R, y: 0))
            let legNode = SKShapeNode(path: legs)
            legNode.strokeColor = Palette.shorts
            legNode.lineWidth = CGFloat(0.2 * R)
            legNode.lineCap = .round
            node.addChild(legNode)

            let torso = CGMutablePath()
            torso.move(to: CGPoint(x: -0.31 * R, y: 1.85 * R))
            torso.addLine(to: CGPoint(x: 0.31 * R, y: 1.85 * R))
            torso.addLine(to: CGPoint(x: 0.38 * R, y: 3.55 * R))
            torso.addLine(to: CGPoint(x: -0.38 * R, y: 3.55 * R))
            torso.closeSubpath()
            let torsoNode = SKShapeNode(path: torso)
            torsoNode.fillColor = color
            torsoNode.strokeColor = .clear
            node.addChild(torsoNode)

            let neck = SKSpriteNode(color: Palette.skin, size: CGSize(width: 0.22 * R, height: 0.3 * R))
            neck.position = CGPoint(x: 0, y: 3.62 * R)
            node.addChild(neck)

            let head = SKShapeNode(circleOfRadius: CGFloat(0.40 * R))
            head.position = CGPoint(x: 0, y: 3.97 * R)
            head.fillColor = Palette.skin
            head.strokeColor = .clear
            node.addChild(head)

            let arm = SKNode()
            arm.position = CGPoint(x: 0.28 * R, y: 3.3 * R)
            let armPath = CGMutablePath()
            armPath.move(to: .zero); armPath.addLine(to: CGPoint(x: 0.85 * R, y: 0.2 * R))
            let armNode = SKShapeNode(path: armPath)
            armNode.strokeColor = Palette.skin
            armNode.lineWidth = CGFloat(0.14 * R)
            armNode.lineCap = .round
            arm.addChild(armNode)
            let paddle = SKShapeNode(ellipseOf: CGSize(width: 0.68 * R, height: 0.88 * R))
            paddle.position = CGPoint(x: 1.05 * R, y: 0.3 * R)
            paddle.fillColor = UIColor(red: 0.11, green: 0.16, blue: 0.23, alpha: 1)
            paddle.strokeColor = UIColor(red: 0.24, green: 0.36, blue: 0.48, alpha: 1)
            paddle.lineWidth = 2
            arm.addChild(paddle)
            node.addChild(arm)
            armNodes.append(arm)

            actorLayer.addChild(node)
            playerNodes.append(node)
        }

        ballShadow = SKShapeNode(ellipseOf: CGSize(width: 6, height: 2.4))
        ballShadow.fillColor = UIColor(white: 0, alpha: 0.3)
        ballShadow.strokeColor = .clear
        ballShadow.zPosition = 2
        actorLayer.addChild(ballShadow)

        markerNode = SKShapeNode(ellipseOf: CGSize(width: 30, height: 11))
        markerNode.strokeColor = UIColor(white: 1, alpha: 0.7)
        markerNode.fillColor = .clear
        markerNode.lineWidth = 2
        markerNode.zPosition = 2
        actorLayer.addChild(markerNode)

        ballNode = SKShapeNode(circleOfRadius: 6)
        ballNode.fillColor = Palette.ball
        ballNode.strokeColor = UIColor(white: 0, alpha: 0.25)
        ballNode.zPosition = 12
        actorLayer.addChild(ballNode)
    }

    private func buildHud() {
        scoreLabel = SKLabelNode(text: "0 - 0")
        scoreLabel.fontName = "AvenirNext-Bold"
        scoreLabel.fontSize = 26
        scoreLabel.fontColor = .white
        scoreLabel.position = CGPoint(x: size.width / 2, y: size.height - 46)
        scoreLabel.zPosition = 20
        hudLayer.addChild(scoreLabel)

        serveLabel = SKLabelNode(text: "")
        serveLabel.fontName = "AvenirNext-DemiBold"
        serveLabel.fontSize = 11
        serveLabel.position = CGPoint(x: size.width / 2, y: size.height - 62)
        serveLabel.zPosition = 20
        hudLayer.addChild(serveLabel)

        bannerLabel = SKLabelNode(text: "")
        bannerLabel.fontName = "AvenirNext-Bold"
        bannerLabel.fontSize = 24
        bannerLabel.position = CGPoint(x: size.width / 2, y: size.height * 0.52)
        bannerLabel.zPosition = 20
        hudLayer.addChild(bannerLabel)

        bannerSub = SKLabelNode(text: "")
        bannerSub.fontName = "AvenirNext-DemiBold"
        bannerSub.fontSize = 13
        bannerSub.fontColor = UIColor(white: 1, alpha: 0.75)
        bannerSub.position = CGPoint(x: size.width / 2, y: size.height * 0.52 - 22)
        bannerSub.zPosition = 20
        hudLayer.addChild(bannerSub)

        hintLabel = SKLabelNode(text: "")
        hintLabel.fontName = "AvenirNext-DemiBold"
        hintLabel.fontSize = 13
        hintLabel.fontColor = UIColor(red: 1, green: 0.88, blue: 0.47, alpha: 1)
        hintLabel.position = CGPoint(x: size.width / 2, y: 26)
        hintLabel.zPosition = 20
        hudLayer.addChild(hintLabel)
    }

    // ── frame ──────────────────────────────────────────────────────────────
    private var ownedSlots: [String] {
        guard let m = model.match else { return ["p1"] }
        if m.versus { return [side == 1 ? "p2" : "p1"] }
        return ["p1", "p2"]
    }

    override func update(_ currentTime: TimeInterval) {
        let dt = lastTime == 0 ? 1.0 / 60.0 : min(0.05, currentTime - lastTime)
        lastTime = currentTime
        clearMovement()
        drainMovement(dt: dt)
        if isPrimary { model.step(dt: dt) }
        guard let m = model.match else { return }
        if playerNodes.count != m.players.count { rebuild(); return }
        sync(m)
    }

    private func sync(_ m: Match) {
        for (i, pl) in m.players.enumerated() {
            let base = cam.project(pl.x, 0, pl.z)
            let node = playerNodes[i]
            node.position = base.point
            node.setScale(CGFloat(base.scale / refScale))
            node.zPosition = pl.team == side ? 8 : 3
            let facing: Double = side == pl.team ? 1 : -1
            node.xScale = CGFloat(base.scale / refScale) * CGFloat(facing)
            let swing = max(0, pl.swingT) / 0.28
            armNodes[i].zRotation = CGFloat(-0.4 + swing * 1.7 * pl.swingDir)

            let sh = shadowNodes[i]
            sh.position = base.point
            sh.setScale(CGFloat(base.scale / 24.0))
        }

        let b = m.ball
        let bp = cam.project(b.x, b.y, b.z)
        ballNode.position = bp.point
        let r = max(3.0, bp.scale * Court.ballR * 1.5)
        ballNode.path = CGPath(ellipseIn: CGRect(x: -r, y: -r, width: r * 2, height: r * 2), transform: nil)
        ballNode.isHidden = !(b.live || m.state == "ready")

        let shp = cam.project(b.x, 0.01, b.z)
        ballShadow.position = shp.point
        ballShadow.setScale(CGFloat(max(0.3, shp.scale / 24.0)))
        ballShadow.alpha = CGFloat(max(0.08, 0.34 - b.y * 0.03))
        ballShadow.isHidden = ballNode.isHidden

        if let land = m.landing, b.live {
            let mp = cam.project(land.x, 0.02, land.z)
            markerNode.position = mp.point
            markerNode.setScale(CGFloat(mp.scale / 24.0))
            markerNode.strokeColor = Court.inBounds(land.x, land.z)
                ? UIColor(white: 1, alpha: 0.7)
                : UIColor(red: 1, green: 0.47, blue: 0.43, alpha: 0.85)
            markerNode.isHidden = false
        } else {
            markerNode.isHidden = true
        }

        scoreLabel.text = m.scoreText
        serveLabel.text = "SACA  " + (m.servingTeam == 0 ? "TIME 1" : "TIME 2")
        serveLabel.fontColor = Palette.shirt[m.servingTeam]
        if let banner = m.banner {
            bannerLabel.text = banner.label
            bannerLabel.fontColor = Palette.shirt[banner.team]
            bannerSub.text = banner.sideOut ? "Troca de saque" : (banner.team == 0 ? "Ponto Time 1" : "Ponto Time 2")
        } else {
            bannerLabel.text = ""
            bannerSub.text = ""
        }
        if m.state == "ready", let me = mySlotPlayer(m), me.id == m.serverIdx {
            hintLabel.text = m.hint ?? "Deslize para sacar"
        } else {
            hintLabel.text = m.hint ?? ""
        }
    }

    private func mySlotPlayer(_ m: Match) -> Player? {
        if m.versus { return m.players[side == 0 ? m.slotP1 : (m.slotP2 ?? m.slotP1)] }
        return m.players[m.slotP1]
    }

    // ── touch ──────────────────────────────────────────────────────────────
    private func slotFor(_ point: CGPoint) -> String {
        guard let m = model.match else { return "p1" }
        if m.versus { return side == 1 ? "p2" : "p1" }
        if m.cfg.humans == 2 {
            let left = point.x < size.width / 2
            let p1 = m.players[m.slotP1], p2 = m.players[m.slotP2 ?? m.slotP1]
            let p1IsLeft = p1.x < p2.x
            return left == p1IsLeft ? "p1" : "p2"
        }
        return "p1"
    }

    override func touchesBegan(_ set: Set<UITouch>, with event: UIEvent?) {
        for t in set {
            let loc = t.location(in: self)
            let slot = slotFor(loc)
            let hasMover = touches.values.contains { $0.slot == slot && $0.mover }
            var st = TouchState(slot: slot, x: Double(loc.x), y: Double(loc.y), mover: !hasMover)
            st.samples = [(t.timestamp, Double(loc.x), Double(loc.y))]
            touches[ObjectIdentifier(t)] = st
        }
    }

    override func touchesMoved(_ set: Set<UITouch>, with event: UIEvent?) {
        for t in set {
            let key = ObjectIdentifier(t)
            guard var st = touches[key] else { continue }
            let loc = t.location(in: self)
            st.dx += Double(loc.x) - st.x
            st.dy += Double(loc.y) - st.y
            st.x = Double(loc.x); st.y = Double(loc.y)
            st.samples.append((t.timestamp, st.x, st.y))
            while st.samples.count > 2 && t.timestamp - st.samples[0].t > 0.15 { st.samples.removeFirst() }
            detectSwipe(&st, now: t.timestamp, release: false)
            touches[key] = st
        }
    }

    override func touchesEnded(_ set: Set<UITouch>, with event: UIEvent?) {
        for t in set {
            let key = ObjectIdentifier(t)
            if var st = touches[key] {
                detectSwipe(&st, now: t.timestamp, release: true)
            }
            touches[key] = nil
        }
    }

    override func touchesCancelled(_ set: Set<UITouch>, with event: UIEvent?) {
        for t in set { touches[ObjectIdentifier(t)] = nil }
    }

    private func detectSwipe(_ st: inout TouchState, now: TimeInterval, release: Bool) {
        if now < st.lockUntil { return }
        guard let s0 = st.samples.first else { return }
        let dt = max(0.016, now - s0.t)
        let dx = st.x - s0.x, dy = st.y - s0.y
        let len = (dx * dx + dy * dy).squareRoot()
        let H = Double(size.height)
        let speed = len / dt / H
        if dy < H * 0.055 { return }                       // must travel toward the net
        if speed < 0.75 && !(release && len > H * 0.16) { return }

        var sw = SwipeInput()
        sw.long = len > H * 0.19
        sw.fast = speed > 1.75
        sw.lateral = clampD(dx / max(abs(dy), 1) / 1.4, -1, 1)
        sw.depth = clampD((len / H - 0.05) / 0.30, 0, 1)
        sw.power = clampD(speed / 2.6, 0.25, 1)
        model.inputs[st.slot]?.swipe = sw
        st.lockUntil = now + 0.26
        st.dx = 0; st.dy = 0
        st.samples = [(now, st.x, st.y)]
    }

    /// Called by the model each step: turn accumulated drag into a move vector.
    func drainMovement(dt: Double) {
        let full = Double(size.height) * 0.5
        for key in Array(touches.keys) {
            guard var st = touches[key] else { continue }
            if st.mover {
                model.inputs[st.slot]?.mx = clampD(st.dx / dt / full, -1, 1)
                model.inputs[st.slot]?.mz = clampD(st.dy / dt / full, -1, 1)
            }
            st.dx = 0; st.dy = 0
            touches[key] = st
        }
    }

    func clearMovement() {
        for slot in ownedSlots {
            model.inputs[slot]?.mx = 0
            model.inputs[slot]?.mz = 0
        }
    }

    static func gradientTexture(size: CGSize, top: UIColor, bottom: UIColor) -> SKTexture {
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { ctx in
            let colors = [top.cgColor, bottom.cgColor] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                         colors: colors, locations: [0, 1]) {
                ctx.cgContext.drawLinearGradient(gradient,
                                                 start: CGPoint(x: 0, y: 0),
                                                 end: CGPoint(x: 0, y: size.height),
                                                 options: [])
            }
        }
        return SKTexture(image: image)
    }
}
