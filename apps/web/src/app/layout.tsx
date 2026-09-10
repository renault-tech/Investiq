import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Fonte dos números tabulares do design. Precisa ser carregada aqui: o
 * @theme inline do globals.css só a referencia por nome, e sem o next/font
 * a família cai no fallback sem nenhum aviso. */
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "InvestIQ",
  description: "Plataforma profissional de gestão de investimentos",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "InvestIQ",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#07080A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body
        className={`${instrumentSans.variable} ${geistMono.variable} ${ibmPlexMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
