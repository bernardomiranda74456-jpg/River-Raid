import SpriteKit

// MARK: - Supporting types

private enum GameState { case title, playing, over }

private enum EnemyKind {
    case heli, jet, ship, fuel

    var score: Int {
        switch self {
        case .heli: return 150
        case .jet:  return 100
        case .ship: return 30
        case .fuel: return 80
        }
    }
    var halfW: CGFloat { self == .ship ? 24 : 14 }
    var halfH: CGFloat { self == .ship ? 10 : 22 }
}

private struct Seg {
    let i: Int
    let lx: CGFloat
    let rx: CGFloat
}

private struct EnemyRec {
    let id: UUID
    let kind: EnemyKind
    var wx: CGFloat
    let wy: CGFloat
    var dx: CGFloat
    var alive: Bool = true
}

private struct BulletRec {
    var wx: CGFloat
    var wy: CGFloat
    var alive: Bool = true
    weak var node: SKSpriteNode?
}

// MARK: - GameScene

final class GameScene: SKScene {

    // MARK: Layers
    private let waterBg   = SKSpriteNode()
    private let bankLayer = SKNode()
    private let objLayer  = SKNode()
    private let plrLayer  = SKNode()
    private let hudLayer  = SKNode()
    private let ctrlLayer = SKNode()
    private let lBank     = SKShapeNode()
    private let rBank     = SKShapeNode()

    // MARK: Player
    private var plrNode  = SKNode()
    private var flame    = SKShapeNode()
    private var plrX:    CGFloat = 0
    private var plrScrY: CGFloat { size.height * 0.22 }
    private var plrWY:   CGFloat { worldOff + plrScrY }

    // MARK: HUD
    private var scoreLbl  = SKLabelNode()
    private var hiLbl     = SKLabelNode()
    private var livesCtr  = SKNode()
    private var fuelBg    = SKSpriteNode()
    private var fuelFill  = SKSpriteNode()

    // MARK: Buttons
    private struct BtnDef { var cx, cy, w, h: CGFloat; var tag: String }
    private var btnDefs  = [BtnDef]()
    private var touchMap = [ObjectIdentifier: String]()
    private var goLeft   = false
    private var goRight  = false
    private var doShoot  = false

    // MARK: State
    private var gState:    GameState = .title
    private var score      = 0
    private var hiScore    = 0
    private var lives      = 3
    private var fuel:      CGFloat = 100
    private let maxFuel:   CGFloat = 100
    private var worldOff:  CGFloat = 0
    private var invTime:   CGFloat = 0
    private var fireCd:    CGFloat = 0
    private var deathWait: CGFloat = 0
    private var lastT:     TimeInterval = 0
    private var overlay:   SKNode?

    // MARK: River
    private let SEG_H:      CGFloat = 150
    private let SCROLL_SPD: CGFloat = 95
    private let PLAYER_SPD: CGFloat = 230
    private let BULLET_SPD: CGFloat = 550
    private let FIRE_CD:    CGFloat = 0.16
    private let FUEL_DRAIN: CGFloat = 1.1

    private var segs    = [Int: Seg]()
    private var spawned = Set<Int>()

    // MARK: Entities
    private var enemies = [UUID: EnemyRec]()
    private var eNodes  = [UUID: SKNode]()
    private var bullets = [BulletRec]()

    // MARK: - didMove

    override func didMove(to view: SKView) {
        anchorPoint = .zero
        plrX = size.width / 2
        setupLayers()
        setupBanks()
        setupHUD()
        setupControls()
        buildPlayer()
        showTitle()
    }

    // MARK: - Layers

    private func setupLayers() {
        backgroundColor = .black
        waterBg.color       = UIColor(red: 0.10, green: 0.43, blue: 0.85, alpha: 1)
        waterBg.size        = CGSize(width: size.width, height: size.height)
        waterBg.anchorPoint = .zero
        waterBg.zPosition   = -5
        addChild(waterBg)
        bankLayer.zPosition  = 0;  addChild(bankLayer)
        bankLayer.addChild(lBank); bankLayer.addChild(rBank)
        objLayer.zPosition   = 1;  addChild(objLayer)
        plrLayer.zPosition   = 3;  addChild(plrLayer)
        hudLayer.zPosition   = 10; addChild(hudLayer)
        ctrlLayer.zPosition  = 11; addChild(ctrlLayer)
    }

