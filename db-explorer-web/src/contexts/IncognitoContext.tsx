"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface IncognitoContextType {
  incognitoMode: boolean;
  setIncognitoMode: (enabled: boolean) => void;
  toggleIncognito: () => void;
}

const IncognitoContext = createContext<IncognitoContextType | undefined>(undefined);

const STORAGE_KEY = "db-explorer-incognito-mode";

interface IncognitoProviderProps {
  children: ReactNode;
}

export function IncognitoProvider({ children }: IncognitoProviderProps) {
  const [incognitoMode, setIncognitoModeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIncognitoModeState(stored === "true");
    }
  }, []);

  const setIncognitoMode = (enabled: boolean) => {
    setIncognitoModeState(enabled);
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    }
  };

  const toggleIncognito = () => {
    setIncognitoMode(!incognitoMode);
  };

  const value: IncognitoContextType = {
    incognitoMode,
    setIncognitoMode,
    toggleIncognito,
  };

  return (
    <IncognitoContext.Provider value={value}>
      {children}
    </IncognitoContext.Provider>
  );
}

export function useIncognito() {
  const context = useContext(IncognitoContext);
  if (context === undefined) {
    throw new Error("useIncognito must be used within an IncognitoProvider");
  }
  return context;
}
