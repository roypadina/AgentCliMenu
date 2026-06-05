import SwiftUI
import AppKit
import Carbon.HIToolbox

/// Click-to-record global-hotkey field. Click it, press a modifier+key combo, and it writes a
/// spec like "cmd+shift+m" that `HotKey.parse` understands. Esc (while recording) clears it.
/// Only combos HotKey can actually register are accepted — so what you record always works.
struct HotkeyRecorder: NSViewRepresentable {
    @Binding var spec: String

    func makeNSView(context: Context) -> RecorderView {
        let v = RecorderView()
        v.spec = spec
        v.onChange = { context.coordinator.parent.spec = $0 }
        return v
    }

    func updateNSView(_ v: RecorderView, context: Context) {
        context.coordinator.parent = self
        if !v.isRecording { v.spec = spec }   // don't fight the user mid-record
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    final class Coordinator { var parent: HotkeyRecorder; init(_ p: HotkeyRecorder) { parent = p } }

    /// keyCode → key string, matching HotKey.code(for:) exactly so a recorded spec round-trips.
    private static let keyForCode: [Int: String] = [
        0: "a", 1: "s", 2: "d", 3: "f", 4: "h", 5: "g", 6: "z", 7: "x", 8: "c", 9: "v",
        11: "b", 12: "q", 13: "w", 14: "e", 15: "r", 16: "y", 17: "t", 31: "o", 32: "u",
        34: "i", 35: "p", 37: "l", 38: "j", 40: "k", 45: "n", 46: "m",
        18: "1", 19: "2", 20: "3", 21: "4", 23: "5", 22: "6", 26: "7", 28: "8", 25: "9", 29: "0",
        49: "space", 36: "return", 76: "return",
    ]

    /// Pretty glyphs for display ("cmd+shift+m" → "⌘⇧M").
    static func pretty(_ spec: String) -> String {
        var out = ""
        for p in spec.lowercased().split(whereSeparator: { $0 == "+" || $0 == " " || $0 == "-" }).map(String.init) {
            switch p {
            case "cmd", "command": out += "⌘"
            case "shift": out += "⇧"
            case "ctrl", "control": out += "⌃"
            case "alt", "opt", "option": out += "⌥"
            case "space": out += "Space"
            case "return", "enter": out += "↩"
            default: out += p.uppercased()
            }
        }
        return out
    }

    final class RecorderView: NSView {
        var spec = "" { didSet { needsDisplay = true } }
        var onChange: ((String) -> Void)?
        private(set) var isRecording = false
        private var monitor: Any?

        override var acceptsFirstResponder: Bool { true }
        override var intrinsicContentSize: NSSize { NSSize(width: 180, height: 24) }

        override func draw(_ dirtyRect: NSRect) {
            let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), xRadius: 5, yRadius: 5)
            NSColor.controlBackgroundColor.setFill(); path.fill()
            (isRecording ? NSColor.controlAccentColor : NSColor.separatorColor).setStroke()
            path.lineWidth = isRecording ? 2 : 1; path.stroke()

            let text = isRecording
                ? "Press shortcut…  (esc clears)"
                : (spec.isEmpty ? "Click to record" : HotkeyRecorder.pretty(spec))
            let color: NSColor = (isRecording || spec.isEmpty) ? .secondaryLabelColor : .labelColor
            let s = NSAttributedString(string: text, attributes: [
                .font: NSFont.systemFont(ofSize: 12), .foregroundColor: color,
            ])
            s.draw(at: NSPoint(x: 8, y: (bounds.height - s.size().height) / 2))
        }

        override func mouseDown(with event: NSEvent) {
            window?.makeFirstResponder(self)
            startRecording()
        }

        private func startRecording() {
            guard !isRecording else { return }
            isRecording = true; needsDisplay = true
            monitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { [weak self] e in
                guard let self = self else { return e }
                if Int(e.keyCode) == kVK_Escape { self.commit(""); return nil }
                if let candidate = self.specFrom(e), HotKey.parse(candidate) != nil { self.commit(candidate); return nil }
                return nil   // swallow everything else while recording
            }
        }

        private func stopRecording() {
            isRecording = false
            if let m = monitor { NSEvent.removeMonitor(m); monitor = nil }
            needsDisplay = true
        }

        private func commit(_ value: String) {
            spec = value
            onChange?(value)
            stopRecording()
            window?.makeFirstResponder(nil)
        }

        override func resignFirstResponder() -> Bool { stopRecording(); return true }
        deinit { if let m = monitor { NSEvent.removeMonitor(m) } }

        /// modifier+key from an event → spec, or nil if it lacks a modifier or an unsupported key.
        private func specFrom(_ e: NSEvent) -> String? {
            var parts: [String] = []
            let f = e.modifierFlags
            if f.contains(.command) { parts.append("cmd") }
            if f.contains(.shift) { parts.append("shift") }
            if f.contains(.control) { parts.append("ctrl") }
            if f.contains(.option) { parts.append("alt") }
            guard !parts.isEmpty, let key = HotkeyRecorder.keyForCode[Int(e.keyCode)] else { return nil }
            parts.append(key)
            return parts.joined(separator: "+")
        }
    }
}
