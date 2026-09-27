import { has, pct } from "./format";
import type { Feed } from "./types";

// Thresholds from desgin.md §7. Only these. A missing value is unknown, never a failure.
export type Level = "ok" | "warn" | "crit";

const band = (v: number | undefined, warn: number, crit: number): Level =>
  !has(v) ? "ok" : v > crit ? "crit" : v >= warn ? "warn" : "ok";
const worst = (...ls: Level[]): Level => (ls.includes("crit") ? "crit" : ls.includes("warn") ? "warn" : "ok");

// Network's view of us. Shown, but under Alpenglow it moves with certificates (§23), so it drives no chip.
export const voteDistance = (s: Feed) =>
  has(s.voting?.tip) && has(s.voting?.lastVoteSlot) ? s.voting.tip - s.voting.lastVoteSlot : undefined;

// Whole-epoch schedule minus elapsed leader slots (§27.5).
export const leaderSlotsLeft = (s: Feed) => {
  const { leaderSlots, leaderSlotsSoFar } = s.production ?? {};
  return has(leaderSlots) && has(leaderSlotsSoFar) ? leaderSlots - leaderSlotsSoFar : undefined;
};

export const skipPct = (s: Feed) => {
  const { produced, skipped } = s.production ?? {};
  return has(produced) && has(skipped) ? pct(skipped, produced + skipped) : undefined;
};

// Compute share, not wall clock: wall includes waiting for shreds, which is normal (§24).
export const replayShare = (s: Feed) => pct(s.replay?.computeMs, s.slots?.slotTimeMs);
export const replayLevel = (s: Feed) => band(replayShare(s), 20, 50);
export const skipLevel = (s: Feed) => band(skipPct(s), 5, 15);
export const memLevel = (s: Feed) => band(pct(s.machine?.rssGB, s.machine?.memTotalGB), 60, 80);
export const ledgerLevel = (s: Feed) => band(s.machine?.mounts?.find((m) => m?.name === "ledger")?.usedPct, 70, 85);
export const xdpLevel = (s: Feed): Level => ((s.network?.xdp?.dropped ?? 0) > 0 ? "crit" : "ok");
export const socketLevel = (s: Feed): Level =>
  (s.network?.rcvbufErrorsMin ?? 0) > 0 || s.network?.sockets?.some((k) => (k?.dropsMin ?? 0) > 0) ? "warn" : "ok";

export const sectionLevels = (s: Feed) => ({
  production: skipLevel(s),
  network: worst(xdpLevel(s), socketLevel(s)),
  replay: replayLevel(s),
  machine: worst(memLevel(s), ledgerLevel(s)),
});

// Status chip from local truth only: getHealth and the collector's catch-up timer.
export function nodeState(s: Feed | null): { label: string; level: Level | "none" } {
  if (!s?.health) return { label: "No data", level: "none" };
  if ((s.health.slotsBehind ?? 0) > 0) return { label: "Behind", level: "warn" };
  if (s.health.catchingUp) return { label: "Catching up", level: "warn" };
  return { label: "Voting", level: "ok" };
}

export const levelText: Record<Level, string> = { ok: "text-ink-2", warn: "text-warn", crit: "text-down" };
