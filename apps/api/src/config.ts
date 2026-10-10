export interface Config {
  port: number;
  host: string;
  staticDir?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    staticDir: env.STATIC_DIR || undefined,
  };
}
