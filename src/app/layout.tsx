import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://app.starsconnect.co.uk"),
  title: { default: "STARS Connect", template: "%s · STARS Connect" },
  description: "Attendance and Register Management for STARS Day Service",
  applicationName: "STARS Connect",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "STARS Connect",
    description: "Attendance and Register Management for STARS Day Service",
    siteName: "STARS Connect",
    type: "website",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "STARS Connect" },
};

export const viewport: Viewport = {
  themeColor: "#54205d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-GB"><body><ServiceWorkerRegistration />{children}</body></html>;
}
