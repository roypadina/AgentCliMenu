import AppKit

// Menu-bar–only agent (no dock icon). Top-level code runs on the main thread at launch, so
// assume main-actor isolation to drive the @MainActor AppDelegate + (main-actor) NSApplication.
MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
}
