import { db } from "./db";
export async function postHistory() {
  return db.$queryRaw<
    {
      day: string;
      platform: string;
      likes: number | null;
      comments: number | null;
      engagement: number | null;
    }[]
  >`WITH latest AS (SELECT DISTINCT ON (s."postId",(s."capturedAt" AT TIME ZONE 'America/Maceio')::date) s.*,p."platform" FROM "PostSnapshot" s JOIN "SocialPost" p ON p."id"=s."postId" JOIN "SocialProfile" f ON f."id"=p."profileId" WHERE f."competitorId" IS NULL ORDER BY s."postId",(s."capturedAt" AT TIME ZONE 'America/Maceio')::date,s."capturedAt" DESC) SELECT (("capturedAt" AT TIME ZONE 'America/Maceio')::date)::text as day, platform,CASE WHEN count(likes)=count(*) THEN sum(likes) END as likes,CASE WHEN count(comments)=count(*) THEN sum(comments) END as comments,avg(CASE WHEN audience>0 AND likes IS NOT NULL AND comments IS NOT NULL THEN (likes+comments)/audience*100 END) as engagement FROM latest GROUP BY 1,2 ORDER BY 1`;
}
