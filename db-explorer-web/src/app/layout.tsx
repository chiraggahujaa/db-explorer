import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { IncognitoProvider } from "@/contexts/IncognitoContext";
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
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <ThemeProvider>
          <IncognitoProvider>
            <QueryProvider>
              <RootAuthGuard>
                {children}
              </RootAuthGuard>
              <Toaster position="bottom-right" />
            </QueryProvider>
          </IncognitoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}