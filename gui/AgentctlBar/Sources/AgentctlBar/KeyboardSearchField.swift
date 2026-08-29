import SwiftUI
import AppKit

/// A search NSTextField that forwards arrow / enter / esc / tab to SwiftUI callbacks
/// while still letting you type. The list below it never needs focus — you stay in the
/// field and drive the whole picker from the keyboard.
///
/// Nav comes through the field editor's `doCommand(by:)` (delivered to the delegate as
/// `control(_:textView:doCommandBy:)`) — NOT a global key monitor. Printable characters
/// fall through to the text binding. This is the only pattern that works on macOS 12.
struct KeyboardSearchField: NSViewRepresentable {
    @Binding var text: String
    var placeholder: String
    var onMoveUp: () -> Void = {}
    var onMoveDown: () -> Void = {}
    var onSubmit: () -> Void = {}
    var onCancel: () -> Void = {}
    var onTab: () -> Void = {}
    var onShiftTab: () -> Void = {}
    var onPageUp: () -> Void = {}
    var onPageDown: () -> Void = {}
    var onHome: () -> Void = {}
    var onEnd: () -> Void = {}

    func makeNSView(context: Context) -> NSTextField {
        let field = NSTextField()
        field.placeholderString = placeholder
        field.delegate = context.coordinator
        field.isBordered = true
        field.bezelStyle = .roundedBezel
        field.focusRingType = .default
        field.font = .systemFont(ofSize: 13)
        field.cell?.usesSingleLineMode = true
        field.cell?.wraps = false
        field.cell?.isScrollable = true
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateNSView(_ nsView: NSTextField, context: Context) {
        context.coordinator.parent = self
        if nsView.stringValue != text { nsView.stringValue = text }
        nsView.placeholderString = placeholder
        // Grab focus once, as soon as we're in a window.
        if !context.coordinator.didFocus, let window = nsView.window {
            context.coordinator.didFocus = true
            DispatchQueue.main.async { window.makeFirstResponder(nsView) }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: KeyboardSearchField
        var didFocus = false
        init(_ parent: KeyboardSearchField) { self.parent = parent }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            parent.text = field.stringValue
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy sel: Selector) -> Bool {
            switch sel {
            case #selector(NSResponder.moveUp(_:)): parent.onMoveUp(); return true
            case #selector(NSResponder.moveDown(_:)): parent.onMoveDown(); return true
            case #selector(NSResponder.insertNewline(_:)): parent.onSubmit(); return true
            case #selector(NSResponder.cancelOperation(_:)): parent.onCancel(); return true
            case #selector(NSResponder.insertTab(_:)): parent.onTab(); return true
            case #selector(NSResponder.insertBacktab(_:)): parent.onShiftTab(); return true
            case #selector(NSResponder.pageUp(_:)), #selector(NSResponder.scrollPageUp(_:)):
                parent.onPageUp(); return true
            case #selector(NSResponder.pageDown(_:)), #selector(NSResponder.scrollPageDown(_:)):
                parent.onPageDown(); return true
            case #selector(NSResponder.moveToBeginningOfDocument(_:)),
                 #selector(NSResponder.scrollToBeginningOfDocument(_:)):
                parent.onHome(); return true
            case #selector(NSResponder.moveToEndOfDocument(_:)),
                 #selector(NSResponder.scrollToEndOfDocument(_:)):
                parent.onEnd(); return true
            default:
                return false
            }
        }
    }
}
