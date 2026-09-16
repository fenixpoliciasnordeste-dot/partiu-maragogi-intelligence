import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Partiu Maragogi Intelligence",
  description:
    "Métricas, concorrentes e inteligência de conteúdo para a Partiu Maragogi.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
