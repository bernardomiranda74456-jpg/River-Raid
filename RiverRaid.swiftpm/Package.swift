// swift-tools-version: 5.5
import PackageDescription

let package = Package(
    name: "RiverRaid",
    platforms: [.iOS("15.2")],
    targets: [
        .executableTarget(
            name: "RiverRaid",
            path: "Sources"
        )
    ]
)