    private func setupBanks() {
        for b in [lBank, rBank] {
            b.fillColor   = UIColor(red: 0.18, green: 0.52, blue: 0.12, alpha: 1)
            b.strokeColor = UIColor(red: 0.12, green: 0.40, blue: 0.08, alpha: 1)
            b.lineWidth   = 2
        }
    }

    // MARK: - Player

    private func buildPlayer() {
        plrNode.removeFromParent()
        plrNode = SKNode()

        let body = SKShapeNode(rectOf: CGSize(width: 22, height: 40), cornerRadius: 4)
        body.fillColor   = UIColor(red: 0.25, green: 0.58, blue: 1.0, alpha: 1)
        body.strokeColor = UIColor(white: 1, alpha: 0.7)
        body.lineWidth   = 1

        var lp: [CGPoint] = [
            CGPoint(x: -11, y: -5), CGPoint(x: -38, y: -12),
            CGPoint(x: -38, y:  5), CGPoint(x: -11, y:  5)
        ]
        let lw = SKShapeNode(points: &lp, count: lp.count)
        lw.fillColor = .cyan; lw.strokeColor = .clear

        var rp: [CGPoint] = [
            CGPoint(x:  11, y: -5), CGPoint(x: 38, y: -12),
            CGPoint(x:  38, y:  5), CGPoint(x: 11, y:  5)
        ]
        let rw = SKShapeNode(points: &rp, count: rp.count)
        rw.fillColor = .cyan; rw.strokeColor = .clear

        var np: [CGPoint] = [CGPoint(x: -7, y: 19), CGPoint(x: 7, y: 19), CGPoint(x: 0, y: 30)]
        let nose = SKShapeNode(points: &np, count: np.count)
        nose.fillColor = UIColor(white: 0.95, alpha: 1); nose.strokeColor = .clear

        let pit = SKShapeNode(rectOf: CGSize(width: 10, height: 12), cornerRadius: 3)
        pit.fillColor   = UIColor(red: 0.1, green: 0.1, blue: 0.45, alpha: 1)
        pit.strokeColor = UIColor(white: 1, alpha: 0.3)
        pit.position    = CGPoint(x: 0, y: 5)

        var fp: [CGPoint] = [CGPoint(x: -6, y: -22), CGPoint(x: 6, y: -22), CGPoint(x: 0, y: -34)]
        flame = SKShapeNode(points: &fp, count: fp.count)
        flame.fillColor = .orange; flame.strokeColor = .clear

        for node in [lw, rw, body, nose, pit, flame] as [SKNode] {
            plrNode.addChild(node)
        }
        plrNode.position = CGPoint(x: plrX, y: plrScrY)
        plrLayer.addChild(plrNode)
    }

    // MARK: - HUD

    private func setupHUD() {
        let top = size.height - 48

        scoreLbl = makeLbl("SCORE 000000", sz: 18, at: CGPoint(x: size.width - 14, y: top))
        scoreLbl.horizontalAlignmentMode = .right
        hudLayer.addChild(scoreLbl)

        hiLbl = makeLbl("HI    000000", sz: 14, at: CGPoint(x: size.width - 14, y: top - 26))
        hiLbl.horizontalAlignmentMode = .right
        hiLbl.fontColor = .yellow
        hudLayer.addChild(hiLbl)

        livesCtr.position = CGPoint(x: 14, y: top)
        hudLayer.addChild(livesCtr)

        let fl = makeLbl("FUEL", sz: 11, at: CGPoint(x: 14, y: 58))
        fl.horizontalAlignmentMode = .left
        fl.fontColor = .lightGray
        hudLayer.addChild(fl)

        fuelBg = SKSpriteNode(color: UIColor(white: 0.25, alpha: 1),
                              size: CGSize(width: 160, height: 14))
        fuelBg.anchorPoint = .zero
        fuelBg.position = CGPoint(x: 14, y: 38)
        hudLayer.addChild(fuelBg)

        fuelFill = SKSpriteNode(color: .green, size: CGSize(width: 160, height: 14))
        fuelFill.anchorPoint = .zero
        fuelFill.position = CGPoint(x: 14, y: 38)
        hudLayer.addChild(fuelFill)
    }

