import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Editor IA",
  description: "Editor local de imagens com IA, camadas e anotações."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
