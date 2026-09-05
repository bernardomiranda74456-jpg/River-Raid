// swift-tools-version: 5.5
import PackageDescription

let package = Package(
    name: "Pickleball",
    platforms: [.iOS("15.2")],
    targets: [
        .executableTarget(
            name: "Pickleball",
            path: "Sources"
        )
    ]
)
