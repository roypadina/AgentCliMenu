import SwiftUI
import AppKit

/// The keyboard map, shared by the ⌘/ sheet and the key handler so the two can never drift.
///
/// The letters match the terminal menu's — `e` names a session there, ⌘E names it here — because
/// the two are one product and nobody should have to learn it twice. ⌘ is what separates a command
/// from typing: the search field owns every plain keystroke, permanently, by design.
/// Where macOS already owns a combination (⌘H hides the app, ⌘X/⌘C/⌘V edit text) the shift
/// variant is used instead, and delete takes Finder's ⌘⌫.
enum Shortcut {
    struct Row: Identifiable {
        let keys: String
        let what: String
        var id: String { keys }
    }

    struct Group: Identifiable {
        let title: String
        let rows: [Row]
        var id: String { title }
    }

    static let groups: [Group] = [
        Group(title: "Move & open", rows: [
            Row(keys: "↑ ↓", what: "Move the selection"),
            Row(keys: "⏎", what: "Resume the selected session"),
            Row(keys: "⌘P", what: "Show or hide the details pane"),
            Row(keys: "⌘R", what: "Recap this session — claude -p, cached"),
            Row(keys: "⇧⌘C", what: "Copy its resume command"),
            Row(keys: "⇥", what: "Switch between New and Resume"),
            Row(keys: "esc", what: "Clear the search, then close"),
        ]),
        Group(title: "Find", rows: [
            Row(keys: "type", what: "Filter as you type — no need to click first"),
            Row(keys: "⌘F", what: "Clear the search and start over"),
            Row(keys: "⇧⌘D", what: "Show or hide sessions marked done"),
            Row(keys: "⇧⌘T", what: "Tool runs: all, interactive only, tool only"),
            Row(keys: "⇧⌘V", what: "Show hidden sessions"),
            Row(keys: "⇧⌘R", what: "Reload from disk"),
        ]),
        Group(title: "Annotate the selected session", rows: [
            Row(keys: "⌘E", what: "Name it"),
            Row(keys: "⇧⌘N", what: "Write a note"),
            Row(keys: "⌘L", what: "Labels — a ticket, a repo, a topic"),
            Row(keys: "⇧⌘F", what: "Flags — todo, later, blocked"),
            Row(keys: "⌘T", what: "Remind me about it"),
            Row(keys: "⌘U", what: "Set when the work is due"),
            Row(keys: "⌘D", what: "Mark it done"),
            Row(keys: "⇧⌘H", what: "Hide it from the normal list"),
            Row(keys: "⌘⌫", what: "Take it out of every list — recoverable"),
        ]),
        Group(title: "Other", rows: [
            Row(keys: "⇧⌘A", what: "Change which Claude account resumes it"),
            Row(keys: "⌘/", what: "This list"),
        ]),
    ]
}

/// Which annotation field a shortcut jumps to.
enum AnnField: Hashable { case name, labels, flags, note, remind, due }

/// Hands the hosting `NSWindow` back to SwiftUI. The popover and the detached window each host
/// their own `ContentView`, and a local event monitor sees keystrokes meant for either — so each
/// copy has to know which window is its own before it claims a key.
struct WindowReader: NSViewRepresentable {
    let onWindow: (NSWindow?) -> Void

    final class Coordinator {
        /// Last window handed up. Reporting unconditionally writes @State on every update, and
        /// @State has no equality short-circuit — the write invalidates the body, which updates
        /// this view, which writes again. That is a render loop bounded only by the run loop.
        var last: NSWindow?
        var reported = false
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSView { NSView(frame: .zero) }

    func updateNSView(_ nsView: NSView, context: Context) {
        let window = nsView.window
        guard !context.coordinator.reported || window !== context.coordinator.last else { return }
        context.coordinator.reported = true
        context.coordinator.last = window
        DispatchQueue.main.async { onWindow(window) }
    }
}

/// The ⌘/ sheet. A menu-bar app has no menu bar, so this is the only place the shortcuts live.
struct ShortcutsSheet: View {
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Keyboard").font(.headline)
                Spacer()
                Button("Done", action: onClose).keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 10)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Shortcut.groups) { group in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(group.title.uppercased())
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.secondary)
                                .kerning(0.6)
                            ForEach(group.rows) { row in
                                HStack(alignment: .firstTextBaseline, spacing: 10) {
                                    Text(row.keys)
                                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                                        .frame(width: 62, alignment: .trailing)
                                        .foregroundColor(.primary)
                                    Text(row.what)
                                        .font(.system(size: 12))
                                        .foregroundColor(.secondary)
                                    Spacer(minLength: 0)
                                }
                            }
                        }
                    }
                    Text("The letters match the terminal menu — press ? there for the same list.")
                        .font(.caption2).foregroundColor(.secondary)
                        .padding(.top, 2)
                }
                .padding(.horizontal, 16).padding(.vertical, 14)
            }
        }
        .frame(width: 360, height: 460)
    }
}
