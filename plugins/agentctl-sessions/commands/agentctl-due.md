---
description: Set when the work in this session is actually due
argument-hint: "3d | tomorrow 9am | \"friday 17:00\" | an ISO date"
allowed-tools:
  - Bash
---

Set a due date on the session you are running in: `agentctl due $ARGUMENTS`.

A due date is when the *work* is due — distinct from `/agentctl-remind`, which is just a nudge.
Once it passes, the session shows as overdue in the picker and in `agentctl annotations --due`.
`agentctl due --clear` drops it.

Nothing pops up on its own — say so when you confirm, so the expectation is right.

Report the resolved date in one line.
