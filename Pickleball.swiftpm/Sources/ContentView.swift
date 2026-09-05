import SwiftUI
import SpriteKit

struct ContentView: View {
    @StateObject private var model = GameModel()

    var body: some View {
        ZStack {
            Color(red: 0.04, green: 0.07, blue: 0.11).ignoresSafeArea()
            if model.screen == .game || model.screen == .pause || model.screen == .over {
                GameView(model: model).ignoresSafeArea()
            }
            switch model.screen {
            case .title: TitleScreen(model: model)
            case .setup: SetupScreen(model: model)
            case .how: HowScreen(model: model)
            case .pause: PauseScreen(model: model)
            case .over: OverScreen(model: model)
            case .game: PauseButton(model: model)
            }
        }
        .preferredColorScheme(.dark)
    }
}

// ── game panes ────────────────────────────────────────────────────────────
struct GameView: View {
    @ObservedObject var model: GameModel

    var body: some View {
        GeometryReader { geo in
            if model.match?.versus == true {
                VStack(spacing: 2) {
                    ScenePane(model: model, side: 1, isPrimary: false,
                              size: CGSize(width: geo.size.width, height: (geo.size.height - 2) / 2))
                    ScenePane(model: model, side: 0, isPrimary: true,
                              size: CGSize(width: geo.size.width, height: (geo.size.height - 2) / 2))
                }
            } else {
                ScenePane(model: model, side: 0, isPrimary: true, size: geo.size)
            }
        }
    }
}

struct ScenePane: View {
    let model: GameModel
    let side: Int
    let isPrimary: Bool
    let size: CGSize
    @State private var scene: GameScene?

    var body: some View {
        Group {
            if let s = scene {
                SpriteView(scene: s, preferredFramesPerSecond: 60)
            } else {
                Color.black
            }
        }
        .frame(width: size.width, height: size.height)
        .onAppear {
            if scene == nil {
                let s = GameScene(size: size, side: side, model: model, isPrimary: isPrimary)
                s.scaleMode = .resizeFill
                scene = s
            }
        }
    }
}

// ── shared UI bits ────────────────────────────────────────────────────────
struct Choice<T: Equatable>: View {
    let title: String
    let subtitle: String
    let value: T
    @Binding var selection: T

    var body: some View {
        Button(action: { selection = value }) {
            VStack(spacing: 3) {
                Text(title).font(.system(size: 15, weight: .semibold))
                if !subtitle.isEmpty {
                    Text(subtitle).font(.system(size: 11)).opacity(0.7)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(selection == value ? Color(red: 0.11, green: 0.31, blue: 0.45)
                                           : Color(red: 0.07, green: 0.12, blue: 0.17))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(selection == value ? Color(red: 0.31, green: 0.82, blue: 1.0)
                                           : Color(red: 0.14, green: 0.22, blue: 0.30), lineWidth: 1.5))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
        .foregroundColor(.white)
    }
}

struct BigButton: View {
    let title: String
    var ghost = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 16, weight: .heavy))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(ghost ? Color.clear : Color(red: 0.85, green: 1.0, blue: 0.24))
                .foregroundColor(ghost ? .white : Color(red: 0.07, green: 0.13, blue: 0.17))
                .overlay(RoundedRectangle(cornerRadius: 14)
                    .stroke(ghost ? Color(red: 0.17, green: 0.26, blue: 0.35) : .clear, lineWidth: 1.5))
                .cornerRadius(14)
        }
        .buttonStyle(.plain)
    }
}

struct Sheet<Content: View>: View {
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        ZStack {
            Color(red: 0.03, green: 0.05, blue: 0.08).opacity(0.9).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) { content }
                    .padding(22)
                    .frame(maxWidth: 430)
            }
        }
    }
}

// ── screens ───────────────────────────────────────────────────────────────
struct TitleScreen: View {
    @ObservedObject var model: GameModel

    var body: some View {
        Sheet {
            Text("PICKLEBALL")
                .font(.system(size: 42, weight: .black))
                .kerning(2)
            Text("Simples ou duplas, sozinho ou com um amigo no mesmo aparelho. Regras oficiais, cozinha e tudo.")
                .font(.system(size: 14))
                .multilineTextAlignment(.center)
                .foregroundColor(.gray)
            BigButton(title: "JOGAR") { model.screen = .setup }
            BigButton(title: "Como jogar", ghost: true) { model.screen = .how }
            BigButton(title: model.hapticsOn ? "Vibração: ligada" : "Vibração: desligada", ghost: true) {
                model.hapticsOn.toggle()
            }
        }
        .foregroundColor(.white)
    }
}

struct SetupScreen: View {
    @ObservedObject var model: GameModel

