/**
 * Data Access Configuration Store
 * Zustand store for managing data access settings (read-only, privacy, row limits)
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface DataAccessConfig {
  readOnly: boolean;
  privacyMode: boolean;
  rowLimit: number;
  customRowLimit?: number;
}

interface DataAccessState {
  // Configuration per connection
  configs: Map<string, DataAccessConfig>;

  // Actions
  getConfig: (connectionId: string) => DataAccessConfig;
  setReadOnly: (connectionId: string, readOnly: boolean) => void;
  setPrivacyMode: (connectionId: string, privacyMode: boolean) => void;
  setRowLimit: (connectionId: string, rowLimit: number) => void;
  setCustomRowLimit: (connectionId: string, customRowLimit: number) => void;
  resetConfig: (connectionId: string) => void;
}

const DEFAULT_CONFIG: DataAccessConfig = {
  readOnly: false,
  privacyMode: false,
  rowLimit: 100,
};

export const useDataAccessStore = create<DataAccessState>()(
  devtools(
    persist(
      (set, get) => ({
        configs: new Map(),

        getConfig: (connectionId: string) => {
          const config = get().configs.get(connectionId);
          return config || DEFAULT_CONFIG;
        },

        setReadOnly: (connectionId: string, readOnly: boolean) =>
          set((state) => {
            const configs = new Map(state.configs);
            const currentConfig = configs.get(connectionId) || DEFAULT_CONFIG;
            configs.set(connectionId, { ...currentConfig, readOnly });
            return { configs };
          }),

        setPrivacyMode: (connectionId: string, privacyMode: boolean) =>
          set((state) => {
            const configs = new Map(state.configs);
            const currentConfig = configs.get(connectionId) || DEFAULT_CONFIG;
            configs.set(connectionId, { ...currentConfig, privacyMode });
            return { configs };
          }),

        setRowLimit: (connectionId: string, rowLimit: number) =>
          set((state) => {
            const configs = new Map(state.configs);
            const currentConfig = configs.get(connectionId) || DEFAULT_CONFIG;
            configs.set(connectionId, { ...currentConfig, rowLimit });
            return { configs };
          }),

        setCustomRowLimit: (connectionId: string, customRowLimit: number) =>
          set((state) => {
            const configs = new Map(state.configs);
            const currentConfig = configs.get(connectionId) || DEFAULT_CONFIG;
            configs.set(connectionId, { ...currentConfig, customRowLimit, rowLimit: customRowLimit });
            return { configs };
          }),

        resetConfig: (connectionId: string) =>
          set((state) => {
            const configs = new Map(state.configs);
            configs.delete(connectionId);
            return { configs };
          }),
      }),
      {
        name: 'data-access-config',
        // Custom serialization for Map
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
                configs: new Map(Object.entries(state.configs || {})),
              },
            };
          },
          setItem: (name, newValue) => {
            const str = JSON.stringify({
              state: {
                ...newValue.state,
                configs: Object.fromEntries(newValue.state.configs),
              },
            });
            localStorage.setItem(name, str);
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    { name: 'data-access-store' }
  )
);
