"use client";

import { useState } from "react";
import { ms, num, short, sum } from "@/lib/format";
import type { Feed } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pending, Section } from "./primitives";

const KINDS = ["notar", "notar_fallback", "skip", "skip_fallback", "finalize"];
const cols = ["count", "meanUs", "stddevUs", "maxUs"] as const;
const heads = { count: "count", meanUs: "mean ms", stddevUs: "stddev ms", maxUs: "max ms" };

type Row = Partial<Record<(typeof cols)[number], number>>;

function Timings(props: { name: string; rows: (Row & { label: string; title?: string })[]; sort?: [string, (c: string) => void] }) {
  const { name, rows, sort } = props;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{name}</TableHead>
          {cols.map((c) => (
            <TableHead key={c} className="text-right">
              {sort ? (
                <button onClick={() => sort[1](c)} className={sort[0] === c ? "text-primary" : "hover:text-ink"}>
                  {heads[c]}
                </button>
              ) : (
                heads[c]
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="font-mono">
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableCell className="text-ink" title={r.title}>
              {r.label}
            </TableCell>
            <TableCell className="text-right">{num(r.count)}</TableCell>
            <TableCell className="text-right">{ms(r.meanUs)}</TableCell>
            <TableCell className="text-right">{ms(r.stddevUs)}</TableCell>
            <TableCell className="text-right">{ms(r.maxUs)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SlotDetails({ s }: { s: Feed }) {
  const [sortBy, setSortBy] = useState<string>("meanUs");
  const shreds = s.shreds ?? [];
  const votes = s.votes ?? [];
  // Every kind always listed; a kind the source cannot produce stays "—", never 0 (§27.14).
  const voteRows = KINDS.map((kind) => ({ label: kind, ...votes.find((v) => v?.kind === kind) }));
  const leaders = [...(s.leaders ?? [])]
    .map((l) => ({ ...l, label: short(l?.leader), title: l?.leader }))
    .sort((a, b) => ((b[sortBy as keyof Row] as number) ?? 0) - ((a[sortBy as keyof Row] as number) ?? 0));

  return (
    <div className="space-y-4">
      <Section title="Vote timings" summary="our address, this epoch" aside="consensus_vote_metrics">
        {votes.length ? <Timings name="kind" rows={voteRows} /> : <Pending source="consensus_vote_metrics, emitted at epoch rollover and backfilled from the log" />}
      </Section>
      <Section title="Leader receive latency" summary={`${leaders.length} leaders · how fast we saw each leader's block · click a column to sort`} aside="consensus_block_hash_seen_metrics">
        {leaders.length ? (
          <Timings name="leader" rows={leaders} sort={[sortBy, setSortBy]} />
        ) : (
          <Pending source="consensus_block_hash_seen_metrics, emitted at epoch rollover and backfilled from the log" />
        )}
      </Section>
      <Section
        title="Shreds"
        summary={`last ${shreds.length} slots · ${num(sum(shreds.map((x) => x?.repaired)))} repaired · ${num(sum(shreds.map((x) => x?.recovered)))} recovered by erasure coding`}
        aside="slot_stats_tracking_complete"
      >
        {shreds.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {["slot", "turbine, derived", "repair", "recovered", "fill ms", "state"].map((h, i) => (
                  <TableHead key={h} className={i && i < 5 ? "text-right" : undefined}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono">
              {shreds.map((x) => (
                <TableRow key={x?.slot}>
                  <TableCell className="text-ink">{num(x?.slot)}</TableCell>
                  <TableCell className="text-right">{num(x?.turbine)}</TableCell>
                  <TableCell className="text-right">{num(x?.repaired)}</TableCell>
                  <TableCell className="text-right">{num(x?.recovered)}</TableCell>
                  <TableCell className="text-right">{num(x?.fillMs)}</TableCell>
                  <TableCell className={x?.state === "published" ? "text-ink-4" : "text-down"}>{x?.state ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Pending source="slot_stats_tracking_complete · shred_insert_is_full" />
        )}
      </Section>
    </div>
  );
}
