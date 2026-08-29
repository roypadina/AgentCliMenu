---
description: Mark the current session finished (or reopen it) in the Agent CLI Menu
allowed-tools:
  - Bash
---

Mark the session you are running in as finished: `acm done`. To reopen it: `acm done --undo`.

Done sessions keep a ✓ in the picker and can be hidden with `h`. If `$ARGUMENTS` mentions undo,
reopen instead of closing.

Report the result in one line.
