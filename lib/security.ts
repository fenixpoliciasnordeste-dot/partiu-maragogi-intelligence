import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { AppError } from "./errors";
export function equal(a: string, b: string) {
  const x = createHash("sha256").update(a).digest(),
    y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}
function key() {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k || !/^[a-f0-9]{64}$/i.test(k))
    throw new AppError("Configure a chave de criptografia de tokens.", 503);
  return Buffer.from(k, "hex");
}
export function encrypt(text: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  return [
    iv.toString("hex"),
    c.update(text, "utf8", "hex") + c.final("hex"),
    c.getAuthTag().toString("hex"),
  ].join(".");
}
export function decrypt(text: string) {
  const [iv, data, tag] = text.split(".");
  const c = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  c.setAuthTag(Buffer.from(tag, "hex"));
  return c.update(data, "hex", "utf8") + c.final("utf8");
}
function sessionKey() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw new AppError(
      "Configure SESSION_SECRET com pelo menos 32 caracteres.",
      503,
    );
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}
export async function login(email: string, password: string) {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16)
    throw new AppError(
      "Configure uma senha administrativa com pelo menos 16 caracteres.",
      503,
    );
  if (
    !equal(email, process.env.ADMIN_EMAIL || "") ||
    !equal(password, process.env.ADMIN_PASSWORD)
  )
    throw new AppError("E-mail ou senha incorretos.", 401);
  const user = await db.user.upsert({
    where: { email },
    create: { email },
    update: {},
  });
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(sessionKey());
  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 43200,
  });
  return user;
}
export async function requireUser() {
  try {
    const token = (await cookies()).get("session")?.value;
    if (!token) throw new Error();
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
    });
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error();
    return user;
  } catch {
    throw new AppError("Entre para continuar.", 401);
  }
}
export function checkOrigin(req: Request) {
  if (!["GET", "HEAD"].includes(req.method)) {
    const expected = new URL(process.env.APP_URL || "http://localhost:3000")
      .origin;
    if (req.headers.get("origin") !== expected)
      throw new AppError("Origem da requisição inválida.", 403);
  }
}
export async function rateLimit(key: string, limit = 60, seconds = 60) {
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","resetAt") VALUES (${key},1,NOW()+${seconds}*INTERVAL '1 second') ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."resetAt"<NOW() THEN 1 ELSE "RateLimit"."count"+1 END,"resetAt"=CASE WHEN "RateLimit"."resetAt"<NOW() THEN NOW()+${seconds}*INTERVAL '1 second' ELSE "RateLimit"."resetAt" END RETURNING "count"`;
  if (rows[0].count > limit)
    throw new AppError("Muitas solicitações. Aguarde um minuto.", 429);
}
