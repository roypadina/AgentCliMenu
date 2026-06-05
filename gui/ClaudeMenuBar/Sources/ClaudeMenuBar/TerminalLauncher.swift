import Foundation

enum TerminalLauncher {
    /// Launch the chosen terminal running `command`. The command is passed to osascript as an
    /// argv element (after --), never interpolated into the script body → no AppleScript injection.
    static func launch(terminal: String, command: String, custom: String?) {
        switch terminal {
        case "iTerm":
            runOsascript([
                "on run argv",
                "tell application \"iTerm\"",
                "  create window with default profile command (item 1 of argv)",
                "  activate",
                "end tell",
                "end run",
            ], arg: command)
        case "custom":
            guard let tmpl = custom else { return }
            let full = tmpl.replacingOccurrences(of: "{{cmd}}", with: command)
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/bin/sh")
            p.arguments = ["-c", full]
            try? p.run()
        default: // Terminal
            runOsascript([
                "on run argv",
                "tell application \"Terminal\"",
                "  do script (item 1 of argv)",
                "  activate",
                "end tell",
                "end run",
            ], arg: command)
        }
    }

    private static func runOsascript(_ lines: [String], arg: String) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        var args: [String] = []
        for l in lines { args.append("-e"); args.append(l) }
        args.append("--")
        args.append(arg)
        p.arguments = args
        try? p.run()
    }
}
