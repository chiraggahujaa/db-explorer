"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export interface QueryConfig {
  readOnly: boolean;
  dryRun: boolean; // Query return not execute it
  maxRows?: number;
  timeout?: number;
}

export interface ChatConfig {
  readOnlyMode: boolean;
  showSQLGeneration: boolean;
  autoExecuteQueries: boolean;
  resultRowLimit: number;
  incognitoMode: boolean;
}

interface ConnectionExplorerContextType {
  selectedSchema: string | undefined;
  selectedTables: Set<string>;
  config: QueryConfig;
  chatConfig: ChatConfig;
  setSelectedSchema: (schema: string | undefined) => void;
  setSelectedTables: (tables: string[]) => void;
  toggleTable: (tableName: string) => void;
  clearSelectedTables: () => void;
  updateConfig: (updates: Partial<QueryConfig>) => void;
  updateChatConfig: (updates: Partial<ChatConfig>) => void;
  reset: () => void;
}

const ConnectionExplorerContext = createContext<ConnectionExplorerContextType | undefined>(
  undefined
);

const defaultConfig: QueryConfig = {
  readOnly: false,
  dryRun: false,
  maxRows: undefined,
  timeout: undefined,
};

const defaultChatConfig: ChatConfig = {
  readOnlyMode: false,
  showSQLGeneration: false,
  autoExecuteQueries: true,
  resultRowLimit: 100,
  incognitoMode: false,
};

interface ConnectionExplorerProviderProps {
  children: ReactNode;
}

export function ConnectionExplorerProvider({ children }: ConnectionExplorerProviderProps) {
  const [selectedSchema, setSelectedSchemaState] = useState<string | undefined>();
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<QueryConfig>(defaultConfig);

  const [chatConfig, setChatConfig] = useState<ChatConfig>(() => {
    if (typeof window !== 'undefined') {
      const savedIncognito = localStorage.getItem('incognito-mode');
      if (savedIncognito !== null) {
        return {
          ...defaultChatConfig,
          incognitoMode: savedIncognito === 'true'
        };
      }
    }
    return defaultChatConfig;
  });

  const setSelectedSchema = useCallback((schema: string | undefined) => {
    setSelectedSchemaState(schema);
    setSelectedTables(new Set());
  }, []);

  const setSelectedTablesCallback = useCallback((tables: string[]) => {
    setSelectedTables(new Set(tables));
  }, []);

  const toggleTable = useCallback((tableName: string) => {
    setSelectedTables((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  }, []);

  const clearSelectedTables = useCallback(() => {
    setSelectedTables(new Set());
  }, []);

  const updateConfig = useCallback((updates: Partial<QueryConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateChatConfig = useCallback((updates: Partial<ChatConfig>) => {
    setChatConfig((prev) => {
      const newConfig = { ...prev, ...updates };

      if (typeof window !== 'undefined' && 'incognitoMode' in updates) {
        localStorage.setItem('incognito-mode', String(newConfig.incognitoMode));
      }

      return newConfig;
    });
  }, []);

  useEffect(() => {
    const handleIncognitoChange = (event: CustomEvent<{ enabled: boolean }>) => {
      setChatConfig((prev) => ({ ...prev, incognitoMode: event.detail.enabled }));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('incognito-mode-change' as any, handleIncognitoChange as any);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('incognito-mode-change' as any, handleIncognitoChange as any);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setSelectedSchemaState(undefined);
    setSelectedTables(new Set());
    setConfig(defaultConfig);
    setChatConfig(defaultChatConfig);
  }, []);

  const value: ConnectionExplorerContextType = {
    selectedSchema,
    selectedTables,
    config,
    chatConfig,
    setSelectedSchema,
    setSelectedTables: setSelectedTablesCallback,
    toggleTable,
    clearSelectedTables,
    updateConfig,
    updateChatConfig,
    reset,
  };

  return (
    <ConnectionExplorerContext.Provider value={value}>
      {children}
    </ConnectionExplorerContext.Provider>
  );
}

export function useConnectionExplorer() {
  const context = useContext(ConnectionExplorerContext);
  if (context === undefined) {
    throw new Error(
      "useConnectionExplorer must be used within a ConnectionExplorerProvider"
    );
  }
  return context;
}


