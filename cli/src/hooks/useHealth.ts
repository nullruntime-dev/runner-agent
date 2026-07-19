import { useState, useEffect, useCallback } from 'react';
import type { ApiClient } from '../api/client.js';
import type { HealthResponse, SkillsResponse } from '../api/types.js';

interface UseHealthResult {
  health: HealthResponse | null;
  skills: SkillsResponse | null;
  connected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHealth(client: ApiClient, pollInterval = 30000): UseHealthResult {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [skills, setSkills] = useState<SkillsResponse | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [healthData, skillsData] = await Promise.all([
        client.health(),
        client.skills().catch(() => null),
      ]);
      setHealth(healthData);
      setSkills(skillsData);
      setConnected(true);
      setError(null);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [client]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { health, skills, connected, error, refresh };
}
