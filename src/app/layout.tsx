import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./auth-provider";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export const metadata: Metadata = {
  title: "Salvô! · Controle financeiro",
  description: "Importe o PDF do banco, veja para onde seu dinheiro foi e planeje o próximo mês — sem planilha, sem surpresa no fechamento.",
  manifest: `${BASE}/manifest.json`,
  icons: {
    icon: [
      { url: `${BASE}/assets/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${BASE}/assets/favicon-16.png`, sizes: "16x16", type: "image/png" },
      { url: `${BASE}/icon.svg`, type: "image/svg+xml" },
    ],
    apple: [{ url: `${BASE}/assets/apple-touch-icon.png`, sizes: "180x180" }],
  },
  openGraph: {
    title: "Salvô! | O amigo rico que você nunca teve",
    description: "Um app que olha sua vida financeira do jeito que ela é, te fala a verdade na cara e te mostra um caminho real pra sair do sufoco. Sem planilha. Sem palavra difícil. Sem promessa furada.",
    url: "https://jpmendes.com/salvo",
    type: "website",
    images: [{ url: "https://jpmendes.com/salvo/og-v2.png" }]
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://jpmendes.com/salvo/og-v2.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-title" content="Salvô!" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#000000" />
        {GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`
              }}
            />
          </>
        )}
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
