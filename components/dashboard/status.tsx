import { Ellipsis, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { compact, dur, num } from "@/lib/format";
import { nodeState, skipPct, type Level } from "@/lib/health";
import type { Feed } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Cols, Term, Tile } from "./primitives";

const chip: Record<Level | "none", string> = {
  ok: "text-ok border-ok/40 bg-ok/10",
  warn: "text-warn border-warn/40 bg-warn/10",
  crit: "text-down border-down/40 bg-down/10",
  none: "text-ink-3 border-border bg-elevated",
};

const headline: Record<string, string> = {
  Voting: "In step with the cluster.",
  "Catching up": "Replaying to reach the tip.",
  Behind: "Falling behind the cluster.",
  "No data": "Waiting for the collector.",
};

// Level 1. The chip reads local truth only (getHealth); vote distance is not liveness under Alpenglow (§23).
export function Status({ s }: { s: Feed }) {
  const state = nodeState(s);
  const { node, network: n, production: p, health: h } = s;
  const caughtUp =
    node?.caughtUpAfterSec === null ? "healthy at collector start" : `caught up after ${dur(node?.caughtUpAfterSec)}`;
  const startup = node?.startup;

  return (
    <Card className="gap-5 border bg-surface p-5 ring-0">
      <div className="flex flex-wrap items-center gap-4">
        <span className={cn("flex items-center gap-2 rounded-md border px-3 py-1 font-mono text-sm font-semibold uppercase", chip[state.level])}>
          <span className="size-2 rounded-full bg-current" />
          {state.label}
        </span>
        <h1 className="font-heading text-xl font-bold text-ink sm:text-2xl">{headline[state.label]}</h1>
        <div className="ml-auto flex gap-2">
          {node?.identity && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://explorer.solana.com/address/${node.identity}?cluster=${node.cluster ?? "testnet"}`} target="_blank" rel="noreferrer">
                View on Explorer <ExternalLink />
              </a>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Node details">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-mono">
              <DropdownMenuLabel>{num(node?.commission)}% commission</DropdownMenuLabel>
              <DropdownMenuLabel>{num(node?.identitySol, 2)} SOL identity</DropdownMenuLabel>
              <DropdownMenuLabel>{num(node?.voteSol)} SOL vote</DropdownMenuLabel>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="-mt-3 font-mono text-xs text-ink-3">
        Leader again in {dur(p?.nextLeaderSec)} ·{" "}
        {startup ? (
          <Term
            tip={`loading ledger ${dur(startup.loadingLedgerSec)} · ledger replay ${dur(startup.ledgerReplaySec)} · everything else ${dur(startup.otherSec)}`}
          >
            {caughtUp}
          </Term>
        ) : (
          caughtUp
        )}{" "}
        · {num(node?.restarts)} restarts · Repaired shreds {num(h?.repairedPct, 2)}% · Snapshot {dur(h?.snapshotAgoSec)} ago
      </p>
      <Cols n={6} className="border-t pt-5">
        <Tile label="Staked" value={`${num(node?.stakeSol)} SOL`} sub={`${num(node?.clusterSharePct, 3)}% of cluster`} />
        <Tile
          label="Credits per SOL"
          value={`${num(s.epoch?.creditsPctOfMedian, 1)}%`}
          sub={`of median · ${compact(s.voting?.creditsPerSol)} per SOL · ${num(skipPct(s), 2)}% skip`}
        />
        <Tile label="Replay compute" value={`${num(s.replay?.computeMs, 2)} ms`} sub={`per slot · ${num(s.replay?.wallMs)} ms wall`} />
        <Tile label="Network in" value={`${num(n?.inMBs, 1)} MB/s`} sub={`avg ${num(n?.inAvg, 1)} · peak ${num(n?.inPeak, 1)} since start`} />
        <Tile label="Network out" value={`${num(n?.outMBs, 1)} MB/s`} sub={`avg ${num(n?.outAvg, 1)} · peak ${num(n?.outPeak, 1)} since start`} />
        <Tile label="Uptime" value={dur(node?.uptimeSec)} sub={`${num(node?.restarts)} restarts since boot`} />
      </Cols>
    </Card>
  );
}
