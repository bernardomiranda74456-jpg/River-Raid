import SwiftUI
import WebKit

/// The whole game is one HTML page carried inside the app. This view hosts it
/// edge to edge: no scrolling, no bounce, no zoom, and sound allowed without a
/// touch, so the menu music comes in as the company mark closes, the way it
/// does on a desktop browser.
struct GameView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 11 / 255, green: 19 / 255, blue: 29 / 255, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false

        if let url = GameView.gameURL() {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            web.loadHTMLString(GameView.missingPage, baseURL: nil)
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    /// The page lives in the bundle's Resources folder. The lookup is done more
    /// than one way because Xcode and Swift Playgrounds lay resources out
    /// differently.
    static func gameURL() -> URL? {
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Resources") {
            return url
        }
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            return url
        }
        let fm = FileManager.default
        if let walker = fm.enumerator(at: Bundle.main.bundleURL, includingPropertiesForKeys: nil) {
            for case let file as URL in walker where file.lastPathComponent == "index.html" {
                return file
            }
        }
        return nil
    }

    static let missingPage = """
    <html><body style="background:#0b131d;color:#eaf2f8;font-family:-apple-system;display:flex;\
    align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px">
    <p>index.html não está no pacote.<br>Rode <code>node pickleball/build-single.js</code> e compile de novo.</p>
    </body></html>
    """
}
