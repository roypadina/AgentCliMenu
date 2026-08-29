---
description: Label the current session with what it relates to — a Jira ticket, a repo, a topic
argument-hint: "<label> [more] — prefix with - to remove, --auto to read the key from the branch"
allowed-tools:
  - Bash
---

Label the session you are running in: `agentctl label $ARGUMENTS`.

Labels link a session to something durable — an issue key (`RD-12345`), a repo, a component. They
keep their case and are matched by the picker's filter, so labelling by ticket makes every session
on that ticket findable in one search.

- No arguments → run `agentctl label --auto` to take the issue key from the current git branch. If
  the branch has none, ask the user what to label it with rather than inventing something.
- `-label` removes one.

Use the `agentctl-sessions` skill for the full toolset. Report the resulting labels in one line.
