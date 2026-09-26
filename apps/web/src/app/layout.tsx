import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SwRegister } from "@/components/layout/sw-register";
import { appUrl } from "@/lib/utils";
import { BRAND } from "@/lib/company";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: `${BRAND.name} — construction materials, suppliers and quotes`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Find suppliers, compare offers, request quotes and manage construction-material procurement in one place.",
  applicationName: BRAND.name,
  openGraph: { type: "website", siteName: BRAND.name },
  twitter: { card: "summary_large_image" },
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