    private func refreshHUD() {
        scoreLbl.text = String(format: "SCORE %06d", score)
        hiLbl.text    = String(format: "HI    %06d", hiScore)

        livesCtr.removeAllChildren()
        for i in 0..<lives {
            var tp: [CGPoint] = [CGPoint(x: 0, y: 10), CGPoint(x: -8, y: -6), CGPoint(x: 8, y: -6)]
            let icon = SKShapeNode(points: &tp, count: tp.count)
            icon.fillColor   = UIColor(red: 0.3, green: 0.6, blue: 1, alpha: 1)
            icon.strokeColor = .white; icon.lineWidth = 1
            icon.position    = CGPoint(x: CGFloat(i) * 26, y: 0)
            livesCtr.addChild(icon)
        }

        let pct = max(0, min(1, fuel / maxFuel))
        fuelFill.size  = CGSize(width: max(1, 160 * pct), height: 14)
        fuelFill.color = pct > 0.3 ? .green : pct > 0.15 ? .yellow : .red
    }

    // MARK: - Controls

    private func setupControls() {
        let bW: CGFloat = 110, bH: CGFloat = 90, y: CGFloat = bH / 2 + 8

        btnDefs = [
            BtnDef(cx: bW * 0.5 + 8,              cy: y, w: bW, h: bH, tag: "L"),
            BtnDef(cx: bW * 1.5 + 18,             cy: y, w: bW, h: bH, tag: "R"),
            BtnDef(cx: size.width - bW * 0.5 - 8, cy: y, w: bW, h: bH, tag: "F"),
        ]

        for (def, icon) in zip(btnDefs, ["◀", "▶", "🔥"]) {
            let bg = SKShapeNode(rectOf: CGSize(width: def.w, height: def.h), cornerRadius: 16)
            bg.fillColor   = UIColor(white: 1, alpha: 0.13)
            bg.strokeColor = UIColor(white: 1, alpha: 0.35)
            bg.lineWidth   = 1.5
            bg.position    = CGPoint(x: def.cx, y: def.cy)
            ctrlLayer.addChild(bg)

            let t = SKLabelNode(text: icon)
            t.fontSize = 34
            t.verticalAlignmentMode   = .center
            t.horizontalAlignmentMode = .center
            t.position = CGPoint(x: def.cx, y: def.cy)
            ctrlLayer.addChild(t)
        }
    }

    // MARK: - River

    private func getSeg(_ i: Int) -> Seg {
        if let s = segs[i] { return s }
        let prev = segs[i - 1]
        let lx: CGFloat
        let rx: CGFloat
        if let p = prev {
            let d  = CGFloat.random(in: -14...14)
            let q  = CGFloat.random(in: -9...9)
            let nl = (p.lx + d + q).clamped(28, size.width * 0.44)
            let nr = (p.rx + d - q).clamped(nl + 110, size.width - 28)
            lx = nl; rx = nr
        } else {
            lx = size.width * 0.20
            rx = size.width * 0.80
        }
        let s = Seg(i: i, lx: lx, rx: rx)
        segs[i] = s
        return s
    }

    private func riverAt(_ wy: CGFloat) -> (lx: CGFloat, rx: CGFloat) {
        let i = Int(floor(wy / SEG_H))
        let t = (wy.truncatingRemainder(dividingBy: SEG_H)) / SEG_H
        let a = getSeg(i), b = getSeg(i + 1)
        return (a.lx + (b.lx - a.lx) * t, a.rx + (b.rx - a.rx) * t)
    }

    private func ensureSegs() {
        let top = Int(ceil((worldOff + size.height) / SEG_H)) + 4
        for i in 0...max(0, top) { _ = getSeg(i) }
    }

    // MARK: - Bank drawing

