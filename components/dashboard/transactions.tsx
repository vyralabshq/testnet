"use client";

import { Bar, BarChart, XAxis } from "recharts";
import { num } from "@/lib/format";
import type { Feed } from "@/lib/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Facts, Pending, Section, Sub } from "./primitives";

const config = { nonVoteTps: { label: "non-vote tps", color: "var(--info)" } } satisfies ChartConfig;

// Cluster-wide, getRecentPerformanceSamples: one bar per 60-second bucket, not per second.
// Alpenglow votes never land as transactions, so our own votes come from the Votor transport (§27.10).
export function Transactions({ t, votesPerSec }: { t?: Feed["txs"]; votesPerSec?: number }) {
  const samples = t?.samples ?? [];
  return (
    <Section
      title="Transactions"
      hint="Transactions per second across the whole testnet, not just our node. Averaged over 60-second buckets."
      summary={`${num(t?.tps)} transactions per second across testnet · peak minute ${num(t?.peak)}`}
    >
      <Facts
        items={[
          ["cluster tps, latest bucket", num(t?.tps, 1)],
          ["peak 60-second bucket", num(t?.peak, 1)],
          ["our votes sent / s", num(votesPerSec, 1)],
        ]}
      />
      <div>
        <Sub>Non-vote tps per 60-second bucket</Sub>
        {samples.length ? (
          <ChartContainer config={config} className="aspect-auto h-32 w-full">
            <BarChart data={samples}>
              <XAxis dataKey="slot" hide />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `bucket ending slot ${num(p?.[0]?.payload?.slot)}`} />} />
              <Bar dataKey="nonVoteTps" fill="var(--color-nonVoteTps)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <Pending source="txs.samples (getRecentPerformanceSamples)" />
        )}
      </div>
    </Section>
  );
}
