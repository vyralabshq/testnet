import { bytes, num, sum } from "@/lib/format";
import type { Level } from "@/lib/health";
import type { Feed } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cols, Facts, Pending, Section, StackBar, Sub, Term, Tile } from "./primitives";

export function Network({ n, level }: { n?: Feed["network"]; level: Level }) {
  const sockets = n?.sockets ?? [];
  const x = n?.xdp;
  const t = n?.turbine;
  const dropsMin = sum(sockets.map((k) => k?.dropsMin));
  const dropsTotal = sum(sockets.map((k) => k?.dropsTotal));
  const share = (v = 0, of: number) => (of ? ` · ${Math.round((v / of) * 100)}%` : "");

  return (
    <Section
      title="Network"
      hint="Data flowing in and out of the machine. Blocks arrive as small pieces called shreds, passed down a tree of validators (Turbine); we forward them over XDP, a fast kernel path."
      level={level}
      summary={`${num(n?.inMBs, 1)} MB/s in · ${num(n?.outMBs, 1)} MB/s out · ${num(x?.dropped)} shreds dropped · ${num(n?.rcvbufErrorsMin)} socket drops this minute`}
      detail={
        <>
          <div>
            <Sub>XDP transmit</Sub>
            <Facts
              items={[
                ["mode", x ? (x.zeroCopy ? "zero-copy" : "copy, not zero-copy") : "—"],
                ["driver", x?.driver ?? "—"],
                ["kernel", x?.kernel ?? "—"],
                ["device", <span key="n" className="text-xs">{x?.device ?? "—"}</span>],
              ]}
            />
          </div>
          <div>
            <Sub>Socket ingest, dropped by the kernel per UDP port</Sub>
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
        </>
      }
    >
      <Cols n={3}>
        <Tile label="Coming in" value={`${num(n?.inMBs, 1)} MB/s`} />
        <Tile
          label="Going out"
          value={`${num(n?.outMBs, 1)} MB/s`}
        />
        <Tile
          label="Shreds forwarded"
          value={num(x?.shreds)}
          sub={<span className={x?.dropped ? "text-down" : undefined}>{num(x?.dropped)} dropped · {num(x?.addrsFailed)} addresses failed</span>}
        />
      </Cols>
      <div className="border-t pt-5">
        <Sub>
          <Term tip="Blocks reach us as shreds passed down a tree of validators. This is which layer of that tree we received from.">
            Where our shreds come from
          </Term>
        </Sub>
        {t ? (
          <StackBar
            share
            cols={4}
            segments={[
              { label: "leader", value: t.root, color: "bg-primary" },
              { label: "layer 1", value: t.l1, color: "bg-orange-bright" },
              { label: "layer 2", value: t.l2, color: "bg-info" },
              { label: "layer 3", value: t.l3, color: "bg-sub" },
            ]}
          />
        ) : (
          <Pending source="retransmit-stage-slot-stats" />
        )}
      </div>
    </Section>
  );
}
