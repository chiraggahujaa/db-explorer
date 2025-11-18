"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

/**
 * Theme provider component that wraps the application with next-themes
 * Provides dark mode support with automatic browser storage persistence
 *
 * Features:
 * - Automatic localStorage persistence
 * - System preference detection
 * - No flash of unstyled content (FOUC)
 * - Tab synchronization
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
