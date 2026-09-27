"use client";

import { useEffect, useState } from "react";
import type { Feed } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CopyKey } from "./primitives";

export type Freshness = { hasData: boolean; failing: boolean; stale: boolean };

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Header({ s, fresh }: { s: Feed; fresh: Freshness }) {
  const { node, meta } = s;
  const now = useNow();
  const ago = meta?.updatedAt && now ? Math.max(0, Math.round((now - meta.updatedAt) / 1000)) : undefined;
  const errors = Object.keys(meta?.errors ?? {}).length;
  const [label, tone] = !fresh.hasData
    ? [fresh.failing ? "Offline" : "Connecting", "text-ink-3"]
    : fresh.stale || (ago ?? 0) > 10
      ? ["Stale", "text-warn"]
      : ["Live", "text-ok"];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="font-heading text-xl font-bold text-ink">
        v<span className="text-primary">y</span>ra
      </span>
      <CopyKey label="identity" value={node?.identity} />
      <CopyKey label="vote" value={node?.vote} />
      <Badge variant="outline" className="font-mono">
        {node?.cluster ?? "testnet"}
      </Badge>
      {node?.version && (
        <span className="font-mono text-ink-3">
          {node.client} {node.version}
        </span>
      )}
      {node?.shredVersion && <span className="font-mono text-ink-3">shred {node.shredVersion}</span>}
      <span className="ml-auto flex items-center gap-4 text-xs">
        {errors > 0 && <span className="text-warn">{errors} collector errors</span>}
        <span className={`flex items-center gap-2 font-semibold ${tone}`}>
          <span className="size-2 rounded-full bg-current" />
          {label}
        </span>
        {ago !== undefined && <span className="text-ink-3">Last updated {ago}s ago</span>}
      </span>
    </div>
  );
}
