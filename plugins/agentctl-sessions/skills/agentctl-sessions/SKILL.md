---
name: agentctl-sessions
description: Use when naming, labelling, flagging, annotating, closing out, or setting reminders and due dates on a Claude Code session — and whenever the user says "name this session", "mark this done", "remind me about this", "what am I supposed to come back to", "tag this with the ticket", or asks what is on their plate across sessions. Also use proactively at the start of real work to name and label the session so it can be found again later.
---

# Session metadata via `agentctl`

Claude Code sessions are named after your first prompt, which ages badly, and nothing else about
them is recorded. `agentctl` attaches the missing metadata — a real name, notes, labels, flags, a
done state, reminders and due dates — and shows it in its session picker (TUI and menu-bar app).

Everything is stored in `~/.config/agentctl/annotations/<session-id>.json`, one small file per
session, outside `~/.claude`, so nothing here can corrupt a transcript.

## Before anything else: is the tool installed?

Run `command -v agentctl`. If it is missing, **do not silently skip the work** — tell the user and
offer to install it:

> `agentctl` isn't installed — it's the session manager that stores this. Want me to install it?
> `brew install --cask roypadina/tap/agentctl`

Install it **only if they say yes**, then carry on. If they decline, drop it and don't ask again
this session. Never install without asking.

## The commands

Every one targets **the session you are running in** — no id, no `-s`. That resolution walks the
parent-process chain to the live Claude process, so it works from any shell you spawn.

| Command | What it does |
|---|---|
| `agentctl name "billing spike"` | Display name; overrides the transcript title. Re-runnable, `--clear` removes it |
| `agentctl note "waiting on review"` | A note. `--append` adds a line, `--clear` removes it |
| `agentctl label RD-12345 catalog` | Links the session to a ticket / repo / topic. Searchable. `--remove` to drop |
| `agentctl label --auto` | Adds the issue key found in the current git branch |
| `agentctl flag todo` | Short status marker: `todo`, `later`, `blocked`. `--remove` to drop |
| `agentctl remind 2h` | Nudge me then. `30m`, `3d`, `tomorrow 9am`, `17:00`, ISO. `--clear` |
| `agentctl due "friday 17:00"` | When the work itself is due. Same formats. `--clear` |
| `agentctl done` | Finished. `--undo` reopens it |
| `agentctl annotations` | Everything annotated. `--due` for what has come due, `--label RD-12345` to filter |

Add `--json` to any of them when you need to read the result back.

To act on a *different* session, pass `-s <id-or-prefix>` — get ids from `agentctl ls`.

## Do it without being asked

**Name the session** once the first real task is clear — a 3-5 word name describing the work, not
the tool. Run it quietly; do not ask permission and do not announce it. Only once per session: if
it already has a name, leave it alone unless the work has clearly changed direction.

**Label it with the ticket.** If the branch or the conversation mentions an issue key (`RD-12345`,
`PROJ-42`), label the session with it. `agentctl label --auto` reads it from the branch for you.
Add a second label for the component or repo when that is obvious and stable.

Good: `billing spike` + `[RD-12345]` · `catalog reindex slowness` + `[RD-12987] [catalog]`
Bad: `debugging` · `fix the thing` · `Claude Code session`

**Leave a note before a long pause** — if the user is clearly stopping mid-task (they say they're
leaving, or you're blocked on someone else), save one line on where things stand and what's next.

Do **not** proactively: mark a session done, set reminders, or set due dates. Those are the user's
judgement calls — wait to be asked.

## Do it when asked

Map plain requests onto the commands, and confirm in one line — never dump the JSON:

- "name this session X" / "call this X" → `agentctl name "X"`
- "mark this done" / "we're finished here" → `agentctl done`
- "remind me in 2 hours" / "ping me tomorrow morning" → `agentctl remind 2h` / `remind "tomorrow 9am"`
- "this is due Friday" → `agentctl due "friday 17:00"`
- "tag this with RD-123" / "this is for RD-123" → `agentctl label RD-123`
- "flag this to come back to" → `agentctl flag todo`
- "make a note that…" → `agentctl note "…"`
- "what do I need to get back to?" → `agentctl annotations --due`, then summarise in prose
- "what was I doing on RD-123?" → `agentctl annotations --label RD-123`

If a reminder or due date fails to parse, the CLI says so and exits 2 — ask for a clearer time
rather than guessing at one.

## What reminders actually do

Nothing pops up. A due reminder shows as a red marker in the `agentctl` picker and is mentioned at
the start of the user's next session. Say that when you set one, so the expectation is right.

## Notes

- A name set here always wins over the transcript title, and can be changed any number of times.
  Never try to rename a session by editing its JSONL — Claude Code re-flushes its own cached title
  after almost every turn and would silently revert you.
- Labels keep their case (`RD-12345`); flags are lowercased and dash-joined (`Follow Up` → `follow-up`).
- Both labels and flags are matched by the picker's filter, so `RD-12345` finds every session on
  that ticket.
