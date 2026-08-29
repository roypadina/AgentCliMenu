import Foundation

// ── JSON models (mirror `agentctl gui ...` output) ──────────────────────────────────
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
    /// Where `claude` was launched, when that differs from where the work happened.
    let launchCwd: String?
    let active: Bool; let gitBranch: String?; let cwdConfident: Bool; let lastUpdatedAt: String
    let startedAt: String?
    // User annotations. Optional so an older CLI (which does not emit them) still decodes.
    let flags: [String]?; let labels: [String]?; let note: String?; let done: Bool?
    let remindAt: String?; let remindDue: Bool?
    let dueAt: String?; let overdue: Bool?
    let hidden: Bool?; let deleted: Bool?
    /// "interactive" or "tool" — a tool run is one something else started (`claude -p`, the SDK,
    /// MCP), not one you sat in front of. `entrypoint` is the raw value behind it.
    let kind: String?; let entrypoint: String?
    /// Claude account this session would resume under.
    let account: String?

    var tags: [String] { flags ?? [] }
    var tickets: [String] { labels ?? [] }
    var isDone: Bool { done ?? false }
    var isReminderDue: Bool { remindDue ?? false }
    var isOverdue: Bool { overdue ?? false }
    var isHidden: Bool { hidden ?? false }
    var isDeleted: Bool { deleted ?? false }
    var isToolRun: Bool { kind == "tool" }
    var hasAnnotation: Bool {
        isDone || !tags.isEmpty || !tickets.isEmpty || note != nil || remindAt != nil || dueAt != nil
    }
}
struct Profile: Codable, Identifiable {
    let home: String; let account: String; let isPrimary: Bool
    var id: String { home }
}
struct RecapResponse: Codable {
    let ok: Bool; let text: String?; let generatedAt: String?; let fromCache: Bool?; let error: String?
}
struct TerminalOpt: Codable, Identifiable {
    let id: String; let label: String; let installed: Bool; let selected: Bool
}
struct PeekTurn: Codable { let role: String; let kind: String; let text: String }
struct TerminalsResponse: Codable {
    let terminals: [TerminalOpt]; let current: String; let customCommand: String?
}

// Editable config (shared with the TUI). Mirrors `agentctl gui config-get` / `config-save`.
struct GroupDTO: Codable { var name: String; var path: String; var color: String }
struct ToolDTO: Codable { var name: String; var runs: String; var label: String; var color: String }
struct IdeDTO: Codable { var key: String; var label: String; var cmd: String }
struct ConfigDTO: Codable {
    var defaultTool: String
    var terminal: String
    var launchCommand: String?
    var hotkey: String?
    var groups: [GroupDTO]
    var tools: [ToolDTO]
    var ides: [IdeDTO]
}

extension Notification.Name {
    static let cmReload = Notification.Name("cmReload")          // re-fetch projects/sessions
    static let cmHotkeyChanged = Notification.Name("cmHotkeyChanged") // re-register the global shortcut
    static let cmActionFailed = Notification.Name("cmActionFailed")   // a fire-and-forget launch/resume failed (object = message)
}

enum CmError: Error { case notFound, failed(String) }

