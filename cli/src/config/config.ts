import Conf from 'conf';

export interface GriphookConfig {
  url: string;
  token: string;
  lastSessionId?: string;
}

const defaults: GriphookConfig = {
  url: 'http://localhost:8090',
  token: '1234',
};

const conf = new Conf<GriphookConfig>({
  projectName: 'griphook',
  defaults,
});

export function getConfig(): GriphookConfig {
  return {
    url: process.env.GRIPHOOK_URL || conf.get('url'),
    token: process.env.AGENT_TOKEN || conf.get('token'),
    lastSessionId: conf.get('lastSessionId'),
  };
}

export function setConfig(updates: Partial<GriphookConfig>): void {
  if (updates.url) conf.set('url', updates.url);
  if (updates.token) conf.set('token', updates.token);
  if (updates.lastSessionId) conf.set('lastSessionId', updates.lastSessionId);
}

export function getConfigPath(): string {
  return conf.path;
}
