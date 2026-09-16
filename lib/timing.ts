export function timing(
  posts: { publishedAt: string | Date; score: number | null }[],
) {
  const eligible = posts.filter((p) => p.score != null);
  if (eligible.length < 20) return { day: null, hour: null };
  const times = eligible.map((p) => ({
    score: p.score!,
    day: new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone: "America/Maceio",
    }).format(new Date(p.publishedAt)),
    hour: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "America/Maceio",
    }).format(new Date(p.publishedAt)),
  }));
  const best = (key: "day" | "hour", minimum: number) =>
    Object.entries(Object.groupBy(times, (p) => p[key]))
      .map(([name, items]) => ({
        name,
        items: items!,
        average: items!.reduce((s, p) => s + p.score, 0) / items!.length,
      }))
      .filter((g) => g.items.length >= minimum)
      .sort((a, b) => b.average - a.average)[0]?.name || null;
  return {
    day: best("day", 3),
    hour: eligible.length >= 30 ? best("hour", 3) : null,
  };
}
