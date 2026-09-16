import { db } from "./db";
import { provider } from "./providers";
import { safeError } from "./errors";
import { aiService, hash } from "./ai/service";
export async function enqueue(target = "all") {
  await db.syncJob.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: new Date(Date.now() - 3600000) },
    },
    data: {
      status: "ERROR",
      error: "Execução interrompida; nova coleta pode ser solicitada.",
      finishedAt: new Date(),
    },
  });
  const targets =
    target === "all"
      ? [
          "main:Instagram",
          ...(
            await db.competitor.findMany({
              where: { archivedAt: null },
              select: { id: true },
            })
          ).map((c) => "competitor:" + c.id),
        ]
      : [target];
  const jobs = [];
  for (const t of targets) {
    const job = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(908712)`;
      const prior = await tx.syncJob.findFirst({
        where: { target: t, status: { in: ["QUEUED", "RUNNING"] } },
      });
      return prior || tx.syncJob.create({ data: { target: t } });
    });
    jobs.push(job);
  }
  return jobs;
}
export async function processNext() {
  const jobs = await db.$queryRaw<
    { id: string; target: string }[]
  >`UPDATE "SyncJob" SET "status"='RUNNING',"startedAt"=NOW(),"progress"='Buscando perfil e publicações…' WHERE "id"=(SELECT "id" FROM "SyncJob" WHERE "status"='QUEUED' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING "id","target"`;
  const job = jobs[0];
  if (!job) return null;
  try {
    const [kind, id] = job.target.split(":");
    const competitor =
      kind === "competitor"
        ? await db.competitor.findUnique({ where: { id } })
        : null;
    if (kind === "competitor" && (!competitor || competitor.archivedAt))
      throw new Error("Archived target");
    const platform = competitor?.platform || id;
    const p = provider(platform);
    const profile = competitor
      ? await p.getCompetitor(competitor.username)
      : await p.getProfile();
    const stored = await db.socialProfile.upsert({
      where: {
        platform_externalId: { platform, externalId: profile.externalId },
      },
      create: {
        platform,
        externalId: profile.externalId,
        name: profile.name,
        username: profile.username,
        avatar: profile.avatar,
        url: profile.url,
        competitorId: competitor?.id,
      },
      update: {
        name: profile.name,
        username: profile.username,
        avatar: profile.avatar,
        url: profile.url,
      },
    });
    if ((stored.competitorId || null) !== (competitor?.id || null))
      throw new Error("Profile ownership conflict");
    const metrics = competitor
      ? {
          views: null,
          reach: null,
          engagement: null,
          metricWindow: "unavailable",
        }
      : await p.getProfileMetrics();
    await db.profileSnapshot.create({
      data: {
        profileId: stored.id,
        platform,
        followers: profile.followers,
        following: profile.following,
        postsCount: profile.postsCount,
        ...metrics,
      },
    });
    const posts = competitor
      ? await p.getCompetitorPosts(competitor.username)
      : await p.getPosts();
    let count = 0;
    for (const post of posts) {
      const { metrics, ...fields } = post;
      await db.$transaction(async (tx) => {
        const saved = await tx.socialPost.upsert({
          where: {
            platform_externalId: { platform, externalId: post.externalId },
          },
          create: { ...fields, platform, profileId: stored.id },
          update: fields,
        });
        await tx.postSnapshot.create({
          data: { postId: saved.id, ...metrics, audience: profile.followers },
        });
      });
      count++;
    }
    await db.socialProfile.update({
      where: { id: stored.id },
      data: { lastSync: new Date() },
    });
    if (competitor)
      await db.competitor.update({
        where: { id: competitor.id },
        data: { status: "SUCCESS", lastError: null },
      });
    else
      await db.socialAccount.upsert({
        where: { platform },
        create: {
          platform,
          externalId: profile.externalId,
          username: profile.username,
          status: "SUCCESS",
          lastSync: new Date(),
        },
        update: {
          username: profile.username,
          status: "SUCCESS",
          lastSync: new Date(),
          lastError: null,
        },
      });
    await db.syncJob.update({
      where: { id: job.id },
      data: {
        items: count,
        progress: `Coletadas ${count} publicações. Verificando classificações…`,
      },
    });
    let aiNote = "";
    if (process.env.GEMINI_API_KEY) {
      const pending = await db.socialPost.findMany({
        where: { profileId: stored.id },
        select: {
          id: true,
          caption: true,
          format: true,
          duration: true,
          classificationHash: true,
        },
        orderBy: { publishedAt: "desc" },
      });
      try {
        for (const post of pending
          .filter(
            (p) =>
              p.classificationHash !==
              hash({
                caption: p.caption,
                format: p.format,
                duration: p.duration,
              }),
          )
          .slice(0, 50))
          await aiService.classifyPost(post.id);
        if (competitor) await aiService.analyzeCompetitor(competitor.id);
        else await aiService.analyzeProfile(stored.id);
      } catch (e) {
        aiNote = ` Dados coletados; IA: ${safeError(e)}`;
      }
    }
    await db.syncJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        progress: `${count} publicações sincronizadas.${aiNote}`,
      },
    });
  } catch (e) {
    const message = safeError(e);
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "ERROR", error: message, finishedAt: new Date() },
    });
    const [kind, id] = job.target.split(":");
    if (kind === "competitor")
      await db.competitor.updateMany({
        where: { id },
        data: { status: "ERROR", lastError: message },
      });
    else
      await db.socialAccount.updateMany({
        where: { platform: id },
        data: { status: "ERROR", lastError: message },
      });
  }
  return job.id;
}
export async function drain() {
  await db.syncJob.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: new Date(Date.now() - 3600000) },
    },
    data: {
      status: "ERROR",
      error: "Execução interrompida. Solicite nova sincronização.",
      finishedAt: new Date(),
    },
  });
  while (await processNext()) {}
}
