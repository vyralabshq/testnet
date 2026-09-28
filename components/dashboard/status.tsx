import type { ReactNode } from "react";
import { Ellipsis, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { dur, num, pct } from "@/lib/format";
import { levelText, nodeStale, nodeState, rpcDown, skipLevel, skipPct, slotsBehindTip, type Level } from "@/lib/health";
import type { Feed } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Cols, Term } from "./primitives";

const chip: Record<Level | "none", string> = {
  ok: "text-ok border-ok/40 bg-ok/10",
  warn: "text-warn border-warn/40 bg-warn/10",
  crit: "text-down border-down/40 bg-down/10",
  none: "text-ink-3 border-border bg-elevated",
};

const headline: Record<string, string> = {
  "Node down": "The validator is not responding.",
  "Not voting": "Votes have stopped leaving the node.",
  Voting: "In step with the cluster.",
  "Catching up": "Replaying to reach the tip.",
  Behind: "Falling behind the cluster.",
  "No data": "Waiting for the collector.",
};

// One big figure with a plain-English caption, readable without knowing validator jargon.
function Kpi({ label, value, caption, children }: { label: string; value: ReactNode; caption: ReactNode; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="font-mono text-3xl text-ink">{value}</div>
      {children}
      <div className="text-sm text-ink-3">{caption}</div>
    </div>
  );
}

// What is wrong, in plain words, when the node is not healthy. Each line is a fact from the collector.
function Outage({ s, level }: { s: Feed; level: Level }) {
  const behind = slotsBehindTip(s);
  const lines = [
    rpcDown(s) && "The node's own RPC is not answering: the validator process is down, restarting, or still loading a snapshot.",
    s.node?.uptimeSec !== undefined && `The validator service (re)started ${dur(s.node.uptimeSec)} ago.`,
    (s.votor?.transportAgoSec ?? 0) > 0 && `Last vote left the node ${dur(s.votor?.transportAgoSec)} ago.`,
    (behind ?? 0) > 0 && `Replay is ${num(behind)} slots behind the newest blocks we have seen${s.slots?.slotTimeMs ? `, about ${dur(((behind ?? 0) * s.slots.slotTimeMs) / 1000)} of chain` : ""}.`,
  ].filter(Boolean);
  return (
    <div className={cn("rounded-lg border p-4 text-sm", level === "crit" ? "border-down/30 bg-down/5" : "border-warn/30 bg-warn/5")}>
      <ul className="list-disc space-y-1 pl-5 text-ink-2">
        {lines.map((l) => (
          <li key={l as string}>{l}</li>
        ))}
      </ul>
      <p className="mt-3 space-x-1 text-xs text-ink-3">
        {(behind ?? 0) > 0 && <span>Time estimates stretch while the node replays slower than the network makes slots.</span>}
        {nodeStale(s) && (
          <span>
            Sections marked <span className="text-warn">last known</span> are frozen from when the node stopped reporting; stake,
            block production and cluster figures come from the public network and stay live.
          </span>
        )}
      </p>
    </div>
  );
}

// Level 1. The chip reads local truth only (getHealth); vote distance is not liveness under Alpenglow (§23).
export function Status({ s }: { s: Feed }) {
  const state = nodeState(s);
  const { node, network: n, production: p, epoch: e, replay: r, machine: m } = s;
  const skip = skipPct(s);
  const epochPct = pct(e?.slotIndex, e?.slotsInEpoch);

  return (
    <Card className={cn("gap-6 border bg-surface p-6 ring-0", state.level === "crit" && "border-down/50")}>
      <div className="flex flex-wrap items-center gap-4">
        <span className={cn("flex items-center gap-2 rounded-md border px-3 py-1 font-mono text-sm font-semibold uppercase", chip[state.level])}>
          <span className="size-2 rounded-full bg-current" />
          {state.label}
        </span>
        <h1 className="font-heading text-2xl font-bold text-ink">{headline[state.label]}</h1>
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
              <DropdownMenuLabel>{num(node?.restarts)} restarts since boot</DropdownMenuLabel>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(state.level === "crit" || state.level === "warn") && <Outage s={s} level={state.level} />}

      <Cols n={4} className="border-t pt-6">
        <Kpi label="Epoch" value={num(e?.epoch)} caption={`${num(epochPct)}% done · ${dur(e?.secondsLeft)} left`}>
          <Progress value={epochPct ?? 0} className="h-1.5 bg-elevated" />
        </Kpi>
        <Kpi
          label="Blocks produced"
          value={
            <>
              {num(p?.produced)}
              <span className="text-lg text-ink-4"> / {num(p?.leaderSlotsSoFar)}</span>
            </>
          }
          caption={
            <>
              <span className={levelText[skipLevel(s)]}>{num(skip, 1)}% skipped</span> · cluster {num(e?.clusterSkipPct, 1)}%
            </>
          }
        />
        <Kpi
          label="Vote credits"
          value={`${num(e?.creditsPctOfMedian)}%`}
          caption={
            <Term tip="Credits earned per SOL staked, against the median validator this epoch. 100% is average; above is better.">
              of the cluster median, per SOL
            </Term>
          }
        />
        <Kpi label="Stake" value={num(node?.stakeSol)} caption={`SOL delegated · ${num(node?.clusterSharePct, 3)}% of the cluster`} />
      </Cols>

      <p className="border-t pt-4 text-sm text-ink-3">
        Next block in <span className="text-ink">{dur(p?.nextLeaderSec)}</span>
        <span className="mx-2 text-ink-4">·</span>
        replay <span className="text-ink">{num(r?.computeMs)} ms</span> per slot
        <span className="mx-2 text-ink-4">·</span>
        network <span className="text-ink">{num(n?.inMBs)}</span> in / <span className="text-ink">{num(n?.outMBs)}</span> out MB/s
        <span className="mx-2 text-ink-4">·</span>
        CPU <span className="text-ink">{num(m?.cpu ? (m.cpu.user ?? 0) + (m.cpu.system ?? 0) + (m.cpu.iowait ?? 0) : undefined)}%</span>
        <span className="mx-2 text-ink-4">·</span>
        up <span className="text-ink">{dur(node?.uptimeSec)}</span>
      </p>
    </Card>
  );
}
