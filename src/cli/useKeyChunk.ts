import { useEffect, useRef, type MutableRefObject } from 'react';
import { useStdin } from 'ink';

interface Emitter {
  on(event: string, fn: (chunk: string) => void): void;
  removeListener(event: string, fn: (chunk: string) => void): void;
}

/**
 * ink reads stdin with `stdin.read()` and parses only the FIRST key of each chunk, so a
 * held-down arrow — which arrives as one chunk of several escape sequences — moves the cursor
 * a single row and every other press is dropped. This records the raw chunk so a handler can
 * apply the remaining repeats.
 *
 * Call it BEFORE `useInput` in the component: effects register in declaration order, so the
 * ref is already updated by the time ink's own handler runs for the same chunk.
 */
export function useKeyChunk(): MutableRefObject<string> {
  const chunk = useRef('');
  const stdin = useStdin() as unknown as { internal_eventEmitter?: Emitter };
  useEffect(() => {
    const emitter = stdin.internal_eventEmitter;
    if (!emitter) return;
    const onData = (data: string) => { chunk.current = String(data); };
    emitter.on('input', onData);
    return () => emitter.removeListener('input', onData);
  }, [stdin]);
  return chunk;
}

function countSeq(chunk: string, seq: string): number {
  if (!chunk || !seq) return 0;
  return chunk.split(seq).length - 1;
}

const UP = ['\u001B[A', '\u001BOA'];
const DOWN = ['\u001B[B', '\u001BOB'];

/**
 * Cursor-up presses in one chunk: arrow keys (normal + application mode), plus vim `k` when
 * the screen has no type-to-filter competing for plain letters.
 */
export function upCount(chunk: string, vim = true): number {
  return UP.reduce((n, s) => n + countSeq(chunk, s), 0) + (vim ? countSeq(chunk, 'k') : 0);
}

/** Cursor-down presses in one chunk. */
export function downCount(chunk: string, vim = true): number {
  return DOWN.reduce((n, s) => n + countSeq(chunk, s), 0) + (vim ? countSeq(chunk, 'j') : 0);
}
