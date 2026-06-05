// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AgentCliMenuBar",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "AgentCliMenuBar",
            path: "Sources/AgentCliMenuBar"
        )
    ]
)
