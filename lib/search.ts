import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { score, engagement } from "./metrics";
export const FilterSchema = z.object({
  query: z.string().max(300).default(""),
  platform: z.enum(["Todos", "Instagram"]).default("Todos"),
  origin: z.enum(["Todos", "Meu perfil", "Concorrentes"]).default("Todos"),
  profileId: z.string().optional(),
  competitorId: z.string().optional(),
  format: z.string().max(40).optional(),
  theme: z.string().max(100).optional(),
  funnel: z.string().max(20).optional(),
  days: z.coerce.number().int().min(0).max(3650).default(0),
  minViews: z.coerce.number().min(0).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  minEngagement: z.coerce.number().min(0).optional(),
  minLikes: z.coerce.number().min(0).optional(),
  minComments: z.coerce.number().min(0).optional(),
  status: z.string().max(40).optional(),
  sort: z
    .enum(["recentes", "views", "likes", "comments", "engagement", "score"])
    .default("recentes"),
});
export function interpret(query: string) {
  const q = query.toLocaleLowerCase("pt-BR");
  const result: Record<string, unknown> = { query };
  if (q.includes("reel")) result.format = "Reel";
  if (q.includes("concorrente")) result.origin = "Concorrentes";
  const days = q.match(/(?:últimos|ultimos)\s+(\d+)\s+dias/);
  if (days) result.days = Number(days[1]);
  const views = q.match(
    /(?:mais de|>|acima de)\s*([\d.,]+)\s*(mil|k)?\s*(?:views|visualiza)/,
  );
  if (views)
    result.minViews =
      Number(views[1].replace(",", ".")) * (views[2] ? 1000 : 1);
  const scoreMatch = q.match(/score\s*(?:>|acima de)\s*(\d+)/);
  if (scoreMatch) result.minScore = Number(scoreMatch[1]);
  if (q.includes("topo de funil")) result.funnel = "Topo";
  if (
    q.includes("melhor") ||
    q.includes("performaram bem") ||
    q.includes("maior engajamento")
  )
    result.sort = q.includes("engajamento") ? "engagement" : "score";
  return result;
}
export async function search(raw: unknown) {
  const f = FilterSchema.parse(raw);
  const q = f.query;
  const terms = q
    .toLowerCase()
    .replace(
      /(?:últimos|ultimos)\s+\d+\s+dias|(?:mais de|>|acima de)\s*[\d.,]+\s*(?:mil|k)?\s*(?:views|visualizações)|score\s*(?:>|acima de)\s*\d+|topo de funil/g,
      "",
    )
    .split(/\s+/)
    .filter(
      (x) =>
        x.length > 2 &&
        ![
          "conteúdos",
          "conteudos",
          "posts",
          "publicações",
          "publicacoes",
          "sobre",
          "melhores",
          "reels",
          "concorrentes",
          "dos",
          "das",
          "que",
          "tiveram",
          "com",
          "maior",
          "engajamento",
          "meus",
          "mostre",
          "performaram",
          "bem",
        ].includes(x),
    );
  const textQuery = terms.join(" ");
  let matching: string[] | undefined;
  if (textQuery) {
    const rows = await db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT "id" FROM "SocialPost" WHERE to_tsvector('portuguese',"caption" || ' ' || coalesce("classification"::text,'')) @@ websearch_to_tsquery('portuguese',${textQuery}) OR "caption" ILIKE ${"%" + textQuery + "%"} OR similarity("caption",${textQuery})>0.15 LIMIT 1000`,
    );
    matching = rows.map((x) => x.id);
  }
  const posts = await db.socialPost.findMany({
    where: {
      ...(matching ? { id: { in: matching } } : {}),
      ...(f.platform !== "Todos" ? { platform: f.platform } : {}),
      ...(f.profileId ? { profileId: f.profileId } : {}),
      ...(f.days
        ? { publishedAt: { gte: new Date(Date.now() - f.days * 86400000) } }
        : {}),
      ...(f.format ? { format: f.format } : {}),
      profile: {
        ...(f.origin === "Meu perfil"
          ? { competitorId: null }
          : f.origin === "Concorrentes"
            ? { competitorId: { not: null } }
            : {}),
        ...(f.competitorId ? { competitorId: f.competitorId } : {}),
        OR: [{ competitorId: null }, { competitor: { archivedAt: null } }],
      },
    },
    include: {
      profile: true,
      snapshots: { orderBy: { capturedAt: "desc" }, take: 2 },
    },
    orderBy: { publishedAt: "desc" },
    take: 1000,
  });
  const baselines = await db.socialPost.findMany({
    where: { profileId: { in: [...new Set(posts.map((p) => p.profileId))] } },
    include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });
  const decorated = posts
    .map((p) => ({
      ...p,
      metrics: p.snapshots[0] || {},
      score: score(
        p.snapshots[0] || {},
        baselines
          .filter((b) => b.profileId === p.profileId && b.id !== p.id)
          .map((b) => b.snapshots[0] || {}),
      ),
      engagement: engagement(p.snapshots[0] || {}),
    }))
    .filter((p) => {
      const c = p.classification as any;
      return (
        (!f.theme || c?.tema?.toLowerCase().includes(f.theme.toLowerCase())) &&
        (!f.funnel || c?.funil === f.funnel) &&
        (["Views", "Likes", "Comments", "Score", "Engagement"] as const).every(
          (k) => {
            const min = f[`min${k}`];
            const value =
              k === "Score"
                ? p.score
                : k === "Engagement"
                  ? p.engagement
                  : (p.metrics as any)[k.toLowerCase()];
            return min == null || (value != null && value >= min);
          },
        )
      );
    });
  if (f.sort !== "recentes")
    decorated.sort((a, b) => {
      const key = f.sort;
      const value = (p: typeof a) =>
        key === "score"
          ? p.score
          : key === "engagement"
            ? p.engagement
            : (p.metrics as any)[key];
      return (value(b) ?? -Infinity) - (value(a) ?? -Infinity);
    });
  const ideas = await db.contentIdea.findMany({
    where: {
      ...(f.status ? { status: f.status } : {}),
      ...(textQuery
        ? {
            OR: [
              { title: { contains: textQuery, mode: "insensitive" } },
              {
                scripts: {
                  some: {
                    content: { path: ["titulo"], string_contains: textQuery },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: { scripts: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  const analyses = textQuery
    ? await db.$queryRaw<
        any[]
      >`SELECT * FROM "AIAnalysis" WHERE to_tsvector('portuguese',"result"::text) @@ websearch_to_tsquery('portuguese',${textQuery}) ORDER BY "createdAt" DESC LIMIT 40`
    : [];
  return {
    posts: decorated.slice(0, 200),
    ideas,
    analyses,
    filters: f,
    total: decorated.length,
    limited: posts.length === 1000,
  };
}
