-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiration" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastValidation" TIMESTAMP(3),
    "lastSync" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "url" TEXT,
    "competitorId" TEXT,
    "lastSync" TIMESTAMP(3),

    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "followers" DOUBLE PRECISION,
    "following" DOUBLE PRECISION,
    "postsCount" DOUBLE PRECISION,
    "views" DOUBLE PRECISION,
    "reach" DOUBLE PRECISION,
    "engagement" DOUBLE PRECISION,
    "platform" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricWindow" TEXT NOT NULL DEFAULT 'lifetime',

    CONSTRAINT "ProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "thumbnail" TEXT,
    "url" TEXT,
    "format" TEXT NOT NULL,
    "duration" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "classification" JSONB,
    "classificationHash" TEXT,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostSnapshot" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likes" DOUBLE PRECISION,
    "comments" DOUBLE PRECISION,
    "views" DOUBLE PRECISION,
    "reach" DOUBLE PRECISION,
    "shares" DOUBLE PRECISION,
    "saves" DOUBLE PRECISION,
    "audience" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Nova',
    "source" TEXT NOT NULL DEFAULT 'Gemini',
    "competitorId" TEXT,
    "aiAnalysisId" TEXT,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentScript" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastCall" TIMESTAMP(3),
    "lastSuccess" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "items" INTEGER NOT NULL DEFAULT 0,
    "progress" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIRequestLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseTime" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "reservedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "errorCode" TEXT,

    CONSTRAINT "APIRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorialProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorialProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLimit" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "dailyUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyRequests" INTEGER NOT NULL DEFAULT 0,
    "monthlyRequests" INTEGER NOT NULL DEFAULT 0,
    "inputRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alertPercent" INTEGER NOT NULL DEFAULT 75,

    CONSTRAINT "AIUsageLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightSource" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_platform_key" ON "SocialAccount"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "SocialProfile_competitorId_key" ON "SocialProfile"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialProfile_platform_externalId_key" ON "SocialProfile"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_platform_username_key" ON "Competitor"("platform", "username");

-- CreateIndex
CREATE INDEX "ProfileSnapshot_profileId_capturedAt_idx" ON "ProfileSnapshot"("profileId", "capturedAt");

-- CreateIndex
CREATE INDEX "SocialPost_profileId_publishedAt_idx" ON "SocialPost"("profileId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_platform_externalId_key" ON "SocialPost"("platform", "externalId");

-- CreateIndex
CREATE INDEX "PostSnapshot_postId_capturedAt_idx" ON "PostSnapshot"("postId", "capturedAt");

-- CreateIndex
CREATE INDEX "AIAnalysis_kind_subjectId_inputHash_idx" ON "AIAnalysis"("kind", "subjectId", "inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "ContentIdea_titleKey_key" ON "ContentIdea"("titleKey");

-- CreateIndex
CREATE INDEX "SyncJob_status_createdAt_idx" ON "SyncJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "APIRequestLog_provider_timestamp_idx" ON "APIRequestLog"("provider", "timestamp");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_createdAt_idx" ON "SearchHistory"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TutorialProgress_userId_page_key" ON "TutorialProgress"("userId", "page");

-- CreateIndex
CREATE UNIQUE INDEX "InsightSource_analysisId_postId_key" ON "InsightSource"("analysisId", "postId");

-- AddForeignKey
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SocialProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SocialProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSnapshot" ADD CONSTRAINT "PostSnapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_aiAnalysisId_fkey" FOREIGN KEY ("aiAnalysisId") REFERENCES "AIAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentScript" ADD CONSTRAINT "ContentScript_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ContentIdea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialProgress" ADD CONSTRAINT "TutorialProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightSource" ADD CONSTRAINT "InsightSource_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightSource" ADD CONSTRAINT "InsightSource_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "post_caption_trgm" ON "SocialPost" USING GIN ("caption" gin_trgm_ops);
CREATE INDEX "post_fts" ON "SocialPost" USING GIN (to_tsvector('portuguese',"caption" || ' ' || coalesce("classification"::text,'')));
CREATE INDEX "analysis_fts" ON "AIAnalysis" USING GIN (to_tsvector('portuguese',"result"::text));

-- Enforce append-only history at database level.
CREATE FUNCTION prevent_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical snapshots are append-only'; END;
$$;
CREATE TRIGGER profile_snapshot_immutable BEFORE UPDATE OR DELETE ON "ProfileSnapshot" FOR EACH ROW EXECUTE FUNCTION prevent_snapshot_mutation();
CREATE TRIGGER post_snapshot_immutable BEFORE UPDATE OR DELETE ON "PostSnapshot" FOR EACH ROW EXECUTE FUNCTION prevent_snapshot_mutation();
