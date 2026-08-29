// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AgentctlBar",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "AgentctlBar",
            path: "Sources/AgentctlBar"
        )
    ]
)