/// Thin client over the `agentctl gui ...` CLI. All real work (config, launching) lives in Node.
enum Cm {
    /// Resolve a runnable agentctl. $ACM_BIN overrides; else probe fixed install paths
    /// for `agentctl` (then the `agentctl` alias).
    static func invocation() -> String? {
        if let o = ProcessInfo.processInfo.environment["ACM_BIN"], !o.isEmpty { return o }
        let home = NSHomeDirectory()
        let dirs = ["/opt/homebrew/bin", "/usr/local/bin", "\(home)/.local/bin"]
        for name in ["agentctl", "agentctl"] {
            for d in dirs {
                let c = "\(d)/\(name)"
                if FileManager.default.isExecutableFile(atPath: c) { return "'\(c)'" }
            }
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
        DispatchQueue.global().async {
            do { _ = try run(args) } catch { postFailure(error) }
        }
    }

    /// A fire-and-forget action failed — hop to main and post so the UI can surface it.
    private static func postFailure(_ error: Error) {
        let msg: String
        switch error {
        case CmError.notFound: msg = "agentctl not found. Install it (brew or npm link)."
        case CmError.failed(let m): msg = m.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "the action failed." : m
        default: msg = "\(error)"
        }
        DispatchQueue.main.async { NotificationCenter.default.post(name: .cmActionFailed, object: msg) }
    }

    // ── API ──
    static func projects() async throws -> ProjectsResponse { try await runAsync("projects", ProjectsResponse.self) }
    static func sessions() async throws -> [Session] { try await runAsync("sessions", [Session].self) }
    static func terminals() async throws -> TerminalsResponse { try await runAsync("terminals", TerminalsResponse.self) }
    static func peek(id: String) async throws -> [PeekTurn] { try await runAsync("peek --id '\(esc(id))'", [PeekTurn].self) }
    /// Summarize a session via `claude -p` (haiku, cached). Slow on a cache miss — call off the main actor.
    /// `cachedOnly` returns an existing recap instantly (or ok=false) without generating.
    static func recap(id: String, refresh: Bool = false, cachedOnly: Bool = false) async throws -> RecapResponse {
        var flags = ""
        if cachedOnly { flags = " --cached-only" } else if refresh { flags = " --refresh" }
        return try await runAsync("recap --id '\(esc(id))'\(flags)", RecapResponse.self)
    }

    static func launch(dir: String, tool: String) { runVoid("launch --dir '\(esc(dir))' --tool '\(esc(tool))'") }

    /// Update one session annotation. Only the fields you pass are touched; an empty string clears
    /// a field. `flags` replaces the whole set. `completion` runs on the main thread so the caller
    /// can reload without racing the write.
    static func annotate(
        id: String, name: String? = nil, note: String? = nil, flags: [String]? = nil,
        labels: [String]? = nil, done: Bool? = nil, hidden: Bool? = nil, deleted: Bool? = nil,
        remind: String? = nil, due: String? = nil,
        completion: (() -> Void)? = nil
    ) {
        var args = "annotate --id '\(esc(id))'"
        if let name { args += " --name '\(esc(name))'" }
        if let note { args += " --note '\(esc(note))'" }
        if let flags { args += " --flags '\(esc(flags.joined(separator: ",")))'" }
        if let labels { args += " --labels '\(esc(labels.joined(separator: ",")))'" }
        if let done { args += " --done \(done)" }
        if let hidden { args += " --hidden \(hidden)" }
        if let deleted { args += " --deleted \(deleted)" }
        if let remind { args += " --remind '\(esc(remind))'" }
        if let due { args += " --due '\(esc(due))'" }
        DispatchQueue.global().async {
            do { _ = try run(args) } catch { postFailure(error) }
            if let completion { DispatchQueue.main.async(execute: completion) }
        }
    }
    static func profiles() async throws -> [Profile] { try await runAsync("profiles", [Profile].self) }
    /// `profileHome` overrides which Claude account the session resumes under.
    static func resume(id: String, profileHome: String? = nil) {
        var args = "resume --id '\(esc(id))'"
        if let profileHome { args += " --profile '\(esc(profileHome))'" }
        runVoid(args)
    }
    static func configGet() async throws -> ConfigDTO { try await runAsync("config-get", ConfigDTO.self) }

    /// Write the full config (shared with the TUI) by piping JSON to `agentctl gui config-save`.
    /// `completion` runs on the main thread after the write finishes (avoids a read-before-write race).
    static func configSave(_ dto: ConfigDTO, completion: (() -> Void)? = nil) {
        guard let data = try? JSONEncoder().encode(dto) else { return }
        DispatchQueue.global().async {
            if let cm = invocation() {
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
            if let completion = completion { DispatchQueue.main.async(execute: completion) }
        }
    }

    static func setTerminal(_ value: String, command: String?) {
        var a = "set-terminal '\(esc(value))'"
        if let c = command, !c.isEmpty { a += " --command '\(esc(c))'" }
        runVoid(a)
    }
    static func newDirThenLaunch(base: String, name: String, tool: String) {
        DispatchQueue.global().async {
            do {
                let data = try run("new-dir --base '\(esc(base))' --name '\(esc(name))'")
                guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let path = obj["path"] as? String else { postFailure(CmError.failed("couldn’t create the directory")); return }
                _ = try run("launch --dir '\(esc(path))' --tool '\(esc(tool))'")
            } catch { postFailure(error) }
        }
    }

    private static func esc(_ s: String) -> String { s.replacingOccurrences(of: "'", with: "'\\''") }
}
