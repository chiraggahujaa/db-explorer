import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { RootAuthGuard } from "@/features/auth/components/RootAuthGuard";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DB Explorer",
  description: "A modern database exploration and management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // TODO: Find better solution - overflow-hidden prevents body scroll when chat tool calls expand
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full overflow-hidden`}
      >
        <QueryProvider>
          <RootAuthGuard>
            {children}
          </RootAuthGuard>
          <Toaster position="bottom-right" />
        </QueryProvider>
      </body>
    </html>
  );
}