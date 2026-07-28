import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  metadataBase: new URL("https://forma-weight-coach-nima.vercel.app"),
  title: "Forma — AI Weight Coach",
  description: "Snap a food photo, check the calorie estimate, and save your meal in seconds.",
  applicationName: "Forma",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Forma",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/forma-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/forma-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/forma-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Forma — AI Weight Coach",
    description: "Snap your meal. Check the estimate. Done.",
    url: "/",
    siteName: "Forma",
    type: "website",
    images: [{ url: "/og-photo.png", width: 1200, height: 630, alt: "Forma photo-first food tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Forma — AI Weight Coach",
    description: "Snap your meal. Check the estimate. Done.",
    images: ["/og-photo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#30463e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${manrope.variable}`}>{children}</body>
    </html>
  );
}
