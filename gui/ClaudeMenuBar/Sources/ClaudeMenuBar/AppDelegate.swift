import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let popover = NSPopover()
    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "✦"
        statusItem.button?.toolTip = "ClaudeMenu"
        statusItem.button?.target = self
        statusItem.button?.action = #selector(statusClicked)
        statusItem.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])

        popover.behavior = .transient
        popover.contentSize = NSSize(width: 400, height: 540)
        popover.contentViewController = NSHostingController(
            rootView: ContentView(
                onAction: { [weak self] in self?.popover.performClose(nil) },
                onDetach: { [weak self] in self?.openWindow() }
            )
        )

        // Debug/preview: open the window immediately (so it can be screenshotted headlessly).
        if ProcessInfo.processInfo.environment["CM_GUI_SHOW_WINDOW"] == "1" { openWindow() }
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
        }
    }

    private func showMenu() {
        let menu = NSMenu()
        let open = NSMenuItem(title: "Open ClaudeMenu", action: #selector(togglePopover), keyEquivalent: "")
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
                contentRect: NSRect(x: 0, y: 0, width: 460, height: 600),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered, defer: false
            )
            w.title = "ClaudeMenu"
            if ProcessInfo.processInfo.environment["CM_GUI_SHOW_SETTINGS"] == "1" {
                w.contentViewController = NSHostingController(rootView: SettingsView())
            } else {
                w.contentViewController = NSHostingController(rootView: ContentView())
            }
            w.center()
            w.isReleasedWhenClosed = false
            window = w
        }
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
        if ProcessInfo.processInfo.environment["CM_GUI_SHOW_WINDOW"] == "1" {
            FileHandle.standardError.write("WINDOW_ID=\(window?.windowNumber ?? -1)\n".data(using: .utf8)!)
        }
    }

    @objc private func quit() { NSApplication.shared.terminate(nil) }
}
