---
description: Set a reminder on the current session so the Agentctl flags it when it comes due
argument-hint: "2h | 30m | 3d | tomorrow 9am | 17:00 | an ISO date"
allowed-tools:
  - Bash
---

Set a reminder on the session you are running in: `agentctl remind $ARGUMENTS`.

Accepted forms: `30m`, `2h`, `3d`, `tomorrow`, `tomorrow 9am`, `17:00`, or an ISO date. A bare clock
time that has already passed today rolls to tomorrow. `agentctl remind --clear` drops it.

Nothing pops up on its own — the reminder shows as a red marker in the Agentctl picker once
due, and the next session start mentions it. Say that when you confirm, so the expectation is right.

Report the resolved time in one line.
