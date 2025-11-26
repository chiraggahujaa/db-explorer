"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

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
}

interface ConnectionExplorerContextType {
  selectedSchema: string | undefined;
  selectedTables: Set<string>;
  config: QueryConfig;
  chatConfig: ChatConfig;
  setSelectedSchema: (schema: string | undefined) => void;
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
};

interface ConnectionExplorerProviderProps {
  children: ReactNode;
}

export function ConnectionExplorerProvider({ children }: ConnectionExplorerProviderProps) {
  const [selectedSchema, setSelectedSchemaState] = useState<string | undefined>();
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<QueryConfig>(defaultConfig);
  const [chatConfig, setChatConfig] = useState<ChatConfig>(defaultChatConfig);

  const setSelectedSchema = useCallback((schema: string | undefined) => {
    setSelectedSchemaState(schema);
    // Clear selected tables when schema changes
    setSelectedTables(new Set());
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
    setChatConfig((prev) => ({ ...prev, ...updates }));
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


