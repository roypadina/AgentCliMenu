export type SessionStatus = 'busy' | 'idle' | 'inactive';

export interface SessionRecord {
  id: string;
  /** Display name: the annotation's name override when set, else `transcriptName`. */
  name: string;
  /** Name derived from the JSONL alone (custom-title → ai-title → first prompt). */
  transcriptName: string;
  cwd: string;
  cwdDecodeConfident: boolean;
  jsonlPath: string;
  sizeBytes: number;
  startedAt: Date;
  lastUpdatedAt: Date;
  active: boolean;
  status: SessionStatus;
  pid?: number;
  version?: string;
  gitBranch?: string;
  /**
   * Claude home this session belongs to (`~/.claude`, `~/.claude3`, …). Resuming must run under
   * it — a mismatch silently resumes the transcript as the WRONG ACCOUNT when profiles share a
   * `projects/` dir. Undetectable for a dead session under symlinked profiles; see core/paths.ts.
   */
  configDir?: string;
  /** User annotation (name override already applied to `name`). */
  annotation?: Annotation;
}

/** User-attached metadata for a session, stored outside ~/.claude (see core/annotations.ts). */
export interface Annotation {
  sessionId: string;
  /** Overrides every JSONL-derived title when set. */
  name?: string;
  note?: string;
  flags: string[];
  done: boolean;
  /** ISO timestamp. */
  remindAt?: string;
  updatedAt?: string;
}

export interface ListOptions {
  cwd?: string;
  activeOnly?: boolean;
  sortBy?: 'updated' | 'started' | 'name';
  limit?: number;
}

export interface LiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  updatedAt: number;
  status: 'busy' | 'idle';
  version?: string;
  /** Claude home the pid file was found in — authoritative profile while the process lives. */
  profile?: string;
}

export type TranscriptRole = 'user' | 'assistant' | 'system' | 'tool';
export type TranscriptKind =
  | 'text'
  | 'thinking'
  | 'tool-use'
  | 'tool-result'
  | 'summary'
  | 'attachment';

export interface TranscriptTurn {
  role: TranscriptRole;
  kind: TranscriptKind;
  text: string;
}
