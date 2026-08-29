import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configDir } from './config/paths.js';
import type { Annotation } from './types.js';

// User annotations on a session — name, note, flags, done, reminder. Kept OUTSIDE ~/.claude so
// nothing we write can corrupt a live transcript, and one file per session so concurrent writers
// (several Claude sessions annotating themselves via hooks) never clobber each other.

export function annotationsDir(): string {
  return join(configDir(), 'annotations');
}

/** Session ids become filenames — reject anything that could escape the directory. */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isValidSessionId(id: string): boolean {
  return ID_RE.test(id) && !id.includes('..');
}

export interface AnnotationPatch {
  /** Display name override. `null` clears it. */
  name?: string | null;
  /** Free-text note. `null` clears it. */
  note?: string | null;
  addFlags?: string[];
  removeFlags?: string[];
  addLabels?: string[];
  removeLabels?: string[];
  done?: boolean;
  /** ISO timestamp. `null` clears it. */
  remindAt?: string | null;
  /** ISO timestamp. `null` clears it. */
  dueAt?: string | null;
}

export function normalizeFlag(flag: string): string {
  return flag.trim().toLowerCase().replace(/\s+/g, '-');
}

/** Labels keep their case — `RD-12345` must read back as it was typed. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, '-');
}

/** Issue keys as they appear in branch names: `feature/RD-12345-thing` → `RD-12345`. */
export function detectIssueKeys(text: string | undefined | null): string[] {
  if (!text) return [];
  return [...new Set(text.match(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g) ?? [])];
}

/** Parse one annotation file's JSON. Untrusted input — every field is checked. */
export function parseAnnotation(id: string, raw: string): Annotation | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const a: Annotation = {
    sessionId: id,
    name: str(d.name),
    note: str(d.note),
    flags: Array.isArray(d.flags)
      ? [...new Set(d.flags.filter((f): f is string => typeof f === 'string').map(normalizeFlag).filter(Boolean))]
      : [],
    labels: Array.isArray(d.labels)
      ? [...new Set(d.labels.filter((l): l is string => typeof l === 'string').map(normalizeLabel).filter(Boolean))]
      : [],
    done: d.done === true,
    remindAt: str(d.remindAt),
    dueAt: str(d.dueAt),
    updatedAt: str(d.updatedAt),
  };
  return a;
}

export function readAnnotation(id: string, dir = annotationsDir()): Annotation | null {
  if (!isValidSessionId(id)) return null;
  try {
    return parseAnnotation(id, readFileSync(join(dir, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

/** One readdir for callers that annotate a whole listing. */
export function readAllAnnotations(dir = annotationsDir()): Map<string, Annotation> {
  const out = new Map<string, Annotation>();
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return out;
  }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const id = f.slice(0, -5);
    if (!isValidSessionId(id)) continue;
    let a: Annotation | null;
    try {
      a = parseAnnotation(id, readFileSync(join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    if (a) out.set(id, a);
  }
  return out;
}

/** True when the annotation carries nothing worth keeping on disk. */
function isEmpty(a: Annotation): boolean {
  return !a.name && !a.note && !a.done && !a.remindAt && !a.dueAt &&
    a.flags.length === 0 && a.labels.length === 0;
}

/**
 * Read-modify-write one session's annotation. Returns the merged result.
 * Writes via a temp file + rename so a reader never sees a half-written file.
 *
 * ponytail: read-modify-write, not a transaction — two writers patching the SAME session in the
 * same instant can drop one patch. One file per session makes that vanishingly rare; add a lock
 * file only if simultaneous hook + TUI edits ever actually collide.
 */
export function writeAnnotation(id: string, patch: AnnotationPatch, dir = annotationsDir()): Annotation {
  if (!isValidSessionId(id)) throw new Error(`invalid session id: ${id}`);
  const current = readAnnotation(id, dir) ?? { sessionId: id, flags: [], labels: [], done: false };
  const flags = new Set(current.flags);
  for (const f of patch.addFlags ?? []) { const n = normalizeFlag(f); if (n) flags.add(n); }
  for (const f of patch.removeFlags ?? []) flags.delete(normalizeFlag(f));
  const labels = new Set(current.labels);
  for (const l of patch.addLabels ?? []) { const n = normalizeLabel(l); if (n) labels.add(n); }
  for (const l of patch.removeLabels ?? []) labels.delete(normalizeLabel(l));

  const next: Annotation = {
    sessionId: id,
    name: patch.name === null ? undefined : (patch.name ?? current.name),
    note: patch.note === null ? undefined : (patch.note ?? current.note),
    flags: [...flags].sort(),
    labels: [...labels].sort(),
    done: patch.done ?? current.done,
    remindAt: patch.remindAt === null ? undefined : (patch.remindAt ?? current.remindAt),
    dueAt: patch.dueAt === null ? undefined : (patch.dueAt ?? current.dueAt),
    updatedAt: new Date().toISOString(),
  };

  const file = join(dir, `${id}.json`);
  if (isEmpty(next)) {
    rmSync(file, { force: true });
    return next;
  }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  renameSync(tmp, file);
  return next;
}

/** A reminder is due once its timestamp has passed. */
export function isReminderDue(a: Annotation | undefined, now = new Date()): boolean {
  if (!a?.remindAt || a.done) return false;
  const t = Date.parse(a.remindAt);
  return Number.isFinite(t) && t <= now.getTime();
}

/** A due date is overdue once it has passed and the work isn't done. */
export function isOverdue(a: Annotation | undefined, now = new Date()): boolean {
  if (!a?.dueAt || a.done) return false;
  const t = Date.parse(a.dueAt);
  return Number.isFinite(t) && t <= now.getTime();
}

const UNITS: Record<string, number> = {
  m: 60_000, min: 60_000, mins: 60_000, minute: 60_000, minutes: 60_000,
  h: 3_600_000, hr: 3_600_000, hrs: 3_600_000, hour: 3_600_000, hours: 3_600_000,
  d: 86_400_000, day: 86_400_000, days: 86_400_000,
  w: 604_800_000, week: 604_800_000, weeks: 604_800_000,
};

/** `9`, `9am`, `21:30` → that clock time on `base`'s day. */
function applyClock(base: Date, clock: string): Date | null {
  const m = clock.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (hour > 23 || min > 59) return null;
  if (m[3] === 'pm' && hour < 12) hour += 12;
  if (m[3] === 'am' && hour === 12) hour = 0;
  const out = new Date(base);
  out.setHours(hour, min, 0, 0);
  return out;
}

/**
 * Reminder times people actually type: `2h`, `30m`, `3d`, `tomorrow`, `tomorrow 9am`,
 * `17:00`, or any ISO date. A bare clock time that already passed today rolls to tomorrow.
 */
export function parseWhen(input: string, now = new Date()): Date | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const rel = s.match(/^(\d+)\s*([a-z]+)$/);
  if (rel && UNITS[rel[2]]) return new Date(now.getTime() + Number(rel[1]) * UNITS[rel[2]]);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (s === 'tomorrow') return applyClock(tomorrow, '9am');
  const tom = s.match(/^tomorrow\s+(.+)$/);
  if (tom) return applyClock(tomorrow, tom[1]);

  const clock = applyClock(now, s);
  if (clock) return clock.getTime() > now.getTime() ? clock : applyClock(tomorrow, s);

  // A bare number is a forgotten unit, not a year: Date.parse('45') yields 2045 (silently never
  // due) and '90' yields 1990 (permanently overdue). Reject it and let the caller ask again.
  if (/^\d+$/.test(s)) return null;

  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}