    private func drawBanks() {
        let s0 = max(0, Int(floor(worldOff / SEG_H)) - 1)
        let s1 = Int(ceil((worldOff + size.height) / SEG_H)) + 1
        var lpts = [(CGFloat, CGFloat)]()
        var rpts = [(CGFloat, CGFloat)]()
        for i in s0...s1 {
            let seg = getSeg(i)
            let sy  = CGFloat(i) * SEG_H - worldOff
            lpts.append((seg.lx, sy))
            rpts.append((seg.rx, sy))
        }
        lBank.path = bankPath(pts: lpts, edgeX: 0)
        rBank.path = bankPath(pts: rpts, edgeX: size.width)
    }

    private func bankPath(pts: [(CGFloat, CGFloat)], edgeX: CGFloat) -> CGPath {
        let p = CGMutablePath()
        p.move(to: CGPoint(x: edgeX, y: pts.first!.1))
        for (x, y) in pts { p.addLine(to: CGPoint(x: x, y: y)) }
        p.addLine(to: CGPoint(x: edgeX, y: pts.last!.1))
        p.closeSubpath()
        return p
    }

    // MARK: - Enemy spawning

    private func spawnEnemies() {
        let lo = max(8, Int(floor(worldOff / SEG_H)))
        let hi = Int(ceil((worldOff + size.height + SEG_H * 2) / SEG_H))
        guard lo <= hi else { return }
        for i in lo...hi {
            guard !spawned.contains(i) else { continue }
            spawned.insert(i)
            guard Float.random(in: 0...1) < 0.40 else { continue }

            let seg  = getSeg(i)
            let mid  = (seg.lx + seg.rx) / 2
            let half = (seg.rx - seg.lx) * 0.40
            let ex   = CGFloat.random(in: (mid - half)...(mid + half))
            let ey   = CGFloat(i) * SEG_H + SEG_H * 0.5

            let pool: [EnemyKind] = [.heli, .heli, .jet, .ship, .ship, .fuel]
            let kind = pool.randomElement()!
            let spd  = (kind == .ship || kind == .fuel) ? CGFloat(0)
                : CGFloat.random(in: 50...110)
            let dx = Bool.random() ? spd : -spd

            let e = EnemyRec(id: UUID(), kind: kind, wx: ex, wy: ey, dx: dx)
            enemies[e.id] = e
        }
    }

    // MARK: - Enemy sprites

    private func syncEnemyNodes() {
        for (id, e) in enemies {
            guard e.alive else {
                eNodes[id]?.removeFromParent(); eNodes.removeValue(forKey: id); continue
            }
            let sy = e.wy - worldOff
            guard sy > -60 && sy < size.height + 60 else {
                eNodes[id]?.removeFromParent(); eNodes.removeValue(forKey: id); continue
            }
            if eNodes[id] == nil {
                let n = makeEnemy(e.kind)
                objLayer.addChild(n); eNodes[id] = n
            }
            eNodes[id]?.position = CGPoint(x: e.wx, y: sy)
        }
    }

