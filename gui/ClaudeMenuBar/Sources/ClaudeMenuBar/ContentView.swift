import SwiftUI

extension Color {
    init(hex: String) {
        let h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var v: UInt64 = 0
        Scanner(string: h).scanHexInt64(&v)
        if h.count == 6 {
            self = Color(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
        } else { self = .gray }
    }
}

enum Tab: String, CaseIterable { case new = "New", resume = "Resume" }

struct ContentView: View {
    var onAction: () -> Void = {}
    var onDetach: (() -> Void)?

    @State private var tab: Tab = .new
    @State private var projects: ProjectsResponse?
    @State private var sessions: [Session] = []
    @State private var search = ""
    @State private var selectedTool = ""
    @State private var loading = false
    @State private var errorText: String?
    @State private var showSettings = false
    @State private var showNewDir = false

    var body: some View {
        VStack(spacing: 8) {
            header
            if let e = errorText {
                Text(e).font(.caption).foregroundColor(.red).lineLimit(3)
            }
            if tab == .new { newList } else { resumeList }
        }
        .padding(10)
        .frame(minWidth: 380, idealWidth: 400, maxWidth: .infinity, minHeight: 420, idealHeight: 560, maxHeight: .infinity)
        .task { await loadAll() }
        .onReceive(NotificationCenter.default.publisher(for: .cmReload)) { _ in Task { await reload() } }
        .sheet(isPresented: $showSettings) { SettingsView(onSaved: { Task { await reload() } }) }
        .sheet(isPresented: $showNewDir) {
            NewDirView(groups: projects?.groups ?? [], tool: selectedTool) { onAction() }
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            HStack {
                Picker("", selection: $tab) {
                    ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented).labelsHidden().frame(width: 170)
                Spacer()
                if let onDetach = onDetach {
                    Button(action: onDetach) { Image(systemName: "macwindow") }.buttonStyle(.borderless).help("Open in a window")
                }
                Button { showSettings = true } label: { Image(systemName: "gearshape") }.buttonStyle(.borderless).help("Settings")
            }
            TextField(tab == .new ? "Filter projects…" : "Search sessions…", text: $search)
                .textFieldStyle(.roundedBorder)
        }
    }

    // ── New ──
    private var newList: some View {
        VStack(spacing: 6) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(projects?.groups ?? []) { g in
                        let dirs = g.dirs.filter { match($0.name, $0.path) }
                        if !dirs.isEmpty {
                            Text(g.name).font(.caption).bold().foregroundColor(Color(hex: g.color))
                                .padding(.top, 6)
                            ForEach(dirs) { d in dirRow(d) }
                        }
                    }
                    if (projects?.groups.isEmpty ?? true) {
                        Text("No groups configured.\nRun: cm config --setup").font(.caption).foregroundColor(.secondary).padding()
                    }
                }
            }
            HStack {
                Button { showNewDir = true } label: { Label("New dir", systemImage: "plus") }.buttonStyle(.borderless)
                Spacer()
                if let tools = projects?.tools, !tools.isEmpty {
                    Picker("", selection: $selectedTool) {
                        ForEach(tools) { Text($0.name).tag($0.name) }
                    }.labelsHidden().frame(width: 110)
                }
            }
        }
    }

    private func dirRow(_ d: Dir) -> some View {
        Button { Cm.launch(dir: d.path, tool: selectedTool); onAction() } label: {
            HStack {
                Text(d.name)
                if let b = d.branch { Text("⎇ \(b)").font(.caption2).foregroundColor(.purple) }
                Spacer()
                Text(age(d.timeMs)).font(.caption2).foregroundColor(.secondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain).padding(.vertical, 2).padding(.horizontal, 6)
    }

    // ── Resume ──
    private var resumeList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
                ForEach(sessions.filter { match($0.name, $0.cwd) }) { s in
                    Button { Cm.resume(id: s.id); onAction() } label: {
                        HStack {
                            Circle().fill(statusColor(s.status)).frame(width: 7, height: 7)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(s.name).lineLimit(1)
                                Text(tilde(s.cwd)).font(.caption2).foregroundColor(.secondary).lineLimit(1)
                            }
                            Spacer()
                            if let b = s.gitBranch { Text("⎇ \(b)").font(.caption2).foregroundColor(.purple) }
                        }.contentShape(Rectangle())
                    }.buttonStyle(.plain).padding(.vertical, 2).padding(.horizontal, 6)
                }
                if loading && sessions.isEmpty { Text("loading…").font(.caption).foregroundColor(.secondary).padding() }
            }
        }
        .task(id: tab) { if tab == .resume { await loadSessions() } }
    }

    // ── helpers ──
    private func match(_ a: String, _ b: String) -> Bool {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty || a.lowercased().contains(q) || b.lowercased().contains(q)
    }
    private func statusColor(_ s: String) -> Color { s == "busy" ? .green : s == "idle" ? .yellow : .gray }
    private func tilde(_ p: String) -> String { p.replacingOccurrences(of: NSHomeDirectory(), with: "~") }
    private func age(_ ms: Double) -> String {
        let diff = Date().timeIntervalSince1970 - ms / 1000
        if diff < 3600 { return "\(Int(diff/60))m" }
        if diff < 86400 { return "\(Int(diff/3600))h" }
        if diff < 604800 { return "\(Int(diff/86400))d" }
        return "\(Int(diff/604800))w"
    }

    private func loadAll() async {
        loading = true; defer { loading = false }
        do {
            let p = try await Cm.projects()
            projects = p
            if selectedTool.isEmpty { selectedTool = p.defaultTool.isEmpty ? (p.tools.first?.name ?? "cld") : p.defaultTool }
        } catch { errorText = describe(error) }
    }
    private func loadSessions() async {
        guard sessions.isEmpty else { return }
        loading = true; defer { loading = false }
        do { sessions = try await Cm.sessions() } catch { errorText = describe(error) }
    }
    /// Force a fresh fetch (popover reopen / after a config save).
    private func reload() async {
        errorText = nil
        sessions = []
        await loadAll()
        if tab == .resume { await loadSessions() }
    }
    private func describe(_ e: Error) -> String {
        if case CmError.notFound = e { return "cm not found. Install it (brew or npm link)." }
        if case CmError.failed(let m) = e { return "cm error: \(m)" }
        return "\(e)"
    }
}

// ── New dir sheet ──
struct NewDirView: View {
    let groups: [Group]
    let tool: String
    var onDone: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var base = ""
    @State private var name = ""

    private var bases: [(label: String, path: String)] {
        var out: [(String, String)] = []
        for g in groups {
            out.append(("\(g.name)/", g.path))
            for d in g.dirs { out.append(("\(g.name)/\(d.name)", d.path)) }
        }
        return out
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("New directory").font(.headline)
            Picker("Under", selection: $base) {
                ForEach(bases, id: \.path) { Text($0.label).tag($0.path) }
            }
            TextField("New dir name", text: $name)
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Create & open") {
                    if !base.isEmpty && !name.trimmingCharacters(in: .whitespaces).isEmpty {
                        Cm.newDirThenLaunch(base: base, name: name, tool: tool)
                        dismiss(); onDone()
                    }
                }.keyboardShortcut(.defaultAction)
            }
        }
        .padding(16).frame(width: 360)
        .onAppear { if base.isEmpty { base = bases.first?.path ?? "" } }
    }
}

