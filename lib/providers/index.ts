import { InstagramProvider } from "./instagram";
import { AppError } from "../errors";
export function provider(platform: string) {
  if (platform === "Instagram") return new InstagramProvider();
  throw new AppError("Plataforma inválida.");
}
