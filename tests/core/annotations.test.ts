import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readAnnotation, writeAnnotation, readAllAnnotations, parseAnnotation,
  isValidSessionId, normalizeFlag, isReminderDue, parseWhen,
} from '../../src/core/annotations.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'acm-ann-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const ID = 'f0582ec2-6af9-4b5e-afb9-26593439be61';

describe('writeAnnotation', () => {
  it('creates, merges across writes and never loses earlier fields', () => {
    writeAnnotation(ID, { name: 'billing spike' }, dir);
    writeAnnotation(ID, { note: 'waiting on Dor' }, dir);
    writeAnnotation(ID, { addFlags: ['Todo', 'follow up'] }, dir);
    const a = readAnnotation(ID, dir)!;
    expect(a.name).toBe('billing spike');
    expect(a.note).toBe('waiting on Dor');
    expect(a.flags).toEqual(['follow-up', 'todo']);
    expect(a.done).toBe(false);
  });

  it('renames repeatedly — last write wins', () => {
    for (const n of ['one', 'two', 'three']) writeAnnotation(ID, { name: n }, dir);
    expect(readAnnotation(ID, dir)!.name).toBe('three');
  });

  it('clears a field with null and removes flags', () => {
    writeAnnotation(ID, { name: 'x', note: 'y', addFlags: ['a', 'b'] }, dir);
    writeAnnotation(ID, { note: null, removeFlags: ['a'] }, dir);
    const a = readAnnotation(ID, dir)!;
    expect(a.note).toBeUndefined();
    expect(a.flags).toEqual(['b']);
    expect(a.name).toBe('x');
  });

  it('deletes the file once nothing is left', () => {
    writeAnnotation(ID, { addFlags: ['tmp'] }, dir);
    expect(readdirSync(dir)).toHaveLength(1);
    writeAnnotation(ID, { removeFlags: ['tmp'] }, dir);
    expect(readdirSync(dir)).toHaveLength(0);
    expect(readAnnotation(ID, dir)).toBeNull();
  });

  it('rejects a session id that would escape the directory', () => {
    expect(() => writeAnnotation('../../etc/passwd', { done: true }, dir)).toThrow();
    expect(isValidSessionId('../x')).toBe(false);
    expect(isValidSessionId(ID)).toBe(true);
  });
});

describe('readAllAnnotations', () => {
  it('returns an empty map when the dir does not exist', () => {
    expect(readAllAnnotations(join(dir, 'nope')).size).toBe(0);
  });

  it('skips corrupt files and keeps good ones', () => {
    mkdirSync(dir, { recursive: true });
    writeAnnotation(ID, { done: true }, dir);
    writeFileSync(join(dir, 'broken.json'), 'not json');
    const all = readAllAnnotations(dir);
    expect(all.size).toBe(1);
    expect(all.get(ID)!.done).toBe(true);
  });
});

describe('parseAnnotation', () => {
  it('drops junk field types instead of throwing', () => {
    const a = parseAnnotation(ID, JSON.stringify({ name: 42, flags: ['A', 7, 'a'], done: 'yes' }))!;
    expect(a.name).toBeUndefined();
    expect(a.flags).toEqual(['a']);
    expect(a.done).toBe(false);
  });
});

describe('normalizeFlag', () => {
  it('lowercases and dashes whitespace', () => {
    expect(normalizeFlag('  Follow Up ')).toBe('follow-up');
  });
});

describe('isReminderDue', () => {
  const now = new Date('2026-08-29T12:00:00Z');
  it('is due once the timestamp passes', () => {
    expect(isReminderDue({ sessionId: ID, flags: [], done: false, remindAt: '2026-08-29T11:00:00Z' }, now)).toBe(true);
    expect(isReminderDue({ sessionId: ID, flags: [], done: false, remindAt: '2026-08-29T13:00:00Z' }, now)).toBe(false);
  });
  it('is never due for a done session or a bad timestamp', () => {
    expect(isReminderDue({ sessionId: ID, flags: [], done: true, remindAt: '2020-01-01T00:00:00Z' }, now)).toBe(false);
    expect(isReminderDue({ sessionId: ID, flags: [], done: false, remindAt: 'soonish' }, now)).toBe(false);
    expect(isReminderDue(undefined, now)).toBe(false);
  });
});

describe('parseWhen', () => {
  const now = new Date('2026-08-29T15:00:00');

  it('refuses a bare number — a forgotten unit must not become a year', () => {
    for (const s of ['45', '90', '30', '2045']) expect(parseWhen(s, now)).toBeNull();
  });

  it('still takes relative, clock, tomorrow and ISO forms', () => {
    expect(parseWhen('2h', now)!.getTime()).toBe(now.getTime() + 7_200_000);
    expect(parseWhen('45m', now)!.getTime()).toBe(now.getTime() + 2_700_000);
    expect(parseWhen('17:00', now)!.getHours()).toBe(17);
    expect(parseWhen('9am', now)!.getDate()).toBe(30);      // already past today → tomorrow
    expect(parseWhen('tomorrow', now)!.getHours()).toBe(9);
    expect(parseWhen('2026-12-01T08:00:00Z', now)!.getUTCMonth()).toBe(11);
  });

  it('returns null for nonsense', () => {
    expect(parseWhen('whenever', now)).toBeNull();
    expect(parseWhen('tomorrow 99', now)).toBeNull();
    expect(parseWhen('', now)).toBeNull();
  });
});
