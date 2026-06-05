import Carbon.HIToolbox
import AppKit

/// A single global hotkey (Carbon RegisterEventHotKey). Spec like "cmd+shift+m".
final class HotKey {
    private var ref: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?
    var onFire: (() -> Void)?

    func register(_ spec: String?) {
        unregister()
        guard let spec = spec, let (keyCode, mods) = HotKey.parse(spec) else { return }

        var type = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let callback: EventHandlerUPP = { (_, _, userData) -> OSStatus in
            guard let userData = userData else { return noErr }
            let me = Unmanaged<HotKey>.fromOpaque(userData).takeUnretainedValue()
            DispatchQueue.main.async { me.onFire?() }
            return noErr
        }
        InstallEventHandler(GetApplicationEventTarget(), callback, 1, &type,
                            Unmanaged.passUnretained(self).toOpaque(), &handlerRef)

        let id = EventHotKeyID(signature: OSType(0x434D4E55) /* 'CMNU' */, id: 1)
        RegisterEventHotKey(keyCode, mods, id, GetApplicationEventTarget(), 0, &ref)
    }

    func unregister() {
        if let r = ref { UnregisterEventHotKey(r); ref = nil }
        if let h = handlerRef { RemoveEventHandler(h); handlerRef = nil }
    }

    /// "cmd+shift+m" / "⌥ space" → (virtual keyCode, Carbon modifier mask). Needs ≥1 modifier.
    static func parse(_ s: String) -> (UInt32, UInt32)? {
        let parts = s.lowercased().split(whereSeparator: { $0 == " " || $0 == "+" || $0 == "-" }).map(String.init)
        var mods: UInt32 = 0
        var keyCode: UInt32?
        for p in parts {
            switch p {
            case "cmd", "command", "⌘": mods |= UInt32(cmdKey)
            case "shift", "⇧": mods |= UInt32(shiftKey)
            case "ctrl", "control", "⌃": mods |= UInt32(controlKey)
            case "alt", "opt", "option", "⌥": mods |= UInt32(optionKey)
            default: keyCode = code(for: p)
            }
        }
        guard let kc = keyCode, mods != 0 else { return nil }
        return (kc, mods)
    }

    private static func code(for k: String) -> UInt32? {
        let map: [String: Int] = [
            "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9,
            "b": 11, "q": 12, "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "o": 31, "u": 32,
            "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
            "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25, "0": 29,
            "space": 49, "return": 36, "enter": 36,
        ]
        return map[k].map(UInt32.init)
    }
}
