import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fincheck Pro",
  description: "Gestao financeira mensal, compartilhavel e simples.",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
