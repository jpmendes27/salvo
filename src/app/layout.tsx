import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./auth-provider";

export const metadata: Metadata = {
  title: "Fincheck Pro",
  description: "Gestao financeira mensal, compartilhavel e simples.",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
