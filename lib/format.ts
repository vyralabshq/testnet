// Every formatter takes a possibly-missing value and renders "—" for it.
type N = number | null | undefined;

export const DASH = "—";

export const has = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const num = (v: N, digits = 0) =>
  has(v) ? v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : DASH;

export const pct = (part: N, whole: N) => (has(part) && has(whole) && whole ? (part / whole) * 100 : undefined);

export const compact = (v: N) =>
  has(v) ? v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 }) : DASH;

export const dur = (sec: N) => {
  if (!has(sec)) return DASH;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
};

export const bytes = (b: N) => {
  if (!has(b)) return DASH;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (b >= 1000 && i < units.length - 1) {
    b /= 1000;
    i++;
  }
  return `${i ? num(b, b < 10 ? 1 : 0) : b} ${units[i]}`;
};

export const ms = (us: N) => (has(us) ? num(us / 1000, 1) : DASH);

export const plural = (n: N, word: string) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;

export const short = (key?: string) => (key ? `${key.slice(0, 6)}…${key.slice(-6)}` : DASH);

export const sum = (xs: (number | undefined)[] = []) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
