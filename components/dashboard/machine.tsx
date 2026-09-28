import { cn } from "@/lib/utils";
import { bytes, has, num, pct, sum } from "@/lib/format";
import { ledgerLevel, levelText, memLevel, type Level } from "@/lib/health";
import type { Feed } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cols, Facts, Pending, Section, Spark, Sub, Tile } from "./primitives";

const fillFor: Record<Level, string> = {
  ok: "",
  warn: "[&>[data-slot=progress-indicator]]:bg-warn",
  crit: "[&>[data-slot=progress-indicator]]:bg-down",
};

function Threads({ threads = [] }: { threads?: Feed["threads"] }) {
  if (!threads.length) return <Pending source="threads (/proc/<pid>/task, 30 s)" />;
  return (
    <>
      <Sub>Validator threads</Sub>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>thread</TableHead>
            <TableHead>count</TableHead>
            <TableHead>pinned</TableHead>
            <TableHead>on cpu</TableHead>
            <TableHead className="text-right">now</TableHead>
            <TableHead className="text-right">waiting</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="font-mono">
          {threads.map((t) => (
            <TableRow key={t?.name}>
              <TableCell className="text-ink">{t?.name}</TableCell>
              <TableCell className="text-ink-4">{num(t?.count)}</TableCell>
              <TableCell className={t?.pinned === "any" ? "text-ink-4" : "text-ink"}>{t?.pinned}</TableCell>
              <TableCell className="w-1/3">
                <Spark values={t?.spark} />
              </TableCell>
              <TableCell className="text-right text-ink">{num(t?.pct, 1)}%</TableCell>
              <TableCell className="text-right text-ink-4">{num(t?.waitPct, 1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function Caches({ c }: { c?: Feed["caches"] }) {
  if (!c) return <Pending source="loaded-programs-cache-stats · accounts_db_* · blockstore_rocksdb_cfs" />;
  const rocks = c.rocks ?? [];
  const flag = (v?: number, tone = "text-warn") => <span className={v ? tone : undefined}>{num(v)}</span>;
  return (
    <div className="space-y-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Sub>Program cache</Sub>
          <Facts
            className="lg:grid-cols-3"
            items={[
              ["hit rate", `${num(c.program?.hitPct, 1)}%`],
              ["hits", num(c.program?.hits)],
              ["misses", num(c.program?.misses)],
              ["entries", num(c.program?.entries)],
              ["evictions", num(c.program?.evictions)],
            ]}
          />
        </div>
        <div>
          <Sub>Accounts</Sub>
          <Facts
            className="lg:grid-cols-3"
            items={[
              ["hit rate", `${num(c.accounts?.hitPct, 2)}%`],
              ["from read cache", num(c.accounts?.fromReadCache)],
              ["from write cache", num(c.accounts?.fromWriteCache)],
              ["from index storage", num(c.accounts?.fromIndexStorage)],
              ["cache size", `${num(c.accounts?.cacheGB, 2)} GB`],
              ["accounts", num(c.accounts?.accounts)],
            ]}
          />
        </div>
      </div>
      <div>
        <Sub>Storage, per column family</Sub>
        {rocks.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {["column family", "size", "compactions pending", "running", "write stopped", "bg errors"].map((h, i) => (
                  <TableHead key={h} className={i ? "text-right" : undefined}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono">
              {[...rocks].sort((a, b) => (b?.gb ?? 0) - (a?.gb ?? 0)).map((r) => (
                <TableRow key={r?.cf}>
                  <TableCell className="text-ink">{r?.cf}</TableCell>
                  <TableCell className="text-right">{num(r?.gb, 1)} GB</TableCell>
                  <TableCell className="text-right">{num(r?.compactionsPending)}</TableCell>
                  <TableCell className="text-right">{num(r?.compactionsRunning)}</TableCell>
                  <TableCell className="text-right">{flag(r?.writeStopped)}</TableCell>
                  <TableCell className="text-right">{flag(r?.bgErrors, "text-down")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Pending source="blockstore_rocksdb_cfs" />
        )}
      </div>
    </div>
  );
}

export function Machine({ s, level }: { s: Feed; level: Level }) {
  const m = s.machine;
  const cpu = m?.cpu;
  const busy = cpu ? sum([cpu.user, cpu.system, cpu.iowait]) : undefined;
  const mounts = m?.mounts ?? [];
  const disks = m?.disks ?? [];
  const load = m?.load ?? [];

  return (
    <Section
      title="Machine"
      hint="The server itself: CPU, memory and disks. The ledger disk filling up or memory running out are what stop a validator."
      level={level}
      summary={`${num(busy, 1)}% CPU · ${num(m?.memUsedGB, 1)} GB RAM · validator ${num(m?.rssGB, 1)} GB · ${mounts.map((x) => `${num(x?.usedPct)}% ${x?.name}`).join(" · ")}`}
      detail={
        <>
          <div>
            <Sub>How hard worked</Sub>
            {disks.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>device</TableHead>
                    <TableHead className="text-right">time busy</TableHead>
                    <TableHead className="text-right">wait</TableHead>
                    <TableHead className="text-right">iops</TableHead>
                    <TableHead className="text-right">read and write, per s</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="font-mono">
                  {disks.map((d) => (
                    <TableRow key={d?.device}>
                      <TableCell className="text-ink">
                        {d?.device} <span className="text-ink-4">{d?.role}</span>
                      </TableCell>
                      <TableCell className="text-right">{num(d?.busyPct, 1)}%</TableCell>
                      <TableCell className="text-right">{num(d?.waitMs, 2)} ms</TableCell>
                      <TableCell className="text-right">{num(d?.iops)}</TableCell>
                      <TableCell className="text-right">
                        {bytes(d?.readB)}, {bytes(d?.writeB)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Pending source="machine.disks (/proc/diskstats)" />
            )}
            <p className="mt-3 font-mono text-xs text-ink-4">
              {m?.snapshot
                ? `last snapshot ${num(m.snapshot.slot)} took ${num(m.snapshot.tookSec)}s, replay fell ${num(m.snapshot.behind)} slots behind the cluster`
                : "last snapshot: waiting on snapshot log lines from the collector"}
            </p>
          </div>
          <div>
            <Threads threads={s.threads} />
          </div>
          <Caches c={s.caches} />
        </>
      }
    >
      <Cols n={3}>
        <Tile label="Load average" value={`${num(load[0], 2)} of ${num(m?.cores)} cores`} />
        <div className="space-y-3">
          <Tile label="CPU busy" value={`${num(busy, 1)}% of ${num(m?.cores)} cores`} />
          <Progress value={busy ?? 0} className="bg-elevated" />
        </div>
        <div className="space-y-3">
          <Tile
            label="Memory in use"
            value={`${num(m?.memUsedGB, 1)} GB of ${num(m?.memTotalGB)} GB`}
            sub={<span className={levelText[memLevel(s)]}>validator itself {num(m?.rssGB, 1)} GB</span>}
          />
          <Progress value={pct(m?.memUsedGB, m?.memTotalGB) ?? 0} className={cn("bg-elevated", fillFor[memLevel(s)])} />
        </div>
      </Cols>
      <div className="border-t pt-5">
        <Sub>How full</Sub>
        {mounts.length ? (
          <div className="space-y-3">
            {mounts.map((x) => (
              <div key={x?.name} className="flex items-center gap-4 font-mono text-sm">
                <span className="w-24 shrink-0 text-ink">
                  {x?.name}
                </span>
                <Progress
                  value={x?.usedPct ?? 0}
                  className={cn("flex-1 bg-elevated", x?.name === "ledger" && fillFor[ledgerLevel(s)])}
                />
                <span className="w-12 text-right text-ink">{num(x?.usedPct)}%</span>
                <span className="w-28 text-right text-sm text-ink-3">{has(x?.freeGB) ? `${num(x.freeGB)} GB free` : "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <Pending source="machine.mounts (statvfs)" />
        )}
      </div>
    </Section>
  );
}
