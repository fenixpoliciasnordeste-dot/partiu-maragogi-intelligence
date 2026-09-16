export type M = {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  views?: number | null;
  reach?: number | null;
  audience?: number | null;
};
export function engagement(m: M) {
  if (m.likes == null || m.comments == null || !m.audience) return null;
  return ((m.likes + m.comments) / m.audience) * 100;
}
// Relative percentile against same-profile historical posts. Missing axes excluded.
export function score(m: M, history: M[]) {
  if (history.length < 5) return null;
  const axes = ["views", "likes", "comments", "shares", "saves"] as const;
  const ranks: number[] = [];
  for (const k of axes) {
    const values = history
      .map((x) => x[k])
      .filter((x): x is number => x != null);
    if (m[k] != null && values.length >= 5)
      ranks.push(
        values.reduce(
          (sum, v) => sum + (v < m[k]! ? 1 : v === m[k] ? 0.5 : 0),
          0,
        ) / values.length,
      );
  }
  const e = engagement(m),
    es = history.map(engagement).filter((x): x is number => x != null);
  if (e != null && es.length >= 5)
    ranks.push(
      es.reduce((s, v) => s + (v < e ? 1 : v === e ? 0.5 : 0), 0) / es.length,
    );
  return ranks.length
    ? Math.round((100 * ranks.reduce((s, x) => s + x, 0)) / ranks.length)
    : null;
}
export function growth(
  snapshots: { followers: number | null; capturedAt: Date | string }[],
  days: number,
  now = new Date(),
) {
  const ordered = snapshots
    .filter((s) => s.followers != null)
    .sort((a, b) => +new Date(a.capturedAt) - +new Date(b.capturedAt));
  const last = ordered.at(-1);
  if (!last || +now - +new Date(last.capturedAt) > 172800000) return null;
  const target = +now - days * 86400000;
  const base = ordered.filter((s) => +new Date(s.capturedAt) <= target).at(-1);
  if (!base || target - +new Date(base.capturedAt) > 172800000) return null;
  const absolute = last.followers! - base.followers!;
  return {
    absolute,
    percent: base.followers ? (absolute / base.followers) * 100 : null,
    from: base.capturedAt,
    to: last.capturedAt,
  };
}
export function confidence(
  posts: { metrics: M; publishedAt: string | Date }[],
) {
  const count = posts.length;
  if (!count) return "BAIXA";
  const complete =
    posts.filter((p) => p.metrics.likes != null && p.metrics.comments != null)
      .length / count;
  const dates = posts.map((p) => +new Date(p.publishedAt));
  const days = (Math.max(...dates) - Math.min(...dates)) / 86400000;
  return count >= 30 && complete >= 0.8 && days >= 30
    ? "ALTA"
    : count >= 10 && complete >= 0.6 && days >= 7
      ? "MÉDIA"
      : "BAIXA";
}
export function velocity(
  a: { views: number | null; capturedAt: Date | string },
  b: { views: number | null; capturedAt: Date | string },
) {
  const hours = (+new Date(b.capturedAt) - +new Date(a.capturedAt)) / 3600000;
  return a.views != null && b.views != null && hours > 0
    ? (b.views - a.views) / hours
    : null;
}
