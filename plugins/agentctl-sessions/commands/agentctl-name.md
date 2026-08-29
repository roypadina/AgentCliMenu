---
description: Name the current Claude Code session so it is easy to find in the Agentctl picker
argument-hint: "[the name — omit it and I'll suggest one]"
allowed-tools:
  - Bash
---

Set the Agentctl display name for the session you are running in.

- If `$ARGUMENTS` is non-empty, run: `agentctl name $ARGUMENTS`
- If it is empty, propose a 3-5 word name from what this session has actually been about, ask the user to confirm or correct it, then run `agentctl name "<the agreed name>"`.

The name targets the current session automatically — never pass `-s`. It overrides the transcript
title and can be changed as often as you like; `agentctl name --clear` restores the original title.

Report the result in one line.
