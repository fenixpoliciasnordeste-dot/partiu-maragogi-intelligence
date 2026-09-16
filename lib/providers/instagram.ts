import { db } from "../db";
import { AppError } from "../errors";
import { SocialDataProvider, Profile, Post, n, emptyMetrics } from "./types";

const actorId = "apify~instagram-profile-scraper";

export class InstagramProvider implements SocialDataProvider {
  platform = "Instagram" as const;
  private cache = new Map<string, any>();

  private username(value?: string) {
    const username = value || process.env.INSTAGRAM_USERNAME;
    if (!username || !/^[a-zA-Z0-9._]{1,30}$/.test(username))
      throw new AppError(value ? "Username do Instagram inválido." : "Configure INSTAGRAM_USERNAME no Render.", 409);
    return username.toLowerCase();
  }

  private async scrape(value?: string) {
    const username = this.username(value);
    if (this.cache.has(username)) return this.cache.get(username);
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new AppError("Configure APIFY_TOKEN no Render.", 409);
    const dailyLimit = Math.min(30, Math.max(1, Number(process.env.APIFY_DAILY_RUN_LIMIT || 6)));
    const used = await db.aPIRequestLog.count({
      where: { provider: "Apify", operation: "instagram-profile", timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    if (used >= dailyLimit)
      throw new AppError(`Limite diário da Apify atingido (${dailyLimit} perfis). Tente novamente amanhã ou ajuste APIFY_DAILY_RUN_LIMIT.`, 429, "APIFY_DAILY_LIMIT");

    const url = new URL(`https://api.apify.com/v2/actors/${actorId}/run-sync-get-dataset-items`);
    url.searchParams.set("timeout", "285");
    url.searchParams.set("clean", "true");
    const started = Date.now();
    let status = "ERROR";
    let errorCode: string | undefined;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ usernames: [username], includeAboutSection: false }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(290000),
      });
      const body = await response.json();
      if (!response.ok) {
        errorCode = String(body?.error?.type || response.status).slice(0, 80);
        throw new AppError("A Apify não conseguiu coletar o perfil. Verifique o token e o saldo da conta.", 502, errorCode);
      }
      const profile = Array.isArray(body) ? body[0] : null;
      if (!profile?.username) throw new AppError("A Apify não retornou dados para este perfil público.", 404, "EMPTY_PROFILE");
      status = "SUCCESS";
      this.cache.set(username, profile);
      return profile;
    } catch (error) {
      if (error instanceof AppError) throw error;
      errorCode = "NETWORK_ERROR";
      throw new AppError("A Apify demorou demais ou está temporariamente indisponível.", 502, errorCode);
    } finally {
      await db.aPIRequestLog.create({ data: { provider: "Apify", endpoint: `/actors/${actorId}`, operation: "instagram-profile", status, errorCode, responseTime: Date.now() - started } });
      await db.integration.upsert({
        where: { provider: "Apify" },
        create: { provider: "Apify", status, lastCall: new Date(), lastSuccess: status === "SUCCESS" ? new Date() : null, lastError: errorCode },
        update: { status, lastCall: new Date(), ...(status === "SUCCESS" ? { lastSuccess: new Date(), lastError: null } : { lastError: errorCode }) },
      });
    }
  }

  private normalizeProfile(profile: any): Profile {
    return {
      externalId: String(profile.id || profile.pk || profile.username),
      name: profile.fullName || profile.full_name || profile.username,
      username: profile.username,
      avatar: profile.profilePicUrlHD || profile.profilePicUrl || profile.profile_pic_url_hd || profile.profile_pic_url || null,
      url: profile.url || `https://www.instagram.com/${profile.username}/`,
      followers: n(profile.followersCount ?? profile.followers),
      following: n(profile.followsCount ?? profile.following),
      postsCount: n(profile.postsCount ?? profile.post_count),
    };
  }

  private normalizePost(post: any): Post {
    const shortcode = post.shortCode || post.shortcode || post.code;
    const kind = String(post.type || post.productType || post.media_type || "").toLowerCase();
    return {
      externalId: String(post.id || post.pk || shortcode),
      caption: post.caption || post.edge_media_to_caption?.edges?.[0]?.node?.text || "",
      thumbnail: post.displayUrl || post.thumbnailUrl || post.thumbnail_src || post.display_url || null,
      url: post.url || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : null),
      format: kind.includes("sidecar") || kind.includes("carousel") ? "Carrossel" : kind.includes("video") || kind.includes("reel") ? "Reel" : "Post",
      duration: n(post.videoDuration ?? post.video_duration),
      publishedAt: new Date(post.timestamp || post.takenAtTimestamp || (post.taken_at ? post.taken_at * 1000 : Date.now())),
      metrics: { ...emptyMetrics(), likes: n(post.likesCount ?? post.likes ?? post.like_count), comments: n(post.commentsCount ?? post.comments ?? post.comment_count), views: n(post.videoViewCount ?? post.videoPlayCount ?? post.video_view_count) },
    };
  }

  async getProfile() { return this.normalizeProfile(await this.scrape()); }
  async connect() { return this.validateConnection(); }
  async validateConnection() { return this.getProfile(); }
  async getProfileMetrics() { return { views: null, reach: null, engagement: null, metricWindow: "public" }; }
  async getPosts() { const p = await this.scrape(); return (p.latestPosts || p.latest_posts || []).slice(0, 12).map((x: any) => this.normalizePost(x)); }
  async getPostMetrics() { return emptyMetrics(); }
  async getCompetitor(username: string) { return this.normalizeProfile(await this.scrape(username)); }
  async getCompetitorPosts(username: string) { const p = await this.scrape(username); return (p.latestPosts || p.latest_posts || []).slice(0, 12).map((x: any) => this.normalizePost(x)); }
}