    var body: some View {
        Sheet {
            Text("Configurar partida").font(.system(size: 20, weight: .bold))

            group("Formato") {
                Choice(title: "Simples", subtitle: "1 contra 1", value: "singles", selection: $model.cfg.format)
                Choice(title: "Duplas", subtitle: "2 contra 2", value: "doubles", selection: $model.cfg.format)
            }
            group("Jogadores") {
                Choice(title: "Sozinho", subtitle: "contra a CPU", value: 1, selection: $model.cfg.humans)
                Choice(title: "Dois jogadores", subtitle: "mesmo aparelho", value: 2, selection: $model.cfg.humans)
            }
            if model.cfg.format == "doubles" && model.cfg.humans == 2 {
                group("Vocês dois vão…") {
                    Choice(title: "Jogar juntos", subtitle: "dupla contra a CPU",
                           value: "coop", selection: $model.cfg.arrangement)
                    Choice(title: "Um contra o outro", subtitle: "cada um com parceiro CPU",
                           value: "versus", selection: $model.cfg.arrangement)
                }
            }
            group("Dificuldade") {
                Choice(title: "Fácil", subtitle: "golpe automático", value: "facil", selection: $model.cfg.difficulty)
                Choice(title: "Normal", subtitle: "faltas assistidas", value: "normal", selection: $model.cfg.difficulty)
                Choice(title: "Difícil", subtitle: "sem perdão", value: "dificil", selection: $model.cfg.difficulty)
            }
            group("Partida até") {
                Choice(title: "7", subtitle: "", value: 7, selection: $model.cfg.targetPoints)
                Choice(title: "11", subtitle: "", value: 11, selection: $model.cfg.targetPoints)
                Choice(title: "15", subtitle: "", value: 15, selection: $model.cfg.targetPoints)
            }
            BigButton(title: "COMEÇAR") { model.start() }
            BigButton(title: "Voltar", ghost: true) { model.screen = .title }
        }
        .foregroundColor(.white)
    }

    @ViewBuilder
    private func group<C: View>(_ label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .bold))
                .kerning(1.4)
                .foregroundColor(.gray)
            HStack(spacing: 8) { content() }
        }
    }
}

struct HowScreen: View {
    @ObservedObject var model: GameModel

    private struct Item: Identifiable {
        let id = UUID()
        let title: String
        let body: String
    }

    private let items: [Item] = [
        Item(title: "Mover", body: "Arraste o dedo na sua área da tela. O jogador acompanha o dedo."),
        Item(title: "Golpear", body: "Flick (deslize rápido) para cima na hora da bola. Rápido e longo = drive no fundo; rápido e curto = voleio; lento e longo = lob; lento e curto = dink na cozinha. A inclinação define a direção."),
        Item(title: "Sacar", body: "Deslize para cima. O saque é por baixo, na diagonal, e precisa passar da cozinha."),
        Item(title: "Dois quiques", body: "O saque tem que quicar e a devolução também. Só depois vale voleio."),
        Item(title: "Cozinha", body: "Os 2,13 m junto à rede: nada de voleio de dentro dela, nem entrar por impulso logo depois."),
        Item(title: "Pontuação", body: "Só quem saca pontua. Nas duplas os dois parceiros sacam antes do rodízio e o jogo começa em 0-0-2."),
    ]

    var body: some View {
        Sheet {
            Text("Como jogar").font(.system(size: 20, weight: .bold))
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(red: 0.85, green: 1.0, blue: 0.24))
                    Text(item.body).font(.system(size: 13)).foregroundColor(.white.opacity(0.85))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color(red: 0.06, green: 0.11, blue: 0.16))
                .cornerRadius(12)
            }
            BigButton(title: "Voltar", ghost: true) { model.screen = .title }
        }
        .foregroundColor(.white)
    }
}

struct PauseButton: View {
    @ObservedObject var model: GameModel

    var body: some View {
        VStack {
            HStack {
                Spacer()
                Button(action: {
                    model.match?.paused = true
                    model.screen = .pause
                }) {
                    Image(systemName: "pause.fill")
                        .font(.system(size: 16, weight: .bold))
                        .frame(width: 42, height: 42)
                        .background(Color.black.opacity(0.6))
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .padding(.trailing, 14)
                .padding(.top, 10)
            }
            Spacer()
        }
    }
}

struct PauseScreen: View {
    @ObservedObject var model: GameModel

    var body: some View {
        Sheet {
            Text("Pausa").font(.system(size: 20, weight: .bold))
            BigButton(title: "Continuar") {
                model.match?.paused = false
                model.screen = .game
            }
            BigButton(title: "Reiniciar partida", ghost: true) { model.start() }
            BigButton(title: "Sair para o menu", ghost: true) {
                model.match = nil
                model.screen = .title
            }
        }
        .foregroundColor(.white)
    }
}

struct OverScreen: View {
    @ObservedObject var model: GameModel

    var body: some View {
        Sheet {
            Text(model.overTitle).font(.system(size: 22, weight: .bold))
            Text(model.overScore).font(.system(size: 46, weight: .black))
            Text(model.overSub).font(.system(size: 13)).foregroundColor(.gray)
            BigButton(title: "Revanche") { model.start() }
            BigButton(title: "Menu", ghost: true) {
                model.match = nil
                model.screen = .title
            }
        }
        .foregroundColor(.white)
    }
}
