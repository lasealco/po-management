import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavWithGrants } from "@/components/app-nav-with-grants";
import { DemoUserSwitcher } from "@/components/demo-user-switcher";
import "./globals.css";

/** Nav and demo bar read cookies; avoid caching a shell without grants. */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PO Management",
  description: "Purchase order workflow playground",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50">
        <AppNavWithGrants />
        <DemoUserSwitcher />
        {children}
      </body>
    </html>
  );
}
