"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { has, num, short } from "@/lib/format";
import { levelText, type Level } from "@/lib/health";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const rule: Record<Level, string> = { ok: "", warn: "border-l-2 border-l-warn", crit: "border-l-2 border-l-down" };

// Level 2 shell: icon, title and one-line summary always visible, level-3 detail behind a fold.
export function Section(props: {
  title: string;
  hint?: string; // plain-English meaning, for readers who are not validator operators
  stale?: boolean; // fed by the running validator, which has stopped reporting: values are frozen
  summary: ReactNode;
  aside?: ReactNode;
  level?: Level;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  const { title, hint, summary, aside, level = "ok", stale, detail, children } = props;
  const [open, setOpen] = useState(false);
  return (
    <Card className={cn("gap-0 border bg-surface p-0 ring-0", rule[level])}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-4">
        <h2 className="font-heading text-lg font-semibold text-ink">{hint ? <Term tip={hint}>{title}</Term> : title}</h2>
        <p className={cn("text-sm", level === "ok" ? "text-ink-3" : levelText[level])}>{summary}</p>
        {stale ? (
          <span className="ml-auto rounded-md border border-warn/40 px-2 py-0.5 text-xs text-warn">last known · node not reporting</span>
        ) : (
          aside && <span className="ml-auto font-mono text-xs text-ink-4">{aside}</span>
        )}
      </header>
      {children && <div className={cn("space-y-6 p-5", stale && "opacity-40")}>{children}</div>}
      {detail && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-1 border-t px-5 py-3 font-mono text-xs text-ink-4 hover:text-ink-2">
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
            {open ? "fold" : "details"}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 px-5 pb-5">{detail}</CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}

const colClass = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 6: "md:grid-cols-3 xl:grid-cols-6" };

// Columns split by hairline dividers: stacked on mobile, side by side from md.
export function Cols({ n, children, className }: { n: keyof typeof colClass; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid divide-y md:divide-y-0 md:[&>*]:border-l md:[&>*]:px-6 md:[&>*:first-child]:border-l-0 md:[&>*:first-child]:pl-0 [&>*]:py-3 md:[&>*]:py-0",
        colClass[n],
        className
      )}
    >
      {children}
    </div>
  );
}

// Hero tile: label, figure, sub line.
export function Tile(props: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-3">{props.label}</div>
      <div className="font-mono text-lg text-ink">{props.value}</div>
      {props.sub && <div className="text-sm text-ink-3">{props.sub}</div>}
    </div>
  );
}

// Dotted-underline label that explains itself on hover.
export function Term({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-ink-4 decoration-dotted underline-offset-4">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

export function Stat(props: { value: ReactNode; unit?: string; label: ReactNode; className?: string; level?: Level }) {
  return (
    <div>
      <div className={cn("font-mono text-xl", props.level ? levelText[props.level] : "text-ink", props.className)}>
        {props.value}
        {props.unit && <span className="ml-1.5 text-xs text-ink-3">{props.unit}</span>}
      </div>
      <div className="mt-1 text-xs text-ink-3">{props.label}</div>
    </div>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <div className="mb-3 text-xs text-ink-3">{children}</div>;
}

export type Segment = { label: string; value?: number; color: string };

// Proportional bar with an inline legend carrying value and share.
// One number per legend entry: the value, or with `share` its percentage of the whole.
export function StackBar(props: { segments: Segment[]; unit?: string; cols?: number; digits?: number; share?: boolean }) {
  const { segments, unit = "ms", cols = 3, digits = 1, share } = props;
  const total = segments.reduce((a, s) => a + (s.value ?? 0), 0);
  return (
    <div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-elevated">
        {segments.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${total ? ((s.value ?? 0) / total) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="mt-3 grid gap-x-8 gap-y-2 text-sm" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-xs", s.color)} />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="font-mono text-ink">
              {share ? `${total && has(s.value) ? Math.round((s.value / total) * 100) : 0}%` : `${num(s.value, digits)} ${unit}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Spark({ values = [], max = 100 }: { values?: (number | undefined)[]; max?: number }) {
  return (
    <div className="flex h-4 items-end gap-px">
      {values.map((v, i) => (
        <div key={i} className="w-1.5 bg-ink-4" style={{ height: `${Math.max(8, ((v ?? 0) / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function Facts({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-4 text-xs lg:grid-cols-4", className)}>
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-ink-3">{k}</dt>
          <dd className="mt-1 font-mono text-sm text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Pubkey chip: shortened, full key on hover, click to copy.
export function CopyKey({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={copy}
      disabled={!value}
      title={value && `copy ${label} ${value}`}
      className="group inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs text-ink-2 hover:border-ink-4 hover:text-ink"
    >
      <span className="text-ink-4">{label}</span>
      {short(value)}
      {copied ? <Check className="size-3 text-ok" /> : <Copy className="size-3 text-ink-4 group-hover:text-ink-2" />}
    </button>
  );
}

// Placeholder for a panel whose datapoint the collector does not send yet.
export function Pending({ source }: { source: string }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-3 font-mono text-xs text-ink-4">
      waiting on <span className="text-ink-3">{source}</span> from the collector
    </p>
  );
}
