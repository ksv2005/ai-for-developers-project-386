export interface Config {
  port: number;
  host: string;
  staticDir?: string;
  ownerTz: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const ownerTz = env.OWNER_TZ || 'Europe/Moscow';
  // Fail at startup, not on the first request, if the IANA name is invalid.
  new Intl.DateTimeFormat('en-US', { timeZone: ownerTz });

  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    staticDir: env.STATIC_DIR || undefined,
    ownerTz,
  };
}
