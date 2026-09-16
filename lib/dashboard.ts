import { postHistory } from "./analytics";
import { db } from "./db";
import { getLimits } from "./ai/budget";
import { growth, engagement, score } from "./metrics";
export async function dashboard() {
  const [
    profiles,
    competitors,
    ideas,
    analyses,
    jobs,
    integrations,
    accounts,
    logs,
    limits,
    financialEntries,
    apifyRunsToday,
  ] = await Promise.all([
    db.socialProfile.findMany({
      include: {
        snapshots: { orderBy: { capturedAt: "desc" } },
        posts: {
          orderBy: { publishedAt: "desc" },
          take: 1000,
          include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 2 } },
        },
      },
    }),
    db.competitor.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    db.contentIdea.findMany({
      include: {
        scripts: true,
        post: {
          include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.aIAnalysis.findMany({
      where: { kind: { in: ["profile", "competitor", "patterns"] } },
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        sources: { include: { post: { include: { profile: true } } } },
      },
    }),
    db.syncJob.findMany({ take: 40, orderBy: { createdAt: "desc" } }),
    db.integration.findMany(),
    db.socialAccount.findMany({
      select: {
        platform: true,
        externalId: true,
        username: true,
        tokenExpiration: true,
        scopes: true,
        status: true,
        lastValidation: true,
        lastSync: true,
        lastError: true,
      },
    }),
    db.aPIRequestLog.findMany({
      where: { timestamp: { gte: new Date(Date.now() - 32 * 86400000) } },
      orderBy: { timestamp: "desc" },
    }),
    getLimits(),
    db.financialEntry.findMany({
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 1000,
    }),
    db.aPIRequestLog.count({
      where: {
        provider: "Apify",
        operation: "instagram-profile",
        timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);
  return {
    postHistory: await postHistory(),
    profiles: profiles.map((p) => ({
      ...p,
      growth: {
        7: growth(p.snapshots, 7),
        30: growth(p.snapshots, 30),
        90: growth(p.snapshots, 90),
      },
      posts: p.posts.map((x) => ({
        ...x,
        metrics: x.snapshots[0] || {},
        engagement: engagement(x.snapshots[0] || {}),
        score: score(
          x.snapshots[0] || {},
          p.posts.filter((y) => y.id !== x.id).map((y) => y.snapshots[0] || {}),
        ),
      })),
    })),
    competitors,
    ideas,
    analyses,
    jobs,
    integrations,
    accounts,
    logs,
    limits,
    financialEntries,
    configuration: {
      Apify: !!(process.env.APIFY_TOKEN && process.env.INSTAGRAM_USERNAME),
      instagramUsername: process.env.INSTAGRAM_USERNAME || null,
      apifyDailyLimit: Math.min(
        30,
        Math.max(1, Number(process.env.APIFY_DAILY_RUN_LIMIT || 6)),
      ),
      apifyRunsToday,
      Gemini: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || null,
      database: true,
    },
  };
}
