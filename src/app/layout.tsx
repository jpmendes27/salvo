import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./auth-provider";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export const metadata: Metadata = {
  title: "Fincheck Pro · Controle financeiro",
  description: "Importe o PDF do banco, veja para onde seu dinheiro foi e planeje o próximo mês — sem planilha, sem surpresa no fechamento.",
  manifest: "/manifest.json",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23c8f564'/><text x='50%25' y='72%25' font-family='sans-serif' font-weight='700' font-size='20' fill='%23111410' text-anchor='middle'>F</text></svg>"
  },
  openGraph: {
    title: "Fincheck Pro · Controle financeiro",
    description: "Importe o PDF do banco, veja para onde seu dinheiro foi e planeje o próximo mês — sem planilha, sem surpresa no fechamento.",
    url: "https://jpmendes.com/fincheck-pro",
    type: "website",
    images: [{ url: "https://jpmendes.com/fincheck-pro/og.png" }]
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://jpmendes.com/fincheck-pro/og.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
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
