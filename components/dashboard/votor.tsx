import { cn } from "@/lib/utils";
import { has, ms, num, pct } from "@/lib/format";
import type { Feed } from "@/lib/types";
import { Cols, Facts, Section, Stat, Sub, Term } from "./primitives";

// Below this share of tracked slots a moment is too thin to draw; it stays listed, with its count, in details.
const THIN_PCT = 10;

type Moment = { label: string; us?: number | null; samples?: number; color: string };

// One slot, start to end, with the moments that happen inside it. Everything is a p50 over recent slots.
function SlotTimeline({ moments, tracked, slotMs }: { moments: Moment[]; tracked?: number; slotMs?: number }) {
  // Only well-sampled moments, in time order, so neighbouring labels alternate rows and never collide.
  const shown = moments
    .filter((m) => has(m.us) && (pct(m.samples, tracked) ?? 0) >= THIN_PCT)
    .sort((a, b) => (a.us ?? 0) - (b.us ?? 0));
  const end = Math.max(slotMs ?? 0, ...shown.map((m) => (m.us ?? 0) / 1000)) * 1.1 || 1;
  return (
    <div className="pt-2 pb-1">
      <div className="relative mx-2 h-32">
        <div className="absolute inset-x-0 top-10 h-0.5 bg-elevated" />
        {has(slotMs) && (
          <div className="absolute top-6 h-8 border-l border-dashed border-ink-4" style={{ left: `${(slotMs / end) * 100}%` }}>
            <span className="absolute -top-5 -translate-x-1/2 font-mono text-xs whitespace-nowrap text-ink-4">
              slot ends ~{num(slotMs)} ms
            </span>
          </div>
        )}
        {shown.map((m, i) => {
          const left = ((m.us ?? 0) / 1000 / end) * 100;
          // Labels near either edge anchor inward instead of centring on the dot and spilling out.
          const anchor = left < 10 ? "translate-x-0" : left > 90 ? "-translate-x-full" : "-translate-x-1/2";
          return (
            <div key={m.label} className="absolute top-10" style={{ left: `${left}%` }}>
              <span className={cn("absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full", m.color)} />
              <div className={cn("absolute top-3 text-center whitespace-nowrap", anchor, i % 2 && "top-12")}>
                <div className="font-mono text-sm text-ink">{ms(m.us)} ms</div>
                <div className="text-xs text-ink-3">{m.label}</div>
              </div>
            </div>
          );
        })}
        <span className="absolute top-5 left-0 font-mono text-xs text-ink-4">0 ms</span>
      </div>
    </div>
  );
}

// Alpenglow liveness lives here, not in RPC (§23): when in the slot we vote, and whether votes leave the box.
export function Votor(props: { v?: Feed["votor"]; voting?: Feed["voting"]; slotMs?: number; stale?: boolean }) {
  const { v, voting, slotMs, stale } = props;
  const tracked = v?.trackedSlots;
  const distance = has(voting?.tip) && has(voting?.lastVoteSlot) ? voting.tip - voting.lastVoteSlot : undefined;
  const moments: Moment[] = [
    { label: "block reaches us", us: v?.firstShredP50, samples: v?.firstShredSamples, color: "bg-info" },
    { label: "previous block confirmed", us: v?.parentReadyP50, samples: v?.parentReadySamples, color: "bg-sub" },
    { label: "network finalizes", us: v?.finalizedP50, samples: v?.finalizedSamples, color: "bg-ok" },
    { label: "we vote", us: v?.notarizeP50, samples: v?.notarizeSamples, color: "bg-primary" },
  ];
  const lateBy = has(v?.notarizeP50) && has(v?.finalizedP50) ? (v.notarizeP50 - v.finalizedP50) / 1000 : undefined;

  return (
    <Section
      title="Voting"
      stale={stale}
      summary={`${num(v?.fastFinalizationPct)}% of blocks finalized in one round · we vote ${ms(v?.notarizeP50)} ms into a slot`}
      aside={has(v?.transportAgoSec) ? `votes seen leaving ${v.transportAgoSec}s ago` : undefined}
      detail={
        <>
          <div>
            <Sub>Every moment, in numbers</Sub>
            <Facts
              items={moments.map((m): [string, string] => [
                m.label,
                `${ms(m.us)} ms · ${num(m.samples)} of ${num(tracked)} slots`,
              ])}
            />
            <p className="mt-2 font-mono text-xs text-ink-4">
              Worst case (p99): we vote {ms(v?.notarizeP99)} ms in. Not every slot reports every moment, so each is measured
              over the slots that did.
            </p>
          </div>
          <div>
            <Sub>Transport and internals</Sub>
            <Facts
              items={[
                ["votes sent since collector start", num(v?.datagramsSent)],
                ["connect failed", `${num(v?.connectFailed)} · ${num(v?.connectFailedNoAddress)} no address`],
                ["connections lost", num(v?.connectionLost)],
                ["votes received", num(v?.datagramsReceived)],
                ["inbound dropped, queue full", <span key="d" className={v?.ingressDropped ? "text-warn" : undefined}>{num(v?.ingressDropped)}</span>],
                ["event loop lag", `${ms(v?.eventLagUs)} ms`],
                ["certificates · incoming", `${num(v?.certs?.exist)} · ${num(v?.certs?.incoming)}`],
                [
                  "last vote, network view",
                  <Term key="lv" tip="lastVote from getVoteAccounts. Moves when a certificate lands, so it is not a liveness signal under Alpenglow.">
                    {num(distance)} slots behind tip
                  </Term>,
                ],
              ]}
            />
          </div>
        </>
      }
    >
      <p className="-mt-2 text-sm text-ink-3">
        Under Alpenglow, votes travel directly between validators instead of going into blocks. A block is final once enough
        stake has voted for it, usually in a single round.
      </p>

      <div>
        <p className="text-base text-ink-2">
          A block reaches us <span className="font-mono text-ink">{ms(v?.firstShredP50)} ms</span> into the slot. We vote on it
          at <span className="font-mono text-ink">{ms(v?.notarizeP50)} ms</span>. The network finalizes it at{" "}
          <span className="font-mono text-ink">{ms(v?.finalizedP50)} ms</span>.
        </p>
        <SlotTimeline moments={moments} tracked={tracked} slotMs={slotMs} />
        {has(lateBy) && lateBy > 0 && (
          <p className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-ink-2">
            Blocks finalize about <span className="font-mono text-warn">{num(lateBy)} ms</span> before our vote goes out. If that
            holds, our votes arrive after the decision is made, which would fit vote credits running below the median.{" "}
            <span className="text-ink-4">Unconfirmed: the finalized timestamp may belong to the previous slot.</span>
          </p>
        )}
      </div>

      <Cols n={3} className="border-t pt-5">
        <Stat value={`${num(v?.fastFinalizationPct)}%`} label={`of blocks finalized in one round · last ${num(tracked)} slots`} />
        <Stat value={num(v?.votesPerSec, 1)} unit="votes/s" label="leaving our node right now" />
        <Stat
          value={num(v?.peersConnected)}
          unit="peers"
          label={<Term tip="Highest number of validators our vote transport has been connected to at once.">we can reach, at peak</Term>}
        />
      </Cols>
    </Section>
  );
}
