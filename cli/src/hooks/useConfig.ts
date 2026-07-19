import { useState, useMemo } from 'react';
import { getConfig, setConfig as saveConfig, type GriphookConfig } from '../config/config.js';
import { ApiClient } from '../api/client.js';

interface UseConfigResult {
  config: GriphookConfig;
  client: ApiClient;
  updateConfig: (updates: Partial<GriphookConfig>) => void;
}

export function useConfig(overrides?: Partial<GriphookConfig>): UseConfigResult {
  const [config, setConfig] = useState<GriphookConfig>(() => {
    const base = getConfig();
    return { ...base, ...overrides };
  });

  const client = useMemo(() => {
    return new ApiClient({
      baseUrl: config.url,
      token: config.token,
    });
  }, [config.url, config.token]);

  const updateConfig = (updates: Partial<GriphookConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    saveConfig(updates);
  };

  return { config, client, updateConfig };
}
