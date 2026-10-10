// swift-tools-version: 5.8
// Pickleball Forever for iPhone. The game itself is the web page in
// Sources/Resources/index.html, written there by pickleball/build-single.js on
// every build; this package only wraps it in a native app, full screen, with
// sound allowed from the first frame. Open the package in Xcode on a Mac or
// in Swift Playgrounds on an iPad, pick your team under App Settings, and run.
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Pickleball Forever",
    platforms: [.iOS("16.0")],
    products: [
        .iOSApplication(
            name: "Pickleball Forever",
            targets: ["PickleballForever"],
            bundleIdentifier: "br.com.3emp.pickleballforever",
            displayVersion: "1.0",
            bundleVersion: "53",
            appIcon: .asset("AppIcon"),
            accentColor: .presetColor(.green),
            supportedDeviceFamilies: [.phone, .pad],
            supportedInterfaceOrientations: [
                .portrait, .landscapeLeft, .landscapeRight,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "PickleballForever",
            path: "Sources",
            resources: [.copy("Resources")]
        )
    ]
)
