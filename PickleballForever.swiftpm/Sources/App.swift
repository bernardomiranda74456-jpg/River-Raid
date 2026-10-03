import SwiftUI

@main
struct PickleballForeverApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
                .onAppear {
                    // a game is played without touching the screen for long
                    // stretches; the display must not dim mid-rally
                    UIApplication.shared.isIdleTimerDisabled = true
                }
        }
    }
}
