import { bytes, has, num, sum } from "@/lib/format";
import type { Level } from "@/lib/health";
import type { Feed } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cols, Facts, Pending, Section, StackBar, Sub, Term, Tile } from "./primitives";

export function Network({ n, level }: { n?: Feed["network"]; level: Level }) {
  const sockets = n?.sockets ?? [];
  const x = n?.xdp;
  const t = n?.turbine;
  const unattributed = has(n?.outMBs) && has(n?.gossipMBs) ? Math.max(0, n.outMBs - n.gossipMBs) : undefined;
  const dropsMin = sum(sockets.map((k) => k?.dropsMin));
  const dropsTotal = sum(sockets.map((k) => k?.dropsTotal));
  const share = (v = 0, of: number) => (of ? ` · ${Math.round((v / of) * 100)}%` : "");
  const mode = x ? (x.zeroCopy ? "zero-copy" : "copy") : "—";

  return (
    <Section
      title="Network"
      level={level}
      summary={`${num(n?.inMBs, 1)} MB/s in · ${num(n?.outMBs, 1)} MB/s out · XDP ${mode} · ${num(x?.dropped)} dropped · ${num(n?.rcvbufErrorsMin)} rcvbuf errors this min`}
      detail={
        <div>
          <Sub note="since startup">Socket ingest, dropped by the kernel per UDP port</Sub>
          {sockets.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>port</TableHead>
                  <TableHead className="text-right">queued</TableHead>
                  <TableHead className="text-right">last min</TableHead>
                  <TableHead className="text-right">total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono">
                {sockets.map((k) => (
                  <TableRow key={k?.port} className={k?.dropsMin ? "text-warn" : undefined}>
                    <TableCell className="text-ink">{k?.port}</TableCell>
                    <TableCell className="text-right">{bytes(k?.queuedBytes)}</TableCell>
                    <TableCell className="text-right">
                      {num(k?.dropsMin)}
                      {share(k?.dropsMin, dropsMin)}
                    </TableCell>
                    <TableCell className="text-right">
                      {num(k?.dropsTotal)}
                      {share(k?.dropsTotal, dropsTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Pending source="network.sockets (/proc/net/udp)" />
          )}
          <p className="mt-3 font-mono text-xs text-ink-4">
            net-stats-validator: rcvbuf errors {num(n?.rcvbufErrors)} since boot, {num(n?.rcvbufErrorsMin)} this minute · rx drops{" "}
            {num(n?.rxDropsMin)} · no port {num(n?.noPortsMin)} this minute. NIC rx_discards sit below this and the kernel never
            sees them.
          </p>
        </div>
      }
    >
      <Cols n={3}>
        <Tile label="Host in" value={`${num(n?.inMBs, 1)} MB/s`} sub={`avg ${num(n?.inAvg, 1)} · peak since start ${num(n?.inPeak, 1)}`} />
        <Tile
          label="Host out"
          value={`${num(n?.outMBs, 1)} MB/s`}
          sub={
            <>
              avg {num(n?.outAvg, 1)} · peak since start {num(n?.outPeak, 1)} ·{" "}
              <Term tip="Shreds leave over XDP, which reports no bytes, so most of Out is unattributed. Repair has no byte counter on this box.">
                gossip {num(n?.gossipMBs, 1)} · unattributed {num(unattributed, 1)}
              </Term>
            </>
          }
        />
        <div>
          <Sub note={`5 min · ${num(t?.shreds)} shreds from ${num(t?.nodes)} nodes`}>
            <Term tip="Shreds received per turbine layer, retransmit-stage-slot-stats">Turbine intake</Term>
          </Sub>
          {t ? (
            <StackBar
              unit=""
              cols={2}
              digits={0}
              segments={[
                { label: "root", value: t.root, color: "bg-primary" },
                { label: "1st layer", value: t.l1, color: "bg-orange-bright" },
                { label: "2nd layer", value: t.l2, color: "bg-info" },
                { label: "3rd layer", value: t.l3, color: "bg-sub" },
              ]}
            />
          ) : (
            <Pending source="retransmit-stage-slot-stats" />
          )}
        </div>
      </Cols>
      <div className="border-t pt-5">
        <Sub note="xdp-network-config · retransmit-stage">XDP transmit</Sub>
        <Facts
          className="sm:grid-cols-3 lg:grid-cols-6"
          items={[
            ["mode", x ? (x.zeroCopy ? "zero-copy" : "copy · not zero-copy") : "—"],
            ["driver", x?.driver ?? "—"],
            ["device", <span key="n" className="text-xs">{x?.device ?? "—"}</span>],
            ["kernel", x?.kernel ?? "—"],
            ["shreds sent · dropped", <span key="d" className={x?.dropped ? "text-down" : undefined}>{num(x?.shreds)} · {num(x?.dropped)}</span>],
            ["addresses failed", num(x?.addrsFailed)],
          ]}
        />
      </div>
    </Section>
  );
}
