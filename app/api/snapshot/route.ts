// Proxy to the collector (desgin.md §18.2). 1 s cache so viewers never multiply load on the box;
// on failure, serve the last good body with its age so the page shows stale data, not a blank.
export const dynamic = "force-dynamic";

const COLLECTOR_URL = process.env.COLLECTOR_URL ?? "https://node.vyralabs.fun";

let cache: { at: number; body: string } | null = null;

const json = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "content-type": "application/json", ...headers } });

export async function GET() {
  if (cache && Date.now() - cache.at < 1000) return json(cache.body, { "x-cache": "hit" });
  try {
    const r = await fetch(`${COLLECTOR_URL}/snapshot.json`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(String(r.status));
    cache = { at: Date.now(), body: await r.text() };
    return json(cache.body);
  } catch {
    if (cache) return json(cache.body, { "x-stale": String(Date.now() - cache.at) });
    return Response.json({ error: "collector unreachable" }, { status: 503 });
  }
}