    private func makeEnemy(_ k: EnemyKind) -> SKNode {
        let n = SKNode()
        switch k {
        case .heli:
            let body = SKShapeNode(rectOf: CGSize(width: 38, height: 18), cornerRadius: 4)
            body.fillColor   = UIColor(red: 0.8, green: 0.15, blue: 0.15, alpha: 1)
            body.strokeColor = .white; body.lineWidth = 1
            n.addChild(body)
            let tail = SKShapeNode(rectOf: CGSize(width: 14, height: 10), cornerRadius: 2)
            tail.fillColor   = UIColor(red: 0.6, green: 0.1, blue: 0.1, alpha: 1)
            tail.strokeColor = .clear
            tail.position    = CGPoint(x: 22, y: -2)
            n.addChild(tail)
            let rotor = SKSpriteNode(color: .darkGray, size: CGSize(width: 54, height: 5))
            rotor.position = CGPoint(x: 0, y: 13)
            n.addChild(rotor)
            rotor.run(.repeatForever(.rotate(byAngle: .pi * 2, duration: 0.25)))

        case .jet:
            let fuse = SKShapeNode(rectOf: CGSize(width: 16, height: 44), cornerRadius: 4)
            fuse.fillColor   = UIColor(red: 0.9, green: 0.4, blue: 0.0, alpha: 1)
            fuse.strokeColor = .white; fuse.lineWidth = 1
            n.addChild(fuse)
            var lp: [CGPoint] = [
                CGPoint(x: -8, y: 2), CGPoint(x: -30, y: -14),
                CGPoint(x: -30, y: 6), CGPoint(x: -8, y: 6)
            ]
            let lw = SKShapeNode(points: &lp, count: lp.count)
            lw.fillColor = UIColor(red: 0.7, green: 0.3, blue: 0, alpha: 1); lw.strokeColor = .clear
            n.addChild(lw)
            var rp: [CGPoint] = [
                CGPoint(x: 8, y: 2), CGPoint(x: 30, y: -14),
                CGPoint(x: 30, y: 6), CGPoint(x: 8, y: 6)
            ]
            let rw = SKShapeNode(points: &rp, count: rp.count)
            rw.fillColor = UIColor(red: 0.7, green: 0.3, blue: 0, alpha: 1); rw.strokeColor = .clear
            n.addChild(rw)
            var np: [CGPoint] = [CGPoint(x: -6, y: -20), CGPoint(x: 6, y: -20), CGPoint(x: 0, y: -30)]
            let nose = SKShapeNode(points: &np, count: np.count)
            nose.fillColor = .white; nose.strokeColor = .clear
            n.addChild(nose)

        case .ship:
            let hull = SKShapeNode(rectOf: CGSize(width: 48, height: 20), cornerRadius: 5)
            hull.fillColor   = UIColor(red: 0.5, green: 0.5, blue: 0.1, alpha: 1)
            hull.strokeColor = .white; hull.lineWidth = 1
            n.addChild(hull)
            let sup = SKShapeNode(rectOf: CGSize(width: 16, height: 10), cornerRadius: 2)
            sup.fillColor   = UIColor(red: 0.4, green: 0.4, blue: 0.1, alpha: 1)
            sup.strokeColor = .clear
            sup.position    = CGPoint(x: 0, y: 12)
            n.addChild(sup)
            let gun = SKSpriteNode(color: .darkGray, size: CGSize(width: 4, height: 16))
            gun.position = CGPoint(x: 0, y: 22); n.addChild(gun)

        case .fuel:
            let tank = SKShapeNode(rectOf: CGSize(width: 28, height: 48), cornerRadius: 6)
            tank.fillColor   = UIColor(red: 0.9, green: 0.5, blue: 0.0, alpha: 1)
            tank.strokeColor = .white; tank.lineWidth = 1
            n.addChild(tank)
            let lbl = SKLabelNode(text: "F")
            lbl.fontName = "Courier-Bold"; lbl.fontSize = 20
            lbl.fontColor = .white
            lbl.verticalAlignmentMode   = .center
            lbl.horizontalAlignmentMode = .center
            n.addChild(lbl)
        }
        return n
    }

    // MARK: - Bullets

    private func fireBullet() {
        guard fireCd <= 0, gState == .playing else { return }
        fireCd = FIRE_CD
        let nd = SKSpriteNode(color: .yellow, size: CGSize(width: 5, height: 14))
        nd.position = CGPoint(x: plrX, y: plrScrY + 24)
        objLayer.addChild(nd)
        bullets.append(BulletRec(wx: plrX, wy: plrWY + 24, node: nd))
    }

    private func stepBullets(_ dt: CGFloat) {
        for i in bullets.indices {
            guard bullets[i].alive else { continue }
            bullets[i].wy += BULLET_SPD * dt
            let sy = bullets[i].wy - worldOff
            if sy > size.height + 20 {
                bullets[i].alive = false; bullets[i].node?.removeFromParent(); continue
            }
            let r = riverAt(bullets[i].wy)
            if bullets[i].wx < r.lx || bullets[i].wx > r.rx {
                bullets[i].alive = false; bullets[i].node?.removeFromParent(); continue
            }
            bullets[i].node?.position = CGPoint(x: bullets[i].wx, y: sy)

            for (id, var e) in enemies where e.alive {
                if abs(bullets[i].wx - e.wx) < e.kind.halfW &&
                   abs(bullets[i].wy - e.wy) < e.kind.halfH {
                    bullets[i].alive = false; bullets[i].node?.removeFromParent()
                    e.alive = false; enemies[id] = e
                    score += e.kind.score
                    if score > hiScore { hiScore = score }
                    if e.kind == .fuel { fuel = min(maxFuel, fuel + 45) }
                    boom(at: CGPoint(x: e.wx, y: e.wy - worldOff))
                    break
                }
            }
        }
        bullets.removeAll { !$0.alive }
    }

