// The collector contract, matching collector v2's /snapshot.json as served (desgin.md §12, wired per §27).
// The page reads it as `Feed`: any field may be missing or null and renders as a placeholder.

export type GroupState = "produced" | "partial" | "skipped" | "unverified" | "upcoming";

export type SlotState = "pending" | "processed" | "confirmed" | "rooted" | "finalized" | "skipped";

type Timing = { count: number; meanUs: number; stddevUs: number; maxUs: number };

export type Snapshot = {
  // The collector sends raw `errors` (paths, PIDs, messages); /api/snapshot reduces them to these two
  // before anything reaches the browser.
  meta: { startedAt: number; updatedAt: number; errorCount: number; rpcDown: boolean };
  node: {
    identity: string;
    vote: string;
    cluster: string;
    client: string;
    version: string;
    shredVersion: number;
    stakeSol: number;
    clusterSharePct: number;
    commission: number;
    identitySol: number;
    voteSol: number;
    uptimeSec: number;
    restarts: number;
    caughtUpAfterSec: number | null; // null when already healthy at collector start
    startup: { loadingLedgerSec: number; ledgerReplaySec: number; otherSec: number };
  };
  health: {
    slotsBehind: number;
    catchingUp: boolean;
    repairedPct: number;
    snapshotAgoSec: number | null;
  };
  voting: {
    lastVoteSlot: number; // network's view; moves with certificates, not liveness (§23)
    tip: number;
    creditsEarned: number;
    creditsPerSol: number; // credits are stake-weighted post-Alpenglow; compare per SOL only
    creditsPossible: number; // best validator's credits PER SOL
  };
  production: {
    nextLeaderSlot: number;
    nextLeaderSec: number;
    nextLeaderAt: number; // unix seconds
    leaderSlots: number; // whole epoch, getLeaderSchedule
    leaderSlotsSoFar: number; // elapsed, getBlockProduction
    produced: number;
    skipped: number;
    // one per 4-slot leader turn; firstSlot and blocks are added by /api/snapshot from the SlotHistory sysvar
    groups: { slotIndex: number; state: GroupState; firstSlot: number; blocks: number }[];
    skipByEpoch: { epoch: number; pct: number }[];
  };
  slots: {
    slotTimeMs: number;
    peakMs: number;
    recent: { slot: number; ms: number; state: SlotState; ours: boolean }[];
    finalized: number;
    root: number; // bursty under Alpenglow: never alarm on it or anything derived from it
    confirmed: number;
    voted: number;
    processed: number;
    highest: number;
    blockHeight: number;
  };
  epoch: {
    epoch: number;
    secondsLeft: number;
    slotIndex: number;
    slotsInEpoch: number;
    credits: number;
    creditsMedianPerSol: number;
    creditsPctOfMedian: number;
    clusterSkipPct: number;
    // creditsPctOfBest is still served but compares raw, stake-weighted credits: never read it
  };
  cluster: {
    activeStake: number;
    delinquentStake: number;
    voting: number;
    validators: number;
    delinquent: number;
    rpcNodes: number;
  };
  versions: { version: string; validators: number; stake: number; ours: boolean }[]; // gossip nodes until the stake join
  txs: {
    tps: number; // cluster-wide, getRecentPerformanceSamples
    nonVoteTps: number;
    peak: number; // highest 60-second bucket
    samples: { slot: number; tps: number; nonVoteTps: number }[]; // 60-second buckets, not seconds
  };
  network: {
    inMBs: number;
    outMBs: number;
    inAvg: number;
    inPeak: number;
    outAvg: number;
    outPeak: number;
    gossipMBs: number | null;
    rcvbufErrors: number; // since boot
    rcvbufErrorsMin: number;
    rxDropsMin: number;
    noPortsMin: number;
    inErrors: number;
    xdp: {
      zeroCopy: boolean;
      driver: string;
      device: string; // NIC model
      kernel: string;
      dropped: number; // num_shreds_dropped_xdp_full
      shreds: number;
      addrsFailed: number;
    };
    turbine: { root: number; l1: number; l2: number; l3: number; nodes: number; shreds: number };
    sockets: { port: number; queuedBytes: number; dropsMin: number; dropsTotal: number }[];
  };
  replay: {
    // all ms per slot, mean over the last 256 slots
    wallMs: number; // replay_total_elapsed
    computeMs: number; // execute_us + load_us + store_us
    cpuMs: number;
    threadMs: number;
    worstMs: number;
    pctOfSlot: number; // wallMs over slot time: includes waiting for shreds
    txPerSlot: number;
    entriesPerSlot: number;
    shredsPerSlot: number;
    confirmationUs: number; // confirmation_time_us: NOT a compute span, shown for reference only
    spans: { verify: number; disk: number; complete: number };
    verifying: { poh: number; sigs: number };
    exec: { programs: number; loadAccounts: number; store: number; loadPrograms: number; checkTxs: number; blockLimits: number };
  };
  votor: {
    votorSlot: number;
    replaySlot: number;
    slotGap: number;
    // event_handler_slot_tracking over `trackedSlots`. MICROSECONDS from slot start. Each percentile is over
    // non-zero samples only; *Samples says how many, so a low count means a thin percentile.
    trackedSlots: number;
    firstShredP50: number | null;
    firstShredSamples: number;
    parentReadyP50: number | null;
    parentReadyP99: number | null;
    parentReadySamples: number;
    notarizeP50: number | null;
    notarizeP99: number | null;
    notarizeSamples: number;
    finalizedP50: number | null;
    finalizedSamples: number;
    fastFinalizationPct: number;
    peersConnected: number; // connections_peak: a peak, not a live count
    connectFailed: number;
    connectFailedNoAddress: number;
    connectionLost: number;
    datagramsSent: number; // lifetime counter
    votesPerSec: number; // rate of datagramsSent: votes leaving the box
    datagramsReceived: number;
    uniquePeersPeak: number;
    ingressDropped: number;
    transportAgoSec: number;
    eventLagUs: number;
    certs: { exist: number; incoming: number; incomingVotes: number };
  };
  votes: ({ kind: string } & Timing)[]; // consensus_vote_metrics, backfilled at epoch rollover; may be empty
  leaders: ({ leader: string } & Timing)[]; // consensus_block_hash_seen_metrics; may be empty
  shreds: {
    slot: number;
    turbine: number; // derived
    repaired: number;
    recovered: number;
    fillMs: number;
    state: "published" | "nothing" | "skipped";
  }[];
  caches: {
    program: { hits: number; misses: number; evictions: number; entries: number; hitPct: number | null };
    accounts: { fromReadCache: number; fromWriteCache: number; fromIndexStorage: number; hitPct: number; cacheGB: number; accounts: number };
    rocks: { cf: string; gb: number; compactionsPending: number; compactionsRunning: number; writeStopped: number; bgErrors: number }[];
  };
  machine: {
    cores: number;
    load: number[];
    threads: number;
    running: number;
    cpu: { user: number; system: number; iowait: number };
    memTotalGB: number;
    memUsedGB: number;
    availableGB: number;
    pageCacheGB: number;
    rssGB: number;
    mounts: { name: string; path: string; usedPct: number; freeGB: number }[];
    disks: { device: string; role: string; busyPct: number; waitMs: number; iops: number; readB: number; writeB: number }[];
    snapshot: { slot: number; tookSec: number; behind: number };
  };
  threads: { name: string; count: number; pinned: string; pct: number; waitPct: number; spark: number[] }[];
};

type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type Feed = DeepPartial<Snapshot>;
