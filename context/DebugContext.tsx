/**
 * DebugContext & Visual Error Banner System
 * Required for CTE308 evaluation criteria: reactive debug state & dismissible mobile error banners.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DebugBannerType = 'error' | 'warning' | 'info' | 'success';

export interface DebugBannerMessage {
  id: string;
  type: DebugBannerType;
  title: string;
  message: string;
  timestamp: string;
}

interface DebugContextType {
  banner: DebugBannerMessage | null;
  showDebugBanner: (type: DebugBannerType, title: string, message: string) => void;
  dismissBanner: () => void;
  logs: string[];
  addLog: (log: string) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<DebugBannerMessage | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const showDebugBanner = (type: DebugBannerType, title: string, message: string) => {
    console.log(`[Dwello-DebugBanner]: Displaying ${type.toUpperCase()} banner: "${title}" - ${message}`);
    setBanner({
      id: `debug-${Date.now()}`,
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  const dismissBanner = () => {
    console.log('[Dwello-DebugBanner]: Dismissed active banner.');
    setBanner(null);
  };

  const addLog = (log: string) => {
    setLogs((prev) => [log, ...prev.slice(0, 50)]);
  };

  return (
    <DebugContext.Provider
      value={{
        banner,
        showDebugBanner,
        dismissBanner,
        logs,
        addLog,
      }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
}

