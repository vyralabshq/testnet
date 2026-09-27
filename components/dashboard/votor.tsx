import { cn } from "@/lib/utils";
import { has, ms, num, pct } from "@/lib/format";
import type { Feed } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cols, Facts, Section, Stat, Sub, Term } from "./primitives";

// Below this share of tracked slots a percentile is shown but not presented as authoritative.
const THIN_PCT = 10;

// Alpenglow liveness lives here, not in RPC (§23): votes leaving the box, and when in the slot we vote.
export function Votor({ v, votingValidators }: { v?: Feed["votor"]; votingValidators?: number }) {
  const tracked = v?.trackedSlots;
  const timings = [
    { label: "first shred", p50: v?.firstShredP50, samples: v?.firstShredSamples },
    { label: "parent ready", p50: v?.parentReadyP50, p99: v?.parentReadyP99, samples: v?.parentReadySamples, tip: "The field behind ReplayIsBehind." },
    { label: "notarize vote", p50: v?.notarizeP50, p99: v?.notarizeP99, samples: v?.notarizeSamples, tip: "When in the slot we vote. Minus first shred, it is our time to vote after seeing a block (§26)." },
    { label: "finalized", p50: v?.finalizedP50, samples: v?.finalizedSamples },
  ];

  return (
    <Section
      title="Votor"
      summary={`${num(v?.votesPerSec, 1)} votes/s sent · replay ${num(v?.slotGap)} slots ahead of votor · notarize p50 ${ms(v?.notarizeP50)} ms · ${num(v?.fastFinalizationPct, 1)}% fast finalization`}
      aside={has(v?.transportAgoSec) ? `transport reported ${v.transportAgoSec}s ago` : undefined}
      detail={
        <div>
          <Sub note="votor_datagram_server · certificates">Inbound</Sub>
          <Facts
            items={[
              ["datagrams received", num(v?.datagramsReceived)],
              ["unique peers, peak", num(v?.uniquePeersPeak)],
              ["ingress dropped, channel full", <span key="d" className={v?.ingressDropped ? "text-warn" : undefined}>{num(v?.ingressDropped)}</span>],
              ["certs exist · incoming", `${num(v?.certs?.exist)} · ${num(v?.certs?.incoming)}`],
              ["incoming votes", num(v?.certs?.incomingVotes)],
              ["event loop lag", `${ms(v?.eventLagUs)} ms`],
            ]}
          />
        </div>
      }
    >
      <Cols n={4}>
        <Stat value={num(v?.votesPerSec, 1)} unit="votes/s" label={`sent · ${num(v?.datagramsSent)} since collector start`} />
        <Stat
          value={num(v?.slotGap)}
          unit={v?.slotGap === 1 ? "slot" : "slots"}
          label={<Term tip="Replay's frozen slot minus Votor's slot. Replay falling behind Votor is what raises ReplayIsBehind.">replay minus votor</Term>}
        />
        <Stat value={`${num(v?.fastFinalizationPct, 1)}%`} label={`fast finalization, last ${num(tracked)} slots`} />
        <Stat value={ms(v?.eventLagUs)} unit="ms" label="event loop lag" />
      </Cols>

      <div className="border-t pt-5">
        <Sub note={`event_handler_slot_tracking · ms from slot start · last ${num(tracked)} slots`}>When in the slot</Sub>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>event</TableHead>
              <TableHead className="text-right">p50</TableHead>
              <TableHead className="text-right">p99</TableHead>
              <TableHead className="text-right">samples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-mono">
            {timings.map((t) => {
              const share = pct(t.samples, tracked);
              const thin = has(share) && share < THIN_PCT;
              return (
                <TableRow key={t.label} className={cn(thin && "text-ink-4")}>
                  <TableCell className={thin ? undefined : "text-ink"}>
                    {t.tip ? <Term tip={t.tip}>{t.label}</Term> : t.label}
                  </TableCell>
                  <TableCell className="text-right">{ms(t.p50)}</TableCell>
                  <TableCell className="text-right">{"p99" in t ? ms(t.p99) : ""}</TableCell>
                  <TableCell className="text-right">
                    {num(t.samples)} of {num(tracked)}
                    {!t.samples ? <span className="ml-2 text-xs">no samples</span> : thin && <span className="ml-2 text-xs">thin</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="mt-3 font-mono text-xs text-ink-4">
          Not every slot reports every field; each percentile is over its own non-zero samples only.
        </p>
      </div>

      <div className="border-t pt-5">
        <Sub note="votor_datagram_client">Transport</Sub>
        <Facts
          items={[
            [
              "connections, peak",
              <Term key="p" tip="connections_peak is a high-water mark, not a live count. Shown against validators currently voting.">
                {num(v?.peersConnected)} of {num(votingValidators)}
              </Term>,
            ],
            ["connect failed", `${num(v?.connectFailed)} · ${num(v?.connectFailedNoAddress)} no address`],
            ["connection lost", num(v?.connectionLost)],
            ["replay · votor slot", `${num(v?.replaySlot)} · ${num(v?.votorSlot)}`],
          ]}
        />
      </div>
    </Section>
  );
}
