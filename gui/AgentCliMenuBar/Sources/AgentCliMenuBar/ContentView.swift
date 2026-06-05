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

/// A New-tab group plus its fuzzy-filtered dirs and the flat-list index of its first dir.
private struct NewSection: Identifiable { let group: Group; let dirs: [Dir]; let start: Int; var id: String { group.id } }

struct ContentView: View {
    var onAction: () -> Void = {}
    var onDetach: (() -> Void)?

    @State private var tab: Tab = ProcessInfo.processInfo.environment["CM_GUI_START_TAB"] == "resume" ? .resume : .new
    @State private var projects: ProjectsResponse?
    @State private var sessions: [Session] = []
    @State private var search = ""
    @State private var selectedTool = ""
    @State private var loading = false
    @State private var sessionsLoaded = false
    @State private var errorText: String?
    @State private var showSettings = false
    @State private var showNewDir = false

    // keyboard-driven selection (index into the active tab's flat list)
    @State private var selection = 0
    @State private var confirmResumeId: String?   // cwd-confidence gate: 2nd Enter confirms

    // resume peek split
    @State private var showPeek = ProcessInfo.processInfo.environment["CM_GUI_PEEK"] == "1"
    @State private var peekCache: [String: [PeekTurn]] = [:]
    @State private var peekLoadingId: String?
    @State private var peekFailed: Set<String> = []   // ids whose transcript read failed (don't auto-retry)

    private var query: String { search.trimmingCharacters(in: .whitespaces) }

    // ── derived lists ──
    private var newSections: [(group: Group, dirs: [Dir], start: Int)] {
        var out: [(Group, [Dir], Int)] = []
        var start = 0
        for g in projects?.groups ?? [] {
            let dirs = Fuzzy.rank(query, g.dirs) { "\($0.name)  \($0.path)" }
            if dirs.isEmpty { continue }
            out.append((g, dirs, start))
            start += dirs.count
        }
        return out
    }
    private var newFlat: [Dir] { newSections.flatMap { $0.dirs } }
    private var resumeItems: [Session] {
        Fuzzy.rank(query, sessions) { "\($0.name)  \(tilde($0.cwd))  \($0.id)" }
    }
    private var count: Int { tab == .new ? newFlat.count : resumeItems.count }
    private var selIndex: Int { min(max(0, selection), max(0, count - 1)) }
    private var selectedSession: Session? {
        guard tab == .resume, selIndex < resumeItems.count else { return nil }
        return resumeItems[selIndex]
    }

    var body: some View {
        VStack(spacing: 8) {
            header
            if let e = errorText {
                Label(e, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption).foregroundColor(.red).lineLimit(3)
            }
            if tab == .new {
                newList
            } else if showPeek {
                HStack(alignment: .top, spacing: 8) { resumeList; Divider(); peekPane }
            } else {
                resumeList
            }
        }
        .padding(10)
        .frame(minWidth: 380, idealWidth: 460, maxWidth: .infinity, minHeight: 420, idealHeight: 560, maxHeight: .infinity)
        .task { await loadAll() }
        .onChange(of: search) { _ in selection = 0; confirmResumeId = nil }
        .onChange(of: tab) { _ in selection = 0; confirmResumeId = nil }
        .onReceive(NotificationCenter.default.publisher(for: .cmReload)) { _ in Task { await reload() } }
        .sheet(isPresented: $showSettings) { SettingsView(onSaved: { Task { await reload() } }) }
        .sheet(isPresented: $showNewDir) {
            NewDirView(groups: projects?.groups ?? [], tool: selectedTool) { onAction() }
        }
    }

    // ── header ──
    private var header: some View {
        VStack(spacing: 6) {
            HStack {
                Picker("", selection: $tab) {
                    ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented).labelsHidden().frame(width: 170)
                .accessibilityLabel("New or Resume")
                Spacer()
                if tab == .resume {
                    Button { showPeek.toggle() } label: { Image(systemName: showPeek ? "sidebar.right" : "eye") }
                        .buttonStyle(.borderless).help(showPeek ? "Hide preview (⌘P)" : "Preview transcript (⌘P)")
                        .keyboardShortcut("p", modifiers: .command)
                        .accessibilityLabel("Toggle transcript preview")
                }
                if let onDetach = onDetach {
                    Button(action: onDetach) { Image(systemName: "macwindow") }.buttonStyle(.borderless).help("Open in a window")
                }
                Button { showSettings = true } label: { Image(systemName: "gearshape") }.buttonStyle(.borderless).help("Settings")
            }
            KeyboardSearchField(
                text: $search,
                placeholder: tab == .new ? "Filter projects…  (↑↓ select · ⏎ open · ⇥ Resume)" : "Search sessions…  (↑↓ select · ⏎ resume · ⇥ New)",
                onMoveUp: { move(-1) },
                onMoveDown: { move(1) },
                onSubmit: activate,
                onCancel: cancel,
                onTab: { tab = tab == .new ? .resume : .new },
                onShiftTab: { if tab == .new { cycleTool() } else { tab = .new } },
                onPageUp: { move(-8) },
                onPageDown: { move(8) },
                onHome: { selection = 0; confirmResumeId = nil },
                onEnd: { selection = max(0, count - 1); confirmResumeId = nil }
            )
        }
    }

