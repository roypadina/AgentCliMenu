---
description: Attach a note to the current session, visible in the Agent CLI Menu picker
argument-hint: "[the note text]"
allowed-tools:
  - Bash
---

Attach a note to the session you are running in, so future-you sees it in the picker.

- With `$ARGUMENTS`: run `acm note --append $ARGUMENTS`
- Without: write a two-line summary of where this session stands and what the next step is, show it
  to the user for approval, then save it with `acm note --append "<text>"`.

`acm note --clear` removes it. The note targets the current session — never pass `-s`.

Report the result in one line.
