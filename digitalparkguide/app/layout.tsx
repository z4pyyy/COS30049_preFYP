import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SFC Digital Training",
    template: "%s | SFC Digital Training",
  },
  description:
    "Sarawak Forestry Corporation's digital platform for guide and ranger training certifications.",
  // A3.3 — Open Graph tags for search discoverability
  openGraph: {
    title: "SFC Digital Training",
    description:
      "Access advanced forestry training modules, certification tracks, and incident reporting for Sarawak Forestry Commission sentinels.",
    type: "website",
    locale: "en_MY",
    siteName: "SFC Digital Training",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFC Digital Training",
    description: "Guardians of Biodiversity — SFC's digital training platform.",
  },
  keywords: [
    "Sarawak Forestry Corporation",
    "SFC training",
    "ranger certification",
    "guide training Sarawak",
    "forestry digital platform",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="light">
      <head>
        {/* Material Symbols Outlined — used by the SFC design system */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
