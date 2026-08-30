// Reliable optimistic layer for per-room linen counts.
//
// Problem this solves: tapping +/-/+All fired an optimistic cache write and a
// Supabase upsert, but any concurrent refetch (realtime event, 20s poll,
// window focus) could land between the two and paint the stale server value
// (often 0). Rapid taps also raced each other, so the last write to arrive
// won instead of the newest value.
//
// Fix: keep the user's intended value in a local overlay that survives
// refetches until the server has caught up, and serialise writes per item so
// only the newest value is ever sent.
import { useCallback, useEffect, useRef, useState } from "react";

export type CountKind = "template" | "extra";

export const countKey = (room: number, kind: CountKind, itemId: string) =>
  `${room}|${kind}|${itemId}`;

type PendingEntry = {
  room: number;
  kind: CountKind;
  itemId: string;
  value: number;
};

// How long an acknowledged value stays pinned locally, giving the server /
// realtime round trip time to report the same number back.
const GRACE_MS = 4000;

export function usePendingCounts(options: {
  write: (room: number, kind: CountKind, itemId: string, value: number) => Promise<void>;
  onError?: (message: string) => void;
}) {
  const { write, onError } = options;
  const writeRef = useRef(write);
  writeRef.current = write;
  const errRef = useRef(onError);
  errRef.current = onError;

  const [pending, setPending] = useState<Record<string, PendingEntry>>({});
  const pendingRef = useRef<Record<string, PendingEntry>>({});
  const flushing = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, number>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
      timers.current = {};
    };
  }, []);

  const commit = useCallback(() => {
    if (!mounted.current) return;
    setPending({ ...pendingRef.current });
  }, []);

  const drop = useCallback(
    (key: string) => {
      delete pendingRef.current[key];
      if (timers.current[key]) {
        window.clearTimeout(timers.current[key]);
        delete timers.current[key];
      }
      commit();
    },
    [commit],
  );

  const flush = useCallback(
    async (key: string) => {
      if (flushing.current.has(key)) return;
      flushing.current.add(key);
      try {
        let lastSent: number | null = null;
        // Loop so newer taps that arrive mid-request are picked up here
        // instead of firing a competing request.
        for (;;) {
          const entry = pendingRef.current[key];
          if (!entry || entry.value === lastSent) break;
          const value = entry.value;
          try {
            await writeRef.current(entry.room, entry.kind, entry.itemId, value);
            lastSent = value;
          } catch (e) {
            errRef.current?.(e instanceof Error ? e.message : "Could not save count");
            drop(key);
            return;
          }
        }
        // Server acknowledged the newest value: keep it pinned briefly so a
        // refetch already in flight can't flash the previous number.
        if (timers.current[key]) window.clearTimeout(timers.current[key]);
        timers.current[key] = window.setTimeout(() => {
          delete timers.current[key];
          if (pendingRef.current[key] && !flushing.current.has(key)) drop(key);
        }, GRACE_MS);
      } finally {
        flushing.current.delete(key);
        // A tap that landed during the final await gets flushed now.
        const entry = pendingRef.current[key];
        if (entry && !timers.current[key]) void flush(key);
      }
    },
    [drop],
  );

  const setTarget = useCallback(
    (room: number, kind: CountKind, itemId: string, value: number) => {
      const key = countKey(room, kind, itemId);
      pendingRef.current[key] = { room, kind, itemId, value: Math.max(0, value) };
      if (timers.current[key]) {
        window.clearTimeout(timers.current[key]);
        delete timers.current[key];
      }
      commit();
      void flush(key);
    },
    [commit, flush],
  );

  const clearAll = useCallback(() => {
    Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    timers.current = {};
    pendingRef.current = {};
    commit();
  }, [commit]);

  const getPending = useCallback(
    (room: number, kind: CountKind, itemId: string): number | undefined =>
      pending[countKey(room, kind, itemId)]?.value,
    [pending],
  );

  return { pending, getPending, setTarget, clearAll };
}
