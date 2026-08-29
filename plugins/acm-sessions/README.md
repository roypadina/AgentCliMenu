# acm-sessions

A Claude Code plugin that lets a session name itself, take notes on itself, flag itself and set its
own reminders — all of which show up in the [Agent CLI Menu](https://github.com/roypadina/AgentCliMenu)
Resume picker.

Requires the `acm` CLI on `PATH` (`brew install --cask roypadina/tap/agentclimenu`).

## Install

```
/plugin marketplace add roypadina/AgentCliMenu
/plugin install acm-sessions@agent-cli-menu
```

## Commands

| Command | What it does |
|---|---|
| `/acm-name [name]` | Name this session (no name given → Claude suggests one) |
| `/acm-note [text]` | Attach a note (no text → Claude summarises where things stand) |
| `/acm-flag <tag>` | Tag it: `todo`, `later`, `blocked`… (`-tag` removes) |
| `/acm-remind <when>` | `2h`, `30m`, `3d`, `tomorrow 9am`, `17:00`, or an ISO date |
| `/acm-done` | Mark it finished (`--undo` reopens) |

## The hook

One `SessionStart` hook runs `acm hook session-start`. On a **named** session it hands Claude the
name, flags and note, so a resumed session knows what it is. On an **unnamed** one it asks Claude to
pick a short name once the first task is clear — quietly, without asking permission. It also
mentions any reminders that have come due on other sessions.

That is the only hook, it runs once per session start, and it prints at most a handful of lines. If
`acm` is missing or the payload is malformed it prints nothing and exits 0 — a hook must never break
the session it runs in.

## Where the data lives

`~/.config/agentclimenu/annotations/<session-id>.json` — one small file per session, outside
`~/.claude`, so nothing here can corrupt a transcript. Renaming through `acm` (rather than appending
a `custom-title` line to the JSONL) is deliberate: Claude Code re-flushes its in-memory title after
almost every turn, which would silently revert an externally written rename on a live session.
