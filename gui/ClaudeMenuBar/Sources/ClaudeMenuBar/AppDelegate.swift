import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "✦"
            button.toolTip = "ClaudeMenu"
        }

        let menu = NSMenu()
        add(menu, "New session", #selector(openNew), "n")
        add(menu, "Resume session…", #selector(openResume), "r")
        menu.addItem(.separator())
        add(menu, "Edit config", #selector(editConfig), ",")
        menu.addItem(.separator())
        add(menu, "Quit ClaudeMenu", #selector(quit), "q")
        statusItem.menu = menu
    }

    private func add(_ menu: NSMenu, _ title: String, _ action: Selector, _ key: String) {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        menu.addItem(item)
    }

    @objc private func openNew() { CmRunner.shared.launch(entry: "new") }
    @objc private func openResume() { CmRunner.shared.launch(entry: "resume") }
    @objc private func editConfig() { CmRunner.shared.editConfig() }
    @objc private func quit() { NSApplication.shared.terminate(nil) }
}
