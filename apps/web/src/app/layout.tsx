import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SwRegister } from "@/components/layout/sw-register";
import { appUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "Building Materials Network — suppliers, prices and quotes",
    template: "%s | Building Materials Network",
  },
  description:
    "Find suppliers, compare offers, request quotes and manage construction-material procurement in one place.",
  applicationName: "Building Materials Network",
  openGraph: { type: "website", siteName: "Building Materials Network" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#ea580c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <SwRegister />
      </body>
    </html>
  );
}
