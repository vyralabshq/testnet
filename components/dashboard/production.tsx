"use client";

import { Bar, BarChart, Cell, Label, LabelList, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { dur, epochFirstSlot, has, num, pct } from "@/lib/format";
import { leaderSlotsLeft, skipLevel, skipPct, type Level } from "@/lib/health";
import type { Feed, GroupState } from "@/lib/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cols, Pending, Section, Stat, Sub } from "./primitives";

// One meaning per colour (§4): green made it, amber partly, red missed, grey not checked yet, faint still to come.
const groupColor: Record<GroupState, string> = {
  produced: "bg-ok",
  partial: "bg-warn",
  skipped: "bg-down",
  unverified: "bg-ink-3",
  upcoming: "bg-ink-4/40",
};

const groupLabel: Record<GroupState, string> = {
  produced: "made",
  partial: "partly made",
  skipped: "missed",
  unverified: "not checked yet",
  upcoming: "still to come",
};

const donutConfig = {
  produced: { label: "produced", color: "var(--ok)" },
  skipped: { label: "skipped", color: "var(--down)" },
  upcoming: { label: "still to come", color: "color-mix(in oklab, var(--ink-4) 40%, transparent)" },
} satisfies ChartConfig;

const skipConfig = { pct: { label: "skip %" } } satisfies ChartConfig;

const barColor = (v = 0) => (v > 15 ? "var(--down)" : v >= 5 ? "var(--warn)" : "var(--ok)");

// Is it voting, is it producing. Carried over from vyralabs.fun/dashboard, re-grounded for Alpenglow.
export function Production({ s, level }: { s: Feed; level: Level }) {
  const { production: p, epoch: e } = s;
  const skip = skipPct(s);
  const upcoming = leaderSlotsLeft(s);
  const groups = p?.groups ?? [];
  // Past epochs come from the collector; the current epoch is always shown live from block production.
  const skipBars = [
    ...(p?.skipByEpoch ?? []).filter((x) => x?.epoch !== e?.epoch),
    ...(has(e?.epoch) && has(skip) ? [{ epoch: e.epoch, pct: skip, live: true }] : []),
  ];
  const counts = groups.reduce<Partial<Record<GroupState, number>>>(
    (a, g) => (g?.state ? { ...a, [g.state]: (a[g.state] ?? 0) + 1 } : a),
    {}
  );
  const donut = [
    { key: "produced", value: p?.produced ?? 0, fill: "var(--color-produced)" },
    { key: "skipped", value: p?.skipped ?? 0, fill: "var(--color-skipped)" },
    { key: "upcoming", value: upcoming ?? 0, fill: "var(--color-upcoming)" },
  ];

  return (
    <Section
      title="Block production"
      hint="The network gives each validator turns as leader. On our turn we build the block. A skipped slot is a turn that passed without our block."
      level={level}
      summary={`${num(p?.produced)} of ${num(p?.leaderSlotsSoFar)} blocks made · ${num(skip, 1)}% skipped · next turn in ${dur(p?.nextLeaderSec)}`}
    >
      <Cols n={3}>
        <Stat value={num(p?.produced)} unit="blocks" label={`made on our turns this epoch, of ${num(p?.leaderSlotsSoFar)} so far`} />
        <Stat
          value={`${num(skip, 1)}%`}
          level={skipLevel(s)}
          label={`missed · ${num(p?.skipped)} slots · cluster average ${num(e?.clusterSkipPct, 1)}%`}
        />
        <Stat value={num(upcoming)} unit="slots" label={`still to come this epoch, of ${num(p?.leaderSlots)} assigned`} />
      </Cols>


      <div>
        <Sub>Our leader turns this epoch</Sub>
        {groups.length && has(e?.slotsInEpoch) ? (
          <>
            <div className="relative h-16 border-b">
              {groups.map((g) =>
                g?.state ? (
                  <span
                    key={g.slotIndex}
                    title={`${has(g.firstSlot) ? `slots ${num(g.firstSlot)}–${num(g.firstSlot + 3)}` : `slot index ${num(g.slotIndex)}`} · ${groupLabel[g.state]}${has(g.blocks) ? ` · ${g.blocks} of 4 blocks` : ""}`}
                    className={cn("absolute bottom-0 h-full w-1 rounded-t-[1px]", groupColor[g.state])}
                    style={{ left: `${pct(g.slotIndex, e.slotsInEpoch)}%` }}
                  />
                ) : null
              )}
              <span className="absolute top-0 bottom-0 border-l border-primary" style={{ left: `${pct(e.slotIndex, e.slotsInEpoch)}%` }}>
                <span className="ml-1 font-mono text-xs text-primary">now</span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-3">
              {Object.entries(groupColor).map(([g, c]) => (
                <span key={g} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-xs", c)} />
                  {groupLabel[g as GroupState]} <span className="font-mono text-ink-4">{counts[g as GroupState] ?? 0}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <Pending source="production.groups (getLeaderSchedule)" />
        )}
      </div>

      <Cols n={2} className="border-t pt-5">
        <div>
          <Sub>Block production</Sub>
          {has(p?.leaderSlots) ? (
            <div className="flex items-center gap-6">
              <ChartContainer config={donutConfig} className="aspect-square h-44">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                  <Pie data={donut} dataKey="value" nameKey="key" innerRadius="70%" strokeWidth={0} startAngle={90} endAngle={-270}>
                    <Label
                      content={({ viewBox }) =>
                        viewBox && "cx" in viewBox ? (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan className="fill-ink font-mono text-xl">{num(p.produced)}</tspan>
                            <tspan x={viewBox.cx} dy={18} className="fill-ink-3 text-[10px]">
                              produced
                            </tspan>
                          </text>
                        ) : null
                      }
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ul className="flex-1 space-y-2 font-mono text-sm">
                {donut.map((d) => (
                  <li key={d.key} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: donutConfig[d.key as keyof typeof donutConfig].color }} />
                    <span className="flex-1">{d.key}</span>
                    <span className="text-ink">{num(pct(d.value, p.leaderSlots), 1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Pending source="getBlockProduction {identity}" />
          )}
        </div>
        <div>
          <Sub>Skip rate per epoch</Sub>
          {skipBars.length ? (
            <>
              <ChartContainer config={skipConfig} className="aspect-auto h-44 w-full">
                <BarChart data={skipBars} margin={{ top: 16 }}>
                  <XAxis
                    dataKey="epoch"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(ep) => (ep === e?.epoch ? `${ep} live` : String(ep))}
                  />
                  <YAxis hide domain={[0, (max: number) => Math.max(10, max)]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine y={5} stroke="var(--warn)" strokeDasharray="4 4" />
                  <Bar dataKey="pct" radius={[2, 2, 0, 0]} minPointSize={2} maxBarSize={36}>
                    <LabelList dataKey="pct" position="top" className="fill-ink-3 font-mono" fontSize={10} formatter={(v) => `${num(Number(v), 1)}%`} />
                    {skipBars.map((x) => (
                      <Cell key={x?.epoch} fill={barColor(x?.pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </>
          ) : (
            <Pending source="production.skipByEpoch (epochs.json, written on disk at each rollover)" />
          )}
        </div>
      </Cols>
    </Section>
  );
}

// Schedule tab: our upcoming leader windows, derived from the groups.
export function Schedule({ s }: { s: Feed }) {
  const { production: p, epoch: e, slots } = s;
  const next = (p?.groups ?? []).filter((g) => g?.state === "upcoming");
  const index = e?.slotIndex ?? 0;
  const epochStart = has(e?.epoch) ? epochFirstSlot(e.epoch) : undefined;
  return (
    <Section title="Upcoming leader slots" summary={`${next.length} windows left this epoch · 4 slots each`}>
      {next.length && has(e?.slotIndex) ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>first slot</TableHead>
              <TableHead className="text-right">slots away</TableHead>
              <TableHead className="text-right">in about</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-mono">
            {next.map((g) => {
              const away = (g?.slotIndex ?? 0) - index;
              return (
                <TableRow key={g?.slotIndex}>
                  <TableCell className="text-ink">{has(epochStart) ? num(epochStart + (g?.slotIndex ?? 0)) : "—"}</TableCell>
                  <TableCell className="text-right">{num(away)}</TableCell>
                  <TableCell className="text-right">{has(slots?.slotTimeMs) ? dur((away * slots.slotTimeMs) / 1000) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <Pending source="production.groups (getLeaderSchedule)" />
      )}
    </Section>
  );
}
