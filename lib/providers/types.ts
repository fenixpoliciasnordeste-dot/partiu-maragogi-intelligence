export type Platform = "Instagram";
export type Metrics = {
  likes: number | null;
  comments: number | null;
  views: number | null;
  reach: number | null;
  shares: number | null;
  saves: number | null;
};
export type Profile = {
  externalId: string;
  name: string;
  username: string;
  avatar: string | null;
  url: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
};
export type Post = {
  externalId: string;
  caption: string;
  thumbnail: string | null;
  url: string | null;
  format: string;
  duration: number | null;
  publishedAt: Date;
  metrics: Metrics;
};
export type ProfileMetrics = {
  views: number | null;
  reach: number | null;
  engagement: number | null;
  metricWindow: string;
};
export interface SocialDataProvider {
  platform: Platform;
  connect(): Promise<Profile>;
  validateConnection(): Promise<Profile>;
  getProfile(): Promise<Profile>;
  getProfileMetrics(): Promise<ProfileMetrics>;
  getPosts(): Promise<Post[]>;
  getPostMetrics(id: string): Promise<Metrics>;
  getCompetitor(username: string): Promise<Profile>;
  getCompetitorPosts(username: string): Promise<Post[]>;
}
export const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
export const emptyMetrics = (): Metrics => ({
  likes: null,
  comments: null,
  views: null,
  reach: null,
  shares: null,
  saves: null,
});
