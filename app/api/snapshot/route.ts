import { epochFirstSlot } from "@/lib/format";
import { isRpcDown } from "@/lib/health";
import type { GroupState, Snapshot } from "@/lib/types";

// Proxy to the collector (desgin.md §18.2). 1 s cache so viewers never multiply load on the box;
// on failure, serve the last good body with its age so the page shows stale data, not a blank.
export const dynamic = "force-dynamic";

const COLLECTOR_URL = process.env.COLLECTOR_URL ?? "https://node.vyralabs.fun";
const COLLECTOR_KEY = process.env.COLLECTOR_KEY; // shared secret, once Caddy requires it on node.vyralabs.fun
const PUBLIC_RPC = process.env.PUBLIC_RPC_URL ?? "https://api.testnet.solana.com";
const WINDOW = 4; // slots per leader window

let cache: { at: number; body: string } | null = null;

// What the collector serves: the page's shape, except meta still carries raw error messages.
type Raw = Omit<Partial<Snapshot>, "meta"> & { meta?: { startedAt?: number; updatedAt?: number; errors?: Record<string, string> } };

// The collector sends past leader windows as "unverified". Resolve them from the SlotHistory sysvar: a bitmap
// of every slot that got a block on the finalized chain, identical on every node. Slots at or after its
// next_slot are not known yet, so a window is only judged once it is fully behind that line. A judged window
// never changes and is cached. (getBlocks was dropped: it reads each RPC node's own ledger, and nodes disagree.)
const SLOT_HISTORY = "SysvarS1otHistory11111111111111111111111111";
const made = new Map<number, number>(); // first slot of window -> blocks produced in it (0..4)
let history: { at: number; bits: Uint8Array; bitLen: number; nextSlot: number } | null = null;

async function slotHistory() {
  if (history && Date.now() - history.at < 30_000) return history;
  const r = await fetch(PUBLIC_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [SLOT_HISTORY, { encoding: "base64", commitment: "finalized" }],
    }),
    signal: AbortSignal.timeout(4000),
  });
  const raw = Buffer.from((await r.json()).result.value.data[0], "base64");
  // bincode: [1-byte Some][u64 word count][words as little-endian u64...][u64 bit length][u64 next_slot]
  const words = Number(raw.readBigUInt64LE(1));
  const tail = 9 + words * 8;
  history = {
    at: Date.now(),
    bits: raw.subarray(9, tail), // little-endian words, so bit i is byte i/8, bit i%8
    bitLen: Number(raw.readBigUInt64LE(tail)),
    nextSlot: Number(raw.readBigUInt64LE(tail + 8)),
  };
  return history;
}

// Our leader turns, from getLeaderSchedule, once per epoch. The collector's own slotIndex drifts by a few slots
// between snapshots, which shifts every window, so the page builds the turns from the schedule instead.
let schedule: { epoch: number; starts: number[] } | null = null;

async function leaderTurns(epoch: number, identity: string) {
  if (schedule?.epoch === epoch) return schedule.starts;
  const r = await fetch(PUBLIC_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLeaderSchedule", params: [epochFirstSlot(epoch), { identity }] }),
    signal: AbortSignal.timeout(4000),
  });
  const slots: number[] = (await r.json()).result?.[identity] ?? [];
  const starts = [...new Set(slots.map((i) => i - (i % WINDOW)))].sort((x, y) => x - y);
  if (starts.length) schedule = { epoch, starts };
  return starts;
}

async function resolveGroups(s: Partial<Snapshot>) {
  const epoch = s.epoch?.epoch;
  const identity = s.node?.identity;
  const processed = s.slots?.processed;
  if (epoch == null || !identity || processed == null || !s.production) return;
  try {
    const starts = await leaderTurns(epoch, identity);
    if (!starts.length) return;
    const h = await slotHistory();
    const hasBlock = (slot: number) => {
      const i = slot % h.bitLen;
      return (h.bits[i >> 3] >> (i & 7)) & 1;
    };
    s.production.groups = starts.map((slotIndex) => {
      const firstSlot = epochFirstSlot(epoch) + slotIndex;
      let blocks = made.get(firstSlot);
      if (blocks === undefined && firstSlot + WINDOW <= h.nextSlot) {
        blocks = 0;
        for (let i = 0; i < WINDOW; i++) blocks += hasBlock(firstSlot + i);
        made.set(firstSlot, blocks);
      }
      const state: GroupState =
        blocks !== undefined
          ? blocks === WINDOW ? "produced" : blocks ? "partial" : "skipped"
          : firstSlot > processed ? "upcoming" : "unverified";
      return { slotIndex, firstSlot, blocks: blocks ?? 0, state };
    });
    // Recount from the same turns the timeline draws, so every figure is for this epoch. The collector's own
    // produced/skipped can lag an epoch at rollover (e.g. 360 made of 0 so far).
    const groups = s.production.groups;
    const judged = groups.filter((g) => g.state !== "upcoming" && g.state !== "unverified");
    s.production.leaderSlots = groups.length * WINDOW;
    s.production.leaderSlotsSoFar = groups.filter((g) => g.state !== "upcoming").length * WINDOW;
    s.production.produced = judged.reduce((sum, g) => sum + g.blocks, 0);
    s.production.skipped = judged.reduce((sum, g) => sum + WINDOW - g.blocks, 0);
  } catch {
    // public RPC unavailable: keep the collector's groups as sent
  }
  // Without our own count, never show impossible collector numbers: more blocks than turns means a stale epoch.
  const p: Partial<Snapshot["production"]> = s.production;
  if ((p.produced ?? 0) + (p.skipped ?? 0) > (p.leaderSlotsSoFar ?? 0)) {
    delete p.produced;
    delete p.skipped;
  }
}

const json = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "content-type": "application/json", ...headers } });

export async function GET() {
  if (cache && Date.now() - cache.at < 1000) return json(cache.body, { "x-cache": "hit" });
  try {
    const r = await fetch(`${COLLECTOR_URL}/snapshot.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
      headers: COLLECTOR_KEY ? { "x-vyra-key": COLLECTOR_KEY } : undefined,
    });
    if (!r.ok) throw new Error(String(r.status));
    const { meta, ...rest } = (await r.json()) as Raw;
    // Only what the page renders goes to the browser: raw collector errors carry paths and PIDs.
    const errors = meta?.errors ?? {};
    const snap: Partial<Snapshot> = {
      ...rest,
      meta: {
        startedAt: meta?.startedAt ?? 0,
        updatedAt: meta?.updatedAt ?? 0,
        errorCount: Object.keys(errors).length,
        rpcDown: isRpcDown(errors),
      },
    };
    await resolveGroups(snap);
    cache = { at: Date.now(), body: JSON.stringify(snap) };
    return json(cache.body);
  } catch {
    if (cache) return json(cache.body, { "x-stale": String(Date.now() - cache.at) });
    return Response.json({ error: "collector unreachable" }, { status: 503 });
  }
}
