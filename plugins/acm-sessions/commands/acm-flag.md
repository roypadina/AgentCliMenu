---
description: Flag the current session (todo, later, blocked…) so it stands out in the Agent CLI Menu
argument-hint: "<flag> [more flags] — prefix with - to remove"
allowed-tools:
  - Bash
---

Tag the session you are running in: `acm flag $ARGUMENTS`.

Flags are free-form single words (`todo`, `later`, `blocked`, `review`). Prefix one with `-` to
remove it; `acm flag --remove <flag>` does the same. With no arguments, ask the user which flag
they want. Flags are searchable in the picker's filter, so `todo` finds everything tagged that way.

Report the resulting flag list in one line.
