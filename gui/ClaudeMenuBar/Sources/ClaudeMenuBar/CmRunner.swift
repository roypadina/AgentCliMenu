import Foundation

/// Mirrors the JSON printed by `cm gui-config`. All fields optional + a version → forward-compatible.
struct GuiContract: Codable {
    var contractVersion: Int?
    var terminal: String?
    var cmBin: String?
    var cmCommand: String?
    var configPath: String?
    var customTemplate: String?
    var entry: String?
    var warnings: [String]?
}

final class CmRunner {
    static let shared = CmRunner()

    /// How to invoke `cm`. $CM_BIN overrides (dev: "node /repo/bin/cm"); else probe fixed paths.
    private func cmInvocation() -> String? {
        let env = ProcessInfo.processInfo.environment
        if let override = env["CM_BIN"], !override.isEmpty { return override }
        let candidates = [
            "/opt/homebrew/bin/cm",
            "/usr/local/bin/cm",
            (NSHomeDirectory() as NSString).appendingPathComponent(".local/bin/cm"),
        ]
        for c in candidates where FileManager.default.isExecutableFile(atPath: c) {
            return shellQuote(c)
        }
        return nil
    }

    private func runCapture(_ command: String) -> (out: String, status: Int32) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/sh")
        p.arguments = ["-lc", command] // login shell so PATH finds node/cm in dev
        let outPipe = Pipe()
        p.standardOutput = outPipe
        p.standardError = Pipe()
        do { try p.run() } catch { return ("", 127) }
        let data = outPipe.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return (String(data: data, encoding: .utf8) ?? "", p.terminationStatus)
    }

    func contract(entry: String) -> GuiContract? {
        guard let cm = cmInvocation() else { return nil }
        let (out, status) = runCapture("\(cm) gui-config --for \(entry)")
        guard status == 0, let data = out.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(GuiContract.self, from: data)
    }

    func launch(entry: String) {
        let c = contract(entry: entry) ?? GuiContract(
            contractVersion: 1, terminal: "Terminal", cmBin: "cm",
            cmCommand: entry == "root" ? "cm" : "cm \(entry)",
            configPath: nil, customTemplate: nil, entry: entry,
            warnings: ["cm not found on PATH; assuming `cm`"]
        )
        let cmd = (c.cmCommand ?? "cm").trimmingCharacters(in: .whitespaces)
        TerminalLauncher.launch(terminal: c.terminal ?? "Terminal", command: cmd, custom: c.customTemplate)
    }

    func editConfig() {
        guard let cm = cmInvocation() else { return }
        _ = runCapture("\(cm) config --setup") // idempotent: create if missing
        guard let path = contract(entry: "new")?.configPath else { return }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        p.arguments = ["-t", path]
        try? p.run()
    }

    private func shellQuote(_ s: String) -> String {
        "'" + s.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
