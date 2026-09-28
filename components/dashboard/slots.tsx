import { cn } from "@/lib/utils";
import { has, num } from "@/lib/format";
import { nodeStale } from "@/lib/health";
import type { Feed, SlotState } from "@/lib/types";
import { Pending, Section, Term } from "./primitives";

const fill: Record<SlotState, string> = {
  pending: "bg-elevated",
  processed: "bg-info",
  confirmed: "bg-primary",
  rooted: "bg-ink-3",
  finalized: "bg-ok",
  skipped: "bg-down",
};

export function Slots({ s }: { s: Feed }) {
  const slots = s.slots ?? {};
  const recent = slots.recent ?? [];
  // Scale to twice the mean slot time, not the peak: one stall would otherwise flatten every normal slot.
  // The dashed line is the mean; stalls clip at the top and keep their real value in the tooltip.
  const scale = (slots.slotTimeMs ?? 0) * 2 || (slots.peakMs ?? 0);
  const pointers: [string, number | undefined, string?][] = [
    ["Finalized", slots.finalized],
    ["Root", slots.root, "Bursty under Alpenglow: moves only when our vote lands in a finalization certificate. Not a health signal."],
    ["Confirmed", slots.confirmed],
    ["Voted", slots.voted, "The network's view of our last vote, from getVoteAccounts."],
    ["Processed", slots.processed],
    ["Highest", slots.highest],
    ["Block height", slots.blockHeight],
  ];
  return (
    <Section
      title="Slots"
      stale={nodeStale(s)}
      hint="The chain advances one slot at a time, a few per second. Each bar is one recent slot: taller means that slot took longer. Green means the network finalized it."
      summary={`a new slot every ${num(slots.slotTimeMs)} ms · slowest in the last minute ${num(slots.peakMs)} ms`}
      detail={
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {pointers.map(([label, slot, tip]) => {
            const delta = label !== "Block height" && has(slot) && has(slots.processed) ? slot - slots.processed : undefined;
            return (
              <div key={label}>
                <div className="text-xs text-ink-3">
                  {tip ? <Term tip={tip}>{label}</Term> : label}{" "}
                  {has(delta) && <span className="font-mono text-ink-4">{delta > 0 ? `+${delta}` : delta}</span>}
                </div>
                <div className="font-mono text-ink">{num(slot)}</div>
              </div>
            );
          })}
        </div>
      }
    >
      {recent.length && scale ? (
        <div className="rounded-lg border bg-background px-3 pt-4 pb-3">
          <div className="relative flex h-24 items-end gap-0.5">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink-4/60" />
            {recent.map((r) => {
              const ms = r?.ms ?? 0;
              const clipped = ms > scale;
              return (
                <div
                  key={r?.slot}
                  title={`${num(r?.slot)} · ${num(ms)} ms · ${r?.state}${r?.ours ? " · ours" : ""}${ms < 5 ? " · froze with the slot before" : ""}`}
                  className={cn(
                    "flex-1 rounded-t-xs",
                    fill[r?.state ?? "pending"],
                    ms < 5 && "opacity-40",
                    clipped && "border-t-2 border-ink",
                    r?.ours && "outline outline-ink"
                  )}
                  style={{ height: `${Math.max(6, Math.min(100, (ms / scale) * 100))}%` }}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <Pending source="slots.recent (slotsUpdatesSubscribe)" />
      )}
      {recent.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-ink-3">
          {Object.entries(fill).map(([state, bg]) => (
            <span key={state} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-xs", bg)} />
              {state}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs outline outline-ink" />
            ours
          </span>
        </div>
      )}
    </Section>
  );
}
