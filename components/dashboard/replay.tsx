import { has, num } from "@/lib/format";
import { replayShare, type Level } from "@/lib/health";
import type { Feed } from "@/lib/types";
import { Cols, Facts, Pending, Section, StackBar, Stat, Sub, Term } from "./primitives";

const SOURCE = "replay-slot-stats";
const us = (v?: number) => (has(v) ? v * 1000 : undefined);

// Mean over the last 256 slots. Wall clock includes waiting for shreds; compute is the work.
export function Replay({ s, level }: { s: Feed; level: Level }) {
  const r = s.replay;
  const gap = has(r?.wallMs) && has(r?.computeMs) ? r.wallMs - r.computeMs : undefined;
  const share = replayShare(s);
  return (
    <Section
      title="Replay"
      level={level}
      summary={`${num(r?.computeMs, 2)} ms compute · ${num(share, 1)}% of slot time · ${num(r?.wallMs, 1)} ms wall · ${num(r?.worstMs, 1)} ms worst · ${num(r?.txPerSlot, 1)} tx/slot`}
      aside="replay-slot-stats · last 256 slots"
      detail={
        <>
          <div>
            <Sub note="µs per slot · overlapping sums, comparable with each other only">
              <Term tip="Hash chain and signature checks, summed across verify workers">Verifying effort</Term>
            </Sub>
            {r?.verifying ? (
              <StackBar
                unit="µs"
                cols={2}
                digits={0}
                segments={[
                  { label: "Checking the hash chain", value: us(r.verifying.poh), color: "bg-primary" },
                  { label: "Checking signatures", value: us(r.verifying.sigs), color: "bg-sub" },
                ]}
              />
            ) : (
              <Pending source={SOURCE} />
            )}
          </div>
          <div>
            <Sub note="µs per slot">Execution</Sub>
            {r?.exec ? (
              <StackBar
                unit="µs"
                cols={2}
                digits={0}
                segments={[
                  { label: "Running programs", value: us(r.exec.programs), color: "bg-primary" },
                  { label: "Loading accounts", value: us(r.exec.loadAccounts), color: "bg-sub" },
                  { label: "Writing accounts back", value: us(r.exec.store), color: "bg-ok" },
                  { label: "Loading programs", value: us(r.exec.loadPrograms), color: "bg-orange-bright" },
                  { label: "Checking transactions", value: us(r.exec.checkTxs), color: "bg-info" },
                  { label: "Block limits", value: us(r.exec.blockLimits), color: "bg-ink-4" },
                ]}
              />
            ) : (
              <Pending source={`${SOURCE} execute_*`} />
            )}
          </div>
          <p className="font-mono text-xs text-ink-4">
            confirmation_time_us reads {num(r?.confirmationUs)} µs. That is the commitment step, not a compute span, and is
            not used above.
          </p>
        </>
      }
    >
      <Cols n={4}>
        <Stat value={num(r?.computeMs, 2)} unit="ms" label="compute per slot, execute + load + store" />
        <Stat value={num(share, 2)} unit="%" label="compute share of the observed slot time" level={level} />
        <Stat
          value={num(r?.wallMs, 1)}
          unit="ms"
          label={
            <Term tip="replay_total_elapsed: first shred to bank frozen. Mostly waiting for shreds to arrive, which is normal.">
              wall clock, {num(r?.pctOfSlot)}% of slot
            </Term>
          }
        />
        <Stat value={num(r?.worstMs, 1)} unit="ms" label="worst wall clock of the last 256" />
      </Cols>
      <div className="rounded-lg border bg-background p-4">
        <Sub>
          <Term tip="Wall clock minus compute. A positive gap is replay waiting for shreds, normal inside a slot.">
            Compute inside wall clock
          </Term>
        </Sub>
        <p className="font-mono text-ink">
          {num(r?.computeMs, 2)} ms compute <span className="text-ink-4">inside</span> {num(r?.wallMs, 1)} ms wall clock
          <span className="text-ink-4"> · waiting </span>
          {num(gap, 1)} ms
        </p>
      </div>
      <div>
        <Sub note="ms per slot, one after another">Time spent on this slot</Sub>
        {r?.spans ? (
          <StackBar
            digits={2}
            segments={[
              { label: "Verifying and dispatching", value: r.spans.verify, color: "bg-primary" },
              { label: "Reading from disk", value: r.spans.disk, color: "bg-sub" },
              { label: "Completing the bank", value: r.spans.complete, color: "bg-ok" },
            ]}
          />
        ) : (
          <Pending source={SOURCE} />
        )}
      </div>
      <Facts
        className="border-t pt-5 lg:grid-cols-3"
        items={[
          ["transactions per slot", num(r?.txPerSlot, 1)],
          ["entries per slot", num(r?.entriesPerSlot, 1)],
          ["shreds per slot", num(r?.shredsPerSlot, 0)],
        ]}
      />
    </Section>
  );
}