    // ── New ──
    private var newList: some View {
        VStack(spacing: 6) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 1) {
                        ForEach(newSections, id: \.group.id) { sec in
                            Text(sec.group.name).font(.caption).bold().foregroundColor(Color(hex: sec.group.color))
                                .padding(.top, 6)
                            ForEach(Array(sec.dirs.enumerated()), id: \.element.id) { i, d in
                                dirRow(d, index: sec.start + i).id(sec.start + i)
                            }
                        }
                        if newFlat.isEmpty {
                            emptyState(
                                (projects?.groups.isEmpty ?? true)
                                    ? "No groups configured.\nRun: cm config --setup"
                                    : query.isEmpty ? "No project dirs found." : "No matches for “\(query)”."
                            )
                        }
                    }
                }
                .onChange(of: selection) { _ in withAnimation(.easeOut(duration: 0.12)) { proxy.scrollTo(selIndex, anchor: .center) } }
            }
            HStack {
                Button { showNewDir = true } label: { Label("New dir", systemImage: "plus") }.buttonStyle(.borderless)
                Spacer()
                if let tools = projects?.tools, !tools.isEmpty, !selectedTool.isEmpty {
                    Picker("", selection: $selectedTool) {
                        ForEach(tools) { Text($0.name).tag($0.name) }
                    }.labelsHidden().frame(width: 110).help("Tool to launch (⇧⇥)")
                }
            }
        }
    }

    private func dirRow(_ d: Dir, index: Int) -> some View {
        let sel = index == selIndex
        return Button { selection = index; Cm.launch(dir: d.path, tool: selectedTool); onAction() } label: {
            HStack {
                Text(d.name).fontWeight(sel ? .semibold : .regular)
                if let b = d.branch { Text("⎇ \(b)").font(.caption2).foregroundColor(.purple) }
                Spacer()
                Text(age(d.timeMs)).font(.caption2).foregroundColor(.secondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, 3).padding(.horizontal, 6)
        .background(rowBackground(sel))
        .accessibilityLabel("\(d.name)\(d.branch.map { ", branch \($0)" } ?? "")")
    }

    // ── Resume ──
    private var resumeList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 1) {
                    ForEach(Array(resumeItems.enumerated()), id: \.element.id) { i, s in
                        sessionRow(s, index: i).id(i)
                    }
                    if !sessionsLoaded {
                        HStack(spacing: 6) { ProgressView().controlSize(.small); Text("loading…").font(.caption).foregroundColor(.secondary) }.padding()
                    } else if resumeItems.isEmpty {
                        emptyState(sessions.isEmpty ? "No sessions yet." : "No matches for “\(query)”.")
                    }
                }
            }
            .onChange(of: selection) { _ in withAnimation(.easeOut(duration: 0.12)) { proxy.scrollTo(selIndex, anchor: .center) } }
            .task(id: tab) { if tab == .resume { await loadSessions() } }
        }
    }

    private func sessionRow(_ s: Session, index: Int) -> some View {
        let sel = index == selIndex
        let confirming = confirmResumeId == s.id && sel
        return Button { selection = index; activate() } label: {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Image(systemName: "circle.fill").font(.system(size: 9)).foregroundColor(statusColor(s.status))
                        .help(statusText(s.status)).accessibilityLabel(statusText(s.status))
                    if !s.cwdConfident {
                        Image(systemName: "exclamationmark.triangle.fill").font(.caption2).foregroundColor(.orange)
                            .help("cwd uncertain — confirm before resuming")
                    }
                    Text(s.name).fontWeight(sel ? .semibold : .regular).lineLimit(1)
                    Spacer()
                    if let b = s.gitBranch { Text("⎇ \(b)").font(.caption2).foregroundColor(.purple) }
                }
                Text(tilde(s.cwd)).font(.caption2).foregroundColor(.secondary).lineLimit(1)
                if confirming {
                    Text("⚠ cwd uncertain — press ⏎ again to resume anyway, esc to cancel")
                        .font(.caption2).foregroundColor(.orange)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, 3).padding(.horizontal, 6)
        .background(rowBackground(sel))
        .accessibilityLabel("\(s.name), \(statusText(s.status)), \(tilde(s.cwd))")
    }

    // ── peek pane (Resume split) ──
    private var peekPane: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let s = selectedSession {
                Text(s.name).font(.caption).bold().lineLimit(1)
                Divider()
                if peekLoadingId == s.id {
                    HStack(spacing: 6) { ProgressView().controlSize(.small); Text("loading…").font(.caption2).foregroundColor(.secondary) }
                } else if peekFailed.contains(s.id) {
                    Text("(couldn’t read transcript)").font(.caption2).foregroundColor(.secondary)
                } else if let turns = peekCache[s.id] {
                    if turns.isEmpty {
                        Text("(empty transcript)").font(.caption2).foregroundColor(.secondary)
                    } else {
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 3) {
                                ForEach(Array(turns.enumerated()), id: \.offset) { _, t in
                                    HStack(alignment: .top, spacing: 4) {
                                        Text("[\(t.role)]").font(.system(size: 10, design: .monospaced)).foregroundColor(roleColor(t.role))
                                        Text(t.text).font(.system(size: 10)).foregroundColor(.primary).lineLimit(4)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Color.clear
                }
            } else {
                Text("Select a session").font(.caption2).foregroundColor(.secondary)
            }
            Spacer(minLength: 0)
        }
        .frame(width: 300)
        // Debounced fetch: only fires 300ms after selection settles; cached per id.
        .task(id: selectedSession?.id) { await loadPeek() }
    }

    private func loadPeek() async {
        guard let s = selectedSession, peekCache[s.id] == nil, !peekFailed.contains(s.id) else { return }
        try? await Task.sleep(nanoseconds: 300_000_000)
        if Task.isCancelled { return }
        peekLoadingId = s.id
        do {
            let turns = try await Cm.peek(id: s.id)
            if Task.isCancelled { return }
            peekCache[s.id] = turns
        } catch {
            peekFailed.insert(s.id)
        }
        peekLoadingId = nil
    }

    // ── keyboard actions ──
    private func move(_ delta: Int) {
        guard count > 0 else { return }
        selection = min(max(0, selIndex + delta), count - 1)
        confirmResumeId = nil
    }
    private func activate() {
        if tab == .new {
            guard selIndex < newFlat.count else { return }
            let d = newFlat[selIndex]
            Cm.launch(dir: d.path, tool: selectedTool); onAction()
        } else {
            guard let s = selectedSession else { return }
            if !s.cwdConfident && confirmResumeId != s.id { confirmResumeId = s.id; return }
            Cm.resume(id: s.id); onAction()
        }
    }
    private func cancel() {
        if confirmResumeId != nil { confirmResumeId = nil; return }
        if !search.isEmpty { search = ""; return }
        onAction() // closes the popover (no-op in a window)
    }
    private func cycleTool() {
        guard let tools = projects?.tools, !tools.isEmpty else { return }
        let i = tools.firstIndex { $0.name == selectedTool } ?? -1
        selectedTool = tools[(i + 1) % tools.count].name
    }

    // ── helpers ──
    @ViewBuilder private func rowBackground(_ sel: Bool) -> some View {
        if sel { RoundedRectangle(cornerRadius: 5).fill(Color.accentColor.opacity(0.22)) }
        else { Color.clear }
    }
    private func emptyState(_ s: String) -> some View {
        Text(s).font(.caption).foregroundColor(.secondary).frame(maxWidth: .infinity, alignment: .leading).padding()
    }
    private func roleColor(_ r: String) -> Color {
        switch r { case "user": return .cyan; case "assistant": return .green; case "tool": return .orange; default: return .secondary }
    }
    private func statusColor(_ s: String) -> Color { s == "busy" ? .green : s == "idle" ? .yellow : .gray }
    private func statusText(_ s: String) -> String { s == "busy" ? "busy" : s == "idle" ? "idle" : "inactive" }
    private func tilde(_ p: String) -> String { p.replacingOccurrences(of: NSHomeDirectory(), with: "~") }
    private func age(_ ms: Double) -> String {
        let diff = Date().timeIntervalSince1970 - ms / 1000
        if diff < 3600 { return "\(Int(diff/60))m" }
        if diff < 86400 { return "\(Int(diff/3600))h" }
        if diff < 604800 { return "\(Int(diff/86400))d" }
        return "\(Int(diff/604800))w"
    }

    // ── data ──
    private func loadAll() async {
        loading = true; defer { loading = false }
        do {
            let p = try await Cm.projects()
            projects = p
            if selectedTool.isEmpty { selectedTool = p.defaultTool.isEmpty ? (p.tools.first?.name ?? "cld") : p.defaultTool }
        } catch { errorText = describe(error) }
    }
    private func loadSessions() async {
        guard !sessionsLoaded else { return }
        loading = true; defer { loading = false }
        do { sessions = try await Cm.sessions(); sessionsLoaded = true } catch { errorText = describe(error) }
    }
    private func reload() async {
        errorText = nil; sessions = []; sessionsLoaded = false; peekCache = [:]; peekFailed = []
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
