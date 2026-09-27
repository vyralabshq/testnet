"use client";

import { useEffect, useState } from "react";
import type { Feed } from "./types";

const POLL_MS = 2000;
const STALE_MS = 10_000;

// v1 transport (desgin.md §18.4): poll the proxy every 2 s. Stale dims the page, never turns it red.
export function useSnapshot() {
  const [data, setData] = useState<Feed | null>(null);
  const [ageMs, setAgeMs] = useState(0);
  const [failing, setFailing] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/snapshot");
        if (!r.ok) throw new Error(String(r.status));
        const body: Feed = await r.json();
        if (!alive) return;
        setData(body);
        setAgeMs(Number(r.headers.get("x-stale") ?? 0));
        setFailing(false);
      } catch {
        if (alive) setFailing(true);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return { data, ageMs, stale: ageMs > STALE_MS, failing };
}
