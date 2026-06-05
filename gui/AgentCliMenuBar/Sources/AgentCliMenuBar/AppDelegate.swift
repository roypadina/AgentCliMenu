import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let popover = NSPopover()
    private var window: NSWindow?
    private let hotKey = HotKey()

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "✦"
        statusItem.button?.toolTip = "AgentCliMenu"
        statusItem.button?.target = self
        statusItem.button?.action = #selector(statusClicked)
        statusItem.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])

        popover.behavior = .transient
        popover.contentSize = NSSize(width: 400, height: 560)
        popover.contentViewController = NSHostingController(
            rootView: ContentView(
                onAction: { [weak self] in self?.popover.performClose(nil) },
                onDetach: { [weak self] in self?.openWindow() }
            )
        )

        // Global shortcut → open the window; re-register when settings change.
        hotKey.onFire = { [weak self] in self?.openWindow() }
        refreshHotkey()
        NotificationCenter.default.addObserver(self, selector: #selector(refreshHotkey), name: .cmHotkeyChanged, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(actionFailed(_:)), name: .cmActionFailed, object: nil)

        if ProcessInfo.processInfo.environment["CM_GUI_SHOW_WINDOW"] == "1" { openWindow() }
    }

    @objc private func refreshHotkey() {
        Task { [weak self] in
            let spec = (try? await Cm.configGet())?.hotkey
            await MainActor.run { self?.hotKey.register(spec) }
        }
    }

    @objc private func statusClicked() {
        if NSApp.currentEvent?.type == .rightMouseUp { showMenu(); return }
        togglePopover()
    }

    @objc private func togglePopover() {
        guard let button = statusItem.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
            NotificationCenter.default.post(name: .cmReload, object: nil) // refresh each open
        }
    }

    private func showMenu() {
        let menu = NSMenu()
        let open = NSMenuItem(title: "Open AgentCliMenu", action: #selector(togglePopover), keyEquivalent: "")
        let win = NSMenuItem(title: "Open in window", action: #selector(openWindow), keyEquivalent: "")
        let quitItem = NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q")
        for item in [open, win, quitItem] { item.target = self }
        menu.addItem(open); menu.addItem(win); menu.addItem(.separator()); menu.addItem(quitItem)
        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil // restore left-click → popover after this menu closes
    }

    @objc private func openWindow() {
        popover.performClose(nil)
        if window == nil {
            let w = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 820, height: 820),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered, defer: false
            )
            w.title = "AgentCliMenu"
            w.minSize = NSSize(width: 460, height: 460)
            if ProcessInfo.processInfo.environment["CM_GUI_SHOW_SETTINGS"] == "1" {
                w.contentViewController = NSHostingController(rootView: SettingsView())
            } else {
                w.contentViewController = NSHostingController(rootView: ContentView())
            }
            w.center()
            // Remember the user's size/position across launches.
            w.setFrameAutosaveName("AgentCliMenuWindow")
            w.isReleasedWhenClosed = false
            window = w
        }
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
        if ProcessInfo.processInfo.environment["CM_GUI_SHOW_WINDOW"] == "1" {
            FileHandle.standardError.write("WINDOW_ID=\(window?.windowNumber ?? -1)\n".data(using: .utf8)!)
        }
    }

    /// A fire-and-forget launch/resume failed — the popover has already closed, so surface it as an alert.
    @objc private func actionFailed(_ note: Notification) {
        let msg = (note.object as? String) ?? "the action failed."
        NSSound.beep()
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "AgentCliMenu couldn’t open that session"
        alert.informativeText = msg
        alert.addButton(withTitle: "OK")
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }

    @objc private func quit() { NSApplication.shared.terminate(nil) }
}