    // MARK: - Explosion

    private func boom(at pt: CGPoint) {
        let ring = SKShapeNode(circleOfRadius: 6)
        ring.fillColor   = .orange
        ring.strokeColor = .yellow
        ring.lineWidth   = 2
        ring.position    = pt
        objLayer.addChild(ring)
        ring.run(.sequence([
            .group([.scale(to: 4.5, duration: 0.18), .fadeOut(withDuration: 0.18)]),
            .removeFromParent()
        ]))
    }

    // MARK: - Game flow

    private func startGame() {
        score = 0; lives = 3; fuel = maxFuel
        worldOff = 0; invTime = 0; deathWait = 0; fireCd = 0; lastT = 0
        goLeft = false; goRight = false; doShoot = false
        segs.removeAll(); spawned.removeAll()
        enemies.removeAll()
        eNodes.values.forEach { $0.removeFromParent() }; eNodes.removeAll()
        bullets.forEach { $0.node?.removeFromParent() }; bullets.removeAll()
        objLayer.removeAllChildren()
        plrX = size.width / 2
        buildPlayer()
        ensureSegs(); drawBanks()
        overlay?.removeFromParent(); overlay = nil
        gState = .playing
    }

    private func showTitle() {
        gState = .title
        showOverlay(title: "RIVER RAID",
                    sub: "Toque para começar",
                    hint: "◀ ▶  Mover     🔥  Atirar",
                    scoreVal: nil)
    }

    private func gameOver() {
        if score > hiScore { hiScore = score }
        gState = .over
        showOverlay(title: "GAME OVER",
                    sub: "Toque para jogar novamente",
                    hint: nil,
                    scoreVal: score)
    }

    private func showOverlay(title: String, sub: String, hint: String?, scoreVal: Int?) {
        overlay?.removeFromParent()
        let ov = SKNode(); ov.zPosition = 20
        let bg = SKSpriteNode(color: UIColor.black.withAlphaComponent(0.72),
                              size: CGSize(width: size.width, height: size.height))
        bg.anchorPoint = .zero; ov.addChild(bg)

        let cx = size.width / 2, cy = size.height / 2

        let tl = makeLbl(title, sz: 52, at: CGPoint(x: cx, y: cy + 70))
        tl.horizontalAlignmentMode = .center
        tl.fontColor = UIColor(red: 1, green: 0.2, blue: 0.1, alpha: 1)
        ov.addChild(tl)

        if let s = scoreVal {
            let sl = makeLbl(String(format: "SCORE  %06d", s), sz: 22,
                             at: CGPoint(x: cx, y: cy + 10))
            sl.horizontalAlignmentMode = .center; sl.fontColor = .yellow; ov.addChild(sl)
        }
        if hiScore > 0 {
            let hl = makeLbl(String(format: "HI     %06d", hiScore), sz: 18,
                             at: CGPoint(x: cx, y: cy - 20))
            hl.horizontalAlignmentMode = .center; hl.fontColor = .yellow; ov.addChild(hl)
        }

        let sl = makeLbl(sub, sz: 20, at: CGPoint(x: cx, y: cy - 60))
        sl.horizontalAlignmentMode = .center; sl.fontColor = .white; ov.addChild(sl)

        if let h = hint {
            let hl = makeLbl(h, sz: 15, at: CGPoint(x: cx, y: cy - 95))
            hl.horizontalAlignmentMode = .center
            hl.fontColor = UIColor(white: 0.7, alpha: 1); ov.addChild(hl)
        }
        addChild(ov); overlay = ov
    }

