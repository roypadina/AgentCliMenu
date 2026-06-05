export type SessionStatus = 'busy' | 'idle' | 'inactive';

export interface SessionRecord {
  id: string;
  name: string;
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
