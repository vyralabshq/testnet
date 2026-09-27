"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSnapshot } from "@/lib/use-snapshot";
import { sectionLevels } from "@/lib/health";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cluster, Epoch, Versions } from "./cluster";
import { Header } from "./header";
import { Machine } from "./machine";
import { Network } from "./network";
import { Production, Schedule } from "./production";
import { Replay } from "./replay";
import { SlotDetails } from "./slot-details";
import { Slots } from "./slots";
import { Status } from "./status";
import { Transactions } from "./transactions";
import { Votor } from "./votor";

export function Dashboard() {
  const { data, stale, failing } = useSnapshot();
  const s = data ?? {};
  const levels = sectionLevels(s);

  // Diagnostic order (desgin.md §5). The first critical section is promoted under Level 1.
  const sections: [string, ReactNode][] = [
    ["production", <Production key="production" s={s} level={levels.production} />],
    [
      "slots",
      <div key="slots" className="space-y-4">
        <Slots s={s} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Epoch s={s} />
          <Cluster s={s} />
          <Versions s={s} />
        </div>
      </div>,
    ],
    ["transactions", <Transactions key="transactions" t={s.txs} votesPerSec={s.votor?.votesPerSec} />],
    ["network", <Network key="network" n={s.network} level={levels.network} />],
    ["replay", <Replay key="replay" s={s} level={levels.replay} />],
    ["votor", <Votor key="votor" v={s.votor} votingValidators={s.cluster?.voting} />],
    ["machine", <Machine key="machine" s={s} level={levels.machine} />],
  ];
  const promoted = sections.findIndex(([k]) => levels[k as keyof typeof levels] === "crit");
  if (promoted > 0) sections.unshift(...sections.splice(promoted, 1));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Header s={s} fresh={{ hasData: !!data, failing, stale }} />
      <Tabs defaultValue="overview" className={cn("mt-4 transition-opacity", stale && "opacity-60")}>
        <TabsList variant="line" className="w-full justify-start border-b pb-2">
          {[
            ["overview", "Overview"],
            ["slots", "Slot details"],
            ["schedule", "Schedule"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="flex-none after:bg-primary">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="space-y-4 pt-4">
          <Status s={s} />
          {sections.map(([, node]) => node)}
        </TabsContent>
        <TabsContent value="slots" className="pt-4">
          <SlotDetails s={s} />
        </TabsContent>
        <TabsContent value="schedule" className="pt-4">
          <Schedule s={s} />
        </TabsContent>
      </Tabs>
      <footer className="mt-10 border-t pt-6 text-xs text-ink-4">
        Testnet node, operated in the open by Vyra Labs. Node figures are self-reported by a collector on the box; cluster
        figures come from public testnet RPC. Not financial data.
      </footer>
    </main>
  );
}
