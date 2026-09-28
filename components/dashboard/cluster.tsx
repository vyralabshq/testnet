import { cn } from "@/lib/utils";
import { compact, has, num, pct, sum } from "@/lib/format";
import type { Feed } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Pending, Stat, Term } from "./primitives";

function Panel(props: { title: string; hint?: string; note?: string; children: React.ReactNode }) {
  const { title, hint, note, children } = props;
  return (
    <Card className="border bg-surface ring-0">
      <CardHeader className="flex items-baseline justify-between">
        <CardTitle className="text-ink">{hint ? <Term tip={hint}>{title}</Term> : title}</CardTitle>
        {note && <span className="font-mono text-xs text-ink-4">{note}</span>}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

export function Cluster({ s }: { s: Feed }) {
  const c = s.cluster;
  const total = has(c?.activeStake) && has(c?.delinquentStake) ? c.activeStake + c.delinquentStake : undefined;
  const delinquentPct = pct(c?.delinquentStake, total);
  const delinquentTicks = Math.round((delinquentPct ?? 0) / 2);
  return (
    <Panel
      title="Testnet cluster"
      hint="Health of the whole testnet, not just our node. Delinquent validators have stopped voting; their stake does not count toward consensus."
    >
      <div className="grid grid-cols-2 gap-6">
        <Stat value={compact(c?.activeStake)} label="active stake, SOL" />
        <Stat value={`${num(delinquentPct, 2)}%`} label={`delinquent, ${compact(c?.delinquentStake)} SOL`} />
        <Stat value={num(c?.voting)} label={`of ${num(c?.validators)} validators voting, ${num(c?.delinquent)} delinquent`} />
        <Stat value={num(c?.rpcNodes)} label="nodes advertising RPC" />
      </div>
      {has(delinquentPct) && (
        <div className="space-y-2">
          <div className="grid grid-cols-[repeat(25,1fr)] gap-0.5">
            {Array.from({ length: 50 }, (_, i) => {
              const down = i >= 50 - delinquentTicks;
              return (
                <span
                  key={i}
                  title={down ? "2% of all stake: on delinquent validators, not voting" : "2% of all stake: on validators voting normally"}
                  className={cn("h-3 rounded-[1px]", down ? "bg-down" : "bg-ok/50")}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-ok/50" />
              stake voting {num(100 - delinquentPct, 1)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-down" />
              stake on delinquent validators {num(delinquentPct, 1)}%
            </span>
          </div>
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
    <Panel title="Versions">
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
            </div>
          ))}
        </div>
      ) : (
        <Pending source="versions (getClusterNodes)" />
      )}
    </Panel>
  );
}
