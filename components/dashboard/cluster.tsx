import { cn } from "@/lib/utils";
import { compact, dur, has, num, pct, sum } from "@/lib/format";
import { leaderSlotsLeft, skipLevel, skipPct } from "@/lib/health";
import type { Feed } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Pending, Stat } from "./primitives";

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="border bg-surface ring-0">
      <CardHeader className="flex items-baseline justify-between">
        <CardTitle className="text-ink">{title}</CardTitle>
        {note && <span className="font-mono text-xs text-ink-4">{note}</span>}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

export function Epoch({ s }: { s: Feed }) {
  const { epoch: e, production: p } = s;
  return (
    <Panel title="This epoch" note={num(e?.epoch)}>
      <div className="grid grid-cols-2 gap-6">
        <Stat value={dur(e?.secondsLeft)} label="until the next epoch" />
        <Stat value={num(leaderSlotsLeft(s))} label={`of our leader slots left, ${num(p?.leaderSlots)} this epoch`} />
        <Stat
          value={`${num(e?.creditsPctOfMedian, 1)}%`}
          label={`of median credits per SOL · ours ${compact(s.voting?.creditsPerSol)}, median ${compact(e?.creditsMedianPerSol)}`}
        />
        <Stat value={`${num(skipPct(s), 2)}%`} level={skipLevel(s)} label={`skip rate, cluster at ${num(e?.clusterSkipPct, 2)}%`} />
      </div>
      <div className="space-y-2">
        <Progress value={pct(e?.slotIndex, e?.slotsInEpoch) ?? 0} className="bg-elevated" />
        <p className="font-mono text-xs text-ink-4">
          slot {num(e?.slotIndex)} of {num(e?.slotsInEpoch)}
        </p>
      </div>
    </Panel>
  );
}

export function Cluster({ s }: { s: Feed }) {
  const c = s.cluster;
  const total = has(c?.activeStake) && has(c?.delinquentStake) ? c.activeStake + c.delinquentStake : undefined;
  const delinquentPct = pct(c?.delinquentStake, total);
  const delinquentTicks = Math.round((delinquentPct ?? 0) / 2);
  return (
    <Panel title="Cluster">
      <div className="grid grid-cols-2 gap-6">
        <Stat value={compact(c?.activeStake)} label="active stake, SOL" />
        <Stat value={`${num(delinquentPct, 2)}%`} label={`delinquent, ${compact(c?.delinquentStake)} SOL`} />
        <Stat value={num(c?.voting)} label={`of ${num(c?.validators)} validators voting, ${num(c?.delinquent)} delinquent`} />
        <Stat value={num(c?.rpcNodes)} label="nodes advertising RPC" />
      </div>
      {has(delinquentPct) && (
        <div className="space-y-2">
          <div className="grid grid-cols-[repeat(25,1fr)] gap-0.5">
            {Array.from({ length: 50 }, (_, i) => (
              <span key={i} className={cn("h-3 rounded-[1px]", i >= 50 - delinquentTicks ? "bg-down" : "bg-ok/50")} />
            ))}
          </div>
          <p className="font-mono text-xs text-ink-4">each tick is 2% of staked SOL</p>
        </div>
      )}
    </Panel>
  );
}

const TOP = 4;

// By stake once the collector joins gossip to vote accounts; until then gossip node counts (§27.9).
export function Versions({ s }: { s: Feed }) {
  const all = s.versions ?? [];
  const byStake = all.some((v) => has(v?.stake));
  const weight = (v: (typeof all)[number]) => (byStake ? v?.stake : v?.validators) ?? 0;
  const sorted = [...all].sort((a, b) => weight(b) - weight(a));
  const rest = sorted.slice(TOP);
  const rows = [
    ...sorted.slice(0, TOP),
    ...(rest.length
      ? [{ version: "other", validators: sum(rest.map((v) => v?.validators)), stake: sum(rest.map((v) => v?.stake)), ours: rest.some((v) => v?.ours) }]
      : []),
  ];
  const total = sum(all.map(weight));
  return (
    <Panel title="Versions" note={byStake ? "by stake" : "by gossip nodes"}>
      {rows.length ? (
        <div className="space-y-4">
          {rows.map((v) => (
            <div key={v?.version} className="space-y-1">
              <div className="flex items-center gap-3 font-mono text-sm">
                <span className="w-32 truncate text-ink">
                  {v?.version}
                  {v?.ours && <span className="ml-2 text-xs text-primary">OURS</span>}
                </span>
                <Progress value={pct(weight(v), total) ?? 0} className="flex-1 bg-elevated" />
                <span className="w-12 text-right text-ink-2">{num(pct(weight(v), total), 1)}%</span>
              </div>
              <p className="font-mono text-xs text-ink-4">
                {byStake ? `${num(v?.validators)} validators, ${compact(v?.stake)} SOL` : `${num(v?.validators)} nodes`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <Pending source="versions (getClusterNodes)" />
      )}
    </Panel>
  );
}
