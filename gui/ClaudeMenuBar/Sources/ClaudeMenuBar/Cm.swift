import Foundation

// ── JSON models (mirror `cm gui ...` output) ──────────────────────────────────
struct ProjectsResponse: Codable {
    let groups: [Group]
    let tools: [Tool]
    let defaultTool: String
}
struct Group: Codable, Identifiable {
    let name: String; let color: String; let path: String; let dirs: [Dir]
    var id: String { path }
}
struct Dir: Codable, Identifiable {
    let name: String; let path: String; let branch: String?; let timeMs: Double; let scoreSource: String
    var id: String { path }
}
struct Tool: Codable, Identifiable {
    let name: String; let label: String
    var id: String { name }
}
struct Session: Codable, Identifiable {
    let id: String; let name: String; let cwd: String; let status: String
    let active: Bool; let gitBranch: String?; let cwdConfident: Bool; let lastUpdatedAt: String
}
struct TerminalOpt: Codable, Identifiable {
    let id: String; let label: String; let installed: Bool; let selected: Bool
}
struct TerminalsResponse: Codable {
    let terminals: [TerminalOpt]; let current: String; let customCommand: String?
}

// Editable config (shared with the TUI). Mirrors `cm gui config-get` / `config-save`.
struct GroupDTO: Codable { var name: String; var path: String; var color: String }
struct ToolDTO: Codable { var name: String; var runs: String; var label: String; var color: String }
struct IdeDTO: Codable { var key: String; var label: String; var cmd: String }
struct ConfigDTO: Codable {
    var defaultTool: String
    var terminal: String
    var launchCommand: String?
    var groups: [GroupDTO]
    var tools: [ToolDTO]
    var ides: [IdeDTO]
}

enum CmError: Error { case notFound, failed(String) }

/// Thin client over the `cm gui ...` CLI. All real work (config, launching) lives in Node.
enum Cm {
    /// Resolve a runnable cm. $CM_BIN overrides; else probe fixed install paths.
    static func invocation() -> String? {
        if let o = ProcessInfo.processInfo.environment["CM_BIN"], !o.isEmpty { return o }
        let home = NSHomeDirectory()
        let candidates = ["/opt/homebrew/bin/cm", "/usr/local/bin/cm", "\(home)/.local/bin/cm"]
        for c in candidates where FileManager.default.isExecutableFile(atPath: c) {
            return "'\(c)'"
        }
        return nil
    }

    private static func run(_ args: String) throws -> Data {
        guard let cm = invocation() else { throw CmError.notFound }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/sh")
        p.arguments = ["-lc", "\(cm) gui \(args)"]
        let out = Pipe(); let err = Pipe()
        p.standardOutput = out; p.standardError = err
        try p.run()
        let data = out.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        if p.terminationStatus != 0 {
            let e = String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw CmError.failed(e.isEmpty ? "exit \(p.terminationStatus)" : e)
        }
        return data
    }

    private static func runAsync<T: Decodable>(_ args: String, _ type: T.Type) async throws -> T {
        try await withCheckedThrowingContinuation { cont in
            DispatchQueue.global().async {
                do {
                    let data = try run(args)
                    cont.resume(returning: try JSONDecoder().decode(T.self, from: data))
                } catch { cont.resume(throwing: error) }
            }
        }
    }

    private static func runVoid(_ args: String) {
        DispatchQueue.global().async { _ = try? run(args) }
    }

    // ── API ──
    static func projects() async throws -> ProjectsResponse { try await runAsync("projects", ProjectsResponse.self) }
    static func sessions() async throws -> [Session] { try await runAsync("sessions", [Session].self) }
    static func terminals() async throws -> TerminalsResponse { try await runAsync("terminals", TerminalsResponse.self) }

    static func launch(dir: String, tool: String) { runVoid("launch --dir '\(esc(dir))' --tool '\(esc(tool))'") }
    static func resume(id: String) { runVoid("resume --id '\(esc(id))'") }
    static func configGet() async throws -> ConfigDTO { try await runAsync("config-get", ConfigDTO.self) }

    /// Write the full config (shared with the TUI) by piping JSON to `cm gui config-save`.
    static func configSave(_ dto: ConfigDTO) {
        guard let data = try? JSONEncoder().encode(dto) else { return }
        DispatchQueue.global().async {
            guard let cm = invocation() else { return }
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/bin/sh")
            p.arguments = ["-lc", "\(cm) gui config-save"]
            let inp = Pipe(); p.standardInput = inp
            p.standardOutput = Pipe(); p.standardError = Pipe()
            do {
                try p.run()
                inp.fileHandleForWriting.write(data)
                inp.fileHandleForWriting.closeFile()
                p.waitUntilExit()
            } catch { /* ignore */ }
        }
    }

    static func setTerminal(_ value: String, command: String?) {
        var a = "set-terminal '\(esc(value))'"
        if let c = command, !c.isEmpty { a += " --command '\(esc(c))'" }
        runVoid(a)
    }
    static func newDirThenLaunch(base: String, name: String, tool: String) {
        DispatchQueue.global().async {
            guard let data = try? run("new-dir --base '\(esc(base))' --name '\(esc(name))'"),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let path = obj["path"] as? String else { return }
            _ = try? run("launch --dir '\(esc(path))' --tool '\(esc(tool))'")
        }
    }

    private static func esc(_ s: String) -> String { s.replacingOccurrences(of: "'", with: "'\\''") }
}
