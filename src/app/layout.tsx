import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { BottomNav } from "@/components/BottomNav";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBFAF7",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://proofline.ubuntuledger.org"),
  title: {
    default: "Ward Proof-Line · Ubuntu Ledger — Civic Evidence System",
    template: "%s · Ward Proof-Line",
  },
  description:
    "A public evidence system for ward-level infrastructure accountability. Citizens verify repairs via feature phone. Contractors cannot close their own tickets.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Ward Proof-Line · Ubuntu Ledger",
    title: "Ward Proof-Line — Civic Evidence System",
    description:
      "Public evidence system for ward-level infrastructure accountability in Kenya & Ethiopia. Proof of repair via feature phone; zero contractor self-close.",
    images: [
      {
        url: "/icon.svg",
        width: 1200,
        height: 630,
        alt: "Ward Proof-Line Civic Evidence Schematic",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Ward Proof-Line · Ubuntu Ledger",
    description:
      "A contractor cannot close their own ticket. Public infrastructure accountability verified by citizens.",
    images: ["/icon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased font-sans flex flex-col min-h-screen bg-[var(--paper)] text-[var(--ink)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--ink)] focus:text-[var(--paper)] focus:font-mono focus:text-xs focus:font-semibold focus:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--state-open)] focus:ring-offset-2 focus:ring-offset-[var(--paper)]"
        >
          Skip to main content
        </a>
        <SiteNav />
        <main id="main-content" tabIndex={-1} className="focus:outline-none flex-1 pb-20 md:pb-8">
          {children}
        </main>
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  );
}
