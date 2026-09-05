import SwiftUI
import UIKit

enum Screen {
    case title, setup, how, game, pause, over
}

/// Owns the match and feeds it the touch state gathered by the scenes.
final class GameModel: ObservableObject {
    @Published var screen: Screen = .title
    @Published var cfg = MatchConfig()
    @Published var overTitle = ""
    @Published var overScore = ""
    @Published var overSub = ""
    @Published var hapticsOn = true

    var match: Match?
    var inputs: [String: HumanInput] = ["p1": HumanInput(), "p2": HumanInput()]

    private let lightTap = UIImpactFeedbackGenerator(style: .light)
    private let strongTap = UIImpactFeedbackGenerator(style: .medium)

    func start() {
        match = Match(cfg: cfg)
        inputs = ["p1": HumanInput(), "p2": HumanInput()]
        screen = .game
    }

    func step(dt: Double) {
        guard let m = match, screen == .game, !m.paused else { return }
        m.update(dt: dt, inputs: &inputs)
        for e in m.events {
            switch e {
            case .hit:
                if hapticsOn { lightTap.impactOccurred() }
            case .point:
                if hapticsOn { strongTap.impactOccurred() }
            default:
                break
            }
        }
        m.events.removeAll()
        if m.state == "gameover" { finish(m) }
    }

    private func finish(_ m: Match) {
        let humanTeams = Set(m.players.filter { $0.ctrl == "human" }.map { $0.team })
        if m.cfg.humans == 2 && humanTeams.count == 2 {
            overTitle = m.winner == 0 ? "P1 venceu!" : "P2 venceu!"
        } else if humanTeams.contains(m.winner) {
            overTitle = "Você venceu!"
        } else {
            overTitle = "Você perdeu"
        }
        overScore = "\(m.score[0]) - \(m.score[1])"
        let diff = m.cfg.difficulty == "facil" ? "Fácil" : (m.cfg.difficulty == "dificil" ? "Difícil" : "Normal")
        overSub = "\(m.cfg.format == "doubles" ? "Duplas" : "Simples") • até \(m.cfg.targetPoints) pontos • \(diff)"
        screen = .over
    }
}