    private func playerDied() {
        boom(at: CGPoint(x: plrX, y: plrScrY))
        plrNode.isHidden = true
        lives -= 1
        if lives <= 0 {
            deathWait = 1.8
        } else {
            fuel = maxFuel; invTime = 3.0
            plrNode.isHidden = false
        }
    }

    // MARK: - Touch

    private func resolveTag(for t: UITouch) -> String {
        let p = t.location(in: ctrlLayer)
        for b in btnDefs {
            if abs(p.x - b.cx) < b.w / 2 && abs(p.y - b.cy) < b.h / 2 { return b.tag }
        }
        return "F"
    }

    private func applyTag(_ tag: String, active: Bool) {
        switch tag {
        case "L": goLeft  = active
        case "R": goRight = active
        default:  doShoot = active
        }
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if gState != .playing { startGame(); return }
        for t in touches {
            let tag = resolveTag(for: t)
            touchMap[ObjectIdentifier(t)] = tag
            applyTag(tag, active: true)
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            if let tag = touchMap.removeValue(forKey: ObjectIdentifier(t)) {
                applyTag(tag, active: false)
            }
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        touchesEnded(touches, with: event)
    }

    // MARK: - Main loop

    override func update(_ currentTime: TimeInterval) {
        let dt: CGFloat = lastT == 0 ? 1/60 : CGFloat(min(currentTime - lastT, 0.05))
        lastT = currentTime
        guard gState == .playing else { return }

        if deathWait > 0 {
            deathWait -= dt
            if deathWait <= 0 { gameOver() }
            return
        }

        // Scroll
        worldOff += SCROLL_SPD * dt

        // Player lateral movement
        if goLeft  { plrX -= PLAYER_SPD * dt }
        if goRight { plrX += PLAYER_SPD * dt }
        plrX = plrX.clamped(18, size.width - 18)
        plrNode.position = CGPoint(x: plrX, y: plrScrY)

        // Invincibility blink
        if invTime > 0 {
            invTime -= dt
            plrNode.alpha = sin(invTime * 18) >= 0 ? 1 : 0.25
            if invTime <= 0 { plrNode.alpha = 1 }
        }

        // Firing
        if doShoot { fireBullet() }
        if fireCd > 0 { fireCd -= dt }

        // Flame flicker
        flame.alpha  = CGFloat.random(in: 0.5...1.0)
        flame.xScale = CGFloat.random(in: 0.8...1.2)

        // Fuel
        fuel -= FUEL_DRAIN * dt
        if fuel <= 0 { fuel = 0; playerDied(); return }

        // Distance score
        score += Int(SCROLL_SPD * dt * 0.15)
        if score > hiScore { hiScore = score }

        ensureSegs()
        drawBanks()
        spawnEnemies()

        // Move enemies laterally
        for (id, var e) in enemies where e.alive && e.dx != 0 {
            e.wx += e.dx * dt
            let r = riverAt(e.wy)
            if e.wx - e.kind.halfW < r.lx || e.wx + e.kind.halfW > r.rx { e.dx *= -1 }
            enemies[id] = e
        }

        syncEnemyNodes()
        stepBullets(dt)

        // Player collisions
        if invTime <= 0 && !plrNode.isHidden {
            let r = riverAt(plrWY)
            if plrX - 11 < r.lx || plrX + 11 > r.rx { playerDied(); return }

            for (id, var e) in enemies where e.alive {
                let sy = e.wy - worldOff
                if abs(plrX - e.wx) < e.kind.halfW + 10 &&
                   abs(plrScrY - sy) < e.kind.halfH + 10 {
                    e.alive = false; enemies[id] = e
                    playerDied(); return
                }
            }
        }

        refreshHUD()
    }

    // MARK: - Helpers

    private func makeLbl(_ text: String, sz: CGFloat, at pos: CGPoint) -> SKLabelNode {
        let l = SKLabelNode(fontNamed: "Courier-Bold")
        l.text = text; l.fontSize = sz; l.fontColor = .white
        l.position = pos; l.verticalAlignmentMode = .center
        return l
    }
}

// MARK: - CGFloat clamp
extension CGFloat {
    func clamped(_ lo: CGFloat, _ hi: CGFloat) -> CGFloat {
        Swift.max(lo, Swift.min(hi, self))
    }
}
