import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { StoragePersist } from "@/components/StoragePersist";

export const metadata: Metadata = {
  title: "Sortie — Lead Capture Mission Control",
  description: "Mobile-first lead capture at events for SafelyYou",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sortie",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4a5d23",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegistrar />
        <InstallPrompt />
        <StoragePersist />
      </body>
    </html>
  );
}
