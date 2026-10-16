import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PickleballWolves | Play sharper",
  description: "Organize your games, track your progress, and find your pack.",
  // Installed to an iPhone home screen, open full-screen like an app.
  appleWebApp: { capable: true, title: "Wolves", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0f1712",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
