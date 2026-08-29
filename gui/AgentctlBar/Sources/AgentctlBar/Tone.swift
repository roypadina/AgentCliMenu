import SwiftUI
import AppKit

/// One hue, one meaning. The palette is small on purpose: a session list where six things are
/// coloured is a sticker collection, and colour stops carrying information. Every value is a
/// system colour, so it adapts to appearance and stays legible over the popover's vibrancy —
/// the discipline is the choice here, not the hexes.
enum Tone {
    /// Busy, and done. Nothing else is ever green.
    static let ok = Color(nsColor: .systemGreen)
    /// Idle. Nothing else is ever yellow.
    static let idle = Color(nsColor: .systemYellow)
    /// Inactive.
    static let off = Color(nsColor: .tertiaryLabelColor)
    /// Git branch, in both tabs. The terminal menu's magenta.
    static let branch = Color(nsColor: .systemPurple)
    /// "You changed something, or trust this less" — a working directory that is a guess, a list
    /// filter that is on, an account override, a session moved off the default shelf.
    static let warn = Color(nsColor: .systemOrange)
    /// A reminder that has come due, a date that has passed, an error. Never an action button:
    /// red is the platform's word for destruction, and nothing here destroys anything.
    static let alarm = Color(nsColor: .systemRed)
}
